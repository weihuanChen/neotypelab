"use client";

import { Button } from "@/components/ui/button";
import { ShoppingListActions } from "@/components/public/ShoppingListActions";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getCreatorPackAccessCopy } from "@/lib/creatorPackAccess";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

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

export function CreateWorkbench() {
  const searchParams = useSearchParams();
  const catalog = useQuery(api.catalog.listCreateOptions);
  const viewer = useQuery(api.users.viewer);
  const templates = useQuery(api.promptEngine.listTemplates, {
    kind: "repaint-concept",
  });
  const remixConceptId = searchParams.get("remix");
  const recommendedStyleSlug = searchParams.get("recommendedStyle");
  const recommendedMaterialSlug = searchParams.get("recommendedMaterial");
  const recommendedWorkflow = searchParams.get("recommendedWorkflow");
  const recommendedBaseModelSlug = searchParams.get("recommendedBaseModel");
  const recommendedMoodTagsParam = searchParams.get("recommendedMoodTags");
  const recommendedWeathering = searchParams.get("recommendedWeathering");
  const creatorPackSlug = searchParams.get("creatorPack");
  const creatorPackVariant = searchParams.get("creatorPackVariant");
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

  const [selectedBaseModelId, setSelectedBaseModelId] = useState<Id<"baseModels"> | null>(
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
  const paintPlan = useQuery(
    api.paintMappingPlans.getConceptPaintPlan,
    result ? { conceptId: result.conceptId } : "skip"
  );
  const feasibility = useQuery(
    api.feasibility.getViewerConceptFeasibility,
    result ? { conceptId: result.conceptId } : "skip"
  );
  const shoppingList = useQuery(
    api.shopping.getViewerConceptShoppingList,
    result ? { conceptId: result.conceptId } : "skip"
  );
  const recommendations = useQuery(
    api.recommendations.getViewerConceptRecommendations,
    result ? { conceptId: result.conceptId } : "skip"
  );

  const selectedBaseModel =
    catalog?.baseModels.find((item) => item._id === selectedBaseModelId) ?? null;
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
  const notePolicy = templates?.[0]?.notePolicy ?? "Keep notes brief and controlled.";
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
    selectedBaseModel !== null &&
    selectedStylePreset !== null &&
    selectedMaterialPreset !== null &&
    notesRemaining >= 0 &&
    (!remixConceptId || remixSource !== undefined) &&
    creatorPackGateResolved &&
    !creatorPackLocked &&
    !isSubmitting;
  const livePhaseLabel = liveJob?.outputSummary?.label ?? statusDisplayLabel(liveJob?.status);
  const livePhase = liveJob?.outputSummary?.phase ?? liveJob?.status ?? "idle";
  const liveTone = statusTone(liveJob?.status);
  const canGenerateStyleSuggestion = selectedBaseModel !== null && !isGeneratingStyleSuggestion;
  const canGeneratePalettePlan =
    selectedBaseModel !== null &&
    selectedStylePreset !== null &&
    selectedMaterialPreset !== null &&
    !isGeneratingPalettePlan;

  useEffect(() => {
    if (!remixSource || appliedRemixId === remixSource._id) {
      return;
    }

    setSelectedBaseModelId(remixSource.baseModelId);
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
      const baseModel = catalog.baseModels.find((item) => item.slug === recommendedBaseModelSlug);
      if (baseModel) {
        setSelectedBaseModelId(baseModel._id);
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
        baseModelId: selectedBaseModelId!,
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
    if (!selectedBaseModelId || !canGenerateStyleSuggestion) {
      return;
    }

    setIsGeneratingStyleSuggestion(true);
    setErrorMessage(null);

    try {
      const response = await generateStyleSuggestion({
        baseModelId: selectedBaseModelId,
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
      !selectedBaseModelId ||
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
        baseModelId: selectedBaseModelId,
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
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">
          Initializing catalog
        </p>
        <h2 className="mt-4 text-3xl font-semibold">Syncing style DNA and material profiles</h2>
      </section>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.95fr)]">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6 text-[#E6EDF3]">
          <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">
            Prototype flow
          </p>
          <h2 className="mt-4 text-3xl font-semibold">Structured repaint initialization</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9BA7B4]">
            Build the concept through base model, Style DNA, material profile,
            weathering, and a tightly controlled note field. No raw prompt engineering,
            no hidden credit cost.
          </p>
        </section>

        {remixConceptId ? (
          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6 text-[#E6EDF3]">
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Remix intake</p>
            {remixSource === undefined ? (
              <>
                <h2 className="mt-4 text-2xl font-semibold">Resolving public source telemetry</h2>
                <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
                  Loading the shareable concept before this dispatch can preserve lineage.
                </p>
              </>
            ) : remixSource === null ? (
              <>
                <h2 className="mt-4 text-2xl font-semibold">Remix source unavailable</h2>
                <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
                  This share link no longer points at a public or unlisted generated concept. You
                  can still create a new prototype manually, but lineage will not be attached.
                </p>
              </>
            ) : (
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_260px]">
                <div>
                  <h2 className="mt-4 text-2xl font-semibold">{remixSource.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
                    Remix seed from {remixSource.baseModel.name} · {remixSource.stylePreset.name} ·{" "}
                    {remixSource.materialPreset.name}. Dispatching from this page will write
                    `sourceConceptId` into the new concept and keep the branch trace intact.
                  </p>
                  {remixSource.notes ? (
                    <p className="mt-4 rounded-[18px] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-[#C7D0DA]">
                      {clampNotes(remixSource.notes)}
                    </p>
                  ) : null}
                </div>
                <div className="rounded-[22px] border border-white/10 bg-[#0D1117] p-4">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#FFB84D]">
                    Source record
                  </p>
                  <div className="mt-4 space-y-3 text-sm">
                    <SummaryRow
                      label="Pilot"
                      value={remixSource.owner?.handle ?? remixSource.owner?.fullName ?? "Unknown"}
                    />
                    <SummaryRow label="Weathering" value={remixSource.weatheringLevel} />
                    <SummaryRow
                      label="Mood Vector"
                      value={
                        remixSource.moodTags.length > 0
                          ? remixSource.moodTags.map(formatMoodTagLabel).join(", ")
                          : "No mood vector"
                      }
                    />
                  </div>
                  <Link
                    href={`/prototype/${remixSource._id}`}
                    className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-[#123342]"
                  >
                    Open Source Surface
                  </Link>
                </div>
              </div>
            )}
          </section>
        ) : null}

        <StepPanel
          step="01"
          title="Select Base Model"
          description="Choose the silhouette and mechanical complexity first. This anchors every downstream prompt and paint decision."
        >
          <div className="grid gap-3 md:grid-cols-2">
            {catalog.baseModels.map((baseModel) => {
              const active = selectedBaseModelId === baseModel._id;
              return (
                <button
                  key={baseModel._id}
                  type="button"
                  onClick={() => setSelectedBaseModelId(baseModel._id)}
                  className={cn(
                    "rounded-[22px] border p-4 text-left transition-all",
                    active
                      ? "border-[#3DD9FF]/50 bg-[#3DD9FF]/10 shadow-[0_0_0_1px_rgba(61,217,255,0.18)]"
                      : "border-white/10 bg-[#161B22] hover:border-white/20 hover:bg-[#1B222C]"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-[0.28em] text-[#58FFB2]">
                        Base Model
                      </p>
                      <h3 className="mt-2 text-lg font-semibold text-[#E6EDF3]">
                        {baseModel.name}
                      </h3>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
                      {baseModel.grade ?? "Grade N/A"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-[#9BA7B4]">
                    {baseModel.series ?? "Series unknown"} · {baseModel.silhouetteType ?? "Unclassified silhouette"}
                  </p>
                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#6E7A88]">
                    Complexity {baseModel.complexityLevel ?? "Unknown"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {baseModel.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-[#9BA7B4]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </StepPanel>

        <StepPanel
          step="02"
          title="Select Style DNA"
          description="Use one governed preset. The system will translate that preset into controlled prompt logic and material bias."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {catalog.stylePresets.map((preset) => {
              const active = selectedStylePresetId === preset._id;
              return (
                <button
                  key={preset._id}
                  type="button"
                  onClick={() => setSelectedStylePresetId(preset._id)}
                  className={cn(
                    "rounded-[22px] border p-4 text-left transition-all",
                    active
                      ? "border-[#58FFB2]/45 bg-[#58FFB2]/10 shadow-[0_0_0_1px_rgba(88,255,178,0.14)]"
                      : "border-white/10 bg-[#161B22] hover:border-white/20 hover:bg-[#1B222C]"
                  )}
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#3DD9FF]">
                    Style DNA / {preset.category ?? "Unsorted"}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-[#E6EDF3]">{preset.name}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
                    {preset.shortDescription}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">
                    <span>Contrast {preset.contrastLevel ?? "N/A"}</span>
                    <span>Weathering {preset.weatheringProfile ?? "N/A"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </StepPanel>

        <StepPanel
          step="03"
          title="Select Material Profile"
          description="Material finish affects realism, reflectivity, and how believable the result feels as an actual repaint plan."
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {catalog.materialPresets.map((preset) => {
              const active = selectedMaterialPresetId === preset._id;
              return (
                <button
                  key={preset._id}
                  type="button"
                  onClick={() => setSelectedMaterialPresetId(preset._id)}
                  className={cn(
                    "rounded-[22px] border p-4 text-left transition-all",
                    active
                      ? "border-[#FFB84D]/45 bg-[#FFB84D]/10 shadow-[0_0_0_1px_rgba(255,184,77,0.12)]"
                      : "border-white/10 bg-[#161B22] hover:border-white/20 hover:bg-[#1B222C]"
                  )}
                >
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#FFB84D]">
                    Material Profile
                  </p>
                  <h3 className="mt-2 text-base font-semibold text-[#E6EDF3]">{preset.name}</h3>
                  <p className="mt-3 text-sm text-[#9BA7B4]">{preset.finishType}</p>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">
                    <span>Reflectivity {preset.reflectivityLevel ?? "N/A"}</span>
                    <span>Difficulty {preset.difficultyLevel ?? "N/A"}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </StepPanel>

        <StepPanel
          step="04"
          title="Mood Vector and Access Envelope"
          description="Mood is a controlled layer, not a free-form prompt. Visibility defines whether the concept stays private, shareable, or future-showcase ready."
        >
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
            <div className="grid gap-3 md:grid-cols-2">
              {moodOptions.map((option) => {
                const active = selectedMoodTags.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleMoodTag(option.value)}
                    className={cn(
                      "rounded-[20px] border p-4 text-left transition-all",
                      active
                        ? "border-[#58FFB2]/45 bg-[#58FFB2]/10 shadow-[0_0_0_1px_rgba(88,255,178,0.14)]"
                        : "border-white/10 bg-[#161B22] hover:border-white/20 hover:bg-[#1B222C]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-[#E6EDF3]">{option.label}</h3>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">
                        Mood
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">{option.detail}</p>
                  </button>
                );
              })}
            </div>
            <div className="grid gap-3">
              {visibilityOptions.map((option) => {
                const active = visibility === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setVisibility(option.value)}
                    className={cn(
                      "rounded-[20px] border p-4 text-left transition-all",
                      active
                        ? "border-[#FFB84D]/45 bg-[#FFB84D]/10 shadow-[0_0_0_1px_rgba(255,184,77,0.12)]"
                        : "border-white/10 bg-[#161B22] hover:border-white/20 hover:bg-[#1B222C]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-semibold text-[#E6EDF3]">{option.label}</h3>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">
                        Visibility
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">{option.detail}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </StepPanel>

        <StepPanel
          step="05"
          title="Weathering and Directed Note"
          description="Keep the last layer tight. Weathering is a structured selector; notes are capped and only refine the chosen system."
        >
          <div className="grid gap-4 lg:grid-cols-[1fr_minmax(0,1.2fr)]">
            <div className="grid gap-3">
              {weatheringOptions.map((option) => {
                const active = weatheringLevel === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setWeatheringLevel(option.value)}
                    className={cn(
                      "rounded-[20px] border p-4 text-left transition-all",
                      active
                        ? "border-[#3DD9FF]/45 bg-[#3DD9FF]/10"
                        : "border-white/10 bg-[#161B22] hover:border-white/20"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-[#E6EDF3]">{option.label}</h3>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">
                        Weathering
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[#9BA7B4]">{option.detail}</p>
                  </button>
                );
              })}
            </div>
            <div className="rounded-[22px] border border-white/10 bg-[#161B22] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#58FFB2]">
                    Additional Note
                  </p>
                  <p className="mt-2 text-sm text-[#9BA7B4]">{notePolicy}</p>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-1 text-[11px]",
                    notesRemaining < 0
                      ? "border-[#FF5F5F]/30 text-[#FF5F5F]"
                      : "border-white/10 text-[#9BA7B4]"
                  )}
                >
                  {notes.length}/100
                </span>
              </div>
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Add a small direction, e.g. orange warning decals"
                className="mt-4 min-h-[140px] resize-none border-white/10 bg-[#0D1117] text-[#E6EDF3] placeholder:text-[#6E7A88] focus-visible:ring-[#3DD9FF]"
              />
            </div>
          </div>
        </StepPanel>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">
            Reactor summary
          </p>
          <div className="mt-5 space-y-4">
            <SummaryRow
              label="Base Model"
              value={selectedBaseModel?.name ?? "Select base silhouette"}
            />
            <SummaryRow
              label="Style DNA"
              value={selectedStylePreset?.name ?? "Load one governed style preset"}
            />
            <SummaryRow
              label="Material"
              value={selectedMaterialPreset?.name ?? "Choose finish logic"}
            />
            <SummaryRow
              label="Mood Vector"
              value={
                selectedMoodTags.length > 0
                  ? selectedMoodTags.map(formatMoodTagLabel).join(", ")
                  : "No mood vector"
              }
            />
            <SummaryRow label="Weathering" value={weatheringLevel} />
            <SummaryRow label="Visibility" value={visibility} />
            <SummaryRow
              label="Remix Source"
              value={remixSource ? remixSource.title : remixConceptId ? "Resolving source surface" : "Direct prototype"}
            />
            <SummaryRow
              label="Operator"
              value={viewer?.handle ?? "Unknown pilot"}
            />
          </div>
          {(recommendedStyleSlug || recommendedMaterialSlug || recommendedWorkflow) ? (
            <div className="mt-6 rounded-[22px] border border-[#58FFB2]/20 bg-[#58FFB2]/10 p-4 text-sm leading-6 text-[#C7D0DA]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#58FFB2]">
                Recommendation Bridge Applied
              </p>
              <p className="mt-3">
                This create session was prefilled from a public prototype recommendation. Review the loaded Style DNA,
                material profile, and workflow before dispatching the next branch.
              </p>
            </div>
          ) : null}
          {creatorPackSlug ? (
            <div className="mt-4 rounded-[22px] border border-[#3DD9FF]/20 bg-[#3DD9FF]/10 p-4 text-sm leading-6 text-[#C7D0DA]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#3DD9FF]">
                Creator Pack Bridge Applied
              </p>
              <p className="mt-3">
                This create session was initialized from creator pack <span className="font-semibold text-[#E6EDF3]">{creatorPackSlug}</span>
                {creatorPackVariant ? (
                  <>
                    {" "}using variant starter <span className="font-semibold text-[#E6EDF3]">{formatCreatorPackVariantLabel(creatorPackVariant)}</span>
                  </>
                ) : null}
                . Review the loaded base model, Style DNA, and material profile before dispatching.
              </p>
            </div>
          ) : null}
          {creatorPackLocked ? (
            <div className="mt-4 rounded-[22px] border border-[#FF5F5F]/20 bg-[#FF5F5F]/10 p-4 text-sm leading-6 text-[#FFD5D5]">
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#FF8E8E]">Premium Pack Locked</p>
              <p className="mt-3">{creatorPackAccess.message}</p>
            </div>
          ) : null}
          <div className="mt-6 rounded-[22px] border border-white/10 bg-black/20 p-4">
            <p className="text-[11px] uppercase tracking-[0.28em] text-[#58FFB2]">
              Credit Capacity
            </p>
            <div className="mt-3 flex items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold text-[#E6EDF3]">
                  {viewer?.credits.balance ?? 0}
                </p>
                <p className="mt-1 text-sm text-[#6E7A88]">Available credits</p>
              </div>
              <div className="text-right text-sm text-[#9BA7B4]">
                <p>{styleSuggestionCost} credits · style suggestion</p>
                <p>{palettePlanCost} credits · palette plan</p>
                <p>{createCost} credits · concept dispatch</p>
                <p>{hdCost} credits · HD preview later</p>
              </div>
            </div>
          </div>
          {errorMessage ? (
            <div className="mt-4 rounded-[18px] border border-[#FF5F5F]/20 bg-[#FF5F5F]/10 p-4 text-sm text-[#FFD5D5]">
              {errorMessage}
            </div>
          ) : null}
          <Button
            type="button"
            onClick={() => {
              void onInitializePrototype();
            }}
            disabled={!canSubmit}
            className="mt-6 h-12 w-full rounded-[18px] border border-[#3DD9FF]/40 bg-[#0E2430] text-[#E6EDF3] hover:bg-[#123342]"
          >
            {isSubmitting ? "INITIALIZING STYLE DNA" : "Initialize Prototype"}
          </Button>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Operator tools</p>
          <div className="mt-4 grid gap-3">
            <Button
              type="button"
              disabled={!canGenerateStyleSuggestion}
              onClick={() => {
                void onGenerateStyleSuggestion();
              }}
              className="h-11 rounded-[18px] border border-[#58FFB2]/35 bg-[#13241B] text-[#E6EDF3] hover:bg-[#193021]"
            >
              {isGeneratingStyleSuggestion
                ? "Resolving Style DNA"
                : `Generate Style Suggestion · ${styleSuggestionCost} credit${
                    styleSuggestionCost === 1 ? "" : "s"
                  }`}
            </Button>
            <Button
              type="button"
              disabled={!canGeneratePalettePlan}
              onClick={() => {
                void onGeneratePalettePlan();
              }}
              className="h-11 rounded-[18px] border border-[#FFB84D]/35 bg-[#2A210F] text-[#E6EDF3] hover:bg-[#382C13]"
            >
              {isGeneratingPalettePlan
                ? "Composing Palette Plan"
                : `Generate Palette Plan · ${palettePlanCost} credit${
                    palettePlanCost === 1 ? "" : "s"
                  }`}
            </Button>
          </div>

          {styleSuggestionResult ? (
            <div className="mt-5 rounded-[22px] border border-white/10 bg-[#11161D] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#58FFB2]">
                    Style DNA Suggestion
                  </p>
                  <p className="mt-2 text-sm text-[#9BA7B4]">
                    {styleSuggestionResult.templateName} · {styleSuggestionResult.priceRule.creditCost} credit
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.18em] text-[#6E7A88]">
                  Balance {styleSuggestionResult.balanceAfter}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {styleSuggestionResult.suggestions.map((suggestion) => (
                  <div
                    key={suggestion.stylePresetId}
                    className="rounded-[18px] border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#E6EDF3]">{suggestion.name}</p>
                        <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">
                          {suggestion.category ?? "Unsorted"} · {suggestion.confidenceLabel}
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => setSelectedStylePresetId(suggestion.stylePresetId)}
                        className="h-9 rounded-[14px] border border-[#3DD9FF]/35 bg-[#0E2430] px-3 text-xs text-[#E6EDF3] hover:bg-[#123342]"
                      >
                        Apply
                      </Button>
                    </div>
                    {suggestion.shortDescription ? (
                      <p className="mt-3 text-sm text-[#C7D0DA]">{suggestion.shortDescription}</p>
                    ) : null}
                    <p className="mt-3 text-xs leading-5 text-[#9BA7B4]">{suggestion.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {palettePlanResult ? (
            <div className="mt-5 rounded-[22px] border border-white/10 bg-[#11161D] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#FFB84D]">
                    Palette Plan
                  </p>
                  <p className="mt-2 text-sm text-[#9BA7B4]">
                    {palettePlanResult.templateName} · {palettePlanResult.priceRule.creditCost} credit
                  </p>
                </div>
                <span className="text-xs uppercase tracking-[0.18em] text-[#6E7A88]">
                  Balance {palettePlanResult.balanceAfter}
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {palettePlanResult.plan.entries.slice(0, 4).map((entry) => (
                  <div
                    key={entry.roleSlug}
                    className="rounded-[18px] border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-[#E6EDF3]">{entry.roleName}</p>
                        <p className="mt-1 text-xs text-[#6E7A88]">
                          {entry.recommendedArea ?? "Controlled application zone"}
                        </p>
                      </div>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
                        {entry.suggestedPaint?.code ?? "N/A"}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-[#C7D0DA]">
                      {entry.suggestedPaint
                        ? `${entry.suggestedPaint.brand} ${entry.suggestedPaint.colorName}`
                        : "No active paint mapping"}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-[#9BA7B4]">{entry.rationale}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-[18px] border border-white/10 bg-black/20 p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#58FFB2]">
                  Spray Notes
                </p>
                <div className="mt-3 space-y-2 text-xs leading-5 text-[#9BA7B4]">
                  {palettePlanResult.plan.sprayNotes.map((note) => (
                    <p key={note}>{note}</p>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {(recommendedStyleSlug || recommendedMaterialSlug || recommendedWorkflow || recommendedBaseModelSlug || recommendedMoodTagsParam || recommendedWeathering || creatorPackSlug || creatorPackVariant) ? (
            <div className="mt-5 rounded-[22px] border border-white/10 bg-[#11161D] p-4">
              <p className="text-[11px] uppercase tracking-[0.26em] text-[#58FFB2]">
                Recommendation Bridge
              </p>
              <div className="mt-4 space-y-3 text-sm text-[#C7D0DA]">
                {creatorPackSlug ? (
                  <SummaryRow label="Creator Pack" value={creatorPackSlug} />
                ) : null}
                {creatorPackVariant ? (
                  <SummaryRow
                    label="Variant Starter"
                    value={formatCreatorPackVariantLabel(creatorPackVariant)}
                  />
                ) : null}
                {recommendedBaseModelSlug ? (
                  <SummaryRow label="Recommended Base Model" value={recommendedBaseModelSlug} />
                ) : null}
                {recommendedStyleSlug ? (
                  <SummaryRow label="Recommended Style" value={recommendedStyleSlug} />
                ) : null}
                {recommendedMaterialSlug ? (
                  <SummaryRow label="Recommended Material" value={recommendedMaterialSlug} />
                ) : null}
                {recommendedMoodTagsParam ? (
                  <SummaryRow
                    label="Recommended Mood Tags"
                    value={recommendedMoodTagsParam
                      .split(",")
                      .map((tag) => formatMoodTagLabel(tag as MoodTag))
                      .join(", ")}
                  />
                ) : null}
                {recommendedWeathering ? (
                  <SummaryRow label="Recommended Weathering" value={recommendedWeathering} />
                ) : null}
                {recommendedWorkflow ? (
                  <SummaryRow label="Recommended Workflow" value={recommendedWorkflow} />
                ) : null}
              </div>
              <p className="mt-4 text-xs leading-5 text-[#9BA7B4]">
                These overrides came from the P3 recommendation system and are already applied to the current create
                state.
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">
            Dispatch queue
          </p>
          {result ? (
            <div className="mt-4 space-y-4">
              <div
                className={cn(
                  "rounded-[20px] border p-4",
                  liveTone === "green" && "border-[#58FFB2]/20 bg-[#58FFB2]/10",
                  liveTone === "cyan" && "border-[#3DD9FF]/20 bg-[#3DD9FF]/10",
                  liveTone === "red" && "border-[#FF5F5F]/20 bg-[#FF5F5F]/10",
                  liveTone === "neutral" && "border-white/10 bg-white/5"
                )}
              >
                <p
                  className={cn(
                    "text-[11px] uppercase tracking-[0.28em]",
                    liveTone === "green" && "text-[#58FFB2]",
                    liveTone === "cyan" && "text-[#3DD9FF]",
                    liveTone === "red" && "text-[#FF8E8E]",
                    liveTone === "neutral" && "text-[#9BA7B4]"
                  )}
                >
                  {livePhaseLabel}
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[#E6EDF3]">
                  {result.title}
                </h3>
                <p className="mt-3 text-sm text-[#C7D0DA]">
                  {liveJob == null
                    ? "Acquiring live telemetry from Convex."
                    : liveJob.status === "queued"
                      ? "Concept shell is staged. Waiting for the generation worker to pick up the job."
                      : liveJob.status === "running"
                        ? "Generation is running now. This panel updates automatically while the worker composes the preview."
                        : liveJob.status === "succeeded"
                          ? "Preview output has landed. Concept, prompt package, and asset metadata are now synchronized."
                          : liveJob.status === "failed"
                            ? "The job failed and credits were refunded. Review the fault line below before retrying from the library."
                            : "Concept shell, prompt package, and generation job have been created."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TelemetryPill label={`job ${liveJob?.status ?? "syncing"}`} tone={liveTone} />
                <TelemetryPill
                  label={`concept ${liveJob?.concept?.status ?? "draft"}`}
                  tone={statusTone(liveJob?.concept?.status)}
                />
                <TelemetryPill label={`phase ${livePhase}`} tone={liveTone} />
              </div>
              <SummaryRow label="Concept ID" value={result.conceptId} mono />
              <SummaryRow label="Generation Job" value={result.generationJobId} mono />
              <SummaryRow label="Template" value={result.templateName} />
              <SummaryRow
                label="Mood Vector"
                value={
                  result.moodTags.length > 0
                    ? result.moodTags.map(formatMoodTagLabel).join(", ")
                    : "No mood vector"
                }
              />
              <SummaryRow label="Visibility" value={result.visibility} />
              <SummaryRow
                label="Provider"
                value={liveJob?.provider ?? "Resolving provider"}
              />
              <SummaryRow label="Job Kind" value={formatJobKind(liveJob?.kind, liveJob?.renderMode)} />
              <SummaryRow
                label="Credit Spend"
                value={`${result.priceRule.creditCost} credits`}
              />
              <SummaryRow
                label="Remaining Balance"
                value={`${result.balanceAfter} credits`}
              />
              {remixSource ? (
                <SummaryRow label="Source Lineage" value={remixSource.title} />
              ) : null}
              <SummaryRow
                label="Prompt Package"
                value={liveJob?.promptComposition?.status ?? "ready"}
              />
              {paintPlan ? (
                <div className="rounded-[20px] border border-white/10 bg-[#0D1117] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#FFB84D]">
                    Paint Mapping Plan
                  </p>
                  <div className="mt-4 space-y-3">
                    {paintPlan.entries.slice(0, 4).map((entry) => (
                      <div
                        key={entry.roleSlug}
                        className="rounded-[16px] border border-white/10 bg-white/5 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[#E6EDF3]">{entry.roleName}</p>
                            <p className="text-xs text-[#6E7A88]">
                              {entry.recommendedArea ?? "Controlled application zone"}
                            </p>
                          </div>
                          <span className="rounded-full border border-white/10 px-2 py-1 text-[11px] text-[#9BA7B4]">
                            {entry.suggestedPaint?.code ?? "N/A"}
                          </span>
                        </div>
                        <p className="mt-3 text-sm text-[#C7D0DA]">
                          {entry.suggestedPaint
                            ? `${entry.suggestedPaint.brand} ${entry.suggestedPaint.colorName}`
                            : "No active paint mapping"}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[#9BA7B4]">{entry.rationale}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-[16px] border border-white/10 bg-black/20 p-3">
                    <p className="text-[11px] uppercase tracking-[0.22em] text-[#58FFB2]">
                      Spray Notes
                    </p>
                    <ul className="mt-3 space-y-2 text-xs leading-5 text-[#9BA7B4]">
                      {paintPlan.sprayNotes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : null}
              {feasibility ? (
                <div className="rounded-[20px] border border-white/10 bg-[#0D1117] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#FFB84D]">
                    Spray Feasibility
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#C7D0DA]">{feasibility.summary}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <SummaryBadge label="Difficulty" value={feasibility.beginnerDifficulty} />
                    <SummaryBadge label="Layers" value={`${feasibility.estimatedLayerCount}`} />
                    <SummaryBadge label="Masking" value={`${feasibility.maskingComplexity}/100`} />
                    <SummaryBadge label="Cost" value={feasibility.paintCostBand} />
                  </div>
                </div>
              ) : null}
              {shoppingList ? (
                <div className="rounded-[20px] border border-white/10 bg-[#0D1117] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#3DD9FF]">
                    Shopping Readiness
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <SummaryBadge label="Primary Items" value={`${shoppingList.primaryItems.length}`} />
                    <SummaryBadge label="Alternates" value={`${shoppingList.alternateItems.length}`} />
                    <SummaryBadge label="Confidence" value={shoppingList.procurementConfidence} />
                    <SummaryBadge
                      label="Affiliate-ready"
                      value={`${shoppingList.purchaseSummary.affiliateReadyCount}`}
                    />
                  </div>
                  {shoppingList.bundles.core[0] ? (
                    <div className="mt-4 rounded-[16px] border border-white/10 bg-black/20 p-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">
                        Core Anchor
                      </p>
                      <p className="mt-2 text-sm text-[#E6EDF3]">
                        {shoppingList.bundles.core[0].brand} {shoppingList.bundles.core[0].code}
                      </p>
                      <p className="mt-1 text-xs text-[#9BA7B4]">
                        {shoppingList.bundles.core[0].colorName}
                      </p>
                    </div>
                  ) : null}
                  {shoppingList.featuredPurchasePath ? (
                    <a
                      href={shoppingList.featuredPurchasePath.url}
                      target="_blank"
                      rel="noreferrer"
                      className={cn(
                        "mt-4 inline-flex h-10 items-center justify-center rounded-[16px] px-4 text-sm text-[#E6EDF3] transition-colors",
                        shoppingList.featuredPurchasePath.type === "affiliate"
                          ? "border border-[#58FFB2]/35 bg-[#13241B] hover:bg-[#193021]"
                          : "border border-[#3DD9FF]/35 bg-[#0E2430] hover:bg-[#123342]"
                      )}
                    >
                      {shoppingList.featuredPurchasePath.type === "affiliate"
                        ? "Open Best Purchase Path"
                        : "Search Best Purchase Path"}
                    </a>
                  ) : null}
                  <ShoppingListActions
                    className="mt-4"
                    data={{
                      conceptTitle: shoppingList.conceptTitle,
                      baseModelName: shoppingList.baseModelName,
                      stylePresetName: shoppingList.stylePresetName,
                      materialPresetName: shoppingList.materialPresetName,
                      bundles: shoppingList.bundles,
                      notes: shoppingList.notes,
                    }}
                  />
                </div>
              ) : null}
              {recommendations ? (
                <div className="rounded-[20px] border border-white/10 bg-[#0D1117] p-4">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[#58FFB2]">
                    Recommendation Bias
                  </p>
                  <p className="mt-3 text-sm leading-6 text-[#C7D0DA]">
                    {recommendations.feasibilityBias === "practical"
                      ? "The recommendation system is currently favoring easier execution and safer procurement paths."
                      : "The recommendation system is currently balanced between visual ambition and practical execution."}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <SummaryBadge label="Style Alternatives" value={`${recommendations.alternativeStyles.length}`} />
                    <SummaryBadge label="Material Alternatives" value={`${recommendations.easierMaterials.length}`} />
                    <SummaryBadge label="Workflow Alternatives" value={`${recommendations.beginnerAlternatives.length}`} />
                    <SummaryBadge label="Sourcing Alternatives" value={`${recommendations.sourcingAlternatives.length}`} />
                  </div>
                </div>
              ) : null}
              {liveJob?.outputSummary?.mimeType ? (
                <SummaryRow label="Output Type" value={liveJob.outputSummary.mimeType} />
              ) : null}
              {liveJob?.providerJobId ? (
                <SummaryRow label="Provider Job" value={liveJob.providerJobId} mono />
              ) : null}
              {liveJob?.errorMessage ? (
                <div className="rounded-[20px] border border-[#FF5F5F]/20 bg-[#FF5F5F]/10 p-4 text-sm leading-6 text-[#FFD5D5]">
                  {liveJob.errorMessage}
                </div>
              ) : null}
              {liveJob?.asset?.publicUrl ? (
                <div className="overflow-hidden rounded-[20px] border border-white/10 bg-[#0D1117]">
                  <Image
                    src={liveJob.asset.publicUrl}
                    alt={`${result.title} preview`}
                    width={1024}
                    height={1024}
                    className="h-auto w-full object-cover"
                  />
                </div>
              ) : liveJob?.status === "succeeded" ? (
                <div className="rounded-[20px] border border-white/10 bg-[#0D1117] p-4 text-sm leading-6 text-[#9BA7B4]">
                  Preview asset was written to R2, but no public URL is attached yet. Current key:
                  <span className="mt-2 block break-all font-mono text-[12px] text-[#E6EDF3]">
                    {liveJob.asset?.key ?? "Unavailable"}
                  </span>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                {liveJob?.status === "succeeded" ? (
                  <Button
                    type="button"
                    onClick={() => {
                      void onRequestHdRender();
                    }}
                    disabled={isQueueingHdRender}
                    className="h-11 rounded-[18px] border border-[#3DD9FF]/40 bg-[#0E2430] text-[#E6EDF3] hover:bg-[#123342]"
                  >
                    {isQueueingHdRender ? "Queueing HD Render" : `Generate HD Render · ${hdCost} credits`}
                  </Button>
                ) : (
                  <Link
                    href="/t/library"
                    className="inline-flex h-11 items-center justify-center rounded-[18px] border border-white/10 bg-[#0D1117] px-4 text-sm font-medium text-[#E6EDF3] transition-colors hover:bg-[#131A22]"
                  >
                    Open Library
                  </Link>
                )}
                <div className="rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-xs leading-5 text-[#9BA7B4]">
                  {liveJob?.status === "succeeded"
                    ? "HD render derives from the stabilized concept and replaces the current preview asset when complete."
                    : "Live telemetry stays subscribed while you remain on this terminal."}
                </div>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-[#0D1117] p-4">
                <p className="text-[11px] uppercase tracking-[0.28em] text-[#3DD9FF]">
                  Prompt Preview
                </p>
                <pre className="mt-3 whitespace-pre-wrap text-xs leading-6 text-[#9BA7B4]">
                  {result.promptPreview}
                </pre>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[20px] border border-white/10 bg-[#0D1117] p-4 text-sm leading-6 text-[#9BA7B4]">
              The system will create:
              <ul className="mt-3 space-y-2">
                <li>`concepts` draft record</li>
                <li>`promptCompositions` package</li>
                <li>`generationJobs` queued shell</li>
                <li>`creditTransactions` debit entry</li>
              </ul>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}

function TelemetryPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "cyan" | "green" | "red";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
        tone === "neutral" && "border-white/10 text-[#9BA7B4]",
        tone === "cyan" && "border-[#3DD9FF]/30 bg-[#3DD9FF]/10 text-[#8FEAFF]",
        tone === "green" && "border-[#58FFB2]/30 bg-[#58FFB2]/10 text-[#A6FFD5]",
        tone === "red" && "border-[#FF5F5F]/30 bg-[#FF5F5F]/10 text-[#FFD2D2]"
      )}
    >
      {label}
    </span>
  );
}

function statusTone(status?: string): "neutral" | "cyan" | "green" | "red" {
  if (status === "queued" || status === "running" || status === "draft") {
    return "cyan";
  }
  if (status === "succeeded" || status === "generated") {
    return "green";
  }
  if (status === "failed") {
    return "red";
  }
  return "neutral";
}

function statusDisplayLabel(status?: string) {
  if (status === "queued") {
    return "QUEUE LOCKED";
  }
  if (status === "running") {
    return "COMPOSING SPRAY PLAN";
  }
  if (status === "succeeded") {
    return "OUTPUT STABILIZED";
  }
  if (status === "failed") {
    return "OUTPUT UNSTABLE";
  }
  return "DISPATCH PENDING";
}

function formatJobKind(kind?: string, renderMode?: string) {
  if (kind === "hd-preview") {
    if (renderMode === "multi-angle-preview") {
      return "Multi-angle Contact Sheet";
    }
    if (renderMode === "high-fidelity-render") {
      return "High-fidelity Render";
    }
    if (renderMode === "weathering-simulation") {
      return "Weathering Simulation";
    }
    if (renderMode === "weathering-split-preview") {
      return "Before / After Weathering Split";
    }
    if (renderMode === "material-finish-comparison") {
      return "Material Finish Comparison";
    }
    if (renderMode === "build-stage-visualization") {
      return "Build-stage Visualization";
    }
    if (renderMode === "hd-render") {
      return "HD Render";
    }
    return "HD Preview";
  }
  if (kind === "palette-plan") {
    return "Palette Plan";
  }
  return "Pending";
}

function StepPanel({
  step,
  title,
  description,
  children,
}: {
  step: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6 text-[#E6EDF3]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[#6E7A88]">{step}</p>
          <h2 className="mt-2 text-2xl font-semibold">{title}</h2>
        </div>
        <p className="max-w-xl text-sm leading-6 text-[#9BA7B4]">{description}</p>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-3">
      <span className="text-[11px] uppercase tracking-[0.24em] text-[#6E7A88]">
        {label}
      </span>
      <span
        className={cn(
          "max-w-[60%] text-right text-sm text-[#E6EDF3]",
          mono && "font-mono text-[12px]"
        )}
      >
        {value}
      </span>
    </div>
  );
}

function SummaryBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">{label}</p>
      <p className="mt-2 text-sm text-[#E6EDF3]">{value}</p>
    </div>
  );
}

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

function formatCreatorPackVariantLabel(value: string) {
  if (value === "baseline") {
    return "Baseline launch";
  }
  if (value === "field") {
    return "Field-worn variant";
  }
  if (value === "stealth") {
    return "Stealth branch";
  }
  if (value === "remix-seed") {
    return "Remix seed branch";
  }
  return value;
}

function clampNotes(notes?: string | null) {
  return notes?.slice(0, 100) ?? "";
}
