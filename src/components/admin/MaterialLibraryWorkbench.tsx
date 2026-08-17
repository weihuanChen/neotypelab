"use client";

import { MagnifyingGlassIcon, PlusIcon } from "@radix-ui/react-icons";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { TagEditor } from "@/src/components/models/TagEditor";

type MaterialItems = FunctionReturnType<typeof api.admin.listMaterialPresetsAdmin>;
type MaterialItem = MaterialItems[number];
type MaterialSpecDraft = NonNullable<MaterialItem["materialSpec"]> & {
  semanticTags: NonNullable<NonNullable<MaterialItem["materialSpec"]>["semanticTags"]>;
};
type MaterialDraft = {
  difficultyLevel: string;
  finishType: string;
  isActive: boolean;
  materialSpec: MaterialSpecDraft;
  name: string;
  paintFinish: string;
  promptKeywords: string[];
  reflectivityLevel: string;
  sheenLevel: string;
  shortDescription: string;
  slug: string;
};

const emptySpec: MaterialSpecDraft = {
  allowedColorRoleSlugs: [],
  coatingBehavior: "",
  clearCoatBehavior: "",
  edgeWearBehavior: "",
  forbiddenColorRoleSlugs: [],
  metallicResponse: "",
  reflectivity: "",
  renderBehavior: "",
  roughness: "",
  surfaceTexture: "",
  weatheringInteraction: "",
  semanticTags: {
    exclusions: [],
    materialFamily: "",
    optics: [],
    reflection: [],
    surface: [],
  },
};

const emptyDraft: MaterialDraft = {
  difficultyLevel: "",
  finishType: "",
  isActive: true,
  materialSpec: emptySpec,
  name: "",
  paintFinish: "",
  promptKeywords: [],
  reflectivityLevel: "",
  sheenLevel: "",
  shortDescription: "",
  slug: "",
};

export function MaterialLibraryWorkbench() {
  const materials = useQuery(api.admin.listMaterialPresetsAdmin);
  const saveMaterial = useMutation(api.admin.upsertMaterialPresetAdmin);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, MaterialDraft>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!selectedId && materials?.[0]) setSelectedId(materials[0]._id);
  }, [materials, selectedId]);

  const selected = selectedId === "new" ? null : materials?.find((item) => item._id === selectedId) ?? null;
  const draft = selectedId ? drafts[selectedId] ?? (selected ? createDraft(selected) : emptyDraft) : emptyDraft;
  const baseline = selected ? createDraft(selected) : emptyDraft;
  const dirty = selectedId === "new" || Boolean(selectedId && drafts[selectedId] && JSON.stringify(draft) !== JSON.stringify(baseline));
  const canSave = Boolean(dirty && draft.name.trim() && draft.finishType.trim());
  const filtered = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!materials) return [];
    if (!term) return materials;
    return materials.filter((item) => materialSearchText(item).includes(term));
  }, [materials, query]);

  const update = (patch: Partial<MaterialDraft>) => {
    if (!selectedId) return;
    setDrafts((current) => ({ ...current, [selectedId]: { ...draft, ...patch } }));
  };
  const updateSpec = (patch: Partial<MaterialSpecDraft>) => update({ materialSpec: { ...draft.materialSpec, ...patch } });
  const updateSemantic = (patch: Partial<MaterialSpecDraft["semanticTags"]>) => updateSpec({ semanticTags: { ...draft.materialSpec.semanticTags, ...patch } });

  const createMaterial = () => {
    setDrafts((current) => ({ ...current, new: { ...emptyDraft, materialSpec: { ...emptySpec, semanticTags: { ...emptySpec.semanticTags } } } }));
    setSelectedId("new");
    setNotice(null);
  };

  const cancel = () => {
    if (!selectedId) return;
    setDrafts((current) => omit(current, selectedId));
    if (selectedId === "new") setSelectedId(materials?.[0]?._id ?? null);
  };

  const save = async () => {
    if (!selectedId || !canSave) return;
    setBusy(true);
    setNotice(null);
    try {
      const id = await saveMaterial({
        difficultyLevel: optional(draft.difficultyLevel),
        finishType: draft.finishType,
        isActive: draft.isActive,
        materialPresetId: selectedId === "new" ? undefined : selectedId as Id<"materialPresets">,
        materialSpec: draft.materialSpec,
        name: draft.name,
        paintFinish: optional(draft.paintFinish),
        promptKeywords: draft.promptKeywords,
        reflectivityLevel: optional(draft.reflectivityLevel),
        sheenLevel: optional(draft.sheenLevel),
        shortDescription: optional(draft.shortDescription),
        slug: optional(draft.slug),
      });
      setDrafts((current) => omit(current, selectedId));
      setSelectedId(id);
      setNotice({ text: `Saved ${draft.name}.`, tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Material save failed", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (materials === undefined) return <div className="admin-data-empty">Loading material library.</div>;

  return (
    <div className="style-library-workbench material-library-workbench">
      <header className="admin-workspace-head"><p>Content</p><h2>Materials</h2><span>Manage physical surface response, coating behavior, weathering interaction, and render grounding.</span></header>
      <div className="style-library-toolbar"><span><strong>{materials.filter((item) => item.isActive).length}</strong> active · {materials.length} total</span><label><MagnifyingGlassIcon /><Input aria-label="Search materials" onChange={(event) => setQuery(event.target.value)} placeholder="Search materials…" value={query} /></label><Button className="gap-2 bg-ink-primary text-surface shadow-none" onClick={createMaterial}><PlusIcon />New Material</Button></div>
      {notice ? <div className={cn("style-library-notice", notice.tone === "error" ? "is-error" : "is-success")}>{notice.text}</div> : null}
      <section className="style-library-layout">
        <aside className="style-library-list" aria-label="Material library">
          <div className="style-library-list__head"><span>Material library</span><small>{filtered.length}</small></div>
          {filtered.length ? filtered.map((material) => <button className={cn("style-library-row material-library-row", selectedId === material._id && "is-active")} key={material._id} onClick={() => setSelectedId(material._id)} type="button"><span className={cn("style-library-dot", material.isActive ? "is-active" : "is-inactive")} /><span><strong>{material.name}</strong><small>{material.finishType} · {material.reflectivityLevel ?? "no reflectivity"}</small></span><em>{material.difficultyLevel ?? "—"}</em></button>) : <div className="admin-data-empty">No materials match this search.</div>}
        </aside>
        <div className="style-library-inspector">
          {selectedId ? <><header className="style-inspector-head"><div><h3>{draft.name || "New Material"}</h3><p>{selectedId === "new" ? "New material" : `${draft.isActive ? "Active" : "Inactive"} · ${draft.finishType || "No finish"}`}</p></div><div><span className={dirty ? "is-dirty" : ""}>{dirty ? "Unsaved changes" : "Up to date"}</span><button disabled={!dirty} onClick={cancel} type="button">Cancel</button><Button disabled={!canSave || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</Button></div></header><div className="style-inspector-body">
            <InspectorSection description="Catalog identity and operator-facing material profile." title="General"><FieldGrid><Field label="Name"><Input value={draft.name} onChange={(event) => update({ name: event.target.value })} /></Field><Field label="Slug"><Input className="font-mono" value={draft.slug} onChange={(event) => update({ slug: event.target.value })} /></Field><Field label="Finish type"><Input value={draft.finishType} onChange={(event) => update({ finishType: event.target.value })} /></Field><Field label="Paint finish"><Input value={draft.paintFinish} onChange={(event) => update({ paintFinish: event.target.value })} /></Field><Field label="Difficulty"><Input value={draft.difficultyLevel} onChange={(event) => update({ difficultyLevel: event.target.value })} /></Field><Field label="Sheen level"><Input value={draft.sheenLevel} onChange={(event) => update({ sheenLevel: event.target.value })} /></Field></FieldGrid><div className="mt-5"><Field label="Short description"><Textarea value={draft.shortDescription} onChange={(event) => update({ shortDescription: event.target.value })} /></Field></div></InspectorSection>
            <InspectorSection description="Optical and tactile cues used by the render pipeline." title="Surface response"><div className="space-y-5"><TagEditor label="Surface tags" onChange={(surface) => updateSemantic({ surface })} values={draft.materialSpec.semanticTags.surface} /><TagEditor label="Optics" onChange={(optics) => updateSemantic({ optics })} values={draft.materialSpec.semanticTags.optics} /><TagEditor label="Reflection" onChange={(reflection) => updateSemantic({ reflection })} values={draft.materialSpec.semanticTags.reflection} /><TagEditor danger label="Material exclusions" onChange={(exclusions) => updateSemantic({ exclusions })} values={draft.materialSpec.semanticTags.exclusions} /></div><div className="mt-5"><FieldGrid><Field label="Material family"><Input value={draft.materialSpec.semanticTags.materialFamily ?? ""} onChange={(event) => updateSemantic({ materialFamily: event.target.value })} /></Field><Field label="Reflectivity level"><Input value={draft.reflectivityLevel} onChange={(event) => update({ reflectivityLevel: event.target.value })} /></Field><Field label="Reflectivity behavior"><Input value={draft.materialSpec.reflectivity} onChange={(event) => updateSpec({ reflectivity: event.target.value })} /></Field><Field label="Roughness"><Input value={draft.materialSpec.roughness} onChange={(event) => updateSpec({ roughness: event.target.value })} /></Field><Field label="Surface texture"><Input value={draft.materialSpec.surfaceTexture} onChange={(event) => updateSpec({ surfaceTexture: event.target.value })} /></Field><Field label="Metallic response"><Input value={draft.materialSpec.metallicResponse} onChange={(event) => updateSpec({ metallicResponse: event.target.value })} /></Field></FieldGrid></div></InspectorSection>
            <InspectorSection description="How the finish reacts to coating, use, and weathering." title="Coating & wear"><div className="space-y-5"><Field label="Coating behavior"><Textarea value={draft.materialSpec.coatingBehavior} onChange={(event) => updateSpec({ coatingBehavior: event.target.value })} /></Field><Field label="Clear coat behavior"><Textarea value={draft.materialSpec.clearCoatBehavior ?? ""} onChange={(event) => updateSpec({ clearCoatBehavior: event.target.value })} /></Field><Field label="Edge wear behavior"><Textarea value={draft.materialSpec.edgeWearBehavior ?? ""} onChange={(event) => updateSpec({ edgeWearBehavior: event.target.value })} /></Field><Field label="Weathering interaction"><Textarea value={draft.materialSpec.weatheringInteraction ?? ""} onChange={(event) => updateSpec({ weatheringInteraction: event.target.value })} /></Field></div></InspectorSection>
            <InspectorSection description="Restrict the color roles where this material can be applied." title="Color role constraints"><div className="space-y-5"><TagEditor label="Allowed color roles" onChange={(allowedColorRoleSlugs) => updateSpec({ allowedColorRoleSlugs })} values={draft.materialSpec.allowedColorRoleSlugs} /><TagEditor danger label="Forbidden color roles" onChange={(forbiddenColorRoleSlugs) => updateSpec({ forbiddenColorRoleSlugs })} values={draft.materialSpec.forbiddenColorRoleSlugs} /></div></InspectorSection>
            <InspectorSection description="Material-specific language passed to the prompt compiler." title="Prompt grounding"><div className="space-y-5"><TagEditor label="Prompt keywords" onChange={(promptKeywords) => update({ promptKeywords })} values={draft.promptKeywords} /><Field label="Render behavior"><Textarea className="min-h-[130px]" value={draft.materialSpec.renderBehavior} onChange={(event) => updateSpec({ renderBehavior: event.target.value })} /></Field></div></InspectorSection>
            <InspectorSection description="Control availability throughout concept and render selection." title="Status"><ToggleRow checked={draft.isActive} description="Available in material selection and prompt composition." label="Active" onChange={(isActive) => update({ isActive })} /></InspectorSection>
          </div></> : <div className="admin-data-empty">Select a material to inspect it.</div>}
        </div>
      </section>
    </div>
  );
}

function createDraft(item: MaterialItem): MaterialDraft {
  const spec = item.materialSpec ?? emptySpec;
  return {
    difficultyLevel: item.difficultyLevel ?? "",
    finishType: item.finishType,
    isActive: item.isActive,
    materialSpec: { ...emptySpec, ...spec, semanticTags: { ...emptySpec.semanticTags, ...(spec.semanticTags ?? {}) } },
    name: item.name,
    paintFinish: item.paintFinish ?? "",
    promptKeywords: item.promptKeywords,
    reflectivityLevel: item.reflectivityLevel ?? "",
    sheenLevel: item.sheenLevel ?? "",
    shortDescription: item.shortDescription ?? "",
    slug: item.slug,
  };
}
function materialSearchText(item: MaterialItem) { return [item.name, item.slug, item.finishType, item.reflectivityLevel, item.paintFinish, item.difficultyLevel, item.shortDescription, ...item.promptKeywords, ...(item.materialSpec?.semanticTags?.surface ?? []), ...(item.materialSpec?.semanticTags?.optics ?? []), ...(item.materialSpec?.semanticTags?.reflection ?? [])].filter(Boolean).join(" ").toLocaleLowerCase(); }
function InspectorSection({ children, description, title }: { children: ReactNode; description: string; title: string }) { return <section className="style-inspector-section"><div><h4>{title}</h4><p>{description}</p></div>{children}</section>; }
function FieldGrid({ children }: { children: ReactNode }) { return <div className="grid gap-5 sm:grid-cols-2">{children}</div>; }
function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="block"><span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</span><div className="mt-2">{children}</div></label>; }
function ToggleRow({ checked, description, label, onChange }: { checked: boolean; description: string; label: string; onChange: (checked: boolean) => void }) { return <div className="style-toggle-row"><div><strong>{label}</strong><p>{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>; }
function optional(value: string) { const normalized = value.trim(); return normalized ? normalized : undefined; }
function omit<T>(record: Record<string, T>, key: string) { const next = { ...record }; delete next[key]; return next; }
