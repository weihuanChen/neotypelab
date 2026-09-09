# NeotypeLab

NeotypeLab is a TanStack Start frontend deployed on Cloudflare Workers with
Convex as the canonical backend. The app exposes public prototype discovery
routes, OG/social cards, sitemap/robots output, and an authenticated terminal for
create and library workflows.

## Stack

- TanStack Start and TanStack Router in `src/`
- Cloudflare Workers deployment through `wrangler.jsonc`
- Convex queries, mutations, actions, and schema in `convex/`
- Clerk authentication bridged into Convex auth
- Tailwind/shadcn UI primitives shared from `components/`

## Local Development

1. Install dependencies.

   ```bash
   npm install
   ```

2. Create `.env.local` from `.env.example` and fill the Convex, Clerk, site URL,
   R2, and generation keys that your environment needs.

3. Start the TanStack frontend and Convex backend together.

   ```bash
   npm run dev
   ```

   `npm run dev` is an alias for the full-stack local workflow:

   ```bash
   npm run dev:full
   ```

   Useful targeted commands:

   ```bash
   npm run dev:frontend # frontend only; admin Convex data will stay pending
   npm run dev:backend
   ```

4. Seed the Convex deployment after first-time setup.

   ```bash
   npx convex run init:init
   ```

## Production Build

The default production path is TanStack Start on Cloudflare Workers.

```bash
npm run build
npm run deploy
```

## Migration Ownership

TanStack Start under `src/` is the only frontend runtime. The former Next App
Router fallback was removed after route parity and authenticated workflow checks
were completed.

See `docs/tanstack_migration_state.md` for the current migration ownership
rules.

## Cloudflare Environment

Set non-secret public values in the build environment. They are embedded into
both browser and Worker bundles, so changing them requires a rebuild:

- `VITE_SITE_URL`
- `VITE_CONVEX_URL`
- `VITE_CLERK_PUBLISHABLE_KEY`

Set secrets in Wrangler or the Cloudflare dashboard:

- `CLERK_SECRET_KEY`
- `CLERK_JWT_ISSUER_DOMAIN`
- `SUPER_ADMIN_EMAILS`
- `OPENAI_API_KEY`
- R2 credentials used by generation and asset stabilization
- `BILLING_WEBHOOK_SECRET` for normalized subscription event authentication

R2 storage is separated by access boundary in every environment:

- `R2_BUCKET_PUBLIC` stores public showcase and distribution assets.
- `R2_PUBLIC_BASE_URL` is the delivery origin for public object URLs.
- `R2_BUCKET_PRIVATE` stores user library assets.
- private objects are delivered with short-lived S3 presigned URLs; the application
  does not construct private URLs from a public base domain.
- `R2_END_POINT`, `R2_ACCESS_KEY_ID`, and `R2_SECRET_ACCESS_KEY` configure the
  shared S3-compatible connection.

Platform administrators can run a read/write/delete check against both buckets
from the Environment section in Admin Settings. The test objects use the
`_connectivity-tests/` prefix and are removed before the check finishes.

Showcase withdrawal can purge custom-domain cache entries immediately when
`CLOUDFLARE_CACHE_PURGE_ZONE_ID` and `CLOUDFLARE_CACHE_PURGE_TOKEN` are set in
the Convex environment. Use a dedicated token with only cache purge access.

Private asset retention is enforced by the Convex lifecycle cron. R2 provides
a delayed fallback only for the `temporary-originals/` prefix; never apply an
expiration rule to `library/` or `pinned-originals/`. Run retention backfills
before enabling lifecycle processing on an existing deployment.

Subscription providers integrate through the Convex HTTP endpoint
`/billing/webhook`. The provider adapter must send the normalized JSON contract
documented in `docs/neotypelab_technical_architecture.md`, plus
`x-neotypelab-timestamp` and `x-neotypelab-signature` headers. The signature is
`v1=` followed by the lowercase HMAC-SHA256 hex digest of
`<timestamp>.<raw-request-body>` using `BILLING_WEBHOOK_SECRET`.

Convex stays deployed separately:

```bash
npx convex deploy
```

## Verification

Before shipping a migration batch, run:

```bash
npm run build
npm run lint
npm run test:integration
npm run test:e2e:public
```

See `docs/testing.md` for the test architecture, authenticated Playwright setup,
and staging smoke-test boundary.

Suggested smoke checks:

- `/`
- `/showcase`
- `/t`
- `/t/create`
- `/t/library`
- `/robots.txt`
- `/sitemap.xml`

## Text and Image Provider Execution

Generation runs in **Convex actions**. Configure the following secrets in the
Convex deployment (a local `.env.local` or Cloudflare secret alone is insufficient):

- `OPEMAI_IMAGE_FOR_LLM_RELAY`: LLMRelay image key. Keep this exact spelling.
- `GEMINI_API_KEY_OFFCIAL`: official Gemini key. Keep this exact spelling.

Create/save profiles in **Admin Settings → Providers**:

| Setting | LLMRelay images | Gemini official text |
| --- | --- | --- |
| Provider | Custom OpenAI-compatible | Custom OpenAI-compatible |
| Capability | Image generation | Text generation |
| Request protocol | Images API / standard text | Images API / standard text |
| Base URL | `https://llmrelay.site/v1` | `https://generativelanguage.googleapis.com/v1beta/openai` |
| Model | `gpt-image-2` | `gemini-3.5-flash` (verified for this deployment) |
| Credential reference | `OPEMAI_IMAGE_FOR_LLM_RELAY` | `GEMINI_API_KEY_OFFCIAL` |
| Suggested timeout | 180 seconds | 90 seconds |

The Images API adapter also accepts a full `/images/generations` URL. For
`gpt-image-2`, defaults follow the [LLMRelay guide](https://llmrelay.site/guide/gpt-image-2):
`model`, `prompt`, `n: 1`, `size: "1024x1024"`, and `quality` (medium for ordinary
renders; high for the existing fidelity modes). Profile defaults/binding overrides
can change size and quality; model, prompt, and single-image count stay controlled
by the execution request. The returned `data[0].b64_json` or image URL feeds the
existing rendition and R2 storage pipeline. The key must belong to LLMRelay's
`gpt-image-2` token group. Image editing (`/images/edits`) is not implemented here.

The optional Chat Completions image protocol is for gateways that return images
in message content or `message.images`; **do not select it for LLMRelay gpt-image-2**.
It accepts image URL blocks, supported base64 image data URLs, and Markdown image
links. Unsupported response shapes fail explicitly.

`internal.generationNode.executeText` is the server-only text execution entry point.
It accepts `templateKind`, optional `promptTemplateId`, `systemPrompt`, `userPrompt`,
and optional `jsonOutput`. It resolves text-capable profiles from action routes,
then template bindings, then legacy priority, and applies the configured generation
retry/fallback policy. An explicitly configured route without any active text
provider fails rather than silently selecting an unrelated provider.

Gemini text uses its [official OpenAI-compatible endpoint](https://ai.google.dev/gemini-api/docs/openai).
JSON mode requires a JSON object and rejects malformed output, truncation, and
refusals. Style Suggestion and Palette Plan now run through this executor. Repaint Concept
creates a queued text specification job; HD Render is a separate image job. Each
text output is schema-validated and persisted before it can feed the next stage.
Execution returns text, parsed JSON when requested, model/profile IDs, provider
request ID, and usage. HTTP error bodies are omitted from text errors.

`generationNode.testTextProfileGeneration` provides an authenticated administrator
smoke test with `{ "profileId": "..." }`. It performs one real JSON generation
request using the saved profile; normal **Test connection** still only reads
`/models` and does not validate inference. No model ID is inferred from a key.


### Configuring the complete creative workflow

Run the idempotent, deployment-internal setup after confirming the desired model
can complete a real request (being listed by `/models` alone is not sufficient):

```bash
npx convex run creativeSetup:configure '{"textModelId":"gemini-3.5-flash"}' --push
```

This creates the official Gemini and LLMRelay profiles, routes the first three
creative actions to text and HD Render to image, and publishes `creation.v1` of
the three creative templates. Existing template text is retained as version
history. It does not replace the HD Render template.

The creation page now follows: kit → optional style recommendation → style and
material selection → palette generation → **Use this palette** → **Create repaint
specification** → **HD render**. All six configured roles must be present. The
palette model produces target colors and effect types, and the server chooses
actual active catalog paints by CIEDE2000 within the requested effect category.
Matching is approximate; the stored rationale records the target and color
distance. AI-generated brand names or product codes are never used as catalog IDs.

Changing kit, style, material, mood, weathering or notes invalidates the current
palette approval. Recent successful text results for the same inputs are restored
from the current user's history without another model request or credit charge.
Concepts store `paletteCompositionId`, `palettePlanJson` and
`renderSpecificationJson`. Rendering, paint plans, shopping lists, feasibility,
recommendations and public concept pages consume the frozen palette; old concepts
without snapshots continue using the legacy mapping engine.

Text calls reserve credits before inference. Duplicate request keys for identical
inputs reuse the same composition; mismatched inputs are rejected. Failed or
abandoned text calls refund once, and an expiry check after 15 minutes prevents
permanent holds. Late responses cannot overwrite failure/refund state. Text
planning reserves no image storage; R2 storage is reserved only for the image job.
The existing image failure-credit policy continues to apply to HD Render.

`creativeSetupNode.inspectModels` checks configured keys and lists official Gemini
models without returning credentials. `creativeSetupNode.probeTextProtocol` is a
small internal diagnostic inference check. These internal functions are callable
from the deployment CLI, not from an unauthenticated browser.


## Library work details

Owned works have `/library/:conceptId` detail pages with overview, resources and
history tabs. The resource model groups existing media assets and their versions;
reference images, masks and exports can be attached through that model without
replacing the detail page. See `docs/library-work-details.md`.

Browser file downloads use signed URLs and a Blob download, keeping the library
page open. Configure the private R2 bucket for exact frontend origins before using
this flow. The following development origin is configured:

```bash
npx convex run libraryDownloadsNode:configureCors '{"origins":["http://localhost:3001"]}' --push
```

For a deployed frontend, supply its exact HTTPS origin instead. The internal setup
preserves unrelated CORS rules, permits only GET/HEAD and does not make the bucket
public. Download authorization and original-file plan limits remain in effect.
No additional environment secrets are required.
