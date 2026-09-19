import {
  SignInButton,
  useAuth,
} from "@clerk/tanstack-react-start";
import {
  ArrowLeftIcon,
  ArrowTopRightIcon,
  CheckIcon,
  CopyIcon,
  Share1Icon,
} from "@radix-ui/react-icons";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ShoppingListActions } from "@/src/components/public/ShoppingListActions";
import { ConceptEngagementBar } from "@/src/components/showcase/EngagementBars";
import { useStartProviderStatus } from "@/src/providers/StartProviders";
import type {
  PrototypeSnapshot,
  PublicPrototypeFeasibility,
  PublicPrototypeRecommendations,
  PublicPrototypeShoppingList,
  SharedPrototype,
} from "./types";

type ShoppingBundleItem =
  PublicPrototypeShoppingList["bundles"][keyof PublicPrototypeShoppingList["bundles"]][number];

type AdjacentPath = PublicPrototypeRecommendations["beginnerAlternatives"][number];

type ColorSystemRow = {
  index: string;
  roleSlug: string;
  roleName: string;
  targetHex?: string;
  area?: string;
  paint?: NonNullable<SharedPrototype["paintPlan"]["entries"][number]["suggestedPaint"]>;
  note?: string;
};

export function PrototypePublicView({
  conceptId,
  snapshot,
}: {
  conceptId: string;
  snapshot: PrototypeSnapshot;
}) {
  const providerStatus = useStartProviderStatus();
  const canUseLiveData =
    providerStatus.hasClerkProvider && providerStatus.hasConvexClient;

  return canUseLiveData ? (
    <LivePrototypePublicView
      conceptId={conceptId}
      interactive
      snapshot={snapshot}
    />
  ) : (
    <PrototypePublicViewBody
      concept={snapshot.concept}
      interactive={false}
      message={snapshot.status === "ok" ? undefined : snapshot.message}
      status={snapshot.status}
    />
  );
}

function LivePrototypePublicView({
  conceptId,
  interactive,
  snapshot,
}: {
  conceptId: string;
  interactive: boolean;
  snapshot: PrototypeSnapshot;
}) {
  const liveConcept = useQuery(api.showcase.getSharedConcept, {
    conceptId: conceptId as Id<"concepts">,
  });
  const feasibility = useQuery(api.feasibility.getPublicConceptFeasibility, {
    conceptId: conceptId as Id<"concepts">,
  });
  const shoppingList = useQuery(api.shopping.getPublicConceptShoppingList, {
    conceptId: conceptId as Id<"concepts">,
  });
  const recommendations = useQuery(
    api.recommendations.getPublicConceptRecommendations,
    {
      conceptId: conceptId as Id<"concepts">,
    }
  );
  const setRecommendationFeedback = useMutation(
    api.recommendationFeedback.setRecommendationFeedback
  );
  const concept =
    liveConcept === undefined ? snapshot.concept : liveConcept;

  return (
    <PrototypePublicViewBody
      concept={concept}
      feasibility={feasibility}
      interactive={interactive}
      message={snapshot.status === "ok" ? undefined : snapshot.message}
      recommendations={recommendations}
      setRecommendationFeedback={setRecommendationFeedback}
      shoppingList={shoppingList}
      status={snapshot.status}
    />
  );
}

function PrototypePublicViewBody({
  concept,
  feasibility = null,
  interactive,
  message,
  recommendations = null,
  setRecommendationFeedback,
  shoppingList = null,
  status,
}: {
  concept: SharedPrototype | null;
  feasibility?: PublicPrototypeFeasibility | null;
  interactive: boolean;
  message?: string;
  recommendations?: PublicPrototypeRecommendations | null;
  setRecommendationFeedback?: ReturnType<
    typeof useMutation<typeof api.recommendationFeedback.setRecommendationFeedback>
  >;
  shoppingList?: PublicPrototypeShoppingList | null;
  status: PrototypeSnapshot["status"];
}) {
  if (concept === null) {
    return (
      <section className="case-empty">
        <p className="case-eyebrow">Unavailable</p>
        <h1>This case is not on a shareable surface.</h1>
        <p>
          {message ??
            "The work may be private, missing, or no longer public."}
        </p>
        <a className="case-back" href="/showcase">
          <ArrowLeftIcon aria-hidden="true" />
          Back to Showcase
        </a>
      </section>
    );
  }

  const imageUrl = concept.previewAsset?.masterUrl ?? concept.previewAsset?.publicUrl;
  const sprayNotes = concept.paintPlan.sprayNotes;
  const colorRows = buildColorSystemRows(concept);
  let section = 1;

  return (
    <article aria-labelledby="case-title">
      <header className="case-masthead">
        <div className="case-frame">
          <a className="case-back" href="/showcase">
            <ArrowLeftIcon aria-hidden="true" />
            Showcase
          </a>
          <div className="case-masthead__row">
            <div>
              <p className="case-eyebrow">
                Public case / {recordLabel(concept)}
              </p>
              <h1 id="case-title">
                {titleLines(concept.title).map((line, index, lines) => (
                  <span key={line}>
                    {line}
                    {index < lines.length - 1 ? " /" : ""}
                  </span>
                ))}
              </h1>
            </div>
            <dl className="case-identity">
              <div>
                <dt>Kit</dt>
                <dd>{kitLabel(concept.baseModel)}</dd>
              </div>
              <div>
                <dt>Style</dt>
                <dd>{concept.stylePreset?.name ?? "Not recorded"}</dd>
              </div>
              <div>
                <dt>Weathering</dt>
                <dd>{humanize(concept.weatheringLevel)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </header>

      <figure className="case-artwork">
        {imageUrl ? (
          <img src={imageUrl} alt={`${concept.title} public case`} />
        ) : (
          <div className="case-image-empty">
            <strong>Preview unavailable</strong>
            <p>This case does not currently expose a published render.</p>
          </div>
        )}
        <figcaption className="case-frame">
          <span>{concept.owner?.handle ? `@${concept.owner.handle}` : "Anonymous pilot"}</span>
          <span>{concept.remixCount} {concept.remixCount === 1 ? "remix" : "remixes"}</span>
        </figcaption>
      </figure>

      <div className="case-frame">
        <div className="case-toolbar" aria-label="Case actions">
          <div className="case-toolbar__meta">
            <div className="case-engage">
              <ConceptEngagementBar
                conceptId={concept._id}
                interactive={interactive}
                likeCount={concept.engagement.likeCount}
                saveCount={concept.engagement.saveCount}
                viewerHasLiked={concept.engagement.viewerHasLiked}
                viewerHasSaved={concept.engagement.viewerHasSaved}
              />
            </div>
          </div>
          <div className="case-toolbar__actions">
            <CaseShareBar
              sharePath={`/prototype/${concept._id}`}
              text={buildPrototypeDescription(concept)}
              title={concept.title}
            />
            <details className="case-export">
              <summary>Export cards</summary>
              <nav aria-label="Export cards">
                <a href={`/prototype/${concept._id}/watermarked-image`} rel="noreferrer" target="_blank">Watermarked image</a>
                <a href={`/prototype/${concept._id}/pinterest-image`} rel="noreferrer" target="_blank">Pinterest</a>
                <a href={`/prototype/${concept._id}/reddit-image`} rel="noreferrer" target="_blank">Reddit</a>
                <a href={`/prototype/${concept._id}/instagram-image`} rel="noreferrer" target="_blank">Instagram</a>
              </nav>
            </details>
            <a className="case-text-link" href={`/create?remix=${concept._id}`}>
              Remix
            </a>
            <a
              className="case-text-link"
              href={`/feedback?conceptId=${encodeURIComponent(concept._id)}&type=generation-quality&source=prototype`}
            >
              Report an issue
            </a>
          </div>
        </div>

        {status !== "ok" && message ? <p className="case-muted">{message}</p> : null}
        {concept.notes ? <p className="case-operator">{concept.notes}</p> : null}
        <LineageRow concept={concept} />
      </div>

      <ColorSystemSection
        colorRows={colorRows}
        imageUrl={imageUrl}
        number={pad(section++)}
        title={concept.title}
      />
      <FeasibilitySection number={pad(section++)} feasibility={feasibility} />
      {sprayNotes.length > 0 ? (
        <SprayNotesSection number={pad(section++)} notes={sprayNotes} />
      ) : null}
      <ShoppingSection number={pad(section++)} shoppingList={shoppingList} />
      <CreateYoursSection colorRows={colorRows} concept={concept} />
      <RecommendationsSection
        number={pad(section++)}
        conceptId={concept._id}
        interactive={interactive}
        recommendations={recommendations}
        setRecommendationFeedback={setRecommendationFeedback}
      />
      <RemixesSection number={pad(section++)} concept={concept} />
    </article>
  );
}

function CaseShareBar({
  sharePath,
  text,
  title,
}: {
  sharePath: string;
  text: string;
  title: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = typeof window === "undefined"
      ? sharePath
      : new URL(sharePath, window.location.origin).toString();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  async function shareNative() {
    const nativeShare =
      typeof navigator !== "undefined" && "share" in navigator
        ? navigator.share.bind(navigator)
        : undefined;
    if (!nativeShare) {
      await copyLink();
      return;
    }
    try {
      await nativeShare({
        title,
        text,
        url: new URL(sharePath, window.location.origin).toString(),
      });
    } catch {
      /* dismissed */
    }
  }

  return (
    <>
      <button className="case-action" type="button" onClick={() => void copyLink()}>
        {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        <span>{copied ? "Link copied" : "Copy link"}</span>
      </button>
      <button className="case-action" type="button" onClick={() => void shareNative()}>
        <Share1Icon aria-hidden="true" />
        <span>Share</span>
      </button>
    </>
  );
}

function LineageRow({ concept }: { concept: SharedPrototype }) {
  if (concept.lineage.length <= 1 && !concept.sourceConcept) {
    return null;
  }

  const source = concept.sourceConcept;

  return (
    <p className="case-lineage">
      <span>Lineage</span>
      {concept.lineage.length > 1
        ? concept.lineage.map((entry, index) => (
            <span key={entry._id}>
              {index > 0 ? " / " : null}
              <a
                className={entry._id === concept._id ? "is-current" : undefined}
                href={`/prototype/${entry._id}`}
              >
                {entry.title}
              </a>
            </span>
          ))
        : source
          ? (
              <>
                <a href={`/prototype/${source._id}`}>{source.title}</a>
                <span>→ this case</span>
              </>
            )
          : null}
    </p>
  );
}

function ColorSystemSection({
  colorRows,
  imageUrl,
  number,
  title,
}: {
  colorRows: ColorSystemRow[];
  imageUrl?: string;
  number: string;
  title: string;
}) {
  if (colorRows.length === 0) {
    return (
      <section className="case-section" aria-labelledby="case-color-title">
        <div className="case-frame">
          <header className="case-section-heading">
            <div>
              <span>{number}</span>
              <h2 id="case-color-title">Color System</h2>
            </div>
          </header>
          <p className="case-muted">Paint roles have not been published for this case yet.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="case-section" aria-labelledby="case-color-title">
      <div className="case-palette" aria-label="Palette DNA">
        <div className="case-frame">
          <header className="case-section-heading">
            <div>
              <span>{number}</span>
              <h2 id="case-color-title">Color System</h2>
            </div>
            <p>{colorRows.length} roles</p>
          </header>
        </div>
        <div className="case-palette__bars">
          {colorRows.map((row) => (
            <div
              className="case-palette__bar"
              key={row.roleSlug}
              style={row.targetHex ? { backgroundColor: row.targetHex } : undefined}
              title={row.roleName}
            />
          ))}
        </div>
        <p className="case-palette__legend">
          {colorRows.map((row) => row.roleName).join("  /  ")}
        </p>
      </div>

      <div className="case-frame">
        <div className="case-breakdown">
          <div className="case-breakdown__stage">
            {imageUrl ? (
              <img src={imageUrl} alt={`${title} color breakdown`} />
            ) : (
              <div className="case-image-empty">
                <strong>Preview unavailable</strong>
              </div>
            )}
          </div>
          <ol className="case-callouts">
            {colorRows.map((row) => (
              <li className="case-callout" key={row.roleSlug}>
                <span className="case-callout__index">{row.index}</span>
                {row.targetHex ? (
                  <span className="case-swatch" style={{ backgroundColor: row.targetHex }} aria-hidden="true" />
                ) : null}
                <div>
                  <strong>{row.roleName}</strong>
                  <p>
                    {row.paint
                      ? `${row.paint.code} ${row.paint.colorName}`
                      : row.targetHex
                        ? `${row.targetHex} · No catalog SKU · custom mix`
                        : "No catalog SKU · custom mix"}
                  </p>
                  {row.area ? <small>{row.area}</small> : null}
                </div>
              </li>
            ))}
          </ol>
        </div>

        <h3 className="case-subhead">Technical Color Plan</h3>
        <table className="case-matrix">
          <thead>
            <tr>
              <th scope="col">Role</th>
              <th scope="col">Paint</th>
              <th scope="col">Areas</th>
              <th scope="col">Note</th>
            </tr>
          </thead>
          <tbody>
            {colorRows.map((row) => (
              <tr key={row.roleSlug}>
                <td>
                  <div className="case-matrix__role">
                    {row.targetHex ? (
                      <span className="case-swatch" style={{ backgroundColor: row.targetHex }} aria-hidden="true" />
                    ) : null}
                    <strong>{row.roleName}</strong>
                  </div>
                </td>
                <td>
                  {row.paint ? (
                    <>
                      <strong>{row.paint.code}</strong>
                      <small>{row.paint.brand} · {row.paint.colorName}</small>
                    </>
                  ) : (
                    <span className="case-muted">No catalog SKU · custom mix</span>
                  )}
                </td>
                <td>{row.area ?? "—"}</td>
                <td>{row.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FeasibilitySection({
  feasibility,
  number,
}: {
  feasibility?: PublicPrototypeFeasibility | null;
  number: string;
}) {
  if (!feasibility) {
    return null;
  }

  const workflow =
    feasibility.beginnerDifficulty === "advanced"
      ? "Advanced workflow"
      : feasibility.beginnerDifficulty === "moderate"
        ? "Moderate workflow"
        : "Beginner-friendly workflow";
  const maxImpact = Math.max(...feasibility.signals.map((signal) => signal.impact), 1);

  return (
    <section className="case-section" aria-labelledby="case-feasibility-title">
      <div className="case-frame">
        <header className="case-section-heading">
          <div>
            <span>{number}</span>
            <h2 id="case-feasibility-title">Workshop Load</h2>
          </div>
          <p>{workflow}</p>
        </header>
        {feasibility.summary ? <p className="case-intro">{feasibility.summary}</p> : null}
        <div className="case-metrics">
          <div>
            <strong>
              {feasibility.maskingComplexity}
              <small>/100</small>
            </strong>
            <span>Masking</span>
          </div>
          <div>
            <strong>{feasibility.estimatedLayerCount}</strong>
            <span>Layers</span>
          </div>
          <div>
            <strong>{humanize(feasibility.paintCostBand)}</strong>
            <span>Paint cost</span>
          </div>
        </div>
        {feasibility.signals.length > 0 ? (
          <ul className="case-signals">
            {feasibility.signals.map((signal) => (
              <li key={signal.label}>
                <strong>{signal.label}</strong>
                <span>+{signal.impact}</span>
                <div className="case-signal__track" aria-hidden="true">
                  <span style={{ width: `${Math.max(8, (signal.impact / maxImpact) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function SprayNotesSection({
  notes,
  number,
}: {
  notes: string[];
  number: string;
}) {
  return (
    <section className="case-section" aria-labelledby="case-spray-title">
      <div className="case-frame">
        <header className="case-section-heading">
          <div>
            <span>{number}</span>
            <h2 id="case-spray-title">Painting Sequence</h2>
          </div>
          <p>{notes.length} sequential notes</p>
        </header>
        <ol className="case-timeline">
          {notes.map((note, index) => (
            <li key={index}>
              <span>{pad(index + 1)}</span>
              <strong>{sequenceLabel(note)}</strong>
            </li>
          ))}
        </ol>
        <ol className="case-sequence">
          {notes.map((note, index) => (
            <li key={index}>
              <span className="case-sequence__index">{pad(index + 1)}</span>
              <p>{note}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function ShoppingSection({
  shoppingList,
  number,
}: {
  shoppingList?: PublicPrototypeShoppingList | null;
  number: string;
}) {
  if (!shoppingList) {
    return null;
  }

  const specimens = [...shoppingList.bundles.core, ...shoppingList.bundles.support];
  const paintCount = shoppingList.estimatedItemCount;

  return (
    <section className="case-section" aria-labelledby="case-shop-title">
      <div className="case-frame">
        <header className="case-section-heading">
          <div>
            <span>{number}</span>
            <h2 id="case-shop-title">Shopping List</h2>
          </div>
          <p>{paintCount === 1 ? "1 paint" : `${paintCount} paints`}</p>
        </header>
        <div className="case-shop-head">
          <p className="case-intro">
            {shoppingList.procurementConfidence === "strong"
              ? "Most core paints already have a clear sourcing path."
              : shoppingList.procurementConfidence === "moderate"
                ? "Generally sourceable, with a few items that may need substitution."
                : "Several items are constrained; review sourcing before spraying."}
          </p>
          <ShoppingListActions
            className="case-copy"
            data={{
              baseModelName: shoppingList.baseModelName,
              bundles: shoppingList.bundles,
              conceptTitle: shoppingList.conceptTitle,
              materialPresetName: shoppingList.materialPresetName,
              notes: shoppingList.notes,
              stylePresetName: shoppingList.stylePresetName,
            }}
          />
        </div>
        {specimens.length > 0 ? (
          <div className="case-specimens">
            {specimens.map((item) => (
              <ShoppingSpecimen item={item} key={item.mappingKey} />
            ))}
          </div>
        ) : (
          <p className="case-muted">No catalog paints have been published for this case yet.</p>
        )}
      </div>
    </section>
  );
}

function ShoppingSpecimen({ item }: { item: ShoppingBundleItem }) {
  const role = item.recommendedRoles[0];
  const alternative = item.brandAlternatives.length > 0
    ? item.brandAlternatives[0]
    : undefined;
  const findUrl = item.affiliateUrl ?? item.purchaseSearchUrl;

  return (
    <article className="case-specimen">
      <div
        className="case-specimen__swatch"
        style={item.hexPreview ? { backgroundColor: item.hexPreview } : undefined}
        aria-hidden="true"
      />
      <p className="case-specimen__code">{item.code}</p>
      <h3>{item.colorName}</h3>
      <p>{item.line ?? item.brand}</p>
      {role ? <p className="case-specimen__role">{role}</p> : null}
      <a className="case-text-link" href={findUrl} rel="noreferrer" target="_blank">
        Find paint
        <ArrowTopRightIcon aria-hidden="true" />
      </a>
      {alternative ? (
        <p className="case-specimen__alt">
          Alt / {alternative.brand} {alternative.code}
        </p>
      ) : null}
    </article>
  );
}

function CreateYoursSection({
  colorRows,
  concept,
}: {
  colorRows: ColorSystemRow[];
  concept: SharedPrototype;
}) {
  return (
    <section className="case-create" aria-labelledby="case-create-title">
      <div className="case-frame">
        <p className="case-create__kicker">This was one idea.</p>
        <h2 id="case-create-title">
          Your kit
          <span>{"doesn't have to"}</span>
          <span>stay stock.</span>
        </h2>
        <p>Upload a kit. Choose a direction. Build the paint plan.</p>
        <a className="case-create__cta" href={`/create?remix=${concept._id}`}>
          <span>Create your case</span>
          <ArrowTopRightIcon aria-hidden="true" />
        </a>
        {colorRows.length > 0 ? (
          <div className="case-create__swatches" aria-hidden="true">
            {colorRows.map((row) => (
              <span
                key={row.roleSlug}
                style={row.targetHex ? { backgroundColor: row.targetHex } : undefined}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RecommendationsSection({
  conceptId,
  interactive,
  number,
  recommendations,
  setRecommendationFeedback,
}: {
  conceptId: string;
  interactive: boolean;
  number: string;
  recommendations?: PublicPrototypeRecommendations | null;
  setRecommendationFeedback?: ReturnType<
    typeof useMutation<typeof api.recommendationFeedback.setRecommendationFeedback>
  >;
}) {
  if (!recommendations) {
    return null;
  }

  const paths = topAdjacentPaths(recommendations, 3);
  if (paths.length === 0) {
    return null;
  }

  return (
    <section className="case-section" aria-labelledby="case-rec-title">
      <div className="case-frame">
        <header className="case-section-heading">
          <div>
            <span>{number}</span>
            <h2 id="case-rec-title">Explore this direction</h2>
          </div>
        </header>
        <ol className="case-paths">
          {paths.map((item, index) => (
            <li className="case-path" key={`${item.type}-${item.value}`}>
              <span>{pad(index + 1)}</span>
              <div>
                <h3>{item.label}</h3>
                <p>{compactNote(item.rationale, 110)}</p>
                <nav>
                  <a className="case-text-link" href={buildCreateRecommendationHref(conceptId, item)}>
                    Open variation
                    <ArrowTopRightIcon aria-hidden="true" />
                  </a>
                  <span className="case-path__feedback">
                    <RecommendationFeedbackButton
                      active={item.feedback.helpful}
                      conceptId={conceptId}
                      interactive={interactive}
                      kind="helpful"
                      label="Helpful"
                      recommendationType={item.type}
                      recommendationValue={item.value}
                      setRecommendationFeedback={setRecommendationFeedback}
                    />
                    <RecommendationFeedbackButton
                      active={item.feedback.notHelpful}
                      conceptId={conceptId}
                      interactive={interactive}
                      kind="not-helpful"
                      label="Not useful"
                      recommendationType={item.type}
                      recommendationValue={item.value}
                      setRecommendationFeedback={setRecommendationFeedback}
                    />
                  </span>
                </nav>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function RecommendationFeedbackButton({
  active,
  conceptId,
  interactive,
  kind,
  label,
  recommendationType,
  recommendationValue,
  setRecommendationFeedback,
}: {
  active: boolean;
  conceptId: string;
  interactive: boolean;
  kind: "helpful" | "not-helpful" | "try";
  label: string;
  recommendationType: string;
  recommendationValue: string;
  setRecommendationFeedback?: ReturnType<
    typeof useMutation<typeof api.recommendationFeedback.setRecommendationFeedback>
  >;
}) {
  const { isLoaded, isSignedIn } = useAuth();
  const [pending, setPending] = useState(false);
  const disabled =
    !interactive || !setRecommendationFeedback || !isLoaded || pending;

  const button = (
    <button
      className={active ? "is-on" : undefined}
      disabled={disabled}
      type="button"
      onClick={
        isSignedIn
          ? () => {
              if (!setRecommendationFeedback) return;
              setPending(true);
              void setRecommendationFeedback({
                conceptId: conceptId as Id<"concepts">,
                kind,
                recommendationType,
                recommendationValue,
              }).finally(() => setPending(false));
            }
          : undefined
      }
    >
      {pending ? `${label}…` : label}
    </button>
  );

  if (!interactive || !setRecommendationFeedback || isSignedIn) {
    return button;
  }

  return <SignInButton mode="modal">{button}</SignInButton>;
}

function RemixesSection({
  concept,
  number,
}: {
  concept: SharedPrototype;
  number: string;
}) {
  if (concept.remixes.length === 0) {
    return null;
  }

  return (
    <section className="case-section" aria-labelledby="case-remix-title">
      <div className="case-frame">
        <header className="case-section-heading">
          <div>
            <span>{number}</span>
            <h2 id="case-remix-title">Public Branches</h2>
          </div>
          <p>
            {concept.remixCount} remix{concept.remixCount === 1 ? "" : "es"}
          </p>
        </header>
        <ul className="case-remix-list">
          {concept.remixes.map((remix) => (
            <li key={remix._id}>
              <a href={`/prototype/${remix._id}`}>
                <span>
                  <strong>{remix.title}</strong>
                  <span className="case-muted">
                    {[remix.baseModel?.name, remix.stylePreset?.name, remix.owner?.handle ? `@${remix.owner.handle}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <ArrowTopRightIcon aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function buildColorSystemRows(concept: SharedPrototype): ColorSystemRow[] {
  const visual = concept.visualPalette?.entries ?? [];
  const bySlug = new Map(concept.paintPlan.entries.map((entry) => [entry.roleSlug, entry]));
  const order = visual.length > 0
    ? visual
    : concept.paintPlan.entries.map((entry) => ({
        roleSlug: entry.roleSlug,
        roleName: entry.roleName,
        targetHex: entry.suggestedPaint?.hexPreview,
        recommendedArea: entry.recommendedArea,
      }));

  return order.map((entry, index) => {
    const plan = bySlug.get(entry.roleSlug);
    const targetHex = "targetHex" in entry ? entry.targetHex : plan?.suggestedPaint?.hexPreview;
    return {
      index: pad(index + 1),
      roleSlug: entry.roleSlug,
      roleName: entry.roleName,
      targetHex,
      area: entry.recommendedArea ?? plan?.recommendedArea,
      paint: plan?.suggestedPaint ?? undefined,
      note: compactNote(plan?.rationale),
    };
  });
}

function topAdjacentPaths(recommendations: PublicPrototypeRecommendations, limit: number) {
  const groups: AdjacentPath[][] = [
    recommendations.beginnerAlternatives,
    recommendations.alternativeStyles,
    recommendations.easierMaterials,
    recommendations.sourcingAlternatives,
  ];
  const seen = new Set<string>();
  const paths: AdjacentPath[] = [];
  for (const group of groups) {
    for (const item of group) {
      const key = `${item.type}:${item.value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      paths.push(item);
      if (paths.length >= limit) return paths;
    }
  }
  return paths;
}

function titleLines(title: string) {
  const parts = title.split(/\s*\/\s*/).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [title];
}

function sequenceLabel(note: string) {
  const first = note.split(/[.:,]/)[0]?.trim() ?? note;
  const words = first.split(/\s+/).slice(0, 4).join(" ");
  return words.length > 32 ? `${words.slice(0, 29).trimEnd()}…` : words;
}

function compactNote(value?: string, max = 92) {
  if (!value) return undefined;
  const sentence = value.split(/(?<=[.!?])\s+/)[0] ?? value;
  if (sentence.length <= max) return sentence.replace(/\.$/, "");
  return `${sentence.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

function kitLabel(model: SharedPrototype["baseModel"]) {
  if (!model?.name) return "Not recorded";
  const grade = "grade" in model && typeof model.grade === "string" ? model.grade : undefined;
  if (grade && !model.name.toLowerCase().includes(grade.toLowerCase())) {
    return `${grade} ${model.name}`;
  }
  return model.name;
}

function recordLabel(concept: SharedPrototype) {
  return concept.recordNumber
    ? `N° ${String(concept.recordNumber).padStart(4, "0")}`
    : "Prototype";
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function humanize(value: string) {
  return value.replace(/-/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
}

function buildCreateRecommendationHref(
  conceptId: string,
  item: { type: string; value: string }
) {
  const params = new URLSearchParams();
  params.set("remix", conceptId);
  if (item.type === "style") params.set("recommendedStyle", item.value);
  if (item.type === "material") params.set("recommendedMaterial", item.value);
  if (item.type === "workflow") params.set("recommendedWorkflow", item.value);
  return `/create?${params.toString()}`;
}

function buildPrototypeDescription(concept: SharedPrototype) {
  return [
    concept.baseModel?.name ?? "Unknown kit",
    concept.stylePreset?.name ?? "Unknown Style DNA",
    concept.materialPreset?.name ?? "Unknown material",
  ].join(" / ");
}
