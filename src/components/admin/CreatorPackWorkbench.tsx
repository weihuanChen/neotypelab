"use client";

import { MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PackCatalog = FunctionReturnType<typeof api.admin.listCreatorPacksAdmin>;
type PackItem = PackCatalog["packs"][number];
type PackType = "free" | "premium";
type PackDraft = {
  creatorUserId: string;
  description: string;
  isActive: boolean;
  isFeatured: boolean;
  kitVariantIds: string[];
  materialPresetIds: string[];
  name: string;
  packType: PackType;
  stylePresetIds: string[];
  tagline: string;
};
type RelationItem = { _id: string; name: string; meta: string; isActive: boolean };

const emptyDraft: PackDraft = {
  creatorUserId: "none",
  description: "",
  isActive: true,
  isFeatured: false,
  kitVariantIds: [],
  materialPresetIds: [],
  name: "",
  packType: "free",
  stylePresetIds: [],
  tagline: "",
};

export function CreatorPackWorkbench() {
  const catalog = useQuery(api.admin.listCreatorPacksAdmin);
  const savePack = useMutation(api.admin.upsertCreatorPack);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, PackDraft>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!selectedId && catalog?.packs[0]) setSelectedId(catalog.packs[0]._id);
  }, [catalog, selectedId]);

  const selected = selectedId === "new" ? null : catalog?.packs.find((item) => item._id === selectedId) ?? null;
  const draft = selectedId ? drafts[selectedId] ?? (selected ? createDraft(selected) : emptyDraft) : emptyDraft;
  const baseline = selected ? createDraft(selected) : emptyDraft;
  const dirty = selectedId === "new" || Boolean(selectedId && drafts[selectedId] && JSON.stringify(draft) !== JSON.stringify(baseline));
  const canSave = Boolean(dirty && draft.name.trim().length >= 3 && draft.creatorUserId !== "none");
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!catalog) return [];
    return catalog.packs.filter((pack) => !term || [pack.name, pack.slug, pack.tagline, pack.description, pack.creator?.fullName, pack.creator?.handle].filter(Boolean).join(" ").toLocaleLowerCase().includes(term));
  }, [catalog, query]);

  const update = (patch: Partial<PackDraft>) => {
    if (!selectedId) return;
    setDrafts((current) => ({ ...current, [selectedId]: { ...draft, ...patch } }));
  };
  const createPack = () => {
    setDrafts((current) => ({ ...current, new: { ...emptyDraft, creatorUserId: catalog?.creators[0]?._id ?? "none" } }));
    setSelectedId("new");
    setNotice(null);
  };
  const cancel = () => {
    if (!selectedId) return;
    setDrafts((current) => omit(current, selectedId));
    if (selectedId === "new") setSelectedId(catalog?.packs[0]?._id ?? null);
  };
  const save = async () => {
    if (!selectedId || !canSave) return;
    setBusy(true);
    setNotice(null);
    try {
      const id = await savePack({
        creatorPackId: selectedId === "new" ? undefined : selectedId as Id<"creatorPacks">,
        creatorUserId: draft.creatorUserId as Id<"users">,
        description: optional(draft.description),
        isActive: draft.isActive,
        isFeatured: draft.isFeatured,
        kitVariantIds: draft.kitVariantIds as Id<"baseModels">[],
        materialPresetIds: draft.materialPresetIds as Id<"materialPresets">[],
        name: draft.name,
        packType: draft.packType,
        stylePresetIds: draft.stylePresetIds as Id<"stylePresets">[],
        tagline: optional(draft.tagline),
      });
      setDrafts((current) => omit(current, selectedId));
      setSelectedId(id);
      setNotice({ text: `Saved ${draft.name}.`, tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Creator pack save failed", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (catalog === undefined) return <div className="admin-data-empty">Loading creator packs.</div>;

  const styleRelations: RelationItem[] = catalog.styles.map((item) => ({ _id: item._id, name: item.name, meta: item.slug, isActive: item.isActive }));
  const materialRelations: RelationItem[] = catalog.materials.map((item) => ({ _id: item._id, name: item.name, meta: item.slug, isActive: item.isActive }));
  const kitRelations: RelationItem[] = catalog.kitVariants.map((item) => ({ _id: item._id, name: item.name, meta: item.baseUnitName ?? item.slug, isActive: item.isActive }));

  return (
    <div className="style-library-workbench creator-pack-workbench">
      <header className="admin-workspace-head"><p>Content</p><h2>Creator Packs</h2><span>Bundle creator-owned Style DNA, kit variants, and materials into reusable discovery packages.</span></header>
      <div className="style-library-toolbar"><span><strong>{catalog.packs.filter((item) => item.isActive).length}</strong> active · {catalog.packs.length} total</span><label><MagnifyingGlassIcon /><Input aria-label="Search creator packs" onChange={(event) => setQuery(event.target.value)} placeholder="Search packs or creators…" value={query} /></label><Button className="gap-2 bg-ink-primary text-surface shadow-none" onClick={createPack}><PlusIcon />New Pack</Button></div>
      {notice ? <div className={cn("style-library-notice", notice.tone === "error" ? "is-error" : "is-success")}>{notice.text}</div> : null}
      <section className="style-library-layout">
        <aside className="style-library-list" aria-label="Creator pack library"><div className="style-library-list__head"><span>Pack library</span><small>{filtered.length}</small></div>{filtered.length ? filtered.map((pack) => <button className={cn("style-library-row creator-pack-row", selectedId === pack._id && "is-active")} key={pack._id} onClick={() => setSelectedId(pack._id)} type="button"><span className={cn("style-library-dot", pack.isActive ? "is-active" : "is-inactive")} /><span><strong>{pack.name}</strong><small>@{pack.creator?.handle ?? "unknown"} · {pack.stylePresetIds.length + pack.baseModelIds.length + pack.materialPresetIds.length} records</small></span><em>{pack.packType}</em></button>) : <div className="admin-data-empty">No creator packs match this search.</div>}</aside>
        <div className="style-library-inspector">
          {selectedId ? <><header className="style-inspector-head"><div><h3>{draft.name || "New Creator Pack"}</h3><p>{selectedId === "new" ? "New pack" : `${draft.isActive ? "Active" : "Inactive"} · ${draft.packType}`}</p></div><div>{dirty ? <span className="is-dirty">Unsaved changes</span> : null}<button disabled={!dirty} onClick={cancel} type="button">Cancel</button><Button disabled={!canSave || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</Button></div></header><div className="style-inspector-body">
            <InspectorSection description="Pack identity, ownership, and discovery copy." title="General"><FieldGrid><Field label="Pack name"><Input value={draft.name} onChange={(event) => update({ name: event.target.value })} /></Field><Field label="Slug"><Input className="font-mono" disabled value={selected?.slug ?? "Generated from name on save"} /></Field><Field label="Creator owner"><Select value={draft.creatorUserId} onValueChange={(creatorUserId) => update({ creatorUserId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{catalog.creators.length ? catalog.creators.map((creator) => <SelectItem key={creator._id} value={creator._id}>{creator.fullName} · @{creator.handle}</SelectItem>) : <SelectItem disabled value="none">No eligible creators</SelectItem>}</SelectContent></Select></Field><Field label="Pack type"><Select value={draft.packType} onValueChange={(packType) => update({ packType: packType as PackType })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="premium">Premium</SelectItem></SelectContent></Select></Field></FieldGrid><div className="mt-5 space-y-5"><Field label="Tagline"><Input value={draft.tagline} onChange={(event) => update({ tagline: event.target.value })} /></Field><Field label="Description"><Textarea className="min-h-[110px]" value={draft.description} onChange={(event) => update({ description: event.target.value })} /></Field></div></InspectorSection>
            <InspectorSection description="Select the Style DNA presets included in this pack." title="Style DNA"><RelationshipPicker items={styleRelations} onChange={(stylePresetIds) => update({ stylePresetIds })} selectedIds={draft.stylePresetIds} /></InspectorSection>
            <InspectorSection description="Select the kit variants that the pack is designed to support." title="Kit variants"><RelationshipPicker items={kitRelations} onChange={(kitVariantIds) => update({ kitVariantIds })} selectedIds={draft.kitVariantIds} /></InspectorSection>
            <InspectorSection description="Select the material profiles recommended by this pack." title="Materials"><RelationshipPicker items={materialRelations} onChange={(materialPresetIds) => update({ materialPresetIds })} selectedIds={draft.materialPresetIds} /></InspectorSection>
            {selected ? <InspectorSection description="Read-only engagement accumulated by this pack." title="Analytics"><div className="creator-pack-analytics"><div><span>Likes</span><strong>{selected.analytics.likes}</strong></div><div><span>Saves</span><strong>{selected.analytics.saves}</strong></div><div><span>Styles</span><strong>{selected.stylePresetIds.length}</strong></div><div><span>Kits</span><strong>{selected.baseModelIds.length}</strong></div></div></InspectorSection> : null}
            <InspectorSection description="Control availability and editorial placement." title="Status"><ToggleRow checked={draft.isActive} description="Available in public Creator Pack discovery." label="Active" onChange={(isActive) => update({ isActive })} /><ToggleRow checked={draft.isFeatured} description="Eligible for featured placement in Showcase surfaces." label="Featured pack" onChange={(isFeatured) => update({ isFeatured })} /></InspectorSection>
          </div></> : <div className="admin-data-empty">Select a Creator Pack or create a new one.</div>}
        </div>
      </section>
    </div>
  );
}

function RelationshipPicker({ items, onChange, selectedIds }: { items: RelationItem[]; onChange: (ids: string[]) => void; selectedIds: string[] }) {
  const [query, setQuery] = useState("");
  const filtered = items.filter((item) => !query.trim() || `${item.name} ${item.meta}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <div className="creator-relation-picker"><label><MagnifyingGlassIcon /><Input aria-label="Search available records" onChange={(event) => setQuery(event.target.value)} placeholder="Search available records…" value={query} /></label><div className="creator-relation-list">{filtered.length ? filtered.map((item) => { const checked = selectedIds.includes(item._id); return <label className={cn("creator-relation-row", checked && "is-selected")} key={item._id}><Checkbox checked={checked} onCheckedChange={(next) => onChange(next ? [...selectedIds, item._id] : selectedIds.filter((id) => id !== item._id))} /><span><strong>{item.name}</strong><small>{item.meta}</small></span><em>{item.isActive ? "Active" : "Inactive"}</em></label>; }) : <div className="admin-data-empty">No records match this search.</div>}</div><p>{selectedIds.length} selected</p></div>;
}
function createDraft(item: PackItem): PackDraft { return { creatorUserId: item.creatorUserId, description: item.description ?? "", isActive: item.isActive, isFeatured: item.isFeatured, kitVariantIds: item.baseModelIds, materialPresetIds: item.materialPresetIds, name: item.name, packType: item.packType, stylePresetIds: item.stylePresetIds, tagline: item.tagline ?? "" }; }
function InspectorSection({ children, description, title }: { children: ReactNode; description: string; title: string }) { return <section className="style-inspector-section"><div><h4>{title}</h4><p>{description}</p></div>{children}</section>; }
function FieldGrid({ children }: { children: ReactNode }) { return <div className="grid gap-5 sm:grid-cols-2">{children}</div>; }
function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="block"><span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</span><div className="mt-2">{children}</div></label>; }
function ToggleRow({ checked, description, label, onChange }: { checked: boolean; description: string; label: string; onChange: (checked: boolean) => void }) { return <div className="style-toggle-row"><div><strong>{label}</strong><p>{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>; }
function optional(value: string) { const normalized = value.trim(); return normalized ? normalized : undefined; }
function omit<T>(record: Record<string, T>, key: string) { const next = { ...record }; delete next[key]; return next; }
