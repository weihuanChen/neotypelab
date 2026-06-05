"use client";
/* eslint-disable @next/next/no-img-element */

import { ConceptEngagementBar } from "@/components/public/ConceptEngagementBar";
import { PublicShareActions } from "@/components/public/PublicShareActions";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Link from "next/link";

export function SeoLandingPageView({
  baseModelSlug,
  stylePresetSlug,
}: {
  baseModelSlug: string;
  stylePresetSlug: string;
}) {
  const landing = useQuery(api.showcase.getSeoLandingPage, {
    baseModelSlug,
    stylePresetSlug,
  });

  if (landing === undefined) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">SEO Surface</p>
        <h1 className="mt-4 text-3xl font-semibold">Resolving landing page telemetry</h1>
      </section>
    );
  }

  if (landing === null) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-8 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Unavailable</p>
        <h1 className="mt-4 text-3xl font-semibold">This landing page is not available.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9BA7B4]">
          The selected base model and Style DNA combination does not yet have a public showcase surface.
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

  const featuredConcept = landing.featuredConcept;

  return (
    <div className="space-y-6 text-[#E6EDF3]">
      <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">SEO Landing Surface</p>
            <h1 className="mt-4 text-3xl font-semibold">
              {landing.baseModel.name} in {landing.stylePreset.name}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
              {landing.stylePreset.shortDescription ??
                "Public concept references, paint mapping cues, and remix-ready surfaces for this base model and Style DNA pairing."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
              <span>{landing.baseModel.series ?? "Unknown series"}</span>
              <span>{landing.baseModel.grade ?? "Unknown grade"}</span>
              <span>{landing.stylePreset.category ?? "Uncategorized"}</span>
              {landing.stylePreset.isFeaturedStyle ? <span>Featured style</span> : null}
              <span>{landing.conceptCount} public concept{landing.conceptCount === 1 ? "" : "s"}</span>
            </div>
          </div>
          <div className="grid gap-2 text-right text-sm text-[#9BA7B4]">
            <span>{landing.aggregate.likes} likes</span>
            <span>{landing.aggregate.saves} saves</span>
            <span>{landing.aggregate.remixes} remix branches</span>
          </div>
        </div>
        <PublicShareActions
          className="mt-5"
          title={`${landing.baseModel.name} in ${landing.stylePreset.name}`}
          text={`${landing.conceptCount} public concept${landing.conceptCount === 1 ? "" : "s"} ready for sharing and remix discovery`}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Public Concepts" value={`${landing.conceptCount}`} accent="text-[#58FFB2]" />
        <MetricCard label="Likes" value={`${landing.aggregate.likes}`} accent="text-[#FFB84D]" />
        <MetricCard label="Saves" value={`${landing.aggregate.saves}`} accent="text-[#3DD9FF]" />
        <MetricCard label="Remixes" value={`${landing.aggregate.remixes}`} accent="text-[#E6EDF3]" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[#161B22]">
            <div className="aspect-[4/3] bg-[#0D1117]">
              {featuredConcept.previewAsset?.publicUrl ? (
                <img
                  src={featuredConcept.previewAsset.publicUrl}
                  alt={featuredConcept.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-end p-6">
                  <p className="text-sm text-[#9BA7B4]">Featured preview unavailable</p>
                </div>
              )}
            </div>
            <div className="space-y-4 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Featured public concept</p>
                  <Link href={`/prototype/${featuredConcept._id}`} className="mt-3 block text-2xl font-semibold text-[#E6EDF3]">
                    {featuredConcept.title}
                  </Link>
                </div>
                {featuredConcept.owner ? (
                  <Link
                    href={`/pilot/${featuredConcept.owner.handle}`}
                    className="text-sm text-[#9BA7B4] transition-colors hover:text-[#E6EDF3]"
                  >
                    @{featuredConcept.owner.handle}
                  </Link>
                ) : null}
              </div>
              <ConceptEngagementBar
                conceptId={featuredConcept._id}
                likeCount={featuredConcept.engagement.likeCount}
                saveCount={featuredConcept.engagement.saveCount}
                viewerHasLiked={featuredConcept.engagement.viewerHasLiked}
                viewerHasSaved={featuredConcept.engagement.viewerHasSaved}
              />
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Public concept references</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {landing.concepts.map((concept) => (
                <article key={concept._id} className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
                  <div className="aspect-[4/3] bg-[#0D1117]">
                    {concept.previewAsset?.publicUrl ? (
                      <img
                        src={concept.previewAsset.publicUrl}
                        alt={concept.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-end p-5">
                        <p className="text-sm text-[#9BA7B4]">Preview unavailable</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4 p-5">
                    <div>
                      <Link href={`/prototype/${concept._id}`} className="text-xl font-semibold text-[#E6EDF3]">
                        {concept.title}
                      </Link>
                      <p className="mt-2 text-sm leading-6 text-[#9BA7B4]">
                        {concept.materialPreset?.name ?? "Unknown material profile"} · {concept.weatheringLevel}
                      </p>
                    </div>
                    <ConceptEngagementBar
                      conceptId={concept._id}
                      likeCount={concept.engagement.likeCount}
                      saveCount={concept.engagement.saveCount}
                      viewerHasLiked={concept.engagement.viewerHasLiked}
                      viewerHasSaved={concept.engagement.viewerHasSaved}
                      compact
                    />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Style DNA overview</p>
            <div className="mt-4 space-y-3">
              <MetaRow label="Base model" value={landing.baseModel.name} />
              <MetaRow label="Series" value={landing.baseModel.series ?? "Unknown"} />
              <MetaRow label="Grade" value={landing.baseModel.grade ?? "Unknown"} />
              <MetaRow label="Style DNA" value={landing.stylePreset.name} />
              <MetaRow label="Category" value={landing.stylePreset.category ?? "Unknown"} />
              <MetaRow
                label="Creator signal"
                value={landing.stylePreset.isFeaturedStyle ? "Featured style" : "Standard style"}
              />
              <MetaRow label="Contrast" value={landing.stylePreset.contrastLevel ?? "Unknown"} />
              <MetaRow label="Weathering bias" value={landing.stylePreset.weatheringProfile ?? "Unknown"} />
            </div>
          </section>

          {landing.paintPlan ? (
            <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Paint mapping cues</p>
              <div className="mt-4 space-y-3">
                {landing.paintPlan.entries.slice(0, 4).map((entry) => (
                  <div key={entry.roleSlug} className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#E6EDF3]">{entry.roleName}</p>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
                        {entry.suggestedPaint?.code ?? "N/A"}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#C7D0DA]">
                      {entry.suggestedPaint
                        ? `${entry.suggestedPaint.brand} ${entry.suggestedPaint.colorName}`
                        : "No active paint mapping"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">SEO keywords</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {landing.stylePreset.seoKeywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-[#9BA7B4]"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({
  accent,
  label,
  value,
}: {
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-[#161B22] p-5">
      <p className={`text-xs uppercase tracking-[0.24em] ${accent}`}>{label}</p>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">{label}</span>
      <span className="max-w-[58%] text-right text-sm text-[#E6EDF3]">{value}</span>
    </div>
  );
}
