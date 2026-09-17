import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { HeartIcon, HeartFilledIcon, MagnifyingGlassIcon, MixerHorizontalIcon, CheckIcon } from "@radix-ui/react-icons";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type Filters = { universes: string[]; grades: string[]; types: string[]; manufacturers: string[] };
const empty: Filters = { universes: [], grades: [], types: [], manufacturers: [] };
const groups = [{ key: "universes", label: "Universe" }, { key: "grades", label: "Grade" }, { key: "types", label: "Type" }, { key: "manufacturers", label: "Manufacturer" }] as const;

export function KitPortrait({ url, name }: { url?: string | null; name: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  return url && broken !== url ? <img src={url} alt={`${name} silhouette portrait`} loading="lazy" onError={() => setBroken(url)} />
    : <div className="kit-portrait-empty"><svg viewBox="0 0 64 72" aria-hidden="true"><path d="M22 9h20v9H22zM13 24h38v22H13zM18 51h10v16H18zM36 51h10v16H36zM4 26h5v28H4zM55 26h5v28h-5z" /></svg><small>Portrait pending</small></div>;
}

export function KitPicker({ selectedId, onSelect, disabled = false }: { selectedId: Id<"baseModels"> | null; onSelect: (id: Id<"baseModels">) => void; disabled?: boolean }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<"all" | "recent" | "favorites" | "featured">("all");
  const [filters, setFilters] = useState<Filters>(empty);
  const [draft, setDraft] = useState<Filters>(empty);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const favorite = useMutation(api.kitPicker.favorite);
  useEffect(() => { const timer = setTimeout(() => { setQuery(search); setPage(1); }, 180); return () => clearTimeout(timer); }, [search]);
  const data = useQuery(api.kitPicker.browse, { search: query, scope, page, ...filters });
  const draftResult = useQuery(api.kitPicker.browse, open ? { search: query, scope, page: 1, ...draft } : "skip");
  const count = Object.values(filters).reduce((sum, values) => sum + values.length, 0);
  function toggle(key: keyof Filters, value: string, current: Filters) { return { ...current, [key]: current[key].includes(value) ? current[key].filter(item => item !== value) : [...current[key], value] }; }
  return <section className="kit-picker" aria-labelledby="kit-picker-title">
    <header><p className="workbench-kicker">02 · Model</p><h2 id="kit-picker-title">Which kit should wear this style?</h2></header>
    <label className="kit-picker-search"><MagnifyingGlassIcon aria-hidden="true" /><input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search kit, series, scale or model…" aria-label="Search kits" /></label>
    <div className="kit-picker-tools">
      <div className="kit-picker-scopes" aria-label="Kit collection">{(["all", "recent", "favorites", "featured"] as const).map(value => <button type="button" key={value} aria-pressed={scope === value} onClick={() => { setScope(value); setPage(1); }}>{value === "all" ? "All kits" : value.charAt(0).toUpperCase() + value.slice(1)}</button>)}</div>
      <div className="kit-picker-grades" aria-label="Quick grade filters">{["MG", "RG", "HG"].map(grade => <button type="button" key={grade} aria-pressed={filters.grades.includes(grade)} onClick={() => { setFilters(toggle("grades", grade, filters)); setPage(1); }}>{grade}</button>)}</div>
      <Button variant="outline" onClick={() => { setDraft(filters); setOpen(true); }}><MixerHorizontalIcon aria-hidden="true" />Filters{count ? ` · ${count}` : ""}</Button>
    </div>
    {count > 0 ? <div className="kit-active-filters">{groups.flatMap(group => filters[group.key].map(value => <button key={`${group.key}:${value}`} onClick={() => { setFilters(toggle(group.key, value, filters)); setPage(1); }} type="button" aria-label={`Remove ${group.label}: ${value}`}>{value} ×</button>))}<button type="button" onClick={() => { setFilters(empty); setPage(1); }}>Clear all</button></div> : null}
    {error ? <p role="alert" className="kit-picker-error">{error}</p> : null}
    <p className="kit-picker-count" role="status">{data ? `${data.total} kits${scope === "featured" ? " · Catalog selections" : ""}` : "Finding kits…"}</p>
    <div className="kit-picker-grid" aria-busy={!data}>{data?.items.map(kit => <article className={kit.id === selectedId ? "kit-portrait-card is-selected" : "kit-portrait-card"} key={kit.id}>
      <button type="button" className="kit-portrait-select" disabled={disabled} aria-pressed={kit.id === selectedId} onClick={() => onSelect(kit.id)}>
        <div className="kit-portrait"><span className="kit-portrait-grade">{kit.grade || "Kit"}</span><KitPortrait url={kit.portrait} name={kit.name} />{kit.id === selectedId ? <span className="kit-portrait-selected"><CheckIcon />Selected</span> : null}</div>
        <div className="kit-portrait-copy"><h3>{kit.name}</h3><p>{[kit.grade, kit.scale].filter(Boolean).join(" · ")}</p>{kit.releaseVersion ? <small>{kit.releaseVersion}</small> : null}<small>{kit.universe}</small></div>
      </button>
      <button type="button" className="kit-favorite" aria-pressed={kit.favorite} aria-label={`${kit.favorite ? "Unfavorite" : "Favorite"} ${kit.name}`} onClick={() => { setError(null); void favorite({ kitId: kit.id, selected: !kit.favorite }).catch(() => setError("Could not update favorites. Please try again.")); }}>{kit.favorite ? <HeartFilledIcon /> : <HeartIcon />}</button>
    </article>)}</div>
    {data && !data.items.length ? <div className="kit-picker-empty"><h3>{scope === "recent" ? "Your next build starts here." : scope === "favorites" ? "Keep your regular kits close." : "No kits match this search."}</h3><p>{scope === "recent" ? "Kits used in your creations will appear in Recent." : scope === "favorites" ? "Use the heart on a kit to add it to Favorites." : "Try a model name or remove a filter."}</p><Button variant="outline" onClick={() => { setScope("all"); setSearch(""); setFilters(empty); setPage(1); }}>Browse all kits</Button></div> : null}
    {data && data.pages > 1 ? <nav className="kit-picker-pagination" aria-label="Kit pages"><Button variant="ghost" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>← Previous</Button><span>{data.page} / {data.pages}</span><Button variant="ghost" disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Next →</Button></nav> : null}
    <Sheet open={open} onOpenChange={setOpen}><SheetContent className="kit-filter-sheet"><SheetHeader><SheetTitle>Filter kits</SheetTitle><SheetDescription>Find the model and kit version you want to build.</SheetDescription></SheetHeader><div className="kit-filter-fields">{groups.map(group => <fieldset key={group.key}><legend>{group.label}</legend>{(data?.facets[group.key] ?? []).map(value => <label key={value}><Checkbox checked={draft[group.key].includes(value)} onCheckedChange={() => setDraft(toggle(group.key, value, draft))} />{value}</label>)}</fieldset>)}</div><footer><Button variant="ghost" onClick={() => setDraft(empty)}>Clear</Button><Button disabled={!draftResult} onClick={() => { setFilters(draft); setPage(1); setOpen(false); }}>Show {draftResult?.total ?? "…"} kits</Button></footer></SheetContent></Sheet>
  </section>;
}
