import {
  ArrowTopRightIcon,
  CheckIcon,
  ChevronDownIcon,
} from "@radix-ui/react-icons";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useStartProviderStatus } from "@/src/providers/StartProviders";
import {
  buildShowcaseHref,
  hasActiveShowcaseQuery,
  isPublicArchivePending,
  publicConceptImageUrl,
  showcaseSortOptions,
} from "./showcaseUtils";
import type {
  ShowcaseConcept,
  ShowcaseSearch,
  ShowcaseSnapshot,
  ShowcaseSort,
} from "./types";
import { SystemState, SystemStateLink, systemStates } from "@/src/components/system-state";

type ExplorePrototype = {
  id: string;
  title: string;
  kit: string;
  kitSlug: string;
  style: string;
  styleSlug: string;
  material: string;
  materialSlug: string;
  weathering: string;
  creator: string;
  image: string;
  href: string;
  remixHref: string;
  createdAt: number;
  remixCount: number;
  saveCount: number;
};

export function ExploreLanding({
  search,
  snapshot,
}: {
  search: ShowcaseSearch;
  snapshot: ShowcaseSnapshot;
}) {
  const providerStatus = useStartProviderStatus();
  const liveConcepts = useQuery(
    api.showcase.listPublicConcepts,
    providerStatus.hasConvexClient ? {} : "skip"
  );
  const concepts = liveConcepts ?? snapshot.concepts;
  const querying = hasActiveShowcaseQuery(search);

  if (isPublicArchivePending(liveConcepts, snapshot.concepts.length, providerStatus.hasConvexClient)) {
    return (
      <main className="explore-landing">
        <SystemState {...systemStates.exploreLoading} />
      </main>
    );
  }

  if (concepts.length === 0) {
    return (
      <main className="explore-landing">
        <SystemState
          {...(querying ? systemStates.emptyQuery : systemStates.emptyShowcase)}
          primary={
            querying ? (
              <SystemStateLink href="/">Clear filters</SystemStateLink>
            ) : (
              <SystemStateLink href="/create">Plan a paint scheme →</SystemStateLink>
            )
          }
        />
      </main>
    );
  }

  const allItems = concepts.map((concept) => normalizeConcept(concept));
  const editorialItems = allItems.slice(0, 4);
  const trendingItems = cycleItems(allItems.slice(1), allItems, 4);
  const archiveItems = sortDisplayItems(
    allItems.filter((item) => matchesSearch(item, search)),
    search.sort ?? "trending"
  );

  return (
    <main className="explore-landing">
      <div className="explore-canvas">
        <EditorialFeature items={editorialItems} />
        <TrendingStrip items={trendingItems} />
        <ArchiveSection
          items={archiveItems}
          allItems={allItems}
          search={search}
        />
        <footer className="explore-footer">NeotypeLab / Vol.02</footer>
      </div>
    </main>
  );
}

function EditorialFeature({ items }: { items: ExplorePrototype[] }) {
  const [lead] = items;
  if (!lead) {
    return null;
  }

  return (
    <section className="explore-editorial" aria-labelledby="today-title">
      <div className="explore-section-title">
        <p>NeotypeLab · Almanac N°.02</p>
        <h1 id="today-title">Today&apos;s paint plans</h1>
      </div>
      <div className="explore-feature">
        <a className="explore-feature__image" href={lead.href}>
          <span>N.001</span>
          <PreviewImage alt={`${lead.title} paint plan`} src={lead.image} />
        </a>
        <aside className="explore-feature__meta" aria-label="Featured paint plan">
          <div className="explore-feature__record">
            <span>N°.001</span>
            <span>Paint plan</span>
          </div>
          <EditorialMeta label="Kit" value={lead.kit} />
          <div className="explore-feature__meta-group">
            <EditorialMeta label="Color direction" value={lead.style} />
            <EditorialMeta label="Material" value={lead.material} />
            <EditorialMeta label="Weathering" value={lead.weathering} />
          </div>
          <div className="explore-feature__meta-group is-compact">
            <EditorialMeta label="Painter" value={lead.creator} />
            <time dateTime={new Date(lead.createdAt).toISOString()}>{formatEditorialDate(lead.createdAt)}</time>
          </div>
          <div className="explore-feature__actions">
            <a className="explore-action is-primary" href={lead.href}>
              View plan <span aria-hidden="true">→</span>
            </a>
            <a className="explore-action" href={lead.remixHref}>
              Remix <ArrowTopRightIcon aria-hidden="true" />
            </a>
          </div>
        </aside>
      </div>
    </section>
  );
}

function EditorialMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="explore-feature__meta-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TrendingStrip({ items }: { items: ExplorePrototype[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="explore-trending" aria-labelledby="trending-title">
      <h2 id="trending-title">Trending</h2>
      <div className="explore-trending__grid">
        {items.map((item) => (
          <PrototypeCard item={item} key={item.id} compact />
        ))}
      </div>
    </section>
  );
}

function ArchiveSection({
  allItems,
  items,
  search,
}: {
  allItems: ExplorePrototype[];
  items: ExplorePrototype[];
  search: ShowcaseSearch;
}) {
  return (
    <section className="explore-archive" aria-labelledby="archive-title">
      <h2 id="archive-title">Archive</h2>
      <div className="explore-discovery-bar">
        <nav aria-label="Sort prototypes" className="explore-sort-tabs">
          {showcaseSortOptions.map((option) => (
            <a
              aria-current={(search.sort ?? "trending") === option.id ? "page" : undefined}
              className={(search.sort ?? "trending") === option.id ? "is-active" : undefined}
              href={buildShowcaseHref(search, { sort: option.id }, "/")}
              key={option.id}
            >
              {option.label}
            </a>
          ))}
        </nav>
        <div className="explore-filter-row">
          <DiscoveryFilter
            activeValue={search.baseModel}
            allItems={allItems}
            kind="kit"
            search={search}
          />
          <DiscoveryFilter
            activeValue={search.style}
            allItems={allItems}
            kind="style"
            search={search}
          />
          <DiscoveryFilter
            activeValue={search.material}
            allItems={allItems}
            kind="material"
            search={search}
          />
        </div>
        <p className="explore-result-count">
          {items.length} prototype{items.length === 1 ? "" : "s"}
        </p>
      </div>
      {items.length > 0 ? (
        <div className="explore-archive__grid">
          {items.slice(0, 9).map((item) => (
            <PrototypeCard item={item} key={item.id} />
          ))}
        </div>
      ) : (
        <SystemState
          {...systemStates.emptyQuery}
          layout="inline"
          primary={<SystemStateLink href="/">Clear filters</SystemStateLink>}
        />
      )}
      <a className="explore-load-more" href="/showcase">
        Load more
      </a>
    </section>
  );
}

function DiscoveryFilter({
  activeValue,
  allItems,
  kind,
  search,
}: {
  activeValue?: string;
  allItems: ExplorePrototype[];
  kind: "kit" | "style" | "material";
  search: ShowcaseSearch;
}) {
  const config = {
    kit: { label: "Kit", param: "baseModel" as const, slug: "kitSlug" as const, value: "kit" as const },
    style: { label: "Color direction", param: "style" as const, slug: "styleSlug" as const, value: "style" as const },
    material: {
      label: "Material",
      param: "material" as const,
      slug: "materialSlug" as const,
      value: "material" as const,
    },
  }[kind];
  const options = uniqueFilterOptions(allItems, config.slug, config.value);
  const activeLabel = options.find((option) => option.slug === activeValue)?.label;

  return (
    <details className={`explore-filter explore-filter--${kind}`}>
      <summary>
        <span>{activeLabel ?? config.label}</span>
        <ChevronDownIcon aria-hidden="true" />
      </summary>
      <div className="explore-filter__panel">
        <div className="explore-filter__header">
          <p>{kind === "kit" ? "Kit Variant" : config.label}</p>
          {activeValue ? (
            <a href={buildShowcaseHref(search, { [config.param]: null }, "/")}>Clear</a>
          ) : null}
        </div>
        {kind === "kit" ? (
          <label className="explore-filter__search">
            <span className="sr-only">Search kits</span>
            <input placeholder="Search kits..." type="search" />
          </label>
        ) : null}
        <div className={kind === "style" ? "explore-filter__visual-grid" : "explore-filter__list"}>
          {options.slice(0, kind === "style" ? 6 : 8).map((option) => {
            const selected = activeValue === option.slug;
            return (
              <a
                aria-current={selected ? "true" : undefined}
                className={selected ? "is-selected" : undefined}
                href={buildShowcaseHref(search, { [config.param]: option.slug }, "/")}
                key={option.slug}
              >
                <PreviewImage alt="" src={option.image} />
                <span>{option.label}</span>
                {selected ? <CheckIcon aria-hidden="true" /> : null}
              </a>
            );
          })}
        </div>
      </div>
    </details>
  );
}

function PrototypeCard({
  compact = false,
  item,
}: {
  compact?: boolean;
  item: ExplorePrototype;
}) {
  return (
    <article className={compact ? "explore-prototype-card is-compact" : "explore-prototype-card"}>
      <a className="explore-prototype-card__image" href={item.href}>
        <PreviewImage alt={`${item.title} repaint prototype`} src={item.image} />
      </a>
      <div className="explore-prototype-card__body">
        <p>{item.kit}</p>
        <a className="explore-prototype-card__title" href={item.href}>
          {item.title}
        </a>
        <p>{item.style}</p>
        {compact ? null : <p>{item.material} · {item.weathering}</p>}
        <div>
          {compact ? null : <span>by {item.creator}</span>}
          <a href={item.remixHref}>Remix <ArrowTopRightIcon aria-hidden="true" /></a>
        </div>
      </div>
    </article>
  );
}

function PreviewImage({ alt, src }: { alt: string; src: string }) {
  if (!src) {
    return <div className="explore-preview-missing">Preview unavailable</div>;
  }

  return <img alt={alt} src={src} />;
}

function normalizeConcept(concept: ShowcaseConcept): ExplorePrototype {
  return {
    id: String(concept._id),
    title: concept.title,
    kit: concept.baseModel?.name ?? "Unknown kit",
    kitSlug: concept.baseModel?.slug ?? "unknown-kit",
    style: concept.stylePreset?.name ?? "Color direction pending",
    styleSlug: concept.stylePreset?.slug ?? "unknown-style",
    material: concept.materialPreset?.name ?? "Unknown material",
    materialSlug: concept.materialPreset?.slug ?? "unknown-material",
    weathering: concept.weatheringLevel,
    creator: concept.owner?.handle ?? "NeotypeLab",
    image: publicConceptImageUrl(concept.previewAsset),
    href: `/prototype/${concept._id}`,
    remixHref: `/create?remix=${concept._id}`,
    createdAt: concept._creationTime,
    remixCount: concept.remixCount,
    saveCount: concept.engagement.saveCount,
  };
}

function matchesSearch(item: ExplorePrototype, search: ShowcaseSearch) {
  return (
    (!search.baseModel || item.kitSlug === search.baseModel) &&
    (!search.style || item.styleSlug === search.style) &&
    (!search.material || item.materialSlug === search.material)
  );
}

function sortDisplayItems(items: ExplorePrototype[], sort: ShowcaseSort) {
  return [...items].sort((left, right) => {
    if (sort === "recent") {
      return right.createdAt - left.createdAt;
    }
    if (sort === "most-remixed") {
      return right.remixCount - left.remixCount;
    }
    if (sort === "most-saved") {
      return right.saveCount - left.saveCount;
    }
    return right.remixCount * 2 + right.saveCount - (left.remixCount * 2 + left.saveCount);
  });
}

function uniqueFilterOptions(
  items: ExplorePrototype[],
  slugKey: "kitSlug" | "styleSlug" | "materialSlug",
  labelKey: "kit" | "style" | "material"
) {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const slug = item[slugKey];
    if (seen.has(slug)) {
      return [];
    }
    seen.add(slug);
    return [{ slug, label: item[labelKey], image: item.image }];
  });
}

function cycleItems(
  preferred: ExplorePrototype[],
  fallback: ExplorePrototype[],
  count: number
) {
  const pool = preferred.length > 0 ? preferred : fallback;
  return Array.from({ length: Math.min(count, pool.length) }, (_, index) => pool[index % pool.length]);
}

function formatEditorialDate(timestamp: number) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(timestamp));
}
