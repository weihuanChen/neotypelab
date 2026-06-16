import {
  SignInButton,
  useAuth,
} from "@clerk/tanstack-react-start";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { PublicShareActions } from "@/src/components/public/PublicShareActions";
import { ShoppingListActions } from "@/src/components/public/ShoppingListActions";
import { ConceptEngagementBar } from "@/src/components/showcase/EngagementBars";
import { formatMoodTagLabel } from "@/src/components/showcase/showcaseUtils";
import { useStartProviderStatus } from "@/src/providers/StartProviders";
import type {
  PrototypeMetaRowValue,
  PrototypeSnapshot,
  PublicPrototypeFeasibility,
  PublicPrototypeRecommendations,
  PublicPrototypeShoppingList,
  SharedPrototype,
} from "./types";

type ShoppingBundleItem =
  PublicPrototypeShoppingList["bundles"]["core"][number] |
  PublicPrototypeShoppingList["bundles"]["support"][number] |
  PublicPrototypeShoppingList["bundles"]["backup"][number];

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
      providerReady={providerStatus.hasConvexClient}
      snapshot={snapshot}
    />
  ) : (
    <PrototypePublicViewBody
      concept={snapshot.concept}
      interactive={false}
      message={snapshot.status === "ok" ? undefined : snapshot.message}
      providerReady={providerStatus.hasConvexClient}
      status={snapshot.status}
    />
  );
}

function LivePrototypePublicView({
  conceptId,
  interactive,
  providerReady,
  snapshot,
}: {
  conceptId: string;
  interactive: boolean;
  providerReady: boolean;
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
      isLivePending={liveConcept === undefined}
      message={snapshot.status === "ok" ? undefined : snapshot.message}
      providerReady={providerReady}
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
  isLivePending = false,
  message,
  providerReady,
  recommendations = null,
  setRecommendationFeedback,
  shoppingList = null,
  status,
}: {
  concept: SharedPrototype | null;
  feasibility?: PublicPrototypeFeasibility | null;
  interactive: boolean;
  isLivePending?: boolean;
  message?: string;
  providerReady: boolean;
  recommendations?: PublicPrototypeRecommendations | null;
  setRecommendationFeedback?: ReturnType<
    typeof useMutation<typeof api.recommendationFeedback.setRecommendationFeedback>
  >;
  shoppingList?: PublicPrototypeShoppingList | null;
  status: PrototypeSnapshot["status"];
}) {
  if (concept === null) {
    return (
      <section className="prototype-empty">
        <p className="showcase-kicker is-orange">Unavailable</p>
        <h1>This prototype is not on a shareable surface.</h1>
        <p>
          {message ??
            "The concept may be private, missing, archived away from public sharing, or unavailable in the current Convex environment."}
        </p>
        <div className="prototype-action-row">
          <a className="showcase-button" href="/showcase">
            Back to Showcase
          </a>
          <a className="showcase-button is-ghost" href="/t/library">
            Open Terminal
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="prototype-stack">
      <section className="prototype-hero-panel">
        <div className="prototype-hero-panel__copy">
          <div className="showcase-pill-row">
            <Pill>{concept.visibility}</Pill>
            <Pill>{concept.status}</Pill>
            {concept.stylePreset?.category ? (
              <Pill>{concept.stylePreset.category}</Pill>
            ) : null}
            {concept.stylePreset?.isFeaturedStyle ? (
              <Pill tone="blue">featured style</Pill>
            ) : null}
            {concept.remixCount > 0 ? (
              <Pill tone="warm">
                {`${concept.remixCount} remix${concept.remixCount === 1 ? "" : "es"}`}
              </Pill>
            ) : null}
          </div>

          <div>
            <p className="showcase-kicker">Prototype Share Surface</p>
            <h1>{concept.title}</h1>
            <p className="prototype-lede">
              {buildPrototypeDescription(concept)}
            </p>
          </div>

          {concept.moodTags.length > 0 ? (
            <p className="prototype-mood">
              Mood Vector / {concept.moodTags.map(formatMoodTagLabel).join(" / ")}
            </p>
          ) : null}

          <ConceptEngagementBar
            conceptId={concept._id}
            interactive={interactive}
            likeCount={concept.engagement.likeCount}
            saveCount={concept.engagement.saveCount}
            viewerHasLiked={concept.engagement.viewerHasLiked}
            viewerHasSaved={concept.engagement.viewerHasSaved}
          />

          <PrototypeActions concept={concept} />

          <div className="prototype-status-line">
            <span>{providerReady ? "Convex live sync ready" : "SSR snapshot mode"}</span>
            {isLivePending ? <span>Hydrating live concept query</span> : null}
            {status !== "ok" && message ? <span>{message}</span> : null}
          </div>
        </div>

        <div className="prototype-hero-panel__media">
          {concept.previewAsset?.publicUrl ? (
            <img src={concept.previewAsset.publicUrl} alt={concept.title} />
          ) : (
            <div className="prototype-media-placeholder">
              <p>Preview unavailable</p>
              {concept.previewAsset?.key ? <span>{concept.previewAsset.key}</span> : null}
            </div>
          )}
        </div>
      </section>

      <LineagePanel concept={concept} />

      <div className="prototype-content-grid">
        <div className="prototype-main-column">
          <PaintPlanPanel concept={concept} />
          <FeasibilityPanel feasibility={feasibility} providerReady={providerReady} />
          <ShoppingListPanel providerReady={providerReady} shoppingList={shoppingList} />
          <RecommendationsPanel
            conceptId={concept._id}
            interactive={interactive}
            providerReady={providerReady}
            recommendations={recommendations}
            setRecommendationFeedback={setRecommendationFeedback}
          />
          <RemixesPanel concept={concept} />
        </div>
        <aside className="prototype-side-column">
          <SourceConceptPanel concept={concept} />
          <MetadataPanel concept={concept} />
          <SprayNotesPanel concept={concept} />
          <OperatorNotePanel concept={concept} />
        </aside>
      </div>
    </div>
  );
}

function PrototypeActions({ concept }: { concept: SharedPrototype }) {
  const styleLandingHref =
    concept.baseModel?.slug && concept.stylePreset?.slug
      ? `/${concept.baseModel.slug}/${concept.stylePreset.slug}`
      : null;

  return (
    <>
      <PublicShareActions
        className="prototype-action-row"
        exportImageUrl={`/prototype/${concept._id}/watermarked-image`}
        extraExportLinks={[
          {
            href: `/prototype/${concept._id}/instagram-image`,
            label: "Instagram Card",
            tone: "warm",
          },
        ]}
        pinterestImageUrl={`/prototype/${concept._id}/pinterest-image`}
        redditImageUrl={`/prototype/${concept._id}/reddit-image`}
        sharePath={`/prototype/${concept._id}`}
        text={buildPrototypeDescription(concept)}
        title={concept.title}
      />
      <div className="prototype-action-row">
        <a className="showcase-button is-warm" href={`/t/create?remix=${concept._id}`}>
          Remix This Prototype
        </a>
        {styleLandingHref ? (
          <a className="showcase-button is-accent" href={styleLandingHref}>
            Open Style Landing
          </a>
        ) : null}
        <a className="showcase-button is-ghost" href="/showcase">
          Back to Showcase
        </a>
      </div>
    </>
  );
}

function LineagePanel({ concept }: { concept: SharedPrototype }) {
  if (concept.lineage.length <= 1) {
    return null;
  }

  return (
    <section className="prototype-panel prototype-lineage-panel">
      <div>
        <p className="showcase-kicker is-teal">Lineage chain</p>
        <h2>Branch history</h2>
      </div>
      <div className="prototype-lineage">
        {concept.lineage.map((entry, index) => (
          <div className="prototype-lineage__item" key={entry._id}>
            {index > 0 ? <span className="prototype-lineage__arrow">-&gt;</span> : null}
            <a
              className={
                entry._id === concept._id
                  ? "showcase-chip is-active"
                  : "showcase-chip"
              }
              href={`/prototype/${entry._id}`}
            >
              {entry.title}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaintPlanPanel({ concept }: { concept: SharedPrototype }) {
  return (
    <section className="prototype-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker is-teal">Paint Mapping Plan</p>
          <h2>{concept.paintPlan.entries.length} spray-ready roles</h2>
        </div>
        <p>
          {concept.paintPlan.baseModelName} / {concept.paintPlan.stylePresetName}
        </p>
      </div>

      {concept.paintPlan.entries.length > 0 ? (
        <div className="prototype-paint-grid">
          {concept.paintPlan.entries.map((entry) => (
            <article className="prototype-paint-row" key={entry.roleSlug}>
              <div className="prototype-paint-row__head">
                <div>
                  <h3>{entry.roleName}</h3>
                  <p>{entry.recommendedArea ?? "Controlled application zone"}</p>
                </div>
                {entry.suggestedPaint?.hexPreview ? (
                  <span
                    className="prototype-swatch"
                    style={{ backgroundColor: entry.suggestedPaint.hexPreview }}
                  />
                ) : null}
              </div>
              <div className="prototype-paint-row__paint">
                <strong>
                  {entry.suggestedPaint
                    ? `${entry.suggestedPaint.brand} ${entry.suggestedPaint.code}`
                    : "No active paint mapping"}
                </strong>
                <span>
                  {entry.suggestedPaint
                    ? `${entry.suggestedPaint.colorName}${
                        entry.suggestedPaint.line ? ` / ${entry.suggestedPaint.line}` : ""
                      }`
                    : "Fallback mapping is not configured for this role."}
                </span>
              </div>
              <p className="prototype-row-copy">{entry.rationale}</p>
              {entry.alternatePaint ? (
                <p className="prototype-alt-paint">
                  Alternate / {entry.alternatePaint.brand} {entry.alternatePaint.code} /{" "}
                  {entry.alternatePaint.colorName}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="prototype-muted">
          Paint roles have not been configured for this concept yet.
        </p>
      )}
    </section>
  );
}

function FeasibilityPanel({
  feasibility,
  providerReady,
}: {
  feasibility?: PublicPrototypeFeasibility | null;
  providerReady: boolean;
}) {
  if (feasibility === undefined) {
    return (
      <section className="prototype-panel">
        <p className="showcase-kicker is-orange">Spray Feasibility</p>
        <h2>Hydrating feasibility telemetry</h2>
        <p className="prototype-muted">
          Convex is loading the public workflow snapshot for this prototype.
        </p>
      </section>
    );
  }

  if (feasibility === null) {
    return (
      <section className="prototype-panel">
        <p className="showcase-kicker is-orange">Spray Feasibility</p>
        <h2>{providerReady ? "Feasibility not published" : "Live feasibility unavailable"}</h2>
        <p className="prototype-muted">
          {providerReady
            ? "This share surface does not currently expose a public feasibility snapshot."
            : "Set the Convex client environment before this public page can hydrate live feasibility data."}
        </p>
      </section>
    );
  }

  return (
    <section className="prototype-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker is-orange">Spray Feasibility</p>
          <h2>
            {feasibility.beginnerDifficulty === "advanced"
              ? "Advanced workflow"
              : feasibility.beginnerDifficulty === "moderate"
                ? "Moderate workflow"
                : "Beginner-friendly workflow"}
          </h2>
        </div>
        <p>
          Masking {feasibility.maskingComplexity}/100 /{" "}
          {feasibility.estimatedLayerCount} estimated layers /{" "}
          {feasibility.paintCostBand} paint cost
        </p>
      </div>
      <p className="prototype-muted">{feasibility.summary}</p>
      <div className="prototype-stat-grid">
        <MetricMiniCard
          label="Beginner difficulty"
          value={feasibility.beginnerDifficulty}
        />
        <MetricMiniCard
          label="Surface compatibility"
          value={feasibility.surfaceCompatibility}
        />
        <MetricMiniCard
          label="Estimated layers"
          value={`${feasibility.estimatedLayerCount}`}
        />
        <MetricMiniCard label="Paint cost" value={feasibility.paintCostBand} />
      </div>
      <div className="prototype-mini-list">
        {feasibility.signals.map((signal) => (
          <article className="prototype-mini-row" key={signal.label}>
            <div>
              <h3>{signal.label}</h3>
              <p>{signal.note}</p>
            </div>
            <span>+{signal.impact}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

function ShoppingListPanel({
  providerReady,
  shoppingList,
}: {
  providerReady: boolean;
  shoppingList?: PublicPrototypeShoppingList | null;
}) {
  if (shoppingList === undefined) {
    return (
      <section className="prototype-panel">
        <p className="showcase-kicker">Shopping List</p>
        <h2>Hydrating procurement plan</h2>
        <p className="prototype-muted">
          Convex is loading paint bundles and purchase paths for this prototype.
        </p>
      </section>
    );
  }

  if (shoppingList === null) {
    return (
      <section className="prototype-panel">
        <p className="showcase-kicker">Shopping List</p>
        <h2>{providerReady ? "Shopping list not published" : "Live shopping list unavailable"}</h2>
        <p className="prototype-muted">
          {providerReady
            ? "This share surface does not currently expose a public shopping list."
            : "Set the Convex client environment before this public page can hydrate procurement data."}
        </p>
      </section>
    );
  }

  return (
    <section className="prototype-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker">Shopping List</p>
          <h2>
            {shoppingList.estimatedItemCount} recommended paint item
            {shoppingList.estimatedItemCount === 1 ? "" : "s"}
          </h2>
        </div>
        <p>
          {shoppingList.baseModelName} / {shoppingList.stylePresetName}
        </p>
      </div>
      <div className="prototype-stat-grid">
        <MetricMiniCard
          label="Affiliate-ready"
          tone="teal"
          value={`${shoppingList.purchaseSummary.affiliateReadyCount}`}
        />
        <MetricMiniCard
          label="Search-ready"
          tone="blue"
          value={`${shoppingList.purchaseSummary.searchReadyCount}`}
        />
        <MetricMiniCard
          label="Region-limited"
          tone="warm"
          value={`${shoppingList.purchaseSummary.regionLimitedCount}`}
        />
      </div>
      <div className="prototype-mini-row prototype-mini-row--stacked">
        <div>
          <h3>Procurement confidence</h3>
          <p>{shoppingList.procurementConfidence}</p>
        </div>
        <p>
          {shoppingList.procurementConfidence === "strong"
            ? "Most core items already have robust sourcing paths or search-ready global availability."
            : shoppingList.procurementConfidence === "moderate"
              ? "The concept is generally sourceable, but some items may still require manual search or substitution."
              : "This concept has multiple constrained sourcing points, so procurement should be reviewed before execution."}
        </p>
      </div>
      {shoppingList.featuredPurchasePath ? (
        <div className="prototype-mini-row prototype-mini-row--stacked">
          <div>
            <h3>Best purchase path</h3>
            <p>{shoppingList.featuredPurchasePath.label}</p>
          </div>
          <a
            className={
              shoppingList.featuredPurchasePath.type === "affiliate"
                ? "showcase-button is-accent"
                : "showcase-button"
            }
            href={shoppingList.featuredPurchasePath.url}
            rel="noreferrer"
            target="_blank"
          >
            {shoppingList.featuredPurchasePath.type === "affiliate"
              ? "Open Best Purchase Link"
              : "Search Best Purchase Path"}
          </a>
        </div>
      ) : null}
      <ShoppingListActions
        className="prototype-action-row"
        data={{
          baseModelName: shoppingList.baseModelName,
          bundles: shoppingList.bundles,
          conceptTitle: shoppingList.conceptTitle,
          materialPresetName: shoppingList.materialPresetName,
          notes: shoppingList.notes,
          stylePresetName: shoppingList.stylePresetName,
        }}
      />
      <ShoppingBundlePanel items={shoppingList.bundles.core} title="Core Bundle" />
      {shoppingList.bundles.support.length > 0 ? (
        <ShoppingBundlePanel
          items={shoppingList.bundles.support}
          title="Support Bundle"
        />
      ) : null}
      {shoppingList.bundles.backup.length > 0 ? (
        <ShoppingBundlePanel
          items={shoppingList.bundles.backup}
          title="Backup Bundle"
        />
      ) : null}
      <div className="prototype-note-stack">
        {shoppingList.notes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </section>
  );
}

function ShoppingBundlePanel({
  items,
  title,
}: {
  items: ShoppingBundleItem[];
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="prototype-subsection">
      <p className="showcase-kicker is-teal">{title}</p>
      <div className="prototype-mini-list">
        {items.map((item) => (
          <ShoppingListItem item={item} key={item.mappingKey} />
        ))}
      </div>
    </div>
  );
}

function ShoppingListItem({
  item,
}: {
  item: ShoppingBundleItem;
}) {
  return (
    <article className="prototype-shopping-item">
      <div className="prototype-shopping-item__head">
        <div>
          <h3>
            {item.brand} {item.code}
          </h3>
          <p>
            {item.colorName}
            {item.line ? ` / ${item.line}` : ""}
            {item.finishType ? ` / ${item.finishType}` : ""}
          </p>
        </div>
        <div className="prototype-shopping-item__badges">
          {item.hexPreview ? (
            <span
              className="prototype-swatch"
              style={{ backgroundColor: item.hexPreview }}
            />
          ) : null}
          <Pill tone={getProcurementTone(item.procurementStatus)}>
            {item.procurementStatus}
          </Pill>
        </div>
      </div>
      <p className="prototype-row-copy">
        Roles: {item.recommendedRoles.join(", ")}
      </p>
      <p className="prototype-muted">Areas: {item.roleAreas.join(", ")}</p>
      <div className="prototype-action-row">
        {item.affiliateUrl ? (
          <a
            className="showcase-button is-accent"
            href={item.affiliateUrl}
            rel="noreferrer"
            target="_blank"
          >
            Open Purchase Link
          </a>
        ) : null}
        <a
          className="showcase-button"
          href={item.purchaseSearchUrl}
          rel="noreferrer"
          target="_blank"
        >
          Search This Paint
        </a>
      </div>
      <p className="prototype-muted">{item.sourcingAdvice}</p>
      {item.brandAlternatives.length > 0 ? (
        <div className="prototype-alternative-list">
          <p className="showcase-kicker">Brand alternatives</p>
          {item.brandAlternatives.map((alternative) => (
            <div className="prototype-alternative-row" key={alternative.mappingKey}>
              <div>
                <strong>
                  {alternative.brand} {alternative.code}
                </strong>
                <span>
                  {alternative.colorName}
                  {alternative.line ? ` / ${alternative.line}` : ""}
                </span>
              </div>
              <div className="prototype-action-row">
                {alternative.affiliateUrl ? (
                  <a
                    className="showcase-button is-accent"
                    href={alternative.affiliateUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Buy Alternative
                  </a>
                ) : null}
                <a
                  className="showcase-button"
                  href={alternative.purchaseSearchUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Search Alternative
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function RecommendationsPanel({
  conceptId,
  interactive,
  providerReady,
  recommendations,
  setRecommendationFeedback,
}: {
  conceptId: string;
  interactive: boolean;
  providerReady: boolean;
  recommendations?: PublicPrototypeRecommendations | null;
  setRecommendationFeedback?: ReturnType<
    typeof useMutation<typeof api.recommendationFeedback.setRecommendationFeedback>
  >;
}) {
  if (recommendations === undefined) {
    return (
      <section className="prototype-panel">
        <p className="showcase-kicker is-teal">Smart Recommendations</p>
        <h2>Hydrating recommendation graph</h2>
        <p className="prototype-muted">
          Convex is loading adjacent styles, easier materials, and sourcing
          alternatives.
        </p>
      </section>
    );
  }

  if (recommendations === null) {
    return (
      <section className="prototype-panel">
        <p className="showcase-kicker is-teal">Smart Recommendations</p>
        <h2>{providerReady ? "Recommendations not published" : "Live recommendations unavailable"}</h2>
        <p className="prototype-muted">
          {providerReady
            ? "This share surface does not currently expose public recommendations."
            : "Set the Convex client environment before this public page can hydrate recommendations."}
        </p>
      </section>
    );
  }

  return (
    <section className="prototype-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker is-teal">Smart Recommendations</p>
          <h2>
            {recommendations.feasibilityBias === "practical"
              ? "Practical-first alternatives"
              : "Alternative paths"}
          </h2>
        </div>
        <p>
          {recommendations.currentStyle?.name ?? "Unknown Style DNA"} /{" "}
          {recommendations.currentMaterial?.name ?? "Unknown material"} /{" "}
          {recommendations.feasibilityBias} bias
        </p>
      </div>
      <RecommendationGroup
        conceptId={conceptId}
        interactive={interactive}
        items={recommendations.alternativeStyles}
        setRecommendationFeedback={setRecommendationFeedback}
        title="Adjacent Style DNA"
      />
      <RecommendationGroup
        conceptId={conceptId}
        interactive={interactive}
        items={recommendations.easierMaterials}
        setRecommendationFeedback={setRecommendationFeedback}
        title="Easier Finish Alternatives"
      />
      <RecommendationGroup
        conceptId={conceptId}
        interactive={interactive}
        items={recommendations.beginnerAlternatives}
        setRecommendationFeedback={setRecommendationFeedback}
        title="Beginner Workflow Alternatives"
      />
      <RecommendationGroup
        conceptId={conceptId}
        interactive={interactive}
        items={recommendations.sourcingAlternatives}
        setRecommendationFeedback={setRecommendationFeedback}
        title="Sourcing Alternatives"
      />
    </section>
  );
}

function RecommendationGroup({
  conceptId,
  interactive,
  items,
  setRecommendationFeedback,
  title,
}: {
  conceptId: string;
  interactive: boolean;
  items: PublicPrototypeRecommendations["alternativeStyles"];
  setRecommendationFeedback?: ReturnType<
    typeof useMutation<typeof api.recommendationFeedback.setRecommendationFeedback>
  >;
  title: string;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="prototype-subsection">
      <p className="showcase-kicker">{title}</p>
      <div className="prototype-mini-list">
        {items.map((item) => (
          <article className="prototype-mini-row prototype-mini-row--stacked" key={`${item.type}-${item.value}`}>
            <div>
              <h3>{item.label}</h3>
              <p>{item.type}</p>
            </div>
            <p>{item.rationale}</p>
            <div className="prototype-action-row">
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
                label="Not Useful"
                recommendationType={item.type}
                recommendationValue={item.value}
                setRecommendationFeedback={setRecommendationFeedback}
              />
              <RecommendationFeedbackButton
                active={item.feedback.try}
                conceptId={conceptId}
                interactive={interactive}
                kind="try"
                label="Try This"
                recommendationType={item.type}
                recommendationValue={item.value}
                setRecommendationFeedback={setRecommendationFeedback}
              />
              <a
                className="showcase-button"
                href={buildCreateRecommendationHref(conceptId, item)}
              >
                Open In Create
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
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
  const className = active ? "showcase-chip is-active" : "showcase-chip is-button";
  const disabled =
    !interactive || !setRecommendationFeedback || !isLoaded || pending;

  const button = (
    <button
      className={className}
      disabled={disabled}
      type="button"
      onClick={
        isSignedIn
          ? () => {
              if (!setRecommendationFeedback) {
                return;
              }

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
      {pending ? `${label}...` : label}
    </button>
  );

  if (!interactive || !setRecommendationFeedback || isSignedIn) {
    return button;
  }

  return <SignInButton mode="modal">{button}</SignInButton>;
}

function MetricMiniCard({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "blue" | "teal" | "warm";
  value: string;
}) {
  return (
    <div className={tone ? `prototype-stat is-${tone}` : "prototype-stat"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getProcurementTone(
  status: "affiliate-ready" | "search-ready" | "region-limited"
) {
  if (status === "affiliate-ready") {
    return "warm";
  }
  if (status === "search-ready") {
    return "blue";
  }
  return undefined;
}

function buildCreateRecommendationHref(
  conceptId: string,
  item: {
    type: string;
    value: string;
  }
) {
  const params = new URLSearchParams();
  params.set("remix", conceptId);

  if (item.type === "style") {
    params.set("recommendedStyle", item.value);
  }
  if (item.type === "material") {
    params.set("recommendedMaterial", item.value);
  }
  if (item.type === "workflow") {
    params.set("recommendedWorkflow", item.value);
  }

  return `/t/create?${params.toString()}`;
}

function RemixesPanel({ concept }: { concept: SharedPrototype }) {
  if (concept.remixes.length === 0) {
    return (
      <section className="prototype-panel">
        <p className="showcase-kicker is-orange">Remix branches</p>
        <h2>No public branches yet</h2>
        <p className="prototype-muted">
          This concept has not produced public descendant prototypes yet.
        </p>
        <a className="showcase-button is-warm" href={`/t/create?remix=${concept._id}`}>
          Start First Remix
        </a>
      </section>
    );
  }

  return (
    <section className="prototype-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker is-orange">Remix branches</p>
          <h2>
            {concept.remixCount} community branch
            {concept.remixCount === 1 ? "" : "es"}
          </h2>
        </div>
        <a className="showcase-button is-warm" href={`/t/create?remix=${concept._id}`}>
          Start Your Remix
        </a>
      </div>
      <div className="prototype-remix-grid">
        {concept.remixes.map((remix) => (
          <a className="prototype-remix-card" href={`/prototype/${remix._id}`} key={remix._id}>
            <h3>{remix.title}</h3>
            <p>
              {remix.baseModel?.name ?? "Unknown base model"} /{" "}
              {remix.stylePreset?.name ?? "Unknown Style DNA"}
            </p>
            <span>
              {remix.owner?.handle ? `@${remix.owner.handle}` : "Unknown pilot"} /{" "}
              {remix.weatheringLevel}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function SourceConceptPanel({ concept }: { concept: SharedPrototype }) {
  if (!concept.sourceConcept) {
    return null;
  }

  const source = concept.sourceConcept;
  const sourceLandingHref =
    source.baseModel?.slug && source.stylePreset?.slug
      ? `/${source.baseModel.slug}/${source.stylePreset.slug}`
      : null;

  return (
    <section className="prototype-panel">
      <p className="showcase-kicker is-teal">Source lineage</p>
      <h2>{source.title}</h2>
      <p className="prototype-muted">
        This prototype is a public branch derived from an earlier shareable concept.
      </p>
      <dl className="showcase-meta">
        <MetaRow
          label="Pilot"
          value={
            source.owner ? (
              <a href={`/pilot/${source.owner.handle}`}>@{source.owner.handle}</a>
            ) : (
              "Unknown"
            )
          }
        />
        <MetaRow label="Base Model" value={source.baseModel?.name ?? "Unknown"} />
        <MetaRow label="Style DNA" value={source.stylePreset?.name ?? "Unknown"} />
      </dl>
      <div className="prototype-action-column">
        <a className="showcase-button" href={`/prototype/${source._id}`}>
          Open Source Prototype
        </a>
        {sourceLandingHref ? (
          <a className="showcase-button is-accent" href={sourceLandingHref}>
            Open Source Landing
          </a>
        ) : null}
      </div>
    </section>
  );
}

function MetadataPanel({ concept }: { concept: SharedPrototype }) {
  return (
    <section className="prototype-panel">
      <p className="showcase-kicker is-orange">Prototype Metadata</p>
      <dl className="showcase-meta prototype-meta-list">
        <MetaRow
          label="Pilot"
          value={
            concept.owner ? (
              <a href={`/pilot/${concept.owner.handle}`}>@{concept.owner.handle}</a>
            ) : (
              "Unknown"
            )
          }
        />
        <MetaRow label="Series" value={concept.baseModel?.series ?? "Unknown"} />
        <MetaRow label="Grade" value={concept.baseModel?.grade ?? "Unknown"} />
        <MetaRow label="Weathering" value={concept.weatheringLevel} />
        <MetaRow label="Finish" value={concept.materialPreset?.finishType ?? "Unknown"} />
        <MetaRow label="Style DNA" value={concept.stylePreset?.name ?? "Unknown"} />
        <MetaRow label="Remixes" value={`${concept.remixCount}`} />
        <MetaRow label="Likes" value={`${concept.engagement.likeCount}`} />
        <MetaRow label="Saves" value={`${concept.engagement.saveCount}`} />
      </dl>
    </section>
  );
}

function SprayNotesPanel({ concept }: { concept: SharedPrototype }) {
  return (
    <section className="prototype-panel">
      <p className="showcase-kicker is-teal">Spray Notes</p>
      <div className="prototype-note-stack">
        {concept.paintPlan.sprayNotes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </section>
  );
}

function OperatorNotePanel({ concept }: { concept: SharedPrototype }) {
  if (!concept.notes) {
    return null;
  }

  return (
    <section className="prototype-panel">
      <p className="showcase-kicker">Operator Note</p>
      <p className="prototype-muted">{concept.notes}</p>
    </section>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: PrototypeMetaRowValue;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: string;
  tone?: "blue" | "warm";
}) {
  return (
    <span className={tone ? `showcase-pill is-${tone}` : "showcase-pill"}>
      {children}
    </span>
  );
}

function buildPrototypeDescription(concept: SharedPrototype) {
  return [
    concept.baseModel?.name ?? "Unknown base model",
    concept.stylePreset?.name ?? "Unknown Style DNA",
    concept.materialPreset?.name ?? "Unknown material profile",
  ].join(" / ");
}
