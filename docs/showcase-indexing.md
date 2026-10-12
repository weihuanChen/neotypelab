# Showcase publication and indexing

Public sharing and search eligibility are independent. `/prototype/:conceptId`
is the stable public URL; owners use `/library/:conceptId` for private work.
Generation status (`draft`, `generated`, `archived`) is separate from visibility.
`archived` does not mean unpublished.

| State | Public URL | Robots | Sitemap |
| --- | --- | --- | --- |
| Private | 404 | Not indexable | Excluded |
| Public, waiting or failing quality | 200 | noindex, follow | Excluded |
| Public, eligible | 200 | index, follow | Included |
| Unlisted | 200 for anyone with the link | noindex, follow | Excluded |
| Unpublished | 404 | Not indexable | Removed |
| Deleted record | 404 | Not indexable | Removed |

Unpublished maps to private visibility with a withdrawn publication; Library
records and private storage are preserved. Missing/deleted records return 404;
there is no separate 410 tombstone. Unlisted links can be forwarded.

## Eligibility

`convex/showcasePolicy.ts` is shared by the detail query and the paginated sitemap
query. A work must have:

- A nonempty title and an active public kit with a model name.
- An active official preset Style. Custom Style snapshots remain noindex.
- A stored paint plan with nonempty roles, readable rationales and spray notes.
  Generated fallback plans do not qualify.
- A published, owner-matching set of ready master/preview/thumbnail renditions
  for the current asset version, backed by a succeeded HD generation job.
- A clear review state and at least 72 hours of uninterrupted public sharing.

`indexEligible` is materialized by an internal scheduled mutation. Its job captures
the publication ID and `publicSince`; stale jobs cannot activate a newer public
interval. Mutable model/style/publication/storage dependencies are rechecked on
every detail and sitemap read, so their invalidation takes effect immediately.
A bounded 15-minute reconciliation also handles recovered dependencies and legacy
public records. Legacy records without `publicSince` start a fresh 72-hour wait;
asset age is not treated as proof of continuous sharing.

Private/unlisted transitions clear eligibility and the public interval. Publishing
again starts a new wait, using the same concept URL. Publishing a newer rendered
version also restarts the wait. Likes, saves and minor title/notes changes do not.
The sitemap's work `lastmod` reflects publication or content updates, not creation
time or engagement counts.

Admins can call `showcaseIndexing:setReviewStatus` with `clear`, `pending-review`,
`hidden`, `duplicate` or `low-quality`; this requires platform-admin access and
writes an audit entry. A raw report does not automatically revoke eligibility.
A triaged pending report pauses indexing; hidden withdraws public access and
queues public image cleanup. Duplicate/low-quality states remain accessible but
noindex. This is a moderation integration point; it does not perform automatic
image similarity detection or add a new reporting UI.

## Withdrawal and concurrency

The withdrawal transaction clears public access, `indexEligible`, `publicSince`
and pending publication state before external storage cleanup. Pending copy jobs
cannot finalize after a newer visibility request. Every new publication uses its
own object prefix, so cleanup of an older publication cannot delete a republish.
Interrupted copy jobs expire after 15 minutes. A five-minute cron retries due
withdrawals in bounded batches; failed deletions or cache purges defer another
attempt by 15 minutes. Private Library files are never part of this cleanup.

Detail pages, discovery pages, sitemap responses, share image routes and newly
published R2 images use `Cache-Control: no-store`. All five work share image routes
return 404 after withdrawal. Backend failures return 503 with Retry-After rather
than pretending that a work or dynamic sitemap disappeared. Public prototype URLs
remain crawlable in robots.txt so crawlers can observe noindex and 404 responses.

`CLOUDFLARE_CACHE_PURGE_ZONE_ID` and `CLOUDFLARE_CACHE_PURGE_TOKEN` remain necessary
to purge previously cacheable public image URLs. Missing purge configuration leaves
cleanup pending and retryable, while the work remains private. At production
rollout, purge any previously cached sitemap, public detail and share-image
responses, and ensure Cloudflare cache rules respect origin no-store headers.
External copies, already downloaded images and Google results are not removed
synchronously. Search eligibility does not guarantee that Google indexes a work.

## Verification and rollout

Run `npm run lint`, `npm test`, `npm run test:e2e:public` and `npm run build`.
Backend tests cover maturity boundaries, stale jobs, review decisions, ownership,
private Library preservation, republish paths, concurrent publication/withdrawal
and interrupted cleanup. Public browser tests check real HTTP 404s, fresh sitemap
headers and crawl access. Inspect a public work's raw HTML without JavaScript for
its model name, Style, readable paint plan and initial robots tag.

Deploy the backend schema/functions and frontend together against the intended
environment. New fields are optional and legacy records default to noindex.
The reconciliation cron initializes existing public records automatically. Never
backdate `publicSince` from `_creationTime` or asset publication timestamps.
Production deployment is a separate approved operation.
