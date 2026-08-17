"use client";

import { MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PaintItems = FunctionReturnType<typeof api.admin.listPaintMappingsAdmin>;
type PaintItem = PaintItems[number];
type PaintDraft = {
  affiliateUrl: string;
  availabilityRegion: string;
  brand: string;
  code: string;
  colorName: string;
  finishType: string;
  hexPreview: string;
  isActive: boolean;
  line: string;
  mappingKey: string;
  paintType: string;
};
type PaintStatusFilter = "active" | "inactive" | "all";

const emptyDraft: PaintDraft = {
  affiliateUrl: "",
  availabilityRegion: "global",
  brand: "",
  code: "",
  colorName: "",
  finishType: "",
  hexPreview: "#808080",
  isActive: true,
  line: "",
  mappingKey: "",
  paintType: "",
};

export function PaintCatalogWorkbench() {
  const paints = useQuery(api.admin.listPaintMappingsAdmin);
  const savePaint = useMutation(api.admin.upsertPaintMappingAdmin);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<PaintStatusFilter>("active");
  const [drafts, setDrafts] = useState<Record<string, PaintDraft>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!selectedId && paints?.[0]) setSelectedId(paints[0]._id);
  }, [paints, selectedId]);

  const selected = selectedId === "new" ? null : paints?.find((item) => item._id === selectedId) ?? null;
  const draft = selectedId ? drafts[selectedId] ?? (selected ? createDraft(selected) : emptyDraft) : emptyDraft;
  const baseline = selected ? createDraft(selected) : emptyDraft;
  const dirty = selectedId === "new" || Boolean(selectedId && drafts[selectedId] && JSON.stringify(draft) !== JSON.stringify(baseline));
  const hexValid = draft.hexPreview.trim() === "" || /^#[0-9a-fA-F]{6}$/.test(draft.hexPreview.trim());
  const canSave = Boolean(dirty && draft.brand.trim() && draft.code.trim() && draft.colorName.trim() && hexValid);
  const filtered = useMemo(() => {
    if (!paints) return [];
    const term = query.trim().toLocaleLowerCase();
    return paints.filter((item) => {
      if (statusFilter !== "all" && item.isActive !== (statusFilter === "active")) return false;
      return !term || paintSearchText(item).includes(term);
    });
  }, [paints, query, statusFilter]);

  const update = (patch: Partial<PaintDraft>) => {
    if (!selectedId) return;
    setDrafts((current) => ({ ...current, [selectedId]: { ...draft, ...patch } }));
  };
  const createPaint = () => {
    setDrafts((current) => ({ ...current, new: { ...emptyDraft } }));
    setSelectedId("new");
    setNotice(null);
  };
  const cancel = () => {
    if (!selectedId) return;
    setDrafts((current) => omit(current, selectedId));
    if (selectedId === "new") setSelectedId(paints?.[0]?._id ?? null);
  };
  const save = async () => {
    if (!selectedId || !canSave) return;
    setBusy(true);
    setNotice(null);
    try {
      const id = await savePaint({
        affiliateUrl: optional(draft.affiliateUrl),
        availabilityRegion: optional(draft.availabilityRegion),
        brand: draft.brand,
        code: draft.code,
        colorName: draft.colorName,
        finishType: optional(draft.finishType),
        hexPreview: optional(draft.hexPreview),
        isActive: draft.isActive,
        line: optional(draft.line),
        mappingKey: optional(draft.mappingKey),
        paintMappingId: selectedId === "new" ? undefined : selectedId as Id<"paintMappings">,
        paintType: optional(draft.paintType),
      });
      setDrafts((current) => omit(current, selectedId));
      setSelectedId(id);
      setNotice({ text: `Saved ${draft.brand} ${draft.code}.`, tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Paint save failed", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (paints === undefined) return <div className="admin-data-empty">Loading paint catalog.</div>;

  const affiliateReady = paints.filter((item) => Boolean(item.affiliateUrl)).length;
  const classification = draft.affiliateUrl.trim() ? "Affiliate-ready" : draft.availabilityRegion.trim() && draft.availabilityRegion.trim() !== "global" ? "Region-limited" : "Search-ready";

  return (
    <div className="paint-catalog-workbench">
      <header className="admin-workspace-head"><p>Content</p><h2>Paint Catalog</h2><span>Manage searchable paint records, finish metadata, availability, and purchase destinations.</span></header>
      <div className="paint-catalog-summary"><span><strong>{paints.length}</strong> paints</span><span><strong>{paints.filter((item) => item.isActive).length}</strong> active</span><span><strong>{affiliateReady}</strong> affiliate-ready</span></div>
      <div className="paint-catalog-toolbar"><label><MagnifyingGlassIcon /><Input aria-label="Search paints" onChange={(event) => setQuery(event.target.value)} placeholder="Search brand, code, color…" value={query} /></label><Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as PaintStatusFilter)}><SelectTrigger aria-label="Filter paint status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem><SelectItem value="all">All statuses</SelectItem></SelectContent></Select><Button className="gap-2 bg-ink-primary text-surface shadow-none" onClick={createPaint}><PlusIcon />New Paint</Button></div>
      {notice ? <div className={cn("style-library-notice", notice.tone === "error" ? "is-error" : "is-success")}>{notice.text}</div> : null}
      <section className="paint-catalog-layout">
        <section className="paint-catalog-table" aria-label="Paint records">
          <div className="paint-table-head paint-table-grid"><span>Color</span><span>Brand</span><span>Code</span><span>Name</span><span>Finish</span></div>
          {filtered.length ? filtered.map((paint) => <button className={cn("paint-table-row paint-table-grid", selectedId === paint._id && "is-active")} key={paint._id} onClick={() => setSelectedId(paint._id)} type="button"><span><i style={{ backgroundColor: validHex(paint.hexPreview) ? paint.hexPreview : "#888888" }} /><b className={paint.isActive ? "is-active" : "is-inactive"} /></span><span>{paint.brand}</span><span className="is-mono">{paint.code}</span><span>{paint.colorName}</span><span>{paint.finishType ?? "—"}</span></button>) : <div className="admin-data-empty">No paints match the current filters.</div>}
        </section>
        <aside className="paint-catalog-inspector">
          {selectedId ? <><header className="style-inspector-head"><div><h3>{draft.colorName || "New Paint"}</h3><p>{selectedId === "new" ? "New paint" : `${draft.brand} · ${draft.code}`}</p></div><div>{dirty ? <span className="is-dirty">Unsaved changes</span> : null}<button disabled={!dirty} onClick={cancel} type="button">Cancel</button><Button disabled={!canSave || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</Button></div></header><div className="paint-inspector-body">
            <InspectorSection description="Brand, product line, and stable catalog identity." title="General"><FieldGrid><Field label="Brand"><Input value={draft.brand} onChange={(event) => update({ brand: event.target.value })} /></Field><Field label="Line"><Input value={draft.line} onChange={(event) => update({ line: event.target.value })} /></Field><Field label="Code"><Input className="font-mono" value={draft.code} onChange={(event) => update({ code: event.target.value })} /></Field><Field label="Color name"><Input value={draft.colorName} onChange={(event) => update({ colorName: event.target.value })} /></Field><Field className="sm:col-span-2" label="Mapping key"><Input className="font-mono" value={draft.mappingKey} onChange={(event) => update({ mappingKey: event.target.value })} /></Field></FieldGrid></InspectorSection>
            <InspectorSection description="Visible finish and searchable paint chemistry." title="Color & finish"><div className="paint-color-editor"><div className="paint-color-preview" style={{ backgroundColor: hexValid && draft.hexPreview ? draft.hexPreview : "#888888" }} /><div><Field label="Hex preview"><Input className="font-mono" value={draft.hexPreview} onChange={(event) => update({ hexPreview: event.target.value })} /></Field>{!hexValid ? <p className="paint-field-error">Use #RRGGBB format.</p> : null}</div></div><FieldGrid><Field label="Finish type"><Input value={draft.finishType} onChange={(event) => update({ finishType: event.target.value })} /></Field><Field label="Paint type"><Input value={draft.paintType} onChange={(event) => update({ paintType: event.target.value })} /></Field></FieldGrid></InspectorSection>
            <InspectorSection description="Regional availability and outbound purchase destination." title="Availability"><FieldGrid><Field label="Region"><Input value={draft.availabilityRegion} onChange={(event) => update({ availabilityRegion: event.target.value })} /></Field><Field label="Catalog readiness"><Input disabled value={classification} /></Field></FieldGrid><div className="mt-5"><Field label="Affiliate URL"><Input type="url" value={draft.affiliateUrl} onChange={(event) => update({ affiliateUrl: event.target.value })} /></Field></div></InspectorSection>
            <InspectorSection description="Control whether this paint can appear in search and paint recommendations." title="Status"><ToggleRow checked={draft.isActive} description="Available in Paint Library search and recommendation results." label="Active" onChange={(isActive) => update({ isActive })} /></InspectorSection>
          </div></> : <div className="admin-data-empty">Select a paint to inspect it.</div>}
        </aside>
      </section>
    </div>
  );
}

function createDraft(item: PaintItem): PaintDraft { return { affiliateUrl: item.affiliateUrl ?? "", availabilityRegion: item.availabilityRegion ?? "", brand: item.brand, code: item.code, colorName: item.colorName, finishType: item.finishType ?? "", hexPreview: item.hexPreview ?? "", isActive: item.isActive, line: item.line ?? "", mappingKey: item.mappingKey, paintType: item.paintType ?? "" }; }
function paintSearchText(item: PaintItem) { return [item.brand, item.line, item.code, item.colorName, item.finishType, item.paintType, item.availabilityRegion, item.mappingKey].filter(Boolean).join(" ").toLocaleLowerCase(); }
function InspectorSection({ children, description, title }: { children: ReactNode; description: string; title: string }) { return <section className="style-inspector-section"><div><h4>{title}</h4><p>{description}</p></div>{children}</section>; }
function FieldGrid({ children }: { children: ReactNode }) { return <div className="grid gap-5 sm:grid-cols-2">{children}</div>; }
function Field({ children, className, label }: { children: ReactNode; className?: string; label: string }) { return <label className={cn("block", className)}><span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</span><div className="mt-2">{children}</div></label>; }
function ToggleRow({ checked, description, label, onChange }: { checked: boolean; description: string; label: string; onChange: (checked: boolean) => void }) { return <div className="style-toggle-row"><div><strong>{label}</strong><p>{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>; }
function validHex(value?: string) { return Boolean(value && /^#[0-9a-fA-F]{6}$/.test(value)); }
function optional(value: string) { const normalized = value.trim(); return normalized ? normalized : undefined; }
function omit<T>(record: Record<string, T>, key: string) { const next = { ...record }; delete next[key]; return next; }
