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
  showcaseSortOptions,
} from "./showcaseUtils";
import type {
  ShowcaseConcept,
  ShowcaseSearch,
  ShowcaseSnapshot,
  ShowcaseSort,
} from "./types";

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

const editorialAnchor = Date.UTC(2026, 7, 16);

const editorialFallbacks: ExplorePrototype[] = [
  fallbackPrototype({
    id: "n001",
    title: "Gundam MK–II / Field Hazard",
    kit: "MG 1/100 Gundam MK–II",
    kitSlug: "mg-gundam-mk-ii",
    style: "Industrial Hazard",
    styleSlug: "industrial-hazard",
    material: "Chipped Enamel + Oil Stain",
    materialSlug: "chipped-enamel",
    weathering: "Field worn",
    creator: "NeotypeLab",
    image: "/assets/explore/editorial-hero.png",
    remixCount: 24,
    saveCount: 91,
  }),
  fallbackPrototype({
    id: "n002",
    title: "Jesta / Night Dispatch",
    kit: "MG 1/100 Jesta",
    kitSlug: "mg-jesta",
    style: "Command Unit",
    styleSlug: "command-unit",
    material: "Graphite Ceramic",
    materialSlug: "graphite-ceramic",
    weathering: "Clean",
    creator: "S. Kondo",
    image: "/assets/explore/editorial-detail-dark.png",
    remixCount: 18,
    saveCount: 67,
  }),
  fallbackPrototype({
    id: "n003",
    title: "Zaku II / Jungle Recon",
    kit: "MG 1/100 Zaku II",
    kitSlug: "mg-zaku-ii",
    style: "Industrial Hazard",
    styleSlug: "industrial-hazard",
    material: "Matte Armor",
    materialSlug: "matte-armor",
    weathering: "Dust",
    creator: "T. Hayashi",
    image: "/assets/explore/editorial-detail-olive.png",
    remixCount: 15,
    saveCount: 52,
  }),
  fallbackPrototype({
    id: "n004",
    title: "Ball / Ceremonial Relay",
    kit: "MG 1/100 Ball Ver.Ka",
    kitSlug: "mg-ball-ver-ka",
    style: "Ceremonial Clean",
    styleSlug: "ceremonial-clean",
    material: "Pearl Lacquer",
    materialSlug: "pearl-lacquer",
    weathering: "Clean",
    creator: "R. Okada",
    image: "/assets/explore/editorial-detail-white.png",
    remixCount: 11,
    saveCount: 48,
  }),
  fallbackPrototype({
    id: "n005",
    title: "Gundam EZ–8 / Urban Patrol",
    kit: "MG 1/100 Gundam EZ–8",
    kitSlug: "mg-gundam-ez-8",
    style: "Industrial Hazard",
    styleSlug: "industrial-hazard",
    material: "Chipped Enamel",
    materialSlug: "chipped-enamel",
    weathering: "Panel wash",
    creator: "M. Fujita",
    image: "/assets/explore/trending-white-industrial.png",
    remixCount: 21,
    saveCount: 79,
  }),
  fallbackPrototype({
    id: "n006",
    title: "Zaku II / Red Command",
    kit: "HG 1/144 Zaku II",
    kitSlug: "hg-zaku-ii",
    style: "Command Unit",
    styleSlug: "command-unit",
    material: "Satin Plated",
    materialSlug: "satin-plated",
    weathering: "Soft wear",
    creator: "K. Matsuda",
    image: "/assets/explore/trending-red-command.png",
    remixCount: 19,
    saveCount: 72,
  }),
  fallbackPrototype({
    id: "n007",
    title: "GM Sniper II / Desert Watch",
    kit: "MG 1/100 GM Sniper II",
    kitSlug: "mg-gm-sniper-ii",
    style: "Ceremonial Clean",
    styleSlug: "ceremonial-clean",
    material: "Sand Ceramic",
    materialSlug: "sand-ceramic",
    weathering: "Dust",
    creator: "Y. Nakamura",
    image: "/assets/explore/trending-sand-sniper.png",
    remixCount: 16,
    saveCount: 63,
  }),
  fallbackPrototype({
    id: "n008",
    title: "Rick Dias / Harbor Guard",
    kit: "MG 1/100 Rick Dias",
    kitSlug: "mg-rick-dias",
    style: "Industrial Hazard",
    styleSlug: "industrial-hazard",
    material: "Oxide Metal",
    materialSlug: "oxide-metal",
    weathering: "Soot",
    creator: "A. Mori",
    image: "/assets/explore/trending-blue-hazard.png",
    remixCount: 14,
    saveCount: 59,
  }),
  fallbackPrototype({
    id: "n009",
    title: "Gundam TR–1 [Hazel]",
    kit: "MG 1/100 Hazel",
    kitSlug: "mg-hazel",
    style: "Industrial Hazard",
    styleSlug: "industrial-hazard",
    material: "Ivory Ceramic",
    materialSlug: "ivory-ceramic",
    weathering: "Oil stain",
    creator: "N. Iwata",
    image: "/assets/explore/archive-hazel-white.png",
    remixCount: 13,
    saveCount: 57,
  }),
  fallbackPrototype({
    id: "n010",
    title: "Jegan / Signal 21",
    kit: "HG 1/144 Jegan",
    kitSlug: "hg-jegan",
    style: "Command Unit",
    styleSlug: "command-unit",
    material: "Teal Matte",
    materialSlug: "teal-matte",
    weathering: "Clean",
    creator: "Yinglian",
    image: "/assets/explore/archive-jegan-teal.png",
    remixCount: 12,
    saveCount: 55,
  }),
  fallbackPrototype({
    id: "n011",
    title: "Tallgeese EW / Ivory Standard",
    kit: "MG 1/100 Tallgeese EW",
    kitSlug: "mg-tallgeese-ew",
    style: "Ceremonial Clean",
    styleSlug: "ceremonial-clean",
    material: "Pearl + Gold",
    materialSlug: "pearl-gold",
    weathering: "Clean",
    creator: "H. Ito",
    image: "/assets/explore/archive-ceremonial-white.png",
    remixCount: 10,
    saveCount: 51,
  }),
  fallbackPrototype({
    id: "n012",
    title: "Nu Gundam / Black Vanguard",
    kit: "RG 1/144 Nu Gundam",
    kitSlug: "rg-nu-gundam",
    style: "Command Unit",
    styleSlug: "command-unit",
    material: "Black Ceramic",
    materialSlug: "black-ceramic",
    weathering: "Clean",
    creator: "A. Sato",
    image: "/assets/explore/archive-black-vanguard.png",
    remixCount: 9,
    saveCount: 46,
  }),
  fallbackPrototype({
    id: "n013",
    title: "Guncannon / Foundry Unit",
    kit: "MG 1/100 Guncannon",
    kitSlug: "mg-guncannon",
    style: "Industrial Hazard",
    styleSlug: "industrial-hazard",
    material: "Safety Enamel",
    materialSlug: "safety-enamel",
    weathering: "Heavy wear",
    creator: "F. Abe",
    image: "/assets/explore/archive-orange-worker.png",
    remixCount: 8,
    saveCount: 43,
  }),
  fallbackPrototype({
    id: "n014",
    title: "Geara Doga / Field Recon",
    kit: "MG 1/100 Geara Doga",
    kitSlug: "mg-geara-doga",
    style: "Command Unit",
    styleSlug: "command-unit",
    material: "Olive Matte",
    materialSlug: "olive-matte",
    weathering: "Field worn",
    creator: "C. Watanabe",
    image: "/assets/explore/archive-green-field.png",
    remixCount: 7,
    saveCount: 39,
  }),
];

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
  const isFallback = concepts.length === 0;
  const allItems = isFallback
    ? editorialFallbacks
    : concepts.map((concept, index) => normalizeConcept(concept, index));
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
        <h1 id="today-title">Today&apos;s prototypes</h1>
      </div>
      <div className="explore-feature">
        <a className="explore-feature__image" href={lead.href}>
          <span>N.001</span>
          <img src={lead.image} alt={`${lead.title} repaint prototype`} />
        </a>
        <aside className="explore-feature__meta" aria-label="Featured prototype record">
          <div className="explore-feature__record">
            <span>N°.001</span>
            <span>Prototype record</span>
          </div>
          <EditorialMeta label="Kit" value={lead.kit} />
          <div className="explore-feature__meta-group">
            <EditorialMeta label="Style DNA" value={lead.style} />
            <EditorialMeta label="Material" value={lead.material} />
            <EditorialMeta label="Weathering" value={lead.weathering} />
          </div>
          <div className="explore-feature__meta-group is-compact">
            <EditorialMeta label="Painter" value={lead.creator} />
            <time dateTime={new Date(lead.createdAt).toISOString()}>{formatEditorialDate(lead.createdAt)}</time>
          </div>
          <div className="explore-feature__actions">
            <a className="explore-action is-primary" href={lead.href}>
              View Prototype <span aria-hidden="true">→</span>
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
        <div className="explore-archive__empty">
          <p>No prototypes match this combination.</p>
          <a href="/">Clear discovery filters</a>
        </div>
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
    style: { label: "Style DNA", param: "style" as const, slug: "styleSlug" as const, value: "style" as const },
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
                <img src={option.image} alt="" />
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
        <img src={item.image} alt={`${item.title} repaint prototype`} />
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

function normalizeConcept(concept: ShowcaseConcept, index: number): ExplorePrototype {
  const fallback = editorialFallbacks[index % editorialFallbacks.length];
  return {
    id: String(concept._id),
    title: concept.title,
    kit: concept.baseModel?.name ?? "Unknown kit",
    kitSlug: concept.baseModel?.slug ?? "unknown-kit",
    style: concept.stylePreset?.name ?? "Unknown Style DNA",
    styleSlug: concept.stylePreset?.slug ?? "unknown-style",
    material: concept.materialPreset?.name ?? "Unknown material",
    materialSlug: concept.materialPreset?.slug ?? "unknown-material",
    weathering: concept.weatheringLevel,
    creator: concept.owner?.handle ?? "NeotypeLab",
    image: concept.previewAsset?.publicUrl ?? fallback.image,
    href: `/prototype/${concept._id}`,
    remixHref: `/create?remix=${concept._id}`,
    createdAt: concept._creationTime,
    remixCount: concept.remixCount,
    saveCount: concept.engagement.saveCount,
  };
}

function fallbackPrototype(
  prototype: Omit<ExplorePrototype, "createdAt" | "href" | "remixHref">
): ExplorePrototype {
  const index = Number(prototype.id.replace(/\D/g, "")) || 1;
  return {
    ...prototype,
    createdAt: editorialAnchor - index * 86_400_000,
    href: "/showcase",
    remixHref: "/create",
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
