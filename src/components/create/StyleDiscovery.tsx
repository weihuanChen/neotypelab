import { useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import { readStyleIntent } from "@/convex/styleRefinements";
import { StylePalette, displayPalette } from "./StylePalette";

type Preset = FunctionReturnType<typeof api.catalog.listCreateOptions>["stylePresets"][number];
type Community = FunctionReturnType<typeof api.userStyles.community>[number];
type Preview = FunctionReturnType<typeof api.styleEditorial.gallery>[number];
export function StyleDiscovery({ presets, community, previews, selectedId, onPreset, onCommunity, busy, initialCommunity }: {
  presets: Preset[]; community: Community[] | undefined; previews: Preview[];
  selectedId?: string; onPreset: (preset: Preset) => void; onCommunity: (style: Community) => void;
  busy: boolean; initialCommunity?: string;
}) {
  const [browse, setBrowse] = useState(Boolean(initialCommunity));
  const [search, setSearch] = useState("");
  const [source, setSource] = useState(initialCommunity ? "community" : "all");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("featured");
  const [page, setPage] = useState(1);
  const entries = [
    ...presets.map(preset => ({ id: preset._id, name: preset.name, description: preset.shortDescription ?? "",
      category: preset.category ?? "Other", source: "official", image: previews.find(p => p.id === preset._id)?.imageUrl,
      featured: Boolean(previews.find(p => p.id === preset._id)?.featured), colors: displayPalette(preset.slug),
      intent: readStyleIntent(preset.styleIntentJson), choose: () => onPreset(preset) })),
    ...(community ?? []).map(style => ({ id: style.id, name: style.name, description: style.intent.graphicLanguage,
      category: "Community", source: "community", image: style.preview?.imageUrl, featured: false,
      colors: [], intent: style.intent, choose: () => onCommunity(style) })),
  ];
  const filtered = entries.filter(e => (source === "all" || e.source === source) &&
    (category === "all" || e.category === category) && [e.name, e.description].join(" ").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.id === initialCommunity) - Number(a.id === initialCommunity) ||
      (sort === "featured" ? Number(b.featured) - Number(a.featured) : 0) || a.name.localeCompare(b.name));
  const pages = Math.max(1, Math.ceil(filtered.length / 8));
  const current = Math.min(page, pages);
  const visible = browse ? filtered.slice((current - 1) * 8, current * 8) : filtered.slice(0, 4);
  return <div className="style-discovery">
    <div className="style-discovery-heading"><h3>{browse ? "Discover styles" : "Selected directions"}</h3>
      {!browse ? <button type="button" onClick={() => setBrowse(true)}>Browse all {entries.length} →</button> : <button type="button" onClick={() => setBrowse(false)}>Back to selections</button>}</div>
    {browse ? <div className="style-discovery-filters">
      <input aria-label="Search styles" placeholder="Search styles…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
      <select aria-label="Style source" value={source} onChange={e => { setSource(e.target.value); setPage(1); }}>
        <option value="all">All sources</option><option value="official">Official</option><option value="community">Community</option>
      </select>
      <select aria-label="Style category" value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
        <option value="all">All categories</option>{Array.from(new Set(entries.map(e => e.category))).map(c => <option key={c}>{c}</option>)}
      </select>
      <select aria-label="Sort styles" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}>
        <option value="featured">Featured first</option><option value="name">Name A–Z</option>
      </select>
    </div> : null}
    <div className="discover-style-grid">{visible.map(entry => <article key={entry.id} className={selectedId === entry.id ? "discover-style-card is-selected" : "discover-style-card"}>
      <button type="button" className="discover-style-select" disabled={busy} onClick={entry.choose} aria-pressed={selectedId === entry.id}>
        {entry.image ? <img src={entry.image} alt={entry.name + " preview"} loading="lazy" /> :
          entry.colors.length ? <div className="palette-study">{entry.colors.map(color => <span key={color.role} style={{ backgroundColor: color.hex, flexGrow: color.weight }} />)}<small>Palette study</small></div> :
            <div className="palette-study is-unmapped"><strong>{entry.name}</strong><small>Preview coming soon</small></div>}
      </button>
      <StylePalette colors={entry.colors} />
      <button type="button" className="discover-style-select" disabled={busy} onClick={entry.choose} aria-pressed={selectedId === entry.id}>
        <h3>{entry.name}</h3><p>{entry.intent ? Object.values(entry.intent.palette).flat().join(" · ") : entry.description}</p>
      </button>
      <details><summary>Palette details</summary>
        <p>{entry.source === "official" ? "Official" : "Community"} · {entry.category}</p>
        <p>{entry.description}</p>
        {entry.colors.length ? <><p>Illustrative frontend palette · not a verified paint mapping.</p>{entry.colors.map(c => <p key={c.role}>{c.role} · {c.hex}</p>)}</> : <p>Exact colors have not been specified.</p>}
      </details>
    </article>)}</div>
    {!visible.length ? <p role="status">{source === "community" && community === undefined ? "Loading community styles…" : "No styles match these filters."}</p> : null}
    {browse ? <nav className="style-pagination" aria-label="Style pages">
      <button disabled={current === 1} onClick={() => setPage(current - 1)}>← Previous</button>
      <span>Page {current} of {pages}</span><button disabled={current === pages} onClick={() => setPage(current + 1)}>Next →</button>
    </nav> : null}
  </div>;
}
