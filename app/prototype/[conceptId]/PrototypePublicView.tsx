"use client";
/* eslint-disable @next/next/no-img-element */

import { ConceptEngagementBar } from "@/components/public/ConceptEngagementBar";
import { PublicShareActions } from "@/components/public/PublicShareActions";
import { ShoppingListActions } from "@/components/public/ShoppingListActions";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";

export function PrototypePublicView({ conceptId }: { conceptId: string }) {
  const concept = useQuery(api.showcase.getSharedConcept, {
    conceptId: conceptId as Id<"concepts">,
  });
  const feasibility = useQuery(api.feasibility.getPublicConceptFeasibility, {
    conceptId: conceptId as Id<"concepts">,
  });
  const shoppingList = useQuery(api.shopping.getPublicConceptShoppingList, {
    conceptId: conceptId as Id<"concepts">,
  });
  const recommendations = useQuery(api.recommendations.getPublicConceptRecommendations, {
    conceptId: conceptId as Id<"concepts">,
  });
  const setRecommendationFeedback = useMutation(api.recommendationFeedback.setRecommendationFeedback);

  if (concept === undefined) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Share Surface</p>
        <h1 className="mt-4 text-3xl font-semibold">Loading prototype telemetry</h1>
      </section>
    );
  }

  if (concept === null) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-8 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Unavailable</p>
        <h1 className="mt-4 text-3xl font-semibold">This prototype is not publicly shareable.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9BA7B4]">
          The concept may be private, missing, or not yet generated into a shareable state.
        </p>
        <Link
          href="/showcase"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-[18px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
        >
          Back to Showcase
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6 text-[#E6EDF3]">
      <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Prototype Share Surface</p>
            <h1 className="mt-4 text-3xl font-semibold">{concept.title}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9BA7B4]">
              {concept.baseModel?.name ?? "Unknown base model"} ·{" "}
              {concept.stylePreset?.name ?? "Unknown Style DNA"} ·{" "}
              {concept.materialPreset?.name ?? "Unknown material profile"}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {concept.stylePreset?.category ? (
                <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
                  {concept.stylePreset.category}
                </span>
              ) : null}
              {concept.stylePreset?.isFeaturedStyle ? (
                <span className="rounded-full border border-[#FFB84D]/30 bg-[#FFB84D]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#FFD9A0]">
                  featured style
                </span>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2 text-right text-sm text-[#9BA7B4]">
            <span>{concept.visibility}</span>
            <span>{concept.status}</span>
            {concept.owner ? (
              <Link
                href={`/pilot/${concept.owner.handle}`}
                className="transition-colors hover:text-[#E6EDF3]"
              >
                @{concept.owner.handle}
              </Link>
            ) : (
              <span>Unknown pilot</span>
            )}
          </div>
        </div>
        {concept.moodTags.length > 0 ? (
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-[#6E7A88]">
            Mood Vector · {concept.moodTags.map(formatMoodTagLabel).join(" / ")}
          </p>
        ) : null}
        <ConceptEngagementBar
          conceptId={concept._id}
          likeCount={concept.engagement.likeCount}
          saveCount={concept.engagement.saveCount}
          viewerHasLiked={concept.engagement.viewerHasLiked}
          viewerHasSaved={concept.engagement.viewerHasSaved}
          className="mt-5"
        />
        {concept.lineage.length > 1 ? (
          <div className="mt-4 rounded-[18px] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#6E7A88]">Lineage chain</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#C7D0DA]">
              {concept.lineage.map((entry, index) => (
                <div key={entry._id} className="flex items-center gap-2">
                  {index > 0 ? <span className="text-[#6E7A88]">→</span> : null}
                  <Link
                    href={`/prototype/${entry._id}`}
                    className={cn(
                      "rounded-full border px-3 py-1 transition-colors",
                      entry._id === concept._id
                        ? "border-[#58FFB2]/35 bg-[#13241B] text-[#E6EDF3]"
                        : "border-white/10 text-[#9BA7B4] hover:border-white/20 hover:text-[#E6EDF3]"
                    )}
                  >
                    {entry.title}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        <PublicShareActions
          className="mt-4"
          exportImageUrl={`/prototype/${concept._id}/watermarked-image`}
          pinterestImageUrl={`/prototype/${concept._id}/pinterest-image`}
          redditImageUrl={`/prototype/${concept._id}/reddit-image`}
          title={concept.title}
          text={`${concept.baseModel?.name ?? "Unknown base model"} in ${concept.stylePreset?.name ?? "Unknown Style DNA"}`}
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/t/create?remix=${concept._id}`}
            className="inline-flex h-11 items-center justify-center rounded-[18px] border border-[#FFB84D]/35 bg-[#2A210F] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
          >
            Remix This Prototype
          </Link>
          {concept.baseModel?.slug && concept.stylePreset?.slug ? (
            <Link
              href={`/${concept.baseModel.slug}/${concept.stylePreset.slug}`}
              className="inline-flex h-11 items-center justify-center rounded-[18px] border border-[#58FFB2]/35 bg-[#13241B] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
            >
              Open Style Landing
            </Link>
          ) : null}
          <Link
            href="/showcase"
            className="inline-flex h-11 items-center justify-center rounded-[18px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
          >
            Back to Showcase
          </Link>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#161B22]">
            <div className="aspect-[4/3] bg-[#0D1117]">
              {concept.previewAsset?.publicUrl ? (
                <img
                  src={concept.previewAsset.publicUrl}
                  alt={concept.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-end p-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-[#6E7A88]">
                      Preview unavailable
                    </p>
                    <p className="mt-2 max-w-lg text-sm leading-6 text-[#9BA7B4]">
                      The preview asset exists, but this deployment does not expose a public URL yet.
                    </p>
                    {concept.previewAsset?.key ? (
                      <p className="mt-3 break-all font-mono text-xs text-[#C7D0DA]">
                        {concept.previewAsset.key}
                      </p>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Paint Mapping Plan</p>
            <div className="mt-4 space-y-3">
              {concept.paintPlan.entries.map((entry) => (
                <div
                  key={entry.roleSlug}
                  className="rounded-[18px] border border-white/10 bg-black/20 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-[#E6EDF3]">{entry.roleName}</p>
                      <p className="mt-1 text-xs text-[#6E7A88]">
                        {entry.recommendedArea ?? "Controlled application zone"}
                      </p>
                    </div>
                    <span className="text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
                      {entry.suggestedPaint?.code ?? "N/A"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[#C7D0DA]">
                    {entry.suggestedPaint
                      ? `${entry.suggestedPaint.brand} ${entry.suggestedPaint.colorName}`
                      : "No active paint mapping"}
                  </p>
                  <p className="mt-3 text-xs leading-5 text-[#9BA7B4]">{entry.rationale}</p>
                </div>
              ))}
            </div>
          </section>

          {feasibility ? (
            <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Spray Feasibility</p>
                  <h2 className="mt-3 text-2xl font-semibold">
                    {feasibility.beginnerDifficulty === "advanced"
                      ? "Advanced workflow"
                      : feasibility.beginnerDifficulty === "moderate"
                        ? "Moderate workflow"
                        : "Beginner-friendly workflow"}
                  </h2>
                </div>
                <div className="grid gap-2 text-right text-sm text-[#9BA7B4]">
                  <span>Masking {feasibility.maskingComplexity}/100</span>
                  <span>{feasibility.estimatedLayerCount} estimated layers</span>
                  <span>{feasibility.paintCostBand} paint cost band</span>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[#C7D0DA]">{feasibility.summary}</p>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <FeasibilityStat label="Beginner difficulty" value={feasibility.beginnerDifficulty} />
                <FeasibilityStat label="Surface compatibility" value={feasibility.surfaceCompatibility} />
                <FeasibilityStat label="Estimated layers" value={`${feasibility.estimatedLayerCount}`} />
                <FeasibilityStat label="Paint cost" value={feasibility.paintCostBand} />
              </div>
              <div className="mt-5 space-y-3">
                {feasibility.signals.map((signal: (typeof feasibility.signals)[number]) => (
                  <div key={signal.label} className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#E6EDF3]">{signal.label}</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
                        +{signal.impact}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#9BA7B4]">{signal.note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {shoppingList ? (
            <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Shopping List</p>
                  <h2 className="mt-3 text-2xl font-semibold">
                    {shoppingList.estimatedItemCount} recommended paint item{shoppingList.estimatedItemCount === 1 ? "" : "s"}
                  </h2>
                </div>
                <div className="grid gap-2 text-right text-sm text-[#9BA7B4]">
                  <span>{shoppingList.baseModelName}</span>
                  <span>{shoppingList.stylePresetName}</span>
                </div>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <ProcurementStat
                  label="Affiliate-ready"
                  value={`${shoppingList.purchaseSummary.affiliateReadyCount}`}
                  tone="green"
                />
                <ProcurementStat
                  label="Search-ready"
                  value={`${shoppingList.purchaseSummary.searchReadyCount}`}
                  tone="cyan"
                />
                <ProcurementStat
                  label="Region-limited"
                  value={`${shoppingList.purchaseSummary.regionLimitedCount}`}
                  tone="amber"
                />
              </div>
              <div className="mt-4 rounded-[18px] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">
                  Procurement confidence
                </p>
                <p className="mt-3 text-sm text-[#E6EDF3]">{shoppingList.procurementConfidence}</p>
                <p className="mt-2 text-xs leading-5 text-[#9BA7B4]">
                  {shoppingList.procurementConfidence === "strong"
                    ? "Most core items already have robust sourcing paths or search-ready global availability."
                    : shoppingList.procurementConfidence === "moderate"
                      ? "The concept is generally sourceable, but some items may still require manual search or substitution."
                      : "This concept has multiple constrained sourcing points, so procurement should be reviewed before execution."}
                </p>
              </div>
              {shoppingList.featuredPurchasePath ? (
                <div className="mt-4 rounded-[18px] border border-white/10 bg-black/20 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">
                    Best purchase path
                  </p>
                  <p className="mt-3 text-sm text-[#E6EDF3]">
                    {shoppingList.featuredPurchasePath.label}
                  </p>
                  <a
                    href={shoppingList.featuredPurchasePath.url}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      "mt-4 inline-flex h-10 items-center justify-center rounded-[16px] px-4 text-sm text-[#E6EDF3] transition-colors",
                      shoppingList.featuredPurchasePath.type === "affiliate"
                        ? "border border-[#58FFB2]/35 bg-[#13241B] hover:bg-white/10"
                        : "border border-[#3DD9FF]/35 bg-[#0E2430] hover:bg-white/10"
                    )}
                  >
                    {shoppingList.featuredPurchasePath.type === "affiliate"
                      ? "Open Best Purchase Link"
                      : "Search Best Purchase Path"}
                  </a>
                </div>
              ) : null}
              <ShoppingListActions
                className="mt-4"
                data={{
                  conceptTitle: shoppingList.conceptTitle,
                  baseModelName: shoppingList.baseModelName,
                  stylePresetName: shoppingList.stylePresetName,
                  materialPresetName: shoppingList.materialPresetName,
                  bundles: shoppingList.bundles,
                  notes: shoppingList.notes,
                }}
              />
              <div className="mt-5">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#6E7A88]">Core Bundle</p>
                <div className="mt-3 space-y-3">
                  {shoppingList.bundles.core.map((item: (typeof shoppingList.bundles.core)[number]) => (
                    <ShoppingListItem key={item.mappingKey} item={item} />
                  ))}
                </div>
              </div>

              {shoppingList.bundles.support.length > 0 ? (
                <div className="mt-6">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#6E7A88]">Support Bundle</p>
                  <div className="mt-3 space-y-3">
                    {shoppingList.bundles.support.map((item: (typeof shoppingList.bundles.support)[number]) => (
                      <ShoppingListItem key={item.mappingKey} item={item} />
                    ))}
                  </div>
                </div>
              ) : null}

              {shoppingList.bundles.backup.length > 0 ? (
                <div className="mt-6">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#6E7A88]">Backup Bundle</p>
                  <div className="mt-3 space-y-3">
                    {shoppingList.bundles.backup.map((item: (typeof shoppingList.bundles.backup)[number]) => (
                      <ShoppingListItem key={item.mappingKey} item={item} />
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="mt-5 space-y-2 text-xs leading-5 text-[#9BA7B4]">
                {shoppingList.notes.map((note: (typeof shoppingList.notes)[number]) => (
                  <p key={note}>{note}</p>
                ))}
              </div>
            </section>
          ) : null}

          {recommendations ? (
            <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Smart Recommendations</p>
                  <h2 className="mt-3 text-2xl font-semibold">
                    {recommendations.feasibilityBias === "practical"
                      ? "Practical-first alternatives for this concept"
                      : "Alternative paths for this concept"}
                  </h2>
                </div>
                <div className="grid gap-2 text-right text-sm text-[#9BA7B4]">
                  <span>{recommendations.currentStyle?.name ?? "Unknown Style DNA"}</span>
                  <span>{recommendations.currentMaterial?.name ?? "Unknown material profile"}</span>
                  <span>{recommendations.feasibilityBias} bias</span>
                </div>
              </div>

              {recommendations.alternativeStyles.length > 0 ? (
                <RecommendationGroup
                  conceptId={concept._id}
                  title="Adjacent Style DNA"
                  items={recommendations.alternativeStyles}
                  onFeedback={setRecommendationFeedback}
                />
              ) : null}

              {recommendations.easierMaterials.length > 0 ? (
                <RecommendationGroup
                  conceptId={concept._id}
                  title="Easier Finish Alternatives"
                  items={recommendations.easierMaterials}
                  onFeedback={setRecommendationFeedback}
                />
              ) : null}

              {recommendations.beginnerAlternatives.length > 0 ? (
                <RecommendationGroup
                  conceptId={concept._id}
                  title="Beginner Workflow Alternatives"
                  items={recommendations.beginnerAlternatives}
                  onFeedback={setRecommendationFeedback}
                />
              ) : null}

              {recommendations.sourcingAlternatives.length > 0 ? (
                <RecommendationGroup
                  conceptId={concept._id}
                  title="Sourcing Alternatives"
                  items={recommendations.sourcingAlternatives}
                  onFeedback={setRecommendationFeedback}
                />
              ) : null}
            </section>
          ) : null}

          {concept.remixes.length > 0 ? (
            <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Remix branches</p>
                  <h2 className="mt-3 text-2xl font-semibold">
                    {concept.remixCount} community branch{concept.remixCount === 1 ? "" : "es"}
                  </h2>
                </div>
                <Link
                  href={`/t/create?remix=${concept._id}`}
                  className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#FFB84D]/35 bg-[#2A210F] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
                >
                  Start Your Remix
                </Link>
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                {concept.remixes.map((remix: (typeof concept.remixes)[number]) => (
                  <Link
                    key={remix._id}
                    href={`/prototype/${remix._id}`}
                    className="rounded-[20px] border border-white/10 bg-black/20 p-4 transition-colors hover:border-white/20"
                  >
                    <p className="text-sm font-semibold text-[#E6EDF3]">{remix.title}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#6E7A88]">
                      {remix.baseModel?.name ?? "Unknown base model"} · {remix.stylePreset?.name ?? "Unknown Style DNA"}
                    </p>
                    <p className="mt-3 text-sm text-[#9BA7B4]">
                      {remix.owner?.handle ?? remix.owner?.fullName ?? "Unknown pilot"} · {remix.weatheringLevel}
                    </p>
                  </Link>
                ))}
              </div>
              <p className="mt-5 text-xs leading-5 text-[#9BA7B4]">
                This branch history shows the most recent public descendants of the current prototype. Use it to track
                how one concept split into multiple community directions.
              </p>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6">
          {concept.sourceConcept ? (
            <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Source lineage</p>
              <h2 className="mt-4 text-xl font-semibold">{concept.sourceConcept.title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
                This prototype is a public branch derived from an earlier shareable concept.
              </p>
              <div className="mt-4 space-y-3">
                <MetaRow
                  label="Pilot"
                  value={
                    concept.sourceConcept.owner ? (
                      <Link
                        href={`/pilot/${concept.sourceConcept.owner.handle}`}
                        className="transition-colors hover:text-[#E6EDF3]"
                      >
                        @{concept.sourceConcept.owner.handle}
                      </Link>
                    ) : (
                      "Unknown"
                    )
                  }
                />
                <MetaRow label="Base Model" value={concept.sourceConcept.baseModel?.name ?? "Unknown"} />
                <MetaRow label="Style DNA" value={concept.sourceConcept.stylePreset?.name ?? "Unknown"} />
              </div>
              <Link
                href={`/prototype/${concept.sourceConcept._id}`}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
              >
                Open Source Prototype
              </Link>
              {concept.sourceConcept.baseModel?.slug && concept.sourceConcept.stylePreset?.slug ? (
                <Link
                  href={`/${concept.sourceConcept.baseModel.slug}/${concept.sourceConcept.stylePreset.slug}`}
                  className="mt-3 inline-flex h-10 items-center justify-center rounded-[16px] border border-[#58FFB2]/35 bg-[#13241B] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
                >
                  Open Source Landing
                </Link>
              ) : null}
            </section>
          ) : null}

          <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Prototype Metadata</p>
            <div className="mt-5 space-y-4">
              <MetaRow
                label="Pilot"
                value={
                  concept.owner ? (
                    <Link
                      href={`/pilot/${concept.owner.handle}`}
                      className="transition-colors hover:text-[#E6EDF3]"
                    >
                      @{concept.owner.handle}
                    </Link>
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
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Spray Notes</p>
            <div className="mt-4 space-y-3 text-sm leading-6 text-[#C7D0DA]">
              {concept.paintPlan.sprayNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </section>

          {concept.notes ? (
            <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Operator Note</p>
              <p className="mt-4 text-sm leading-6 text-[#C7D0DA]">{concept.notes}</p>
            </section>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-3">
      <span className="text-[11px] uppercase tracking-[0.22em] text-[#6E7A88]">{label}</span>
      <span className="max-w-[58%] text-right text-sm text-[#E6EDF3]">{value}</span>
    </div>
  );
}

function FeasibilityStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">{label}</p>
      <p className="mt-3 text-lg font-semibold text-[#E6EDF3]">{value}</p>
    </div>
  );
}

function RecommendationGroup({
  conceptId,
  items,
  onFeedback,
  title,
}: {
  conceptId: string;
  items: Array<{
    type: string;
    label: string;
    value: string;
    rationale: string;
    feedback: {
      helpful: boolean;
      notHelpful: boolean;
      try: boolean;
    };
  }>;
  onFeedback: ReturnType<typeof useMutation<typeof api.recommendationFeedback.setRecommendationFeedback>>;
  title: string;
}) {
  return (
    <div className="mt-5">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#6E7A88]">{title}</p>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={`${item.type}-${item.value}`} className="rounded-[18px] border border-white/10 bg-black/20 p-4">
            <p className="text-sm font-semibold text-[#E6EDF3]">{item.label}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#6E7A88]">{item.type}</p>
            <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">{item.rationale}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <FeedbackButton
                active={item.feedback.helpful}
                label="Helpful"
                onClick={() => {
                  void onFeedback({
                    conceptId: conceptId as Id<"concepts">,
                    recommendationType: item.type,
                    recommendationValue: item.value,
                    kind: "helpful",
                  });
                }}
              />
              <FeedbackButton
                active={item.feedback.notHelpful}
                label="Not Useful"
                onClick={() => {
                  void onFeedback({
                    conceptId: conceptId as Id<"concepts">,
                    recommendationType: item.type,
                    recommendationValue: item.value,
                    kind: "not-helpful",
                  });
                }}
              />
              <FeedbackButton
                active={item.feedback.try}
                label="Try This"
                onClick={() => {
                  void onFeedback({
                    conceptId: conceptId as Id<"concepts">,
                    recommendationType: item.type,
                    recommendationValue: item.value,
                    kind: "try",
                  });
                }}
              />
              <Link
                href={buildCreateRecommendationHref(conceptId, item)}
                className="inline-flex h-9 items-center justify-center rounded-[14px] border border-[#3DD9FF]/35 bg-[#0E2430] px-3 text-xs text-[#E6EDF3] transition-colors hover:bg-white/10"
              >
                Open In Create
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShoppingListItem({
  item,
}: {
  item: {
    mappingKey: string;
    brand: string;
    line?: string;
    code: string;
    colorName: string;
    finishType?: string;
    availabilityRegion?: string;
    affiliateUrl?: string;
    hexPreview?: string;
    recommendedRoles: string[];
    roleAreas: string[];
    purchasePriority: string;
    procurementStatus: "affiliate-ready" | "search-ready" | "region-limited";
    purchaseSearchUrl: string;
    brandAlternatives: Array<{
      mappingKey: string;
      brand: string;
      line?: string;
      code: string;
      colorName: string;
      availabilityRegion?: string;
      affiliateUrl?: string;
      procurementStatus: "affiliate-ready" | "search-ready" | "region-limited";
      purchaseSearchUrl: string;
    }>;
    sourcingAdvice: string;
  };
}) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#E6EDF3]">
            {item.brand} {item.code}
          </p>
          <p className="mt-2 text-sm text-[#C7D0DA]">
            {item.colorName}
            {item.line ? ` · ${item.line}` : ""}
            {item.finishType ? ` · ${item.finishType}` : ""}
          </p>
          <p className="mt-2 text-xs leading-5 text-[#9BA7B4]">
            Roles: {item.recommendedRoles.join(", ")}
          </p>
          <p className="mt-1 text-xs leading-5 text-[#6E7A88]">
            Areas: {item.roleAreas.join(", ")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {item.hexPreview ? (
            <span
              className="h-8 w-8 rounded-full border border-white/10"
              style={{ backgroundColor: item.hexPreview }}
            />
          ) : null}
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
            {item.availabilityRegion ?? "Region N/A"}
          </span>
          <span className="text-[11px] uppercase tracking-[0.18em] text-[#FFB84D]">
            {item.purchasePriority}
          </span>
          <ProcurementPill status={item.procurementStatus} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        {item.affiliateUrl ? (
          <a
            href={item.affiliateUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#58FFB2]/35 bg-[#13241B] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
          >
            Open Purchase Link
          </a>
        ) : null}
        <a
          href={item.purchaseSearchUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
        >
          Search This Paint
        </a>
      </div>
      {!item.affiliateUrl ? (
        <div className="mt-4 rounded-[14px] border border-white/10 bg-[#0D1117] p-3 text-xs leading-5 text-[#9BA7B4]">
          No direct purchase link is configured yet. Use the brand, line, and code to source this paint through your
          preferred store.
        </div>
      ) : null}
      <div className="mt-4 rounded-[14px] border border-white/10 bg-[#0D1117] p-3 text-xs leading-5 text-[#9BA7B4]">
        {item.sourcingAdvice}
      </div>
      {item.brandAlternatives.length > 0 ? (
        <div className="mt-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">Brand alternatives</p>
          <div className="mt-3 space-y-2">
            {item.brandAlternatives.map((alternative) => (
              <div
                key={alternative.mappingKey}
                className="rounded-[14px] border border-white/10 bg-[#0D1117] p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-[#E6EDF3]">
                      {alternative.brand} {alternative.code}
                    </p>
                    <p className="mt-1 text-xs text-[#9BA7B4]">
                      {alternative.colorName}
                      {alternative.line ? ` · ${alternative.line}` : ""}
                    </p>
                  </div>
                  <ProcurementPill status={alternative.procurementStatus} />
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {alternative.affiliateUrl ? (
                    <a
                      href={alternative.affiliateUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-[14px] border border-[#58FFB2]/35 bg-[#13241B] px-3 text-xs text-[#E6EDF3] transition-colors hover:bg-white/10"
                    >
                      Buy Alternative
                    </a>
                  ) : null}
                  <a
                    href={alternative.purchaseSearchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-9 items-center justify-center rounded-[14px] border border-[#3DD9FF]/35 bg-[#0E2430] px-3 text-xs text-[#E6EDF3] transition-colors hover:bg-white/10"
                  >
                    Search Alternative
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ProcurementStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "green" | "cyan" | "amber";
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-white/10 bg-black/20 p-4">
      <p
        className={cn(
          "text-[11px] uppercase tracking-[0.18em]",
          tone === "green" && "text-[#58FFB2]",
          tone === "cyan" && "text-[#3DD9FF]",
          tone === "amber" && "text-[#FFB84D]"
        )}
      >
        {label}
      </p>
      <p className="mt-3 text-lg font-semibold text-[#E6EDF3]">{value}</p>
    </div>
  );
}

function ProcurementPill({
  status,
}: {
  status: "affiliate-ready" | "search-ready" | "region-limited";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
        status === "affiliate-ready" && "border-[#58FFB2]/30 bg-[#58FFB2]/10 text-[#A6FFD5]",
        status === "search-ready" && "border-[#3DD9FF]/30 bg-[#3DD9FF]/10 text-[#8FEAFF]",
        status === "region-limited" && "border-[#FFB84D]/30 bg-[#FFB84D]/10 text-[#FFD59A]"
      )}
    >
      {status}
    </span>
  );
}

function FeedbackButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-[14px] border px-3 text-xs transition-colors",
        active
          ? "border-[#58FFB2]/35 bg-[#13241B] text-[#E6EDF3]"
          : "border-white/10 text-[#9BA7B4] hover:border-white/20 hover:text-[#E6EDF3]"
      )}
    >
      {label}
    </button>
  );
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

function formatMoodTagLabel(tag: string) {
  if (tag === "command-presence") {
    return "Command Presence";
  }
  if (tag === "stealth-tension") {
    return "Stealth Tension";
  }
  if (tag === "industrial-hazard") {
    return "Industrial Hazard";
  }
  if (tag === "reactor-glow") {
    return "Reactor Glow";
  }
  if (tag === "field-fatigue") {
    return "Field Fatigue";
  }
  if (tag === "ceremonial-clean") {
    return "Ceremonial Clean";
  }
  return tag;
}
