import {
  ArrowTopRightIcon,
  ChevronDownIcon,
  Cross1Icon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import { useStartProviderStatus } from "@/src/providers/StartProviders";
import {
  buildShowcaseHref,
  hasActiveShowcaseQuery,
  isPublicArchivePending,
  publicConceptImageUrl,
  selectExhibitionSections,
} from "./showcaseUtils";
import type { ShowcaseConcept, ShowcaseSearch, ShowcaseSnapshot } from "./types";
import { SystemState, SystemStateLink, systemStates } from "@/src/components/system-state";

type ExhibitionWork = {
  id: string;
  number: string;
  title: string;
  kit: string;
  kitSlug: string;
  style: string;
  styleSlug: string;
  material: string;
  materialSlug: string;
  weathering: string;
  weatheringSlug: string;
  creator: string;
  image: string;
  href: string;
  remixHref: string;
  createdAt: number;
  remixCount: number;
  saveCount: number;
};

export function ShowcaseLanding({ search, snapshot }: { search: ShowcaseSearch; snapshot: ShowcaseSnapshot }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const providerStatus = useStartProviderStatus();
  const liveConcepts = useQuery(api.showcase.listPublicConcepts, providerStatus.hasConvexClient ? {} : "skip");
  const concepts = liveConcepts ?? snapshot.concepts;
  const pending = isPublicArchivePending(
    liveConcepts,
    snapshot.concepts.length,
    providerStatus.hasConvexClient
  );
  const allWorks = concepts.map(normalizeConcept);
  const filteredWorks = useMemo(
    () => sortWorks(allWorks.filter((item) => matchesSearch(item, search)), search),
    [allWorks, search]
  );
  const { featured: featuredItems, selected, recent } = useMemo(
    () => selectExhibitionSections(allWorks, filteredWorks, search),
    [allWorks, filteredWorks, search]
  );
  const collection = allWorks.filter((item) => ["pseudo-plated", "graphite-ceramic", "oxide-metal", "black-ceramic"].includes(item.materialSlug)).slice(0, 4);
  const querying = hasActiveShowcaseQuery(search);

  if (pending) {
    return (
      <main className="exhibition-page">
        <SystemState {...systemStates.showcaseLoading} />
      </main>
    );
  }

  if (concepts.length === 0) {
    return (
      <main className="exhibition-page">
        <SystemState
          {...(querying ? systemStates.emptyQuery : systemStates.emptyShowcase)}
          primary={
            querying ? (
              <SystemStateLink href="/showcase">Clear filters</SystemStateLink>
            ) : (
              <SystemStateLink href="/">Explore works ↗</SystemStateLink>
            )
          }
        />
      </main>
    );
  }

  return (
    <main className="exhibition-page">
      {featuredItems.length ? <FeaturedWorks items={featuredItems} /> : null}
      <CuratedCollection items={collection.length ? collection : allWorks.slice(0, 4)} />
      <section className="exhibition-selected" aria-labelledby="selected-works-title">
        <div className="exhibition-section-heading">
          <div><p>Showcase / Public Archive</p><h2 id="selected-works-title">Selected works</h2></div>
          <span>{filteredWorks.length.toString().padStart(3, "0")} works</span>
        </div>
        <ShowcaseToolbar allWorks={allWorks} onOpenFilters={() => setFiltersOpen(true)} search={search} />
        {selected.length ? (
          <div className="exhibition-work-pairs">
            {Array.from({ length: Math.ceil(selected.length / 2) }, (_, pairIndex) => {
              const pair = selected.slice(pairIndex * 2, pairIndex * 2 + 2);
              const reversed = pairIndex % 2 === 1;

              return (
                <div className={reversed ? "exhibition-work-pair is-reversed" : "exhibition-work-pair"} key={pair[0].id}>
                  {pair.map((item, itemIndex) => {
                    const size = (reversed ? itemIndex === 1 : itemIndex === 0) ? "large" : "small";
                    return <ExhibitionCard item={item} key={item.id} size={size} />;
                  })}
                </div>
              );
            })}
          </div>
        ) : (
          <SystemState
            {...(querying ? systemStates.emptyQuery : systemStates.emptyShowcase)}
            layout="inline"
            primary={
              querying ? (
                <SystemStateLink href="/showcase">Clear filters</SystemStateLink>
              ) : (
                <SystemStateLink href="/">Explore works ↗</SystemStateLink>
              )
            }
          />
        )}
      </section>
      <RecentlyPublished items={recent} />
      <FilterDrawer allWorks={allWorks} onClose={() => setFiltersOpen(false)} open={filtersOpen} search={search} />
    </main>
  );
}

function FeaturedWorks({ items }: { items: ExhibitionWork[] }) {
  const [primary, ...secondary] = items;
  if (!primary) {
    return null;
  }

  return (
    <section className="exhibition-feature" aria-labelledby="featured-title">
      <div className="exhibition-feature__heading">
        <p className="exhibition-eyebrow">Showcase / Selected works</p>
        <span>01 / Featured</span>
      </div>
      <div className="exhibition-feature__composition">
        <FeaturedCompositionCard item={primary} primary />
        <div className="exhibition-feature__secondary">
          {secondary.map((item) => <FeaturedCompositionCard item={item} key={item.id} />)}
        </div>
      </div>
    </section>
  );
}

function FeaturedCompositionCard({ item, primary = false }: { item: ExhibitionWork; primary?: boolean }) {
  return (
    <article className={primary ? "exhibition-feature-card is-primary" : "exhibition-feature-card"}>
      <div className="exhibition-feature-card__image">
        <span>N°.{item.number}</span>
        <PreviewImage alt={`${item.title} repaint prototype`} src={item.image} />
        <div className="exhibition-feature-card__actions">
          <a href={item.href}>View</a>
          <a href={item.remixHref}>Remix <ArrowTopRightIcon aria-hidden="true" /></a>
        </div>
      </div>
      <div className="exhibition-feature-card__caption">
        <h2 id={primary ? "featured-title" : undefined}>{item.title}</h2>
        <p>{item.kit}</p>
        <span>{item.style} · {item.material}</span>
      </div>
    </article>
  );
}

function ShowcaseToolbar({ allWorks, onOpenFilters, search }: { allWorks: ExhibitionWork[]; onOpenFilters: () => void; search: ShowcaseSearch }) {
  const sortMode = search.sort ?? (search.view === "trending" ? "trending" : "featured");
  return (
    <div className="exhibition-toolbar">
      <nav aria-label="Selected works order" className="exhibition-toolbar__modes">
        <a className={sortMode === "featured" ? "is-active" : undefined} href={buildShowcaseHref(search, { sort: null, view: null })}>Featured</a>
        <a className={sortMode === "trending" ? "is-active" : undefined} href={buildShowcaseHref(search, { sort: null, view: "trending" })}>Trending</a>
        <a className={sortMode === "recent" ? "is-active" : undefined} href={buildShowcaseHref(search, { sort: "recent", view: null })}>Recent</a>
        <a className={sortMode === "most-remixed" ? "is-active" : undefined} href={buildShowcaseHref(search, { sort: "most-remixed", view: null })}>Most Remixed</a>
      </nav>
      <div className="exhibition-toolbar__filters">
        <ToolbarFilter kind="kit" items={allWorks} search={search} />
        <ToolbarFilter kind="style" items={allWorks} search={search} />
        <ToolbarFilter kind="material" items={allWorks} search={search} />
        <form action="/showcase" className="exhibition-search" method="get">
          {search.sort ? <input name="sort" type="hidden" value={search.sort} /> : null}
          {search.view ? <input name="view" type="hidden" value={search.view} /> : null}
          {search.baseModel ? <input name="baseModel" type="hidden" value={search.baseModel} /> : null}
          {search.style ? <input name="style" type="hidden" value={search.style} /> : null}
          {search.material ? <input name="material" type="hidden" value={search.material} /> : null}
          {search.weathering ? <input name="weathering" type="hidden" value={search.weathering} /> : null}
          {search.creator ? <input name="creator" type="hidden" value={search.creator} /> : null}
          <MagnifyingGlassIcon aria-hidden="true" />
          <input aria-label="Search works" defaultValue={search.q} name="q" placeholder="Search" />
        </form>
        <button className="exhibition-filters-button" onClick={onOpenFilters} type="button">Filters +</button>
      </div>
    </div>
  );
}

function ToolbarFilter({ items, kind, search }: { items: ExhibitionWork[]; kind: "kit" | "style" | "material"; search: ShowcaseSearch }) {
  const config = {
    kit: { label: "Kit", param: "baseModel" as const, slug: "kitSlug" as const, value: "kit" as const },
    style: { label: "Style DNA", param: "style" as const, slug: "styleSlug" as const, value: "style" as const },
    material: { label: "Material", param: "material" as const, slug: "materialSlug" as const, value: "material" as const },
  }[kind];
  const options = uniqueWorkOptions(items, config.slug, config.value).slice(0, 8);
  const active = search[config.param];
  return (
    <details className="exhibition-toolbar-filter">
      <summary>{active ? options.find((item) => item.slug === active)?.label ?? config.label : config.label}<ChevronDownIcon aria-hidden="true" /></summary>
      <div><a href={buildShowcaseHref(search, { [config.param]: null })}>All {config.label}</a>{options.map((option) => <a className={active === option.slug ? "is-active" : undefined} href={buildShowcaseHref(search, { [config.param]: option.slug })} key={option.slug}>{option.label}</a>)}</div>
    </details>
  );
}

function ExhibitionCard({ item, size }: { item: ExhibitionWork; size: "large" | "small" }) {
  return (
    <article className={`exhibition-card is-${size}`}>
      <p className="exhibition-card__number">N°.{item.number}</p>
      <div className="exhibition-card__media">
        <PreviewImage alt={`${item.title} repaint prototype`} src={item.image} />
        <div className="exhibition-card__hover"><a href={item.href}>View prototype</a><a href={item.remixHref}>Remix <ArrowTopRightIcon aria-hidden="true" /></a></div>
      </div>
      <div className="exhibition-card__caption">
        <h3>{item.title}</h3><p>{item.kit}</p><p>{item.style} · {item.material}</p>
        <div><span>by {item.creator}</span><a aria-label={`View ${item.title}`} href={item.href}><ArrowTopRightIcon aria-hidden="true" /></a></div>
      </div>
    </article>
  );
}

function CuratedCollection({ items }: { items: ExhibitionWork[] }) {
  return (
    <section className="exhibition-collection" aria-labelledby="collection-title">
      <div className="exhibition-collection__intro"><p>Material Study / 006</p><h2 id="collection-title">Pseudo-Plated</h2><p>Layered metallic depth, controlled gloss and dark command-type silhouettes.</p><a href="/showcase/archive?material=pseudo-plated">Explore collection <ArrowTopRightIcon aria-hidden="true" /></a></div>
      <div className="exhibition-collection__works">{items.map((item, index) => <a href={item.href} key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><PreviewImage alt={item.title} src={item.image} /></a>)}</div>
    </section>
  );
}

function RecentlyPublished({ items }: { items: ExhibitionWork[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="exhibition-recent" aria-labelledby="recent-title">
      <div className="exhibition-section-heading"><div><p>Public ledger</p><h2 id="recent-title">Recently published</h2></div></div>
      <div className="exhibition-recent__grid">{items.map((item) => <a className="exhibition-recent__item" href={item.href} key={item.id}><PreviewImage alt={item.title} src={item.image} /><span>N°.{item.number}</span><strong>{item.title}</strong><small>{item.kit}</small></a>)}</div>
      <a className="exhibition-archive-link" href="/showcase/archive">Browse full archive <ArrowTopRightIcon aria-hidden="true" /></a>
    </section>
  );
}

function FilterDrawer({ allWorks, onClose, open, search }: { allWorks: ExhibitionWork[]; onClose: () => void; open: boolean; search: ShowcaseSearch }) {
  return (
    <>
      {open ? <button aria-label="Close filters" className="exhibition-drawer-backdrop" onClick={onClose} type="button" /> : null}
      <aside aria-hidden={!open} aria-label="Filter works" className={open ? "exhibition-drawer is-open" : "exhibition-drawer"}>
        <div className="exhibition-drawer__header"><div><p>Public archive</p><h2>Filter works</h2></div><button aria-label="Close filters" onClick={onClose} type="button"><Cross1Icon /></button></div>
        <form action="/showcase" method="get">
          <DrawerSelect label="Kit" name="baseModel" options={uniqueWorkOptions(allWorks, "kitSlug", "kit")} value={search.baseModel} />
          <DrawerSelect label="Style DNA" name="style" options={uniqueWorkOptions(allWorks, "styleSlug", "style")} value={search.style} />
          <DrawerSelect label="Material" name="material" options={uniqueWorkOptions(allWorks, "materialSlug", "material")} value={search.material} />
          <DrawerSelect label="Weathering" name="weathering" options={uniqueWorkOptions(allWorks, "weatheringSlug", "weathering")} value={search.weathering} />
          <DrawerSelect label="Creator" name="creator" options={uniqueWorkOptions(allWorks, "creator", "creator")} value={search.creator} />
          <div className="exhibition-drawer__actions"><a href="/showcase">Reset</a><button type="submit">Apply</button></div>
        </form>
      </aside>
    </>
  );
}

function DrawerSelect({ label, name, options, value }: { label: string; name: string; options: Array<{ slug: string; label: string }>; value?: string }) {
  return <label className="exhibition-drawer__field"><span>{label}</span><select defaultValue={value ?? ""} name={name}><option value="">All</option>{options.map((option) => <option key={option.slug} value={option.slug}>{option.label}</option>)}</select></label>;
}

function PreviewImage({ alt, src }: { alt: string; src: string }) {
  if (!src) {
    return <div className="exhibition-preview-missing">Preview unavailable</div>;
  }

  return <img alt={alt} src={src} />;
}

function normalizeConcept(concept: ShowcaseConcept, index: number): ExhibitionWork {
  return { id: String(concept._id), number: String(index + 1).padStart(3, "0"), title: concept.title, kit: concept.baseModel?.name ?? "Unknown kit", kitSlug: concept.baseModel?.slug ?? "unknown-kit", style: concept.stylePreset?.name ?? "Unknown Style DNA", styleSlug: concept.stylePreset?.slug ?? "unknown-style", material: concept.materialPreset?.name ?? "Unknown material", materialSlug: concept.materialPreset?.slug ?? "unknown-material", weathering: concept.weatheringLevel, weatheringSlug: concept.weatheringLevel.toLowerCase(), creator: concept.owner?.handle ?? "NeotypeLab", image: publicConceptImageUrl(concept.previewAsset), href: `/prototype/${concept._id}`, remixHref: `/create?remix=${concept._id}`, createdAt: concept._creationTime, remixCount: concept.remixCount, saveCount: concept.engagement.saveCount };
}

function matchesSearch(item: ExhibitionWork, search: ShowcaseSearch) {
  const query = search.q?.toLowerCase();
  return (!search.baseModel || item.kitSlug === search.baseModel) && (!search.style || item.styleSlug === search.style) && (!search.material || item.materialSlug === search.material) && (!search.weathering || item.weatheringSlug === search.weathering) && (!search.creator || item.creator === search.creator) && (!query || [item.title, item.kit, item.style, item.material, item.creator].join(" ").toLowerCase().includes(query));
}

function sortWorks(items: ExhibitionWork[], search: ShowcaseSearch) {
  if (search.sort === "recent") return [...items].sort((a, b) => b.createdAt - a.createdAt);
  if (search.sort === "most-remixed") return [...items].sort((a, b) => b.remixCount - a.remixCount);
  if (search.sort === "most-saved") return [...items].sort((a, b) => b.saveCount - a.saveCount);
  if (search.view === "trending") return [...items].sort((a, b) => (b.remixCount * 2 + b.saveCount) - (a.remixCount * 2 + a.saveCount));
  return items;
}

function uniqueWorkOptions<K extends keyof ExhibitionWork, V extends keyof ExhibitionWork>(items: ExhibitionWork[], slugKey: K, labelKey: V) {
  return Array.from(new Map(items.map((item) => [String(item[slugKey]), { slug: String(item[slugKey]), label: String(item[labelKey]) }])).values()).sort((a, b) => a.label.localeCompare(b.label));
}
