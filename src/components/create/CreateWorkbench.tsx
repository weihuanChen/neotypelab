"use client";

import { CommandButton } from "@/components/ui/command-button";
import { ShoppingListActions } from "@/components/public/ShoppingListActions";
import { Textarea } from "@/components/ui/textarea";
import {
  ChoiceChip,
  FieldHint,
  FocusPanel,
  GhostButton,
  Kicker,
  StatusPill,
  StepHeader,
  TowerField,
  WorkbenchNotice,
  mapStatusTone,
} from "@/src/components/ui/workbench";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getCreatorPackAccessCopy } from "@/lib/creatorPackAccess";
import { cn } from "@/lib/utils";
import { usePrivateAssetUrl } from "@/src/hooks/usePrivateAssetUrl";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import {
  parseOptionalSearchValue,
  type CreateWorkbenchSearch,
} from "./createSearch";

type WeatheringLevel = "clean" | "light" | "heavy";
type MoodTag =
  | "command-presence"
  | "stealth-tension"
  | "industrial-hazard"
  | "reactor-glow"
  | "field-fatigue"
  | "ceremonial-clean";
type ConceptVisibility = "private" | "unlisted" | "public";

const weatheringOptions: Array<{
  value: WeatheringLevel;
  label: string;
  detail: string;
}> = [
  { value: "clean", label: "Clean", detail: "Factory-fresh panel control" },
  { value: "light", label: "Light", detail: "Operational wear, restrained dust" },
  { value: "heavy", label: "Heavy", detail: "Field abrasion and masking stress" },
];

const moodOptions: Array<{
  value: MoodTag;
  label: string;
  detail: string;
}> = [
  {
    value: "command-presence",
    label: "Command Presence",
    detail: "Hero-forward authority with disciplined silhouette readability.",
  },
  {
    value: "stealth-tension",
    label: "Stealth Tension",
    detail: "Suppressed contrast, low-signature armor, and controlled sensor pop.",
  },
  {
    value: "industrial-hazard",
    label: "Industrial Hazard",
    detail: "Maintenance-deck warning logic and workshop brutality.",
  },
  {
    value: "reactor-glow",
    label: "Reactor Glow",
    detail: "Localized high-energy accents without losing panel discipline.",
  },
  {
    value: "field-fatigue",
    label: "Field Fatigue",
    detail: "Operational wear, dust memory, and prolonged deployment stress.",
  },
  {
    value: "ceremonial-clean",
    label: "Ceremonial Clean",
    detail: "Inspection-grade finish with minimal abrasion and crisp masking.",
  },
];

const visibilityOptions: Array<{
  value: ConceptVisibility;
  label: string;
  detail: string;
}> = [
  {
    value: "private",
    label: "Private",
    detail: "Only visible in your operator library.",
  },
  {
    value: "unlisted",
    label: "Unlisted",
    detail: "Shareable later by direct link, hidden from any public surface.",
  },
  {
    value: "public",
    label: "Public",
    detail: "Marked as ready for future showcase and remix surfaces.",
  },
];

export function CreateWorkbench({
  search = {},
}: {
  search?: CreateWorkbenchSearch;
}) {
  const catalog = useQuery(api.catalog.listCreateOptions);
  const viewer = useQuery(api.users.viewer);
  const remixConceptId = parseOptionalSearchValue(search.remix);
  const recommendedStyleSlug = parseOptionalSearchValue(search.recommendedStyle);
  const recommendedMaterialSlug = parseOptionalSearchValue(search.recommendedMaterial);
  const recommendedWorkflow = parseOptionalSearchValue(search.recommendedWorkflow);
  const recommendedBaseModelSlug = parseOptionalSearchValue(search.recommendedBaseModel);
  const recommendedMoodTagsParam = parseOptionalSearchValue(search.recommendedMoodTags);
  const recommendedWeathering = parseOptionalSearchValue(search.recommendedWeathering);
  const creatorPackSlug = parseOptionalSearchValue(search.creatorPack);
  const creatorPackVariant = parseOptionalSearchValue(search.creatorPackVariant);
  const remixSource = useQuery(
    api.showcase.getRemixSeed,
    remixConceptId ? { conceptId: remixConceptId as Id<"concepts"> } : "skip"
  );
  const creatorPack = useQuery(
    api.showcase.getCreatorPackBySlug,
    creatorPackSlug ? { slug: creatorPackSlug } : "skip"
  );
  const initializePrototype = useMutation(api.prototypes.initializePrototype);
  const generateStyleSuggestion = useMutation(api.prototypeTools.generateStyleSuggestion);
  const generatePalettePlan = useMutation(api.prototypeTools.generatePalettePlan);
  const requestHdRender = useMutation(api.prototypeTools.requestHdRender);

  const [selectedKitVariantId, setSelectedKitVariantId] = useState<Id<"baseModels"> | null>(
    null
  );
  const [selectedStylePresetId, setSelectedStylePresetId] = useState<
    Id<"stylePresets"> | null
  >(null);
  const [selectedMaterialPresetId, setSelectedMaterialPresetId] = useState<
    Id<"materialPresets"> | null
  >(null);
  const [selectedMoodTags, setSelectedMoodTags] = useState<MoodTag[]>([]);
  const [weatheringLevel, setWeatheringLevel] = useState<WeatheringLevel>("clean");
  const [visibility, setVisibility] = useState<ConceptVisibility>("private");
  const [notes, setNotes] = useState("");
  const [appliedRemixId, setAppliedRemixId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingStyleSuggestion, setIsGeneratingStyleSuggestion] = useState(false);
  const [isGeneratingPalettePlan, setIsGeneratingPalettePlan] = useState(false);
  const [isQueueingHdRender, setIsQueueingHdRender] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [kitUniverse, setKitUniverse] = useState<string | null>(null);
  const [kitScale, setKitScale] = useState<string | null>(null);
  const [kitComplexity, setKitComplexity] = useState<string | null>(null);
  const [kitTag, setKitTag] = useState<string | null>(null);
  const [styleSuggestionResult, setStyleSuggestionResult] = useState<{
    balanceAfter: number;
    promptCompositionId: Id<"promptCompositions">;
    promptPreview: string;
    suggestions: Array<{
      category?: string;
      confidenceLabel: string;
      name: string;
      rationale: string;
      shortDescription?: string;
      slug: string;
      stylePresetId: Id<"stylePresets">;
    }>;
    templateName: string;
    priceRule: {
      creditCost: number;
      label: string;
    };
  } | null>(null);
  const [palettePlanResult, setPalettePlanResult] = useState<{
    balanceAfter: number;
    promptCompositionId: Id<"promptCompositions">;
    promptPreview: string;
    plan: {
      baseModelName: string;
      conceptTitle: string;
      entries: Array<{
        rationale: string;
        recommendedArea?: string;
        roleName: string;
        roleSlug: string;
        suggestedPaint: {
          brand: string;
          code: string;
          colorName: string;
          hexPreview?: string;
        } | null;
      }>;
      sprayNotes: string[];
    };
    templateName: string;
    priceRule: {
      creditCost: number;
      label: string;
    };
  } | null>(null);
  const [result, setResult] = useState<{
    title: string;
    conceptId: Id<"concepts">;
    generationJobId: Id<"generationJobs">;
    balanceAfter: number;
    templateName: string;
    promptPreview: string;
    visibility: ConceptVisibility;
    moodTags: MoodTag[];
    priceRule: {
      label: string;
      creditCost: number;
    };
  } | null>(null);
  const liveJob = useQuery(
    api.generation.getViewerJobSnapshot,
    result ? { generationJobId: result.generationJobId } : "skip"
  );
  const shoppingList = useQuery(
    api.shopping.getViewerConceptShoppingList,
    result ? { conceptId: result.conceptId } : "skip"
  );
  const privateOriginalUrl = usePrivateAssetUrl(
    liveJob?.status === "succeeded" && !liveJob.asset?.publicUrl
      ? liveJob.asset?.storageObjectId
      : null
  );
  const generatedImageUrl = liveJob?.asset?.publicUrl ?? privateOriginalUrl;

  const selectedKitVariant =
    catalog?.kitVariants.find((item) => item._id === selectedKitVariantId) ?? null;
  const selectedStylePreset =
    catalog?.stylePresets.find((item) => item._id === selectedStylePresetId) ?? null;
  const selectedMaterialPreset =
    catalog?.materialPresets.find((item) => item._id === selectedMaterialPresetId) ??
    null;
  const createCost =
    catalog?.priceRules.find((rule) => rule.actionType === "generate-repaint-concept")
      ?.creditCost ?? 0;
  const palettePlanCost =
    catalog?.priceRules.find((rule) => rule.actionType === "generate-palette")?.creditCost ?? 0;
  const styleSuggestionCost =
    catalog?.priceRules.find((rule) => rule.actionType === "generate-style-suggestion")
      ?.creditCost ?? 0;
  const hdCost =
    catalog?.priceRules.find((rule) => rule.actionType === "generate-hd-render")
      ?.creditCost ?? 0;
  const notesRemaining = 100 - notes.length;
  const creatorPackAccess = getCreatorPackAccessCopy({
    creatorHandle: creatorPack?.creator.handle,
    packType: creatorPack?.packType ?? "free",
    viewer,
  });
  const creatorPackGateResolved = !creatorPackSlug || creatorPack !== undefined;
  const creatorPackLocked = Boolean(
    creatorPackSlug &&
      creatorPack &&
      creatorPack.packType === "premium" &&
      !creatorPackAccess.allowed
  );
  const canSubmit =
    selectedKitVariant !== null &&
    selectedStylePreset !== null &&
    selectedMaterialPreset !== null &&
    notesRemaining >= 0 &&
    (!remixConceptId || remixSource !== undefined) &&
    creatorPackGateResolved &&
    !creatorPackLocked &&
    !isSubmitting;
  const liveTone = mapStatusTone(liveJob?.status);
  const canGenerateStyleSuggestion = selectedKitVariant !== null && !isGeneratingStyleSuggestion;
  const canGeneratePalettePlan =
    selectedKitVariant !== null &&
    selectedStylePreset !== null &&
    selectedMaterialPreset !== null &&
    !isGeneratingPalettePlan;
  const kitFilterOptions = useMemo(
    () => collectKitFilterOptions(catalog?.kitVariants ?? []),
    [catalog?.kitVariants]
  );
  const visibleKits = useMemo(
    () =>
      (catalog?.kitVariants ?? []).filter((kit) => {
        if (kitUniverse && kitUniverseOf(kit) !== kitUniverse) {
          return false;
        }
        if (kitScale && kitScaleOf(kit) !== kitScale) {
          return false;
        }
        if (kitComplexity && (kit.complexityLevel ?? "unknown") !== kitComplexity) {
          return false;
        }
        if (kitTag && !kit.tags.includes(kitTag)) {
          return false;
        }
        return true;
      }),
    [catalog?.kitVariants, kitComplexity, kitScale, kitTag, kitUniverse]
  );

  useEffect(() => {
    if (!remixSource || appliedRemixId === remixSource._id) {
      return;
    }

    setSelectedKitVariantId(remixSource.kitVariantId);
    setSelectedStylePresetId(remixSource.stylePresetId);
    setSelectedMaterialPresetId(remixSource.materialPresetId);
    setSelectedMoodTags(remixSource.moodTags);
    setWeatheringLevel(remixSource.weatheringLevel);
    setVisibility("private");
    setStyleSuggestionResult(null);
    setPalettePlanResult(null);
    setResult(null);
    setErrorMessage(null);
    if (!notes.trim()) {
      setNotes(clampNotes(remixSource.notes));
    }
    setAppliedRemixId(remixSource._id);
  }, [appliedRemixId, notes, remixSource]);

  useEffect(() => {
    if (!catalog) {
      return;
    }
    if (creatorPackSlug && creatorPack === undefined) {
      return;
    }
    if (creatorPackLocked) {
      return;
    }

    if (recommendedStyleSlug) {
      const stylePreset = catalog.stylePresets.find((item) => item.slug === recommendedStyleSlug);
      if (stylePreset) {
        setSelectedStylePresetId(stylePreset._id);
      }
    }

    if (recommendedBaseModelSlug) {
      const kitVariant = catalog.kitVariants.find((item) => item.slug === recommendedBaseModelSlug);
      if (kitVariant) {
        setSelectedKitVariantId(kitVariant._id);
      }
    }

    if (recommendedMaterialSlug) {
      const materialPreset = catalog.materialPresets.find(
        (item) => item.slug === recommendedMaterialSlug
      );
      if (materialPreset) {
        setSelectedMaterialPresetId(materialPreset._id);
      }
    }

    if (recommendedMoodTagsParam) {
      const nextMoodTags = recommendedMoodTagsParam
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag): tag is MoodTag => moodOptions.some((option) => option.value === tag));
      if (nextMoodTags.length > 0) {
        setSelectedMoodTags(nextMoodTags);
      }
    }

    if (
      recommendedWeathering === "clean" ||
      recommendedWeathering === "light" ||
      recommendedWeathering === "heavy"
    ) {
      setWeatheringLevel(recommendedWeathering);
    }

    if (recommendedWorkflow === "light-weathering") {
      setWeatheringLevel("light");
    }
    if (recommendedWorkflow === "lower-contrast-blocking") {
      setSelectedMoodTags((current) =>
        current.filter((tag) => tag !== "industrial-hazard" && tag !== "reactor-glow")
      );
    }
    if (recommendedWorkflow === "merge-accent-roles") {
      setSelectedMoodTags((current) => current.filter((tag) => tag !== "reactor-glow"));
    }
  }, [
    catalog,
    recommendedBaseModelSlug,
    recommendedMaterialSlug,
    recommendedMoodTagsParam,
    recommendedStyleSlug,
    recommendedWeathering,
    recommendedWorkflow,
    creatorPack,
    creatorPackLocked,
    creatorPackSlug,
  ]);

  function toggleMoodTag(tag: MoodTag) {
    setSelectedMoodTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag]
    );
  }

  async function onInitializePrototype() {
    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setResult(null);

    try {
      const response = await initializePrototype({
        sourceConceptId: remixSource?._id,
        kitVariantId: selectedKitVariantId!,
        stylePresetId: selectedStylePresetId!,
        materialPresetId: selectedMaterialPresetId!,
        moodTags: selectedMoodTags,
        weatheringLevel,
        visibility,
        notes: notes.trim() === "" ? undefined : notes.trim(),
      });

      setResult({
        title: response.title,
        conceptId: response.conceptId,
        generationJobId: response.generationJobId,
        balanceAfter: response.balanceAfter,
        templateName: response.templateName,
        promptPreview: response.promptPreview,
        visibility,
        moodTags: selectedMoodTags,
        priceRule: response.priceRule,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to initialize prototype");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onGenerateStyleSuggestion() {
    if (!selectedKitVariantId || !canGenerateStyleSuggestion) {
      return;
    }

    setIsGeneratingStyleSuggestion(true);
    setErrorMessage(null);

    try {
      const response = await generateStyleSuggestion({
        kitVariantId: selectedKitVariantId,
        moodTags: selectedMoodTags,
        notes: notes.trim() === "" ? undefined : notes.trim(),
      });
      setStyleSuggestionResult(response);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to generate Style DNA suggestion"
      );
    } finally {
      setIsGeneratingStyleSuggestion(false);
    }
  }

  async function onGeneratePalettePlan() {
    if (
      !selectedKitVariantId ||
      !selectedStylePresetId ||
      !selectedMaterialPresetId ||
      !canGeneratePalettePlan
    ) {
      return;
    }

    setIsGeneratingPalettePlan(true);
    setErrorMessage(null);

    try {
      const response = await generatePalettePlan({
        kitVariantId: selectedKitVariantId,
        stylePresetId: selectedStylePresetId,
        materialPresetId: selectedMaterialPresetId,
        moodTags: selectedMoodTags,
        weatheringLevel,
        notes: notes.trim() === "" ? undefined : notes.trim(),
      });
      setPalettePlanResult(response);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate palette plan");
    } finally {
      setIsGeneratingPalettePlan(false);
    }
  }

  async function onRequestHdRender() {
    if (!result) {
      return;
    }

    setIsQueueingHdRender(true);
    setErrorMessage(null);
    try {
      const response = await requestHdRender({ conceptId: result.conceptId });
      setResult((current) =>
        current
          ? {
              ...current,
              title: response.title,
              generationJobId: response.generationJobId,
              balanceAfter: response.balanceAfter,
              templateName: response.templateName,
              promptPreview: response.promptPreview,
              priceRule: response.priceRule,
            }
          : current
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to queue HD render");
    } finally {
      setIsQueueingHdRender(false);
    }
  }

  if (catalog === undefined || viewer === undefined) {
    return (
      <div className="workbench-page">
        <Kicker>Create</Kicker>
        <h2>Loading catalog</h2>
      </div>
    );
  }

  const previewFinish = materialFinishOf(selectedMaterialPreset);
  const previewMass = kitMassOf(selectedKitVariant);

  return (
    <div className="workbench-page workbench-layout">
      <div className="workbench-form">
        {remixConceptId ? (
          <section className="workbench-step">
            {remixSource === undefined ? (
              <FieldHint>Loading remix source</FieldHint>
            ) : remixSource === null ? (
              <FieldHint>Remix source unavailable. Continue as a new prototype.</FieldHint>
            ) : (
              <FieldHint>
                Remixing {remixSource.title}.{" "}
                <a href={`/prototype/${remixSource._id}`}>Open source</a>
              </FieldHint>
            )}
          </section>
        ) : null}

        <section className="workbench-step">
          <StepHeader step="01" title="Kit" />
          <div className="kit-browser">
            <div className="kit-filters">
              <KitFilterGroup
                label="Universe"
                options={kitFilterOptions.universes}
                value={kitUniverse}
                onChange={setKitUniverse}
              />
              <KitFilterGroup
                label="Scale"
                options={kitFilterOptions.scales}
                value={kitScale}
                onChange={setKitScale}
              />
              <KitFilterGroup
                label="Complexity"
                options={kitFilterOptions.complexities}
                value={kitComplexity}
                onChange={setKitComplexity}
              />
              <KitFilterGroup
                label="Tags"
                options={kitFilterOptions.tags}
                value={kitTag}
                onChange={setKitTag}
              />
            </div>
            <div className="kit-grid">
              {visibleKits.length === 0 ? (
                <FieldHint>No kits match these filters.</FieldHint>
              ) : (
                visibleKits.map((kit) => (
                <button
                  className={selectedKitVariantId === kit._id ? "kit-tile is-active" : "kit-tile"}
                  key={kit._id}
                  onClick={() => setSelectedKitVariantId(kit._id)}
                  type="button"
                >
                  <div className={`kit-tile__board is-${kitMassOf(kit)}`}>
                    <span className="kit-tile__grade">{kit.grade ?? kit.scale ?? "Kit"}</span>
                    <span className="silhouette-figure" />
                  </div>
                  <p className="kit-tile__name">{kit.name}</p>
                  <p className="kit-tile__tags">{kit.tags.join(" · ")}</p>
                </button>
              ))
              )}
            </div>
          </div>
        </section>

        <section className="workbench-step">
          <StepHeader step="02" title="Style DNA" />
          <div className="dna-grid">
            {catalog.stylePresets.map((preset) => (
              <button
                className={selectedStylePresetId === preset._id ? "dna-card is-active" : "dna-card"}
                key={preset._id}
                onClick={() => setSelectedStylePresetId(preset._id)}
                type="button"
              >
                <p className="dna-card__name">{preset.name}</p>
                <p className="dna-card__meta">{preset.category ?? "Unsorted"}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="workbench-step">
          <StepHeader step="03" title="Material" />
          <div className="swatch-grid">
            {catalog.materialPresets.map((preset) => (
              <button
                className={
                  selectedMaterialPresetId === preset._id ? "swatch-card is-active" : "swatch-card"
                }
                key={preset._id}
                onClick={() => setSelectedMaterialPresetId(preset._id)}
                type="button"
              >
                <div className={`swatch-card__plate is-${materialFinishOf(preset)}`} />
                <p className="swatch-card__name">{preset.name}</p>
                <p className="swatch-card__meta">{preset.finishType}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="workbench-step">
          <StepHeader step="04" title="Mood" />
          <div className="choice-chip-row">
            {moodOptions.map((option) => (
              <ChoiceChip
                key={option.value}
                compact
                active={selectedMoodTags.includes(option.value)}
                onClick={() => toggleMoodTag(option.value)}
                title={option.detail}
              >
                {option.label}
              </ChoiceChip>
            ))}
          </div>
          <Kicker>Visibility</Kicker>
          <div className="choice-chip-row">
            {visibilityOptions.map((option) => (
              <ChoiceChip
                key={option.value}
                compact
                active={visibility === option.value}
                onClick={() => setVisibility(option.value)}
                title={option.detail}
              >
                {option.label}
              </ChoiceChip>
            ))}
          </div>
          <FieldHint>Public sends the concept to showcase.</FieldHint>
        </section>

        <section className="workbench-step">
          <StepHeader step="05" title="Weathering" />
          <div className="segment">
            {weatheringOptions.map((option) => (
              <button
                className={weatheringLevel === option.value ? "is-active" : undefined}
                key={option.value}
                onClick={() => setWeatheringLevel(option.value)}
                title={option.detail}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="workbench-note">
            <div className="flex items-center justify-between gap-3">
              <Kicker>Note</Kicker>
              <span className={cn("status-pill", notesRemaining < 0 && "is-danger")}>
                {notes.length}/100
              </span>
            </div>
            <Textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional: orange warning decals"
              className="border-line-secondary bg-transparent text-ink-primary placeholder:text-ink-muted"
            />
          </div>
        </section>
      </div>

      <aside className="workbench-focus-col">
        <FocusPanel>
          <div className="workbench-focus__preview">
            {generatedImageUrl ? (
              <img src={generatedImageUrl} alt={`${result?.title ?? "Prototype"} preview`} />
            ) : (
              <div
                className={cn(
                  "silhouette-stage",
                  selectedKitVariant && "is-kit",
                  `is-${previewMass}`,
                  previewFinish && `is-${previewFinish}`
                )}
              >
                <span className="silhouette-figure" />
                <p className="silhouette-stage__kicker">
                  {selectedKitVariant
                    ? selectedKitVariant.grade ?? selectedKitVariant.scale ?? "Kit"
                    : "Silhouette"}
                </p>
                <p className="silhouette-stage__name">
                  {selectedKitVariant?.name ?? "Select a kit"}
                </p>
              </div>
            )}
          </div>
          <div className="workbench-focus__body">
            <Kicker>Prototype</Kicker>
            <TowerField
              label="Kit"
              value={
                selectedKitVariant
                  ? `${selectedKitVariant.grade ? `${selectedKitVariant.grade} ` : ""}${selectedKitVariant.name}`
                  : "—"
              }
            />
            <TowerField label="Style" value={selectedStylePreset?.name ?? "—"} />
            <TowerField label="Material" value={selectedMaterialPreset?.name ?? "—"} />
            <TowerField
              label="Mood"
              value={
                selectedMoodTags.length > 0
                  ? selectedMoodTags.map(formatMoodTagLabel).join(", ")
                  : "—"
              }
            />
            <TowerField label="Weathering" value={weatheringLevel} />
            {selectedKitVariant ? (
              <p className="kit-tile__tags">
                {[
                  selectedKitVariant.baseUnit?.ipSeries?.name,
                  selectedKitVariant.complexityLevel,
                  ...selectedKitVariant.tags,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            ) : null}

            {creatorPackLocked ? (
              <WorkbenchNotice tone="danger">
                <p>{creatorPackAccess.message}</p>
              </WorkbenchNotice>
            ) : null}
            {errorMessage ? (
              <WorkbenchNotice tone="danger">
                <p>{errorMessage}</p>
              </WorkbenchNotice>
            ) : null}

            <div className="tower-credits">
              <span className="workbench-kicker">Credits</span>
              <strong>{createCost}</strong>
            </div>

            <CommandButton
              type="button"
              onClick={() => {
                void onInitializePrototype();
              }}
              disabled={!canSubmit}
              className="w-full"
              commandLabel="COMMAND"
            >
              {isSubmitting ? "INITIALIZING" : "Initialize Prototype"}
            </CommandButton>

            <details className="tower-tools">
              <summary>More tools</summary>
              <GhostButton
                disabled={!canGenerateStyleSuggestion}
                loading={isGeneratingStyleSuggestion}
                onClick={() => {
                  void onGenerateStyleSuggestion();
                }}
              >
                {isGeneratingStyleSuggestion
                  ? "Resolving Style DNA"
                  : `Style suggestion · ${styleSuggestionCost} cr`}
              </GhostButton>
              <GhostButton
                disabled={!canGeneratePalettePlan}
                loading={isGeneratingPalettePlan}
                onClick={() => {
                  void onGeneratePalettePlan();
                }}
              >
                {isGeneratingPalettePlan
                  ? "Composing palette"
                  : `Palette plan · ${palettePlanCost} cr`}
              </GhostButton>
              {styleSuggestionResult
                ? styleSuggestionResult.suggestions.map((suggestion) => (
                    <GhostButton
                      key={suggestion.stylePresetId}
                      compact
                      onClick={() => setSelectedStylePresetId(suggestion.stylePresetId)}
                    >
                      Apply {suggestion.name}
                    </GhostButton>
                  ))
                : null}
              {palettePlanResult
                ? palettePlanResult.plan.entries.slice(0, 3).map((entry) => (
                    <FieldHint key={entry.roleSlug}>
                      {entry.roleName}:{" "}
                      {entry.suggestedPaint
                        ? `${entry.suggestedPaint.brand} ${entry.suggestedPaint.colorName}`
                        : "unmapped"}
                    </FieldHint>
                  ))
                : null}
            </details>

            {result ? (
              <div className="workbench-block">
                <div className="choice-chip-row">
                  <StatusPill label={liveJob?.status ?? "syncing"} tone={liveTone} />
                  <StatusPill
                    label={liveJob?.concept?.status ?? "draft"}
                    tone={mapStatusTone(liveJob?.concept?.status)}
                  />
                </div>
                {liveJob?.errorMessage ? (
                  <WorkbenchNotice tone="danger">
                    <p>{liveJob.errorMessage}</p>
                  </WorkbenchNotice>
                ) : null}
                {liveJob?.status === "succeeded" ? (
                  <GhostButton
                    disabled={isQueueingHdRender}
                    loading={isQueueingHdRender}
                    onClick={() => {
                      void onRequestHdRender();
                    }}
                  >
                    {isQueueingHdRender ? "Queueing HD" : `HD render · ${hdCost} cr`}
                  </GhostButton>
                ) : (
                  <GhostButton href="/library">Open library</GhostButton>
                )}
                {shoppingList ? (
                  <ShoppingListActions
                    className="mt-2"
                    data={{
                      conceptTitle: shoppingList.conceptTitle,
                      baseModelName: shoppingList.baseModelName,
                      stylePresetName: shoppingList.stylePresetName,
                      materialPresetName: shoppingList.materialPresetName,
                      bundles: shoppingList.bundles,
                      notes: shoppingList.notes,
                    }}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </FocusPanel>
      </aside>
    </div>
  );
}

function KitFilterGroup({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string | null) => void;
  options: string[];
  value: string | null;
}) {
  if (options.length === 0) {
    return null;
  }

  return (
    <div className="kit-filter">
      <Kicker>{label}</Kicker>
      <div className="choice-chip-row">
        <ChoiceChip compact active={value === null} onClick={() => onChange(null)}>
          All
        </ChoiceChip>
        {options.map((option) => (
          <ChoiceChip
            key={option}
            compact
            active={value === option}
            onClick={() => onChange(option)}
          >
            {option}
          </ChoiceChip>
        ))}
      </div>
    </div>
  );
}

function collectKitFilterOptions(kits: KitOption[]) {
  return {
    universes: uniqueSorted(kits.map(kitUniverseOf).filter(Boolean) as string[]),
    scales: uniqueSorted(kits.map(kitScaleOf).filter(Boolean) as string[]),
    complexities: uniqueSorted(
      kits.map((kit) => kit.complexityLevel).filter((value): value is string => Boolean(value))
    ),
    tags: uniqueSorted(kits.flatMap((kit) => kit.tags)),
  };
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function kitUniverseOf(kit: KitOption) {
  return kit.baseUnit?.ipSeries?.universe ?? kit.baseUnit?.ipSeries?.name ?? null;
}

function kitScaleOf(kit: KitOption) {
  return kit.grade ?? kit.scale ?? null;
}

function kitMassOf(kit: KitOption | null) {
  const silhouette = kit?.silhouetteType ?? kit?.baseUnit?.silhouetteType ?? "";
  if (silhouette.includes("heavy")) {
    return "heavy";
  }
  if (silhouette.includes("agile") || silhouette.includes("frame")) {
    return "agile";
  }
  return "hero";
}

function materialFinishOf(preset: { finishType?: string; sheenLevel?: string } | null) {
  const blob = `${preset?.finishType ?? ""} ${preset?.sheenLevel ?? ""}`.toLowerCase();
  if (blob.includes("chrome") || blob.includes("metal") || blob.includes("high") || blob.includes("gun")) {
    return "chrome";
  }
  if (blob.includes("semi") || blob.includes("medium") || blob.includes("gloss")) {
    return "semi";
  }
  return "matte";
}

type KitOption = {
  _id: Id<"baseModels">;
  name: string;
  grade?: string;
  scale?: string;
  complexityLevel?: string;
  silhouetteType?: string;
  tags: string[];
  baseUnit?: {
    silhouetteType?: string;
    ipSeries?: { name?: string; universe?: string } | null;
  } | null;
};

function formatMoodTagLabel(tag: MoodTag) {
  if (tag === "command-presence") {
    return "Command Presence";
  }
  if (tag === "stealth-tension") {
    return "Stealth Tension";
  }
  if (tag === "industrial-hazard") {
    return "Industrial Hazard";
  }
  if (tag === "reactor-glow") {
    return "Reactor Glow";
  }
  if (tag === "field-fatigue") {
    return "Field Fatigue";
  }
  return "Ceremonial Clean";
}

function clampNotes(notes?: string | null) {
  return notes?.slice(0, 100) ?? "";
}
