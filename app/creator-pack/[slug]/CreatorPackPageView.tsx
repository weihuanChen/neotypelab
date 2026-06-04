"use client";
/* eslint-disable @next/next/no-img-element */

import { ConceptEngagementBar } from "@/components/public/ConceptEngagementBar";
import { PackEngagementBar } from "@/components/public/PackEngagementBar";
import { PublicShareActions } from "@/components/public/PublicShareActions";
import { api } from "@/convex/_generated/api";
import { getCreatorPackAccessCopy } from "@/lib/creatorPackAccess";
import { useQuery } from "convex/react";
import Link from "next/link";

type CreatorPackViewModel = {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  tagline?: string;
  packType: "free" | "premium";
  isFeatured: boolean;
  engagement: {
    likeCount: number;
    saveCount: number;
    viewerHasLiked: boolean;
    viewerHasSaved: boolean;
  };
  analytics: {
    publicConceptCount: number;
    publicRemixCount: number;
    publicLikeCount: number;
    publicSaveCount: number;
    featuredStyleCount: number;
  };
  creator: {
    handle: string;
    fullName: string;
    pictureUrl?: string;
  };
  styles: Array<{
    _id: string;
    name: string;
    slug: string;
    category?: string;
    shortDescription?: string;
    isFeaturedStyle: boolean;
  }>;
  baseModels: Array<{
    _id: string;
    name: string;
    slug: string;
    series?: string;
    grade?: string;
  }>;
  materials: Array<{
    _id: string;
    name: string;
    slug: string;
    finishType: string;
  }>;
  concepts: Array<{
    _id: string;
    title: string;
    baseModel: {
      name: string;
      slug: string;
      grade?: string;
    } | null;
    stylePreset: {
      name: string;
      slug: string;
      category?: string;
      isFeaturedStyle?: boolean;
    } | null;
    previewAsset: {
      publicUrl?: string;
      key: string;
      contentType?: string;
    } | null;
    engagement: {
      likeCount: number;
      saveCount: number;
      viewerHasLiked: boolean;
      viewerHasSaved: boolean;
    };
  }>;
};

export function CreatorPackPageView({
  pack,
}: {
  pack: CreatorPackViewModel;
}) {
  const viewer = useQuery(api.users.viewer);
  const access = getCreatorPackAccessCopy({
    creatorHandle: pack.creator.handle,
    packType: pack.packType,
    viewer,
  });

  return (
    <div className="space-y-6 text-[#E6EDF3]">
      <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-4xl">
            <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Creator Pack</p>
            <h1 className="mt-4 text-3xl font-semibold">{pack.name}</h1>
            {pack.tagline ? (
              <p className="mt-3 text-sm leading-6 text-[#C7D0DA]">{pack.tagline}</p>
            ) : null}
            <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
              {pack.description ??
                "Curated starter set built from creator-owned Style DNA, supported base models, and material presets."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
              <span>{pack.packType}</span>
              {pack.isFeatured ? <span>Featured pack</span> : null}
              <span>{pack.styles.length} styles</span>
              <span>{pack.baseModels.length} base models</span>
              <span>{pack.materials.length} materials</span>
            </div>
          </div>
          <div className="grid gap-2 text-right text-sm text-[#9BA7B4]">
            <Link href={`/pilot/${pack.creator.handle}`} className="transition-colors hover:text-[#E6EDF3]">
              @{pack.creator.handle}
            </Link>
            <span>{pack.creator.fullName}</span>
          </div>
        </div>
        <PublicShareActions
          className="mt-5"
          title={pack.name}
          text={`${pack.styles.length} styles · ${pack.baseModels.length} base models · ${pack.materials.length} materials`}
        />
        <PackEngagementBar
          className="mt-4"
          creatorPackId={pack._id}
          likeCount={pack.engagement.likeCount}
          saveCount={pack.engagement.saveCount}
          viewerHasLiked={pack.engagement.viewerHasLiked}
          viewerHasSaved={pack.engagement.viewerHasSaved}
        />
        {pack.packType === "premium" ? (
          <div className="mt-4 rounded-[18px] border border-[#3DD9FF]/20 bg-[#3DD9FF]/10 p-4 text-sm leading-6 text-[#C7D0DA]">
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#8FEAFF]">{access.badge}</p>
            <p className="mt-3">{access.message}</p>
          </div>
        ) : null}
        {(pack.baseModels[0] || pack.styles[0] || pack.materials[0]) ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {access.allowed ? (
              <>
                {creatorPackVariants.map((variant) => (
                  <Link
                    key={variant.id}
                    href={buildCreateHref(pack, variant)}
                    className="inline-flex h-11 items-center justify-center rounded-[18px] border border-[#58FFB2]/35 bg-[#13241B] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-[#193021]"
                  >
                    {variant.label}
                  </Link>
                ))}
                {pack.concepts[0] ? (
                  <Link
                    href={buildRemixHref(pack, pack.concepts[0]._id)}
                    className="inline-flex h-11 items-center justify-center rounded-[18px] border border-[#FFB84D]/35 bg-[#2A210F] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-[#382C13]"
                  >
                    Remix Featured Concept
                  </Link>
                ) : null}
              </>
            ) : (
              <span className="inline-flex h-11 items-center justify-center rounded-[18px] border border-white/10 px-4 text-sm text-[#6E7A88]">
                Premium launch locked
              </span>
            )}
            <Link
              href={`/creator/${pack.creator.handle}`}
              className="inline-flex h-11 items-center justify-center rounded-[18px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/5"
            >
              View Creator Hub
            </Link>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <InfoCard label="Styles" value={`${pack.styles.length}`} />
        <InfoCard label="Concepts" value={`${pack.analytics.publicConceptCount}`} />
        <InfoCard label="Likes" value={`${pack.analytics.publicLikeCount}`} />
        <InfoCard label="Saves" value={`${pack.analytics.publicSaveCount}`} />
        <InfoCard label="Remixes" value={`${pack.analytics.publicRemixCount}`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Pack Style DNA</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {pack.styles.map((style: CreatorPackViewModel["styles"][number]) => (
                <article key={style._id} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap gap-2">
                    {style.category ? (
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
                        {style.category}
                      </span>
                    ) : null}
                    {style.isFeaturedStyle ? (
                      <span className="rounded-full border border-[#FFB84D]/30 bg-[#FFB84D]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#FFD9A0]">
                        featured style
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-4 text-xl font-semibold">{style.name}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#9BA7B4]">
                    {style.shortDescription ?? "Creator-linked style preset in this pack."}
                  </p>
                  <Link
                    href={`/showcase?style=${style.slug}`}
                    className="mt-4 inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/5"
                  >
                    Filter Showcase
                  </Link>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Related public concepts</p>
            {pack.concepts.length === 0 ? (
              <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm leading-6 text-[#9BA7B4]">
                  No public concepts are currently attached to this pack&apos;s Style DNA.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {pack.concepts.map((concept: CreatorPackViewModel["concepts"][number]) => (
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
                        <Link href={`/prototype/${concept._id}`} className="text-xl font-semibold">
                          {concept.title}
                        </Link>
                        <p className="mt-2 text-sm leading-6 text-[#9BA7B4]">
                          {concept.baseModel?.name ?? "Unknown base model"} ·{" "}
                          {concept.stylePreset?.name ?? "Unknown Style DNA"}
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
                      <div className="flex flex-wrap gap-3">
                        {access.allowed ? (
                          <Link
                            href={buildRemixHref(pack, concept._id)}
                            className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#FFB84D]/35 bg-[#2A210F] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-[#382C13]"
                          >
                            Remix In Create
                          </Link>
                        ) : (
                          <span className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#6E7A88]">
                            Premium remix locked
                          </span>
                        )}
                        {concept.baseModel?.slug && concept.stylePreset?.slug ? (
                          <Link
                            href={`/${concept.baseModel.slug}/${concept.stylePreset.slug}`}
                            className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/5"
                          >
                            Open Style Landing
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Supported base models</p>
            <div className="mt-4 space-y-3">
              {pack.baseModels.map((model: CreatorPackViewModel["baseModels"][number]) => (
                <div key={model._id} className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-[#E6EDF3]">{model.name}</p>
                  <p className="mt-2 text-xs leading-5 text-[#9BA7B4]">
                    {model.series ?? "Unknown series"} · {model.grade ?? "Unknown grade"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Recommended materials</p>
            <div className="mt-4 space-y-3">
              {pack.materials.map((material: CreatorPackViewModel["materials"][number]) => (
                <div key={material._id} className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                  <p className="text-sm font-semibold text-[#E6EDF3]">{material.name}</p>
                  <p className="mt-2 text-xs leading-5 text-[#9BA7B4]">{material.finishType}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Pack analytics</p>
            <div className="mt-4 space-y-3">
              <MetaStat label="Featured styles" value={`${pack.analytics.featuredStyleCount}`} />
              <MetaStat label="Pack likes" value={`${pack.engagement.likeCount}`} />
              <MetaStat label="Pack saves" value={`${pack.engagement.saveCount}`} />
              <MetaStat label="Community concept saves" value={`${pack.analytics.publicSaveCount}`} />
              <MetaStat label="Community concept remixes" value={`${pack.analytics.publicRemixCount}`} />
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-[#161B22] p-5">
      <p className="text-xs uppercase tracking-[0.24em] text-[#58FFB2]">{label}</p>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function MetaStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">{label}</span>
      <span className="text-sm text-[#E6EDF3]">{value}</span>
    </div>
  );
}

const creatorPackVariants: Array<{
  id: "baseline" | "field" | "stealth";
  label: string;
  moodTags: string[];
  weathering: "clean" | "light" | "heavy";
}> = [
  {
    id: "baseline",
    label: "Launch Baseline",
    moodTags: ["command-presence"],
    weathering: "clean",
  },
  {
    id: "field",
    label: "Launch Field Variant",
    moodTags: ["field-fatigue", "industrial-hazard"],
    weathering: "heavy",
  },
  {
    id: "stealth",
    label: "Launch Stealth Variant",
    moodTags: ["stealth-tension"],
    weathering: "light",
  },
];

function buildCreateHref(
  pack: CreatorPackViewModel,
  variant: (typeof creatorPackVariants)[number]
) {
  const params = new URLSearchParams();

  if (pack.baseModels[0]?.slug) {
    params.set("recommendedBaseModel", pack.baseModels[0].slug);
  }
  if (pack.styles[0]?.slug) {
    params.set("recommendedStyle", pack.styles[0].slug);
  }
  if (pack.materials[0]?.slug) {
    params.set("recommendedMaterial", pack.materials[0].slug);
  }
  params.set("creatorPack", pack.slug);
  params.set("creatorPackVariant", variant.id);
  params.set("recommendedMoodTags", variant.moodTags.join(","));
  params.set("recommendedWeathering", variant.weathering);

  return `/t/create?${params.toString()}`;
}

function buildRemixHref(pack: CreatorPackViewModel, conceptId: string) {
  const params = new URLSearchParams();
  params.set("remix", conceptId);
  params.set("creatorPack", pack.slug);
  params.set("creatorPackVariant", "remix-seed");
  return `/t/create?${params.toString()}`;
}
