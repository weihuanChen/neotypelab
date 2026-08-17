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
import { buildShowcaseHref } from "./showcaseUtils";
import type { ShowcaseConcept, ShowcaseSearch, ShowcaseSnapshot } from "./types";

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

const exhibitionAnchor = Date.UTC(2026, 7, 16);

const fallbackWorks: ExhibitionWork[] = [
  work("042", "Crimson Command", "MG Sazabi Ver.Ka", "mg-sazabi-ver-ka", "Command Unit", "command-unit", "Pseudo Plated", "pseudo-plated", "Clean", "yinglian", "/assets/explore/trending-red-command.png", 48, 132),
  work("037", "Field Hazard", "MG Gundam MK–II", "mg-gundam-mk-ii", "Industrial Hazard", "industrial-hazard", "Chipped Enamel", "chipped-enamel", "Heavy", "NeotypeLab", "/assets/explore/editorial-hero.png", 34, 108),
  work("031", "Night Dispatch", "MG Jesta", "mg-jesta", "Command Unit", "command-unit", "Graphite Ceramic", "graphite-ceramic", "Clean", "S. Kondo", "/assets/explore/editorial-detail-dark.png", 29, 96),
  work("028", "Jungle Recon", "MG Zaku II", "mg-zaku-ii", "Industrial Hazard", "industrial-hazard", "Matte Armor", "matte-armor", "Light", "T. Hayashi", "/assets/explore/editorial-detail-olive.png", 25, 88),
  work("024", "Ivory Relay", "MG Ball Ver.Ka", "mg-ball-ver-ka", "Ceremonial Clean", "ceremonial-clean", "Pearl Lacquer", "pearl-lacquer", "Clean", "R. Okada", "/assets/explore/editorial-detail-white.png", 21, 84),
  work("021", "Urban Patrol", "MG Gundam EZ–8", "mg-gundam-ez-8", "Industrial Hazard", "industrial-hazard", "Chipped Enamel", "chipped-enamel", "Heavy", "M. Fujita", "/assets/explore/trending-white-industrial.png", 19, 79),
  work("018", "Desert Watch", "MG GM Sniper II", "mg-gm-sniper-ii", "Ceremonial Clean", "ceremonial-clean", "Sand Ceramic", "sand-ceramic", "Light", "Y. Nakamura", "/assets/explore/trending-sand-sniper.png", 18, 76),
  work("016", "Harbor Guard", "MG Rick Dias", "mg-rick-dias", "Industrial Hazard", "industrial-hazard", "Oxide Metal", "oxide-metal", "Light", "A. Mori", "/assets/explore/trending-blue-hazard.png", 16, 70),
  work("013", "Hazel Test Frame", "MG Gundam TR–1", "mg-hazel", "Industrial Hazard", "industrial-hazard", "Ivory Ceramic", "ivory-ceramic", "Light", "N. Iwata", "/assets/explore/archive-hazel-white.png", 14, 65),
  work("011", "Signal 21", "HG Jegan", "hg-jegan", "Command Unit", "command-unit", "Teal Matte", "teal-matte", "Clean", "yinglian", "/assets/explore/archive-jegan-teal.png", 13, 61),
  work("009", "Ivory Standard", "MG Tallgeese EW", "mg-tallgeese-ew", "Ceremonial Clean", "ceremonial-clean", "Pearl + Gold", "pearl-gold", "Clean", "H. Ito", "/assets/explore/archive-ceremonial-white.png", 11, 58),
  work("007", "Black Vanguard", "RG Nu Gundam", "rg-nu-gundam", "Command Unit", "command-unit", "Black Ceramic", "black-ceramic", "Clean", "A. Sato", "/assets/explore/archive-black-vanguard.png", 10, 54),
  work("005", "Foundry Unit", "MG Guncannon", "mg-guncannon", "Industrial Hazard", "industrial-hazard", "Safety Enamel", "safety-enamel", "Heavy", "F. Abe", "/assets/explore/archive-orange-worker.png", 8, 49),
  work("003", "Field Recon", "MG Geara Doga", "mg-geara-doga", "Command Unit", "command-unit", "Olive Matte", "olive-matte", "Light", "C. Watanabe", "/assets/explore/archive-green-field.png", 7, 44),
];

export function ShowcaseLanding({ search, snapshot }: { search: ShowcaseSearch; snapshot: ShowcaseSnapshot }) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const providerStatus = useStartProviderStatus();
  const liveConcepts = useQuery(api.showcase.listPublicConcepts, providerStatus.hasConvexClient ? {} : "skip");
  const concepts = liveConcepts ?? snapshot.concepts;
  const allWorks = concepts.length ? concepts.map(normalizeConcept) : fallbackWorks;
  const filteredWorks = useMemo(
    () => sortWorks(allWorks.filter((item) => matchesSearch(item, search)), search),
    [allWorks, search]
  );
  const featuredItems = allWorks.slice(0, 3);
  const featuredIds = new Set(featuredItems.map((item) => item.id));
  const selected = filteredWorks.filter((item) => !featuredIds.has(item.id)).slice(0, 6);
  const recent = [...allWorks].sort((a, b) => b.createdAt - a.createdAt).slice(6, 14);
  const collection = allWorks.filter((item) => ["pseudo-plated", "graphite-ceramic", "oxide-metal", "black-ceramic"].includes(item.materialSlug)).slice(0, 4);

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
          <div className="exhibition-empty"><p>No selected works match this lens.</p><a href="/showcase">Reset selection</a></div>
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
        <img src={item.image} alt={`${item.title} repaint prototype`} />
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
        <a className={sortMode === "featured" ? "is-active" : undefined} href="/showcase">Featured</a>
        <a className={sortMode === "trending" ? "is-active" : undefined} href={buildShowcaseHref(search, { sort: null, view: "trending" })}>Trending</a>
        <a className={sortMode === "recent" ? "is-active" : undefined} href={buildShowcaseHref(search, { sort: "recent", view: null })}>Recent</a>
        <a className={sortMode === "most-remixed" ? "is-active" : undefined} href={buildShowcaseHref(search, { sort: "most-remixed", view: null })}>Most Remixed</a>
      </nav>
      <div className="exhibition-toolbar__filters">
        <ToolbarFilter kind="kit" items={allWorks} search={search} />
        <ToolbarFilter kind="style" items={allWorks} search={search} />
        <ToolbarFilter kind="material" items={allWorks} search={search} />
        <form action="/showcase" className="exhibition-search" method="get"><MagnifyingGlassIcon aria-hidden="true" /><input aria-label="Search works" defaultValue={search.q} name="q" placeholder="Search" /></form>
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
        <img src={item.image} alt={`${item.title} repaint prototype`} />
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
      <div className="exhibition-collection__works">{items.map((item, index) => <a href={item.href} key={item.id}><span>{String(index + 1).padStart(2, "0")}</span><img src={item.image} alt={item.title} /></a>)}</div>
    </section>
  );
}

function RecentlyPublished({ items }: { items: ExhibitionWork[] }) {
  return (
    <section className="exhibition-recent" aria-labelledby="recent-title">
      <div className="exhibition-section-heading"><div><p>Public ledger</p><h2 id="recent-title">Recently published</h2></div></div>
      <div className="exhibition-recent__grid">{items.map((item) => <a className="exhibition-recent__item" href={item.href} key={item.id}><img src={item.image} alt={item.title} /><span>N°.{item.number}</span><strong>{item.title}</strong><small>{item.kit}</small></a>)}</div>
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

function work(number: string, title: string, kit: string, kitSlug: string, style: string, styleSlug: string, material: string, materialSlug: string, weathering: string, creator: string, image: string, remixCount: number, saveCount: number): ExhibitionWork {
  return { id: `work-${number}`, number, title, kit, kitSlug, style, styleSlug, material, materialSlug, weathering, weatheringSlug: weathering.toLowerCase(), creator, image, href: "/showcase/archive", remixHref: "/create", createdAt: exhibitionAnchor - Number(number) * 86_400_000, remixCount, saveCount };
}

function normalizeConcept(concept: ShowcaseConcept, index: number): ExhibitionWork {
  const fallback = fallbackWorks[index % fallbackWorks.length];
  return { id: String(concept._id), number: String(index + 1).padStart(3, "0"), title: concept.title, kit: concept.baseModel?.name ?? "Unknown kit", kitSlug: concept.baseModel?.slug ?? "unknown-kit", style: concept.stylePreset?.name ?? "Unknown Style DNA", styleSlug: concept.stylePreset?.slug ?? "unknown-style", material: concept.materialPreset?.name ?? "Unknown material", materialSlug: concept.materialPreset?.slug ?? "unknown-material", weathering: concept.weatheringLevel, weatheringSlug: concept.weatheringLevel.toLowerCase(), creator: concept.owner?.handle ?? "NeotypeLab", image: concept.previewAsset?.publicUrl ?? fallback.image, href: `/prototype/${concept._id}`, remixHref: `/create?remix=${concept._id}`, createdAt: concept._creationTime, remixCount: concept.remixCount, saveCount: concept.engagement.saveCount };
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
