import type { Id } from "@/convex/_generated/dataModel";
import type {
  MoodTag,
  PromptLabDraft,
  PromptLabExperimentDraft,
  PromptLabMutationArgs,
  PromptRunStatus,
  WeatheringLevel,
} from "./promptLabTypes";

export const selectedTemplateStorageKey = "neotypelab.admin.selectedTemplateId";
export const promptLabDraftStorageKey = "neotypelab.admin.promptLabDraft";
export const promptLabExperimentDraftStorageKey =
  "neotypelab.admin.promptLabExperimentDraft";

export const moodOptions: Array<{ value: MoodTag; label: string }> = [
  { value: "command-presence", label: "Command" },
  { value: "stealth-tension", label: "Stealth" },
  { value: "industrial-hazard", label: "Hazard" },
  { value: "reactor-glow", label: "Reactor" },
  { value: "field-fatigue", label: "Fatigue" },
  { value: "ceremonial-clean", label: "Ceremonial" },
];

export const weatheringOptions: Array<{
  value: WeatheringLevel;
  label: string;
}> = [
  { value: "clean", label: "Clean" },
  { value: "light", label: "Light" },
  { value: "heavy", label: "Heavy" },
];

export const defaultPromptLabDraft: PromptLabDraft = {
  kitVariantId: "none",
  stylePresetId: "none",
  materialPresetId: "none",
  moodTags: [],
  weatheringLevel: "clean",
  notes: "",
  conceptId: "",
  remixSource: "",
};

export const defaultExperimentDraft: PromptLabExperimentDraft = {
  providerLabel: "",
  modelLabel: "",
  vendorUrl: "",
  parameterNotes: "",
  outputImageUrl: "",
  outputNotes: "",
  failureTags: "",
  styleHitScore: "",
  silhouetteScore: "",
  paintabilityScore: "",
  promptAdherenceScore: "",
  visualImpactScore: "",
  overallScore: "",
  selectedAsWinner: false,
};

export function buildPromptLabArgs(
  promptTemplateId: Id<"promptTemplates">,
  promptTemplateVersionId: Id<"promptTemplateVersions"> | undefined,
  draft: PromptLabDraft
): PromptLabMutationArgs {
  return {
    promptTemplateId,
    promptTemplateVersionId,
    kitVariantId:
      draft.kitVariantId === "none"
        ? undefined
        : (draft.kitVariantId as Id<"baseModels">),
    stylePresetId:
      draft.stylePresetId === "none"
        ? undefined
        : (draft.stylePresetId as Id<"stylePresets">),
    materialPresetId:
      draft.materialPresetId === "none"
        ? undefined
        : (draft.materialPresetId as Id<"materialPresets">),
    moodTags: draft.moodTags,
    weatheringLevel: draft.weatheringLevel,
    notes: emptyToUndefined(draft.notes),
    conceptId: emptyToUndefined(draft.conceptId),
    remixSource: emptyToUndefined(draft.remixSource),
  };
}

export function parseOptionalScore(value: string) {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    throw new Error("Scores must be between 0 and 10");
  }
  return parsed;
}

export function calculateScoreAverage(draft: PromptLabExperimentDraft) {
  const values = [
    draft.styleHitScore,
    draft.silhouetteScore,
    draft.paintabilityScore,
    draft.promptAdherenceScore,
    draft.visualImpactScore,
  ]
    .map((value) => parseOptionalScore(value))
    .filter((value): value is number => value !== undefined);
  if (values.length === 0) return undefined;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

export function resolveOverallScore(draft: PromptLabExperimentDraft) {
  return parseOptionalScore(draft.overallScore) ?? calculateScoreAverage(draft);
}

export function readStoredPromptLabDraft() {
  return readStoredObject(promptLabDraftStorageKey, defaultPromptLabDraft, isPromptLabDraft);
}

export function readStoredExperimentDraft() {
  return readStoredObject(
    promptLabExperimentDraftStorageKey,
    defaultExperimentDraft,
    isExperimentDraft
  );
}

export function readStoredString(key: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

export function writeStoredString(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
}

export function writeStoredJson(key: string, value: unknown) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(key, JSON.stringify(value));
  }
}

export function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function emptyToUndefined(value: string) {
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

export function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(timestamp));
}

export function shortRunId(id: string) {
  return id.slice(-6).toUpperCase();
}

export function statusLabel(status: PromptRunStatus) {
  if (status === "selected") return "Win";
  if (status === "ready-for-web") return "Ready";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function snapshotRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function snapshotName(value: unknown) {
  const record = snapshotRecord(value);
  return typeof record?.name === "string" ? record.name : undefined;
}

function readStoredObject<T>(key: string, fallback: T, guard: (value: unknown) => value is T) {
  const raw = readStoredString(key);
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return guard(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isPromptLabDraft(value: unknown): value is PromptLabDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<PromptLabDraft>;
  return (
    typeof draft.kitVariantId === "string" &&
    typeof draft.stylePresetId === "string" &&
    typeof draft.materialPresetId === "string" &&
    Array.isArray(draft.moodTags) &&
    draft.moodTags.every((tag) => moodOptions.some((option) => option.value === tag)) &&
    weatheringOptions.some((option) => option.value === draft.weatheringLevel) &&
    typeof draft.notes === "string" &&
    typeof draft.conceptId === "string" &&
    typeof draft.remixSource === "string"
  );
}

function isExperimentDraft(value: unknown): value is PromptLabExperimentDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<PromptLabExperimentDraft>;
  return (
    typeof draft.providerLabel === "string" &&
    typeof draft.modelLabel === "string" &&
    typeof draft.vendorUrl === "string" &&
    typeof draft.parameterNotes === "string" &&
    typeof draft.outputImageUrl === "string" &&
    typeof draft.outputNotes === "string" &&
    typeof draft.failureTags === "string" &&
    typeof draft.styleHitScore === "string" &&
    typeof draft.silhouetteScore === "string" &&
    typeof draft.paintabilityScore === "string" &&
    typeof draft.promptAdherenceScore === "string" &&
    typeof draft.visualImpactScore === "string" &&
    typeof draft.overallScore === "string" &&
    typeof draft.selectedAsWinner === "boolean"
  );
}
