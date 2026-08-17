import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useStartProviderStatus } from "@/src/providers/StartProviders";
import { ChoiceChip, FieldHint, Kicker } from "@/src/components/ui/workbench";
import { ConceptEngagementBar } from "./EngagementBars";
import { CreatorPackCard } from "./CreatorPackCard";
import { CreatorRankingCard } from "./CreatorRankingCard";
import {
  buildShowcaseHref,
  compareConcepts,
  compareCreatorPacks,
  formatMoodTagLabel,
  showcaseSortOptions,
  uniqueOptions,
} from "./showcaseUtils";
import type {
  MetaRowValue,
  ShowcaseData,
  ShowcaseSearch,
  ShowcaseSnapshot,
} from "./types";

export function ShowcaseFeed({
  basePath = "/showcase",
  hideIntro = false,
  search,
  snapshot,
}: {
  basePath?: string;
  hideIntro?: boolean;
  search: ShowcaseSearch;
  snapshot: ShowcaseSnapshot;
}) {
  const providerStatus = useStartProviderStatus();
  const canUseLiveData =
    providerStatus.hasClerkProvider && providerStatus.hasConvexClient;
  const canInteract = canUseLiveData;

  return canUseLiveData ? (
    <LiveShowcaseFeed
      basePath={basePath}
      canInteract={canInteract}
      hideIntro={hideIntro}
      search={search}
      snapshot={snapshot}
    />
  ) : (
    <ShowcaseFeedView
      canInteract={canInteract}
      data={snapshot}
      basePath={basePath}
      hideIntro={hideIntro}
      providerReady={providerStatus.hasConvexClient}
      search={search}
      status={snapshot.status}
      statusMessage={
        snapshot.status === "ok" ? undefined : snapshot.message
      }
    />
  );
}

function LiveShowcaseFeed({
  basePath,
  canInteract,
  hideIntro,
  search,
  snapshot,
}: {
  basePath: string;
  canInteract: boolean;
  hideIntro: boolean;
  search: ShowcaseSearch;
  snapshot: ShowcaseSnapshot;
}) {
  const liveConcepts = useQuery(api.showcase.listPublicConcepts);
  const liveCreatorPacks = useQuery(api.showcase.listPublicCreatorPacks);
  const liveRankedCreators = useQuery(api.showcase.listRankedPublicCreators);
  const data: ShowcaseData = {
    concepts: liveConcepts ?? snapshot.concepts,
    creatorPacks: liveCreatorPacks ?? snapshot.creatorPacks,
    rankedCreators: liveRankedCreators ?? snapshot.rankedCreators,
  };

  return (
    <ShowcaseFeedView
      basePath={basePath}
      canInteract={canInteract}
      data={data}
      hideIntro={hideIntro}
      providerReady
      search={search}
      status={snapshot.status}
      statusMessage={
        snapshot.status === "ok" ? undefined : snapshot.message
      }
    />
  );
}

function ShowcaseFeedView({
  basePath,
  canInteract,
  data,
  hideIntro = false,
  providerReady,
  search,
  status,
  statusMessage,
}: {
  basePath: string;
  canInteract: boolean;
  data: ShowcaseData;
  hideIntro?: boolean;
  providerReady: boolean;
  search: ShowcaseSearch;
  status: ShowcaseSnapshot["status"];
  statusMessage?: string;
}) {
  const activeSort =
    showcaseSortOptions.find((option) => option.id === search.sort) ??
    showcaseSortOptions[0];
  const filterOptions = {
    baseModels: uniqueOptions(
      data.concepts.map((concept) => ({
        value: concept.baseModel?.slug,
        label: concept.baseModel?.name,
      }))
    ),
    styles: uniqueOptions(
      data.concepts.map((concept) => ({
        value: concept.stylePreset?.slug,
        label: concept.stylePreset?.name,
      }))
    ),
    materials: uniqueOptions(
      data.concepts.map((concept) => ({
        value: concept.materialPreset?.slug,
        label: concept.materialPreset?.name,
      }))
    ),
    categories: uniqueOptions(
      data.concepts.map((concept) => ({
        value: concept.stylePreset?.category,
        label: concept.stylePreset?.category,
      }))
    ),
    creators: uniqueOptions(
      data.concepts.map((concept) => ({
        value: concept.owner?.handle,
        label: concept.owner?.handle,
      }))
    ),
  };
  const filteredConcepts = data.concepts.filter((concept) => {
    if (search.baseModel && concept.baseModel?.slug !== search.baseModel) {
      return false;
    }
    if (search.style && concept.stylePreset?.slug !== search.style) {
      return false;
    }
    if (search.material && concept.materialPreset?.slug !== search.material) {
      return false;
    }
    if (search.weathering && concept.weatheringLevel !== search.weathering) {
      return false;
    }
    if (search.category && concept.stylePreset?.category !== search.category) {
      return false;
    }
    if (search.creator && concept.owner?.handle !== search.creator) {
      return false;
    }
    if (search.q) {
      const query = search.q.toLowerCase();
      const haystack = [
        concept.title,
        concept.baseModel?.name,
        concept.stylePreset?.name,
        concept.materialPreset?.name,
        concept.owner?.handle,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });
  const sortedConcepts = [...filteredConcepts].sort((left, right) =>
    compareConcepts(left, right, activeSort.id)
  );
  const sortedCreatorPacks = [...data.creatorPacks].sort((left, right) =>
    compareCreatorPacks(left, right, activeSort.id)
  );
  const hasActiveFilters = Boolean(
    search.baseModel ||
      search.style ||
      search.material ||
      search.weathering ||
      search.category ||
      search.creator ||
      search.q
  );

  return (
    <div className="showcase-stack">
      <section className="showcase-control-panel">
        {hideIntro ? null : (
          <div>
            <p className="showcase-kicker">Public Showcase</p>
            <h1>Published prototype surface</h1>
            <p>
              This feed only surfaces concepts marked public. Unlisted operator work
              stays off the grid but remains accessible by direct share link.
            </p>
          </div>
        )}
        <div className="filter-stack">
          <div className="filter-stack__group">
            <Kicker>Sort</Kicker>
            <div className="choice-chip-row">
              {showcaseSortOptions.map((option) => (
                <ChoiceChip
                  key={option.id}
                  active={option.id === activeSort.id}
                  href={buildShowcaseHref(search, { sort: option.id }, basePath)}
                >
                  {option.label}
                </ChoiceChip>
              ))}
            </div>
            <FieldHint>Discovery lens: {activeSort.description}</FieldHint>
          </div>
          <FilterGroup
            activeValue={search.baseModel}
            label="Base model"
            options={filterOptions.baseModels}
            paramName="baseModel"
            basePath={basePath}
            search={search}
          />
          <FilterGroup
            activeValue={search.style}
            label="Style DNA"
            options={filterOptions.styles}
            paramName="style"
            basePath={basePath}
            search={search}
          />
          <FilterGroup
            activeValue={search.material}
            label="Material"
            options={filterOptions.materials}
            paramName="material"
            basePath={basePath}
            search={search}
          />
          <FilterGroup
            activeValue={search.category}
            label="Category"
            options={filterOptions.categories}
            paramName="category"
            basePath={basePath}
            search={search}
          />
          <FilterGroup
            activeValue={search.creator}
            label="Creator"
            options={filterOptions.creators}
            paramName="creator"
            basePath={basePath}
            search={search}
          />
        </div>
        <div className="showcase-status-row">
          <span>
            {sortedConcepts.length} concept
            {sortedConcepts.length === 1 ? "" : "s"} in view
          </span>
          <span>{providerReady ? "Convex live sync ready" : "SSR snapshot mode"}</span>
          {status !== "ok" && statusMessage ? <span>{statusMessage}</span> : null}
        </div>
      </section>

      {data.rankedCreators.length > 0 ? (
        <section className="showcase-section">
          <SectionHeader
            accent="teal"
            copy="Ranked public creators weighted by featured or verified status plus live concept saves, likes, and remix activity."
            kicker="Featured / Verified Pilots"
            title="Creator ranking surface"
          />
          <div className="showcase-grid showcase-grid--creators">
            {data.rankedCreators.map((creator) => (
              <CreatorRankingCard creator={creator} key={creator._id} />
            ))}
          </div>
        </section>
      ) : null}

      {sortedCreatorPacks.length > 0 ? (
        <section className="showcase-section">
          <SectionHeader
            accent="orange"
            copy="Discover creator-built pack surfaces that can launch directly into create flows or serve as remix entry points."
            kicker="Featured Creator Packs"
            title="Reusable starter sets"
          />
          <p className="showcase-section-note">
            Pack ranking follows the current discovery lens: {activeSort.label}
          </p>
          <div className="showcase-grid showcase-grid--packs">
            {sortedCreatorPacks.map((pack) => (
              <CreatorPackCard
                interactive={canInteract}
                key={pack._id}
                pack={pack}
              />
            ))}
          </div>
        </section>
      ) : null}

      {sortedConcepts.length === 0 ? (
        <section className="showcase-empty">
          <p className="showcase-kicker">
            {hasActiveFilters ? "No filtered concepts" : "No public concepts"}
          </p>
          <h2>
            {hasActiveFilters
              ? "No public concepts matched this discovery filter."
              : "The showcase has not been populated yet."}
          </h2>
          <p>
            {hasActiveFilters
              ? "Try clearing one or more filters, or publish more concepts that cover this base model and Style DNA combination."
              : "Move a generated concept to public from the library to expose it here."}
          </p>
          {hasActiveFilters ? (
            <a
              className="showcase-button"
              href={buildShowcaseHref(
                search,
                {
                  baseModel: null,
                  category: null,
                  creator: null,
                  material: null,
                  q: null,
                  style: null,
                  weathering: null,
                },
                basePath
              )}
            >
              Clear Filters
            </a>
          ) : null}
        </section>
      ) : (
        <section className="showcase-grid showcase-grid--concepts">
          {sortedConcepts.map((concept) => (
            <article className="showcase-card" key={concept._id}>
              <div className="showcase-card__media">
                {concept.previewAsset?.publicUrl ? (
                  <img src={concept.previewAsset.publicUrl} alt={concept.title} />
                ) : (
                  <div className="showcase-card__placeholder">
                    Preview unavailable
                  </div>
                )}
              </div>
              <div className="showcase-card__body">
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
                  <a className="showcase-card__title" href={`/prototype/${concept._id}`}>
                    {concept.title}
                  </a>
                  <p className="showcase-card__copy">
                    {concept.baseModel?.name ?? "Unknown base model"} /{" "}
                    {concept.stylePreset?.name ?? "Unknown Style DNA"} /{" "}
                    {concept.materialPreset?.name ?? "Unknown material profile"}
                  </p>
                  {concept.moodTags.length > 0 ? (
                    <p className="showcase-card__mood">
                      Mood Vector / {concept.moodTags.map(formatMoodTagLabel).join(" / ")}
                    </p>
                  ) : null}
                </div>
                <dl className="showcase-meta">
                  <MetaRow
                    label="Pilot"
                    value={
                      concept.owner ? (
                        <a href={`/pilot/${concept.owner.handle}`}>
                          @{concept.owner.handle}
                        </a>
                      ) : (
                        "Unknown"
                      )
                    }
                  />
                  <MetaRow label="Weathering" value={concept.weatheringLevel} />
                  <MetaRow
                    label="Finish"
                    value={concept.materialPreset?.finishType ?? "Unknown"}
                  />
                </dl>
                <ConceptEngagementBar
                  compact
                  conceptId={concept._id}
                  interactive={canInteract}
                  likeCount={concept.engagement.likeCount}
                  saveCount={concept.engagement.saveCount}
                  viewerHasLiked={concept.engagement.viewerHasLiked}
                  viewerHasSaved={concept.engagement.viewerHasSaved}
                />
                <div className="showcase-card__actions">
                  <a className="showcase-button" href={`/prototype/${concept._id}`}>
                    Open Share Surface
                  </a>
                  <a className="showcase-button is-warm" href={`/create?remix=${concept._id}`}>
                    Remix
                  </a>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function FilterGroup({
  activeValue,
  basePath,
  label,
  options,
  paramName,
  search,
}: {
  activeValue?: string;
  basePath: string;
  label: string;
  options: Array<{ value: string; label: string }>;
  paramName: "baseModel" | "style" | "material" | "category" | "creator";
  search: ShowcaseSearch;
}) {
  return (
    <div className="filter-stack__group">
      <Kicker>{label}</Kicker>
      <div className="choice-chip-row">
        <ChoiceChip
          active={!activeValue}
          href={buildShowcaseHref(search, { [paramName]: null }, basePath)}
        >
          All
        </ChoiceChip>
        {options.map((option) => (
          <ChoiceChip
            key={option.value}
            active={activeValue === option.value}
            href={buildShowcaseHref(search, { [paramName]: option.value }, basePath)}
          >
            {option.label}
          </ChoiceChip>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({
  accent,
  copy,
  kicker,
  title,
}: {
  accent: "orange" | "teal";
  copy: string;
  kicker: string;
  title: string;
}) {
  return (
    <div className="showcase-section-header">
      <div>
        <p className={`showcase-kicker is-${accent}`}>{kicker}</p>
        <h2>{title}</h2>
        <p>{copy}</p>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: MetaRowValue }) {
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
