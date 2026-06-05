"use client";
/* eslint-disable @next/next/no-img-element */

import { ConceptEngagementBar } from "@/components/public/ConceptEngagementBar";
import { CreatorPackCard } from "@/components/public/CreatorPackCard";
import { CreatorRankingCard } from "@/components/public/CreatorRankingCard";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const showcaseSortOptions = [
  {
    id: "trending",
    label: "Trending",
    description: "Fresh public prototypes weighted by remix activity.",
  },
  {
    id: "recent",
    label: "Recent",
    description: "Newest public launches across the showcase.",
  },
  {
    id: "most-remixed",
    label: "Most Remixed",
    description: "Share surfaces generating the strongest branching activity.",
  },
  {
    id: "most-saved",
    label: "Most Saved",
    description: "Community concepts people are actively holding onto for later.",
  },
] as const;

const defaultShowcaseSort = "trending";
const dayMs = 1000 * 60 * 60 * 24;

export function ShowcaseFeed({ terminalMode = false }: { terminalMode?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sortMode = parseShowcaseSort(searchParams.get("sort"));
  const baseModelFilter = searchParams.get("baseModel");
  const styleFilter = searchParams.get("style");
  const categoryFilter = searchParams.get("category");
  const creatorFilter = searchParams.get("creator");
  const concepts = useQuery(api.showcase.listPublicConcepts);
  const creatorPacks = useQuery(api.showcase.listPublicCreatorPacks);
  const rankedCreators = useQuery(api.showcase.listRankedPublicCreators);
  const activeSort = showcaseSortOptions.find((option) => option.id === sortMode) ?? showcaseSortOptions[0];
  const filterOptions =
    concepts === undefined
      ? undefined
      : {
          baseModels: uniqueOptions(
            concepts.map((concept) => ({
              value: concept.baseModel?.slug,
              label: concept.baseModel?.name,
            }))
          ),
          styles: uniqueOptions(
            concepts.map((concept) => ({
              value: concept.stylePreset?.slug,
              label: concept.stylePreset?.name,
            }))
          ),
          categories: uniqueOptions(
            concepts.map((concept) => ({
              value: concept.stylePreset?.category,
              label: concept.stylePreset?.category,
            }))
          ),
          creators: uniqueOptions(
            concepts.map((concept) => ({
              value: concept.owner?.handle,
              label: concept.owner?.handle,
            }))
          ),
        };
  const filteredConcepts =
    concepts === undefined
      ? undefined
      : concepts.filter((concept) => {
          if (baseModelFilter && concept.baseModel?.slug !== baseModelFilter) {
            return false;
          }
          if (styleFilter && concept.stylePreset?.slug !== styleFilter) {
            return false;
          }
          if (categoryFilter && concept.stylePreset?.category !== categoryFilter) {
            return false;
          }
          if (creatorFilter && concept.owner?.handle !== creatorFilter) {
            return false;
          }
          return true;
        });
  const sortedConcepts =
    filteredConcepts === undefined
      ? undefined
      : [...filteredConcepts].sort((left, right) => compareConcepts(left, right, sortMode));
  const sortedCreatorPacks =
    creatorPacks === undefined
      ? undefined
      : [...creatorPacks].sort((left, right) => compareCreatorPacks(left, right, sortMode));

  if (sortedConcepts === undefined) {
    return (
      <section className="border-2 border-line-primary bg-surface p-6 text-ink-primary">
        <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">Showcase Sync</p>
        <h2 className="mt-4 text-3xl font-semibold">Indexing public prototype signals</h2>
      </section>
    );
  }

  return (
    <div className="space-y-6 text-ink-primary">
      <section
        className={cn(
          "rounded-[28px] border border-line-secondary p-6",
          terminalMode ? "bg-panel" : "bg-panel/95 backdrop-blur"
        )}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">Public Showcase</p>
        <h1 className="mt-4 text-3xl font-semibold">Published prototype surface</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
          This feed only surfaces concepts marked `public`. Unlisted operator work stays
          off the grid but remains accessible by direct share link.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {showcaseSortOptions.map((option) => {
            const active = option.id === sortMode;
            return (
              <Link
                key={option.id}
                href={buildShowcaseHref(pathname, searchParams, { sort: option.id })}
                className={cn(
                  "inline-flex h-10 items-center justify-center rounded-[16px] border px-4 text-sm transition-colors",
                  active
                    ? "border-accent-teal bg-accent-teal/10 text-ink-primary"
                    : "border-line-secondary text-ink-secondary hover:border-line-active hover:text-ink-primary"
                )}
              >
                {option.label}
              </Link>
            );
          })}
        </div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
          Discovery lens: {activeSort.description}
        </p>
        {filterOptions ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-4">
            <FilterGroup
              label="Base Model"
              activeValue={baseModelFilter}
              pathname={pathname}
              searchParams={searchParams}
              paramName="baseModel"
              options={filterOptions.baseModels}
            />
            <FilterGroup
              label="Style DNA"
              activeValue={styleFilter}
              pathname={pathname}
              searchParams={searchParams}
              paramName="style"
              options={filterOptions.styles}
            />
            <FilterGroup
              label="Category"
              activeValue={categoryFilter}
              pathname={pathname}
              searchParams={searchParams}
              paramName="category"
              options={filterOptions.categories}
            />
            <FilterGroup
              label="Creator"
              activeValue={creatorFilter}
              pathname={pathname}
              searchParams={searchParams}
              paramName="creator"
              options={filterOptions.creators}
            />
          </div>
        ) : null}
        {(baseModelFilter || styleFilter || categoryFilter || creatorFilter) && sortedConcepts.length > 0 ? (
          <p className="mt-4 text-xs uppercase tracking-[0.18em] text-ink-muted">
            Filtered surface · {sortedConcepts.length} match{sortedConcepts.length === 1 ? "" : "es"}
          </p>
        ) : null}
      </section>

      {rankedCreators && rankedCreators.length > 0 ? (
        <section className="border-2 border-line-primary bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">Featured / Verified Pilots</p>
              <h2 className="mt-3 text-2xl font-semibold">Creator ranking surface</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
                Ranked public creators weighted by featured or verified status plus live concept saves, likes, and remix activity.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {rankedCreators.map((creator) => (
              <CreatorRankingCard key={creator._id} creator={creator} />
            ))}
          </div>
        </section>
      ) : null}

      {sortedCreatorPacks && sortedCreatorPacks.length > 0 ? (
        <section className="border-2 border-line-primary bg-surface p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-accent-orange">Featured Creator Packs</p>
              <h2 className="mt-3 text-2xl font-semibold">Reusable starter sets</h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
                Discover creator-built pack surfaces that can launch directly into create flows or serve as remix entry points.
              </p>
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-muted">
                Pack ranking follows the current discovery lens: {activeSort.label}
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sortedCreatorPacks.map((pack) => (
              <CreatorPackCard key={pack._id} pack={pack} compact />
            ))}
          </div>
        </section>
      ) : null}

      {sortedConcepts.length === 0 ? (
        <section className="border-2 border-line-primary bg-surface p-8">
          <p className="text-xs uppercase tracking-[0.28em] text-accent-teal">
            {baseModelFilter || styleFilter || categoryFilter || creatorFilter ? "No filtered concepts" : "No public concepts"}
          </p>
          <h2 className="mt-4 text-2xl font-semibold">
            {baseModelFilter || styleFilter || categoryFilter || creatorFilter
              ? "No public concepts matched this discovery filter."
              : "The showcase has not been populated yet."}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary">
            {baseModelFilter || styleFilter || categoryFilter || creatorFilter
              ? "Try clearing one or more filters, or publish more concepts that cover this base model and Style DNA combination."
              : "Move a generated concept to `public` from the library to expose it here."}
          </p>
          {baseModelFilter || styleFilter || categoryFilter || creatorFilter ? (
            <Link
              href={buildShowcaseHref(pathname, searchParams, {
                baseModel: null,
                style: null,
                category: null,
                creator: null,
              })}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-[18px] border border-accent-blue bg-surface shadow-sm px-4 text-sm text-ink-primary transition-colors hover:bg-hover-panel"
            >
              Clear Filters
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sortedConcepts.map((concept) => (
            <article
              key={concept._id}
              className="overflow-hidden rounded-[28px] border border-line-secondary bg-surface"
            >
              <div className="aspect-[4/3] bg-main">
                {concept.previewAsset?.publicUrl ? (
                  <img
                    src={concept.previewAsset.publicUrl}
                    alt={concept.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-end p-5">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">
                        Preview unavailable
                      </p>
                      <p className="mt-2 text-sm leading-6 text-ink-secondary">
                        Asset exists, but no public URL is attached yet.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill>{concept.visibility}</Pill>
                  <Pill>{concept.status}</Pill>
                  {concept.stylePreset?.category ? <Pill>{concept.stylePreset.category}</Pill> : null}
                  {concept.stylePreset?.isFeaturedStyle ? <Pill>featured style</Pill> : null}
                  {concept.remixCount > 0 ? <Pill>{`${concept.remixCount} remix${concept.remixCount === 1 ? "" : "es"}`}</Pill> : null}
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">{concept.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-ink-secondary">
                    {concept.baseModel?.name ?? "Unknown base model"} ·{" "}
                    {concept.stylePreset?.name ?? "Unknown Style DNA"} ·{" "}
                    {concept.materialPreset?.name ?? "Unknown material profile"}
                  </p>
                  {concept.moodTags.length > 0 ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-muted">
                      Mood Vector · {concept.moodTags.map(formatMoodTagLabel).join(" / ")}
                    </p>
                  ) : null}
                </div>
                <div className="grid gap-2 text-sm text-ink-muted">
                  <MetaRow
                    label="Pilot"
                    value={
                      concept.owner ? (
                        <Link
                          href={`/pilot/${concept.owner.handle}`}
                          className="transition-colors hover:text-ink-primary"
                        >
                          @{concept.owner.handle}
                        </Link>
                      ) : (
                        "Unknown"
                      )
                    }
                  />
                  <MetaRow label="Weathering" value={concept.weatheringLevel} />
                  <MetaRow label="Finish" value={concept.materialPreset?.finishType ?? "Unknown"} />
                </div>
                <ConceptEngagementBar
                  conceptId={concept._id}
                  likeCount={concept.engagement.likeCount}
                  saveCount={concept.engagement.saveCount}
                  viewerHasLiked={concept.engagement.viewerHasLiked}
                  viewerHasSaved={concept.engagement.viewerHasSaved}
                  compact
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link
                    href={`/prototype/${concept._id}`}
                    className="inline-flex h-11 items-center justify-center rounded-[18px] border border-accent-blue bg-surface shadow-sm px-4 text-sm font-medium text-ink-primary transition-colors hover:bg-hover-panel"
                  >
                    Open Share Surface
                  </Link>
                  <Link
                    href={`/t/create?remix=${concept._id}`}
                    className="inline-flex h-11 items-center justify-center rounded-[18px] border border-accent-orange bg-accent-orange/10 px-4 text-sm font-medium text-ink-primary transition-colors hover:bg-accent-orange/20"
                  >
                    Remix in Terminal
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-line-guide pb-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">{label}</span>
      <span className="max-w-[58%] text-right">{value}</span>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-line-secondary px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-ink-secondary">
      {children}
    </span>
  );
}

function parseShowcaseSort(
  value: string | null
): (typeof showcaseSortOptions)[number]["id"] {
  return value === "recent" || value === "most-remixed" || value === "most-saved"
    ? value
    : defaultShowcaseSort;
}

function buildShowcaseHref(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>,
  updates: Partial<Record<"sort" | "baseModel" | "style" | "category" | "creator", string | null>>
) {
  const params = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === "" || (key === "sort" && value === defaultShowcaseSort)) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

function uniqueOptions(
  options: Array<{ value?: string | null; label?: string | null }>
) {
  const seen = new Set<string>();
  return options
    .filter((option): option is { value: string; label: string } => Boolean(option.value && option.label))
    .filter((option) => {
      if (seen.has(option.value)) {
        return false;
      }
      seen.add(option.value);
      return true;
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

function FilterGroup({
  activeValue,
  label,
  options,
  paramName,
  pathname,
  searchParams,
}: {
  activeValue: string | null;
  label: string;
  options: Array<{ value: string; label: string }>;
  paramName: "baseModel" | "style" | "category" | "creator";
  pathname: string;
  searchParams: ReturnType<typeof useSearchParams>;
}) {
  return (
    <div className="rounded-[20px] border border-line-secondary bg-main p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={buildShowcaseHref(pathname, searchParams, { [paramName]: null })}
          className={cn(
            "inline-flex h-9 items-center justify-center rounded-[14px] border px-3 text-xs transition-colors",
            activeValue === null
              ? "border-accent-teal bg-accent-teal/10 text-ink-primary"
              : "border-line-secondary text-ink-secondary hover:border-line-active hover:text-ink-primary"
          )}
        >
          All
        </Link>
        {options.map((option) => {
          const active = option.value === activeValue;
          return (
            <Link
              key={option.value}
              href={buildShowcaseHref(pathname, searchParams, { [paramName]: option.value })}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-[14px] border px-3 text-xs transition-colors",
                active
                  ? "border-accent-teal bg-accent-teal/10 text-ink-primary"
                  : "border-line-secondary text-ink-secondary hover:border-line-active hover:text-ink-primary"
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function compareConcepts(
  left: {
    _creationTime: number;
    remixCount: number;
    engagement: { likeCount: number; saveCount: number };
  },
  right: {
    _creationTime: number;
    remixCount: number;
    engagement: { likeCount: number; saveCount: number };
  },
  sortMode: (typeof showcaseSortOptions)[number]["id"]
) {
  if (sortMode === "recent") {
    return right._creationTime - left._creationTime;
  }
  if (sortMode === "most-saved") {
    return (
      right.engagement.saveCount - left.engagement.saveCount ||
      right.engagement.likeCount - left.engagement.likeCount ||
      right._creationTime - left._creationTime
    );
  }
  if (sortMode === "most-remixed") {
    return right.remixCount - left.remixCount || right._creationTime - left._creationTime;
  }
  return trendingScore(right) - trendingScore(left) || right._creationTime - left._creationTime;
}

function trendingScore(concept: {
  _creationTime: number;
  remixCount: number;
  engagement: { likeCount: number; saveCount: number };
}) {
  const ageDays = Math.max(0, (Date.now() - concept._creationTime) / dayMs);
  const freshnessBoost = Math.max(0, 21 - ageDays);
  return (
    concept.remixCount * 24 +
    concept.engagement.saveCount * 16 +
    concept.engagement.likeCount * 8 +
    freshnessBoost
  );
}

function compareCreatorPacks(
  left: {
    _creationTime: number;
    engagement: { likeCount: number; saveCount: number };
    stats: { publicRemixCount: number; publicLikeCount: number; publicSaveCount: number };
  },
  right: {
    _creationTime: number;
    engagement: { likeCount: number; saveCount: number };
    stats: { publicRemixCount: number; publicLikeCount: number; publicSaveCount: number };
  },
  sortMode: (typeof showcaseSortOptions)[number]["id"]
) {
  if (sortMode === "recent") {
    return right._creationTime - left._creationTime;
  }
  if (sortMode === "most-saved") {
    return (
      right.engagement.saveCount + right.stats.publicSaveCount - (left.engagement.saveCount + left.stats.publicSaveCount) ||
      right.engagement.likeCount + right.stats.publicLikeCount - (left.engagement.likeCount + left.stats.publicLikeCount) ||
      right._creationTime - left._creationTime
    );
  }
  if (sortMode === "most-remixed") {
    return right.stats.publicRemixCount - left.stats.publicRemixCount || right._creationTime - left._creationTime;
  }
  return trendingPackScore(right) - trendingPackScore(left) || right._creationTime - left._creationTime;
}

function trendingPackScore(pack: {
  _creationTime: number;
  engagement: { likeCount: number; saveCount: number };
  stats: { publicRemixCount: number; publicLikeCount: number; publicSaveCount: number };
}) {
  const ageDays = Math.max(0, (Date.now() - pack._creationTime) / dayMs);
  const freshnessBoost = Math.max(0, 21 - ageDays);
  return (
    pack.stats.publicRemixCount * 24 +
    (pack.engagement.saveCount + pack.stats.publicSaveCount) * 16 +
    (pack.engagement.likeCount + pack.stats.publicLikeCount) * 8 +
    freshnessBoost
  );
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
