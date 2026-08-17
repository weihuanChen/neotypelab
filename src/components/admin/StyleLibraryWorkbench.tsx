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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { TagEditor } from "@/src/components/models/TagEditor";

type StyleCatalog = FunctionReturnType<typeof api.admin.listStylePresetsAdmin>;
type StyleItem = StyleCatalog["styles"][number];
type StyleSpecDraft = NonNullable<StyleItem["styleSpec"]> & {
  semanticTags: NonNullable<NonNullable<StyleItem["styleSpec"]>["semanticTags"]>;
};
type StyleDraft = {
  category: string;
  contrastLevel: string;
  creatorUserId: string;
  isActive: boolean;
  isFeaturedStyle: boolean;
  name: string;
  negativeKeywords: string[];
  promptKeywords: string[];
  promptVersion: string;
  recommendedMaterialSlugs: string[];
  seoKeywords: string[];
  shortDescription: string;
  slug: string;
  styleSpec: StyleSpecDraft;
  systemPromptFragment: string;
  visibilityWeight: string;
  weatheringProfile: string;
};

const emptyStyleSpec: StyleSpecDraft = {
  colorRelationship: "",
  contrastBehavior: "",
  decalStyle: "",
  identityBoundary: "",
  markingDensity: "",
  personalityTags: [],
  prohibitedEffects: [],
  renderBehavior: "",
  tone: "",
  warningMarkingBehavior: "",
  semanticTags: {
    shapeLanguage: [],
    styleFamily: "",
    surfaceLanguage: [],
    visualExclusions: [],
    visualTone: [],
  },
};

const emptyDraft: StyleDraft = {
  category: "",
  contrastLevel: "",
  creatorUserId: "none",
  isActive: true,
  isFeaturedStyle: false,
  name: "",
  negativeKeywords: [],
  promptKeywords: [],
  promptVersion: "p1.v1",
  recommendedMaterialSlugs: [],
  seoKeywords: [],
  shortDescription: "",
  slug: "",
  styleSpec: emptyStyleSpec,
  systemPromptFragment: "",
  visibilityWeight: "",
  weatheringProfile: "",
};

export function StyleLibraryWorkbench() {
  const catalog = useQuery(api.admin.listStylePresetsAdmin);
  const saveStyle = useMutation(api.admin.upsertStylePresetAdmin);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [drafts, setDrafts] = useState<Record<string, StyleDraft>>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; tone: "error" | "success" } | null>(null);

  useEffect(() => {
    if (!selectedId && catalog?.styles[0]) setSelectedId(catalog.styles[0]._id);
  }, [catalog, selectedId]);

  const selected = selectedId === "new" ? null : catalog?.styles.find((item) => item._id === selectedId) ?? null;
  const draft = selectedId ? drafts[selectedId] ?? (selected ? createDraft(selected) : emptyDraft) : emptyDraft;
  const baseline = selected ? createDraft(selected) : emptyDraft;
  const dirty = selectedId === "new" || Boolean(selectedId && drafts[selectedId] && JSON.stringify(draft) !== JSON.stringify(baseline));
  const canSave = Boolean(dirty && draft.name.trim());
  const filteredStyles = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    if (!catalog) return [];
    if (!term) return catalog.styles;
    return catalog.styles.filter((style) => styleSearchText(style).includes(term));
  }, [catalog, query]);

  const update = (patch: Partial<StyleDraft>) => {
    if (!selectedId) return;
    setDrafts((current) => ({ ...current, [selectedId]: { ...draft, ...patch } }));
  };
  const updateSpec = (patch: Partial<StyleSpecDraft>) => update({ styleSpec: { ...draft.styleSpec, ...patch } });
  const updateSemantic = (patch: Partial<StyleSpecDraft["semanticTags"]>) => updateSpec({ semanticTags: { ...draft.styleSpec.semanticTags, ...patch } });

  const createStyle = () => {
    setDrafts((current) => ({ ...current, new: { ...emptyDraft, styleSpec: { ...emptyStyleSpec, semanticTags: { ...emptyStyleSpec.semanticTags } } } }));
    setSelectedId("new");
    setNotice(null);
  };

  const cancel = () => {
    if (!selectedId) return;
    setDrafts((current) => omit(current, selectedId));
    if (selectedId === "new") setSelectedId(catalog?.styles[0]?._id ?? null);
  };

  const save = async () => {
    if (!selectedId || !canSave) return;
    setBusy(true);
    setNotice(null);
    try {
      const id = await saveStyle({
        category: optional(draft.category),
        contrastLevel: optional(draft.contrastLevel),
        creatorUserId: draft.creatorUserId === "none" ? null : draft.creatorUserId as Id<"users">,
        isActive: draft.isActive,
        isFeaturedStyle: draft.isFeaturedStyle,
        name: draft.name,
        negativeKeywords: draft.negativeKeywords,
        promptKeywords: draft.promptKeywords,
        promptVersion: optional(draft.promptVersion),
        recommendedMaterialSlugs: draft.recommendedMaterialSlugs,
        seoKeywords: draft.seoKeywords,
        shortDescription: optional(draft.shortDescription),
        slug: optional(draft.slug),
        stylePresetId: selectedId === "new" ? undefined : selectedId as Id<"stylePresets">,
        styleSpec: draft.styleSpec,
        systemPromptFragment: optional(draft.systemPromptFragment),
        visibilityWeight: draft.visibilityWeight.trim() ? Number(draft.visibilityWeight) : null,
        weatheringProfile: optional(draft.weatheringProfile),
      });
      setDrafts((current) => omit(current, selectedId));
      setSelectedId(id);
      setNotice({ text: `Saved ${draft.name}.`, tone: "success" });
    } catch (error) {
      setNotice({ text: error instanceof Error ? error.message : "Style save failed", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (catalog === undefined) return <div className="admin-data-empty">Loading Style DNA library.</div>;

  return (
    <div className="style-library-workbench">
      <header className="admin-workspace-head">
        <p>Content</p>
        <h2>Style DNA</h2>
        <span>Manage the visual language, exclusions, and prompt grounding shared across repaint concepts.</span>
      </header>
      <div className="style-library-toolbar">
        <span><strong>{catalog.styles.filter((item) => item.isActive).length}</strong> active · {catalog.styles.length} total</span>
        <label><MagnifyingGlassIcon /><Input aria-label="Search styles" onChange={(event) => setQuery(event.target.value)} placeholder="Search styles…" value={query} /></label>
        <Button className="gap-2 bg-ink-primary text-surface shadow-none" onClick={createStyle}><PlusIcon />New Style</Button>
      </div>
      {notice ? <div className={cn("style-library-notice", notice.tone === "error" ? "is-error" : "is-success")}>{notice.text}</div> : null}
      <section className="style-library-layout">
        <aside className="style-library-list" aria-label="Style library">
          <div className="style-library-list__head"><span>Style library</span><small>{filteredStyles.length}</small></div>
          {filteredStyles.length ? filteredStyles.map((style) => (
            <button className={cn("style-library-row", selectedId === style._id && "is-active")} key={style._id} onClick={() => setSelectedId(style._id)} type="button">
              <span className={cn("style-library-dot", style.isActive ? "is-active" : "is-inactive")} />
              <span><strong>{style.name}</strong><small>{style.category ?? "Uncategorized"} · {style.promptVersion ?? "No version"}</small></span>
              {style.isFeaturedStyle ? <em>Featured</em> : null}
            </button>
          )) : <div className="admin-data-empty">No styles match this search.</div>}
        </aside>
        <div className="style-library-inspector">
          {selectedId ? (
            <>
              <header className="style-inspector-head">
                <div><h3>{draft.name || "New Style"}</h3><p>{selectedId === "new" ? "New style" : `${draft.isActive ? "Active" : "Inactive"} · ${draft.promptVersion || "No version"}`}</p></div>
                <div><span className={dirty ? "is-dirty" : ""}>{dirty ? "Unsaved changes" : "Up to date"}</span><button disabled={!dirty} onClick={cancel} type="button">Cancel</button><Button disabled={!canSave || busy} onClick={() => void save()}>{busy ? "Saving…" : "Save changes"}</Button></div>
              </header>
              <div className="style-inspector-body">
                <InspectorSection description="Catalog identity and operator-facing context." title="General">
                  <FieldGrid><Field label="Name"><Input value={draft.name} onChange={(event) => update({ name: event.target.value })} /></Field><Field label="Slug"><Input className="font-mono" value={draft.slug} onChange={(event) => update({ slug: event.target.value })} /></Field><Field label="Category"><Input value={draft.category} onChange={(event) => update({ category: event.target.value })} /></Field><Field label="Version"><Input className="font-mono" value={draft.promptVersion} onChange={(event) => update({ promptVersion: event.target.value })} /></Field></FieldGrid>
                  <div className="mt-5"><Field label="Short description"><Textarea value={draft.shortDescription} onChange={(event) => update({ shortDescription: event.target.value })} /></Field></div>
                </InspectorSection>
                <InspectorSection description="Semantic tags used by prompt grounding and discovery." title="Style DNA">
                  <div className="space-y-5"><TagEditor label="Shape language" onChange={(shapeLanguage) => updateSemantic({ shapeLanguage })} values={draft.styleSpec.semanticTags.shapeLanguage} /><TagEditor label="Surface language" onChange={(surfaceLanguage) => updateSemantic({ surfaceLanguage })} values={draft.styleSpec.semanticTags.surfaceLanguage} /><TagEditor label="Visual tone" onChange={(visualTone) => updateSemantic({ visualTone })} values={draft.styleSpec.semanticTags.visualTone} /><TagEditor danger label="Visual exclusions" onChange={(visualExclusions) => updateSemantic({ visualExclusions })} values={draft.styleSpec.semanticTags.visualExclusions} /></div>
                  <div className="mt-5"><FieldGrid><Field label="Style family"><Input value={draft.styleSpec.semanticTags.styleFamily ?? ""} onChange={(event) => updateSemantic({ styleFamily: event.target.value })} /></Field><Field label="Tone"><Input value={draft.styleSpec.tone} onChange={(event) => updateSpec({ tone: event.target.value })} /></Field><Field label="Color relationship"><Input value={draft.styleSpec.colorRelationship} onChange={(event) => updateSpec({ colorRelationship: event.target.value })} /></Field><Field label="Contrast behavior"><Input value={draft.styleSpec.contrastBehavior} onChange={(event) => updateSpec({ contrastBehavior: event.target.value })} /></Field><Field label="Decal style"><Input value={draft.styleSpec.decalStyle} onChange={(event) => updateSpec({ decalStyle: event.target.value })} /></Field><Field label="Marking density"><Input value={draft.styleSpec.markingDensity} onChange={(event) => updateSpec({ markingDensity: event.target.value })} /></Field></FieldGrid></div>
                  <div className="mt-5 space-y-5"><Field label="Warning marking behavior"><Textarea value={draft.styleSpec.warningMarkingBehavior} onChange={(event) => updateSpec({ warningMarkingBehavior: event.target.value })} /></Field><TagEditor label="Personality tags" onChange={(personalityTags) => updateSpec({ personalityTags })} values={draft.styleSpec.personalityTags} /><TagEditor danger label="Prohibited effects" onChange={(prohibitedEffects) => updateSpec({ prohibitedEffects })} values={draft.styleSpec.prohibitedEffects} /></div>
                </InspectorSection>
                <InspectorSection description="Instructions passed to the prompt compiler." title="Prompt grounding"><div className="space-y-5"><Field label="System prompt fragment"><Textarea className="min-h-[110px]" value={draft.systemPromptFragment} onChange={(event) => update({ systemPromptFragment: event.target.value })} /></Field><Field label="Identity boundary"><Textarea value={draft.styleSpec.identityBoundary} onChange={(event) => updateSpec({ identityBoundary: event.target.value })} /></Field><Field label="Render behavior"><Textarea value={draft.styleSpec.renderBehavior} onChange={(event) => updateSpec({ renderBehavior: event.target.value })} /></Field><TagEditor label="Prompt keywords" onChange={(promptKeywords) => update({ promptKeywords })} values={draft.promptKeywords} /><TagEditor danger label="Negative keywords" onChange={(negativeKeywords) => update({ negativeKeywords })} values={draft.negativeKeywords} /></div></InspectorSection>
                <InspectorSection description="Catalog ranking, material links, and search metadata." title="Discovery"><FieldGrid><Field label="Contrast level"><Input value={draft.contrastLevel} onChange={(event) => update({ contrastLevel: event.target.value })} /></Field><Field label="Weathering profile"><Input value={draft.weatheringProfile} onChange={(event) => update({ weatheringProfile: event.target.value })} /></Field><Field label="Visibility weight"><Input max="1" min="0" step="0.05" type="number" value={draft.visibilityWeight} onChange={(event) => update({ visibilityWeight: event.target.value })} /></Field><Field label="Creator"><Select value={draft.creatorUserId} onValueChange={(creatorUserId) => update({ creatorUserId })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No owner</SelectItem>{catalog.creators.map((creator) => <SelectItem key={creator._id} value={creator._id}>{creator.fullName} · @{creator.handle}</SelectItem>)}</SelectContent></Select></Field></FieldGrid><div className="mt-5 space-y-5"><TagEditor label="Recommended materials" onChange={(recommendedMaterialSlugs) => update({ recommendedMaterialSlugs })} values={draft.recommendedMaterialSlugs} /><TagEditor label="SEO keywords" onChange={(seoKeywords) => update({ seoKeywords })} values={draft.seoKeywords} /></div></InspectorSection>
                <InspectorSection description="Control availability and editorial placement." title="Status"><ToggleRow checked={draft.isActive} description="Available in Style DNA selection and prompt composition." label="Active" onChange={(isActive) => update({ isActive })} /><ToggleRow checked={draft.isFeaturedStyle} description="Eligible for featured discovery placement." label="Featured style" onChange={(isFeaturedStyle) => update({ isFeaturedStyle })} /></InspectorSection>
              </div>
            </>
          ) : <div className="admin-data-empty">Select a style to inspect it.</div>}
        </div>
      </section>
    </div>
  );
}

function createDraft(style: StyleItem): StyleDraft {
  const spec = style.styleSpec ?? emptyStyleSpec;
  return {
    category: style.category ?? "",
    contrastLevel: style.contrastLevel ?? "",
    creatorUserId: style.creatorUserId ?? "none",
    isActive: style.isActive,
    isFeaturedStyle: style.isFeaturedStyle,
    name: style.name,
    negativeKeywords: style.negativeKeywords,
    promptKeywords: style.promptKeywords,
    promptVersion: style.promptVersion ?? "",
    recommendedMaterialSlugs: style.recommendedMaterialSlugs,
    seoKeywords: style.seoKeywords,
    shortDescription: style.shortDescription ?? "",
    slug: style.slug,
    styleSpec: {
      ...emptyStyleSpec,
      ...spec,
      semanticTags: { ...emptyStyleSpec.semanticTags, ...(spec.semanticTags ?? {}) },
    },
    systemPromptFragment: style.systemPromptFragment ?? "",
    visibilityWeight: style.visibilityWeight?.toString() ?? "",
    weatheringProfile: style.weatheringProfile ?? "",
  };
}

function styleSearchText(style: StyleItem) {
  return [style.name, style.slug, style.category, style.shortDescription, style.promptVersion, ...style.promptKeywords, ...style.negativeKeywords, ...(style.styleSpec?.semanticTags?.shapeLanguage ?? []), ...(style.styleSpec?.semanticTags?.surfaceLanguage ?? []), ...(style.styleSpec?.semanticTags?.visualTone ?? [])].filter(Boolean).join(" ").toLocaleLowerCase();
}
function InspectorSection({ children, description, title }: { children: ReactNode; description: string; title: string }) { return <section className="style-inspector-section"><div><h4>{title}</h4><p>{description}</p></div>{children}</section>; }
function FieldGrid({ children }: { children: ReactNode }) { return <div className="grid gap-5 sm:grid-cols-2">{children}</div>; }
function Field({ children, label }: { children: ReactNode; label: string }) { return <label className="block"><span className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">{label}</span><div className="mt-2">{children}</div></label>; }
function ToggleRow({ checked, description, label, onChange }: { checked: boolean; description: string; label: string; onChange: (checked: boolean) => void }) { return <div className="style-toggle-row"><div><strong>{label}</strong><p>{description}</p></div><Switch checked={checked} onCheckedChange={onChange} /></div>; }
function optional(value: string) { const normalized = value.trim(); return normalized ? normalized : undefined; }
function omit<T>(record: Record<string, T>, key: string) { const next = { ...record }; delete next[key]; return next; }
