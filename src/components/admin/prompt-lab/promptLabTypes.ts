import type { Id } from "@/convex/_generated/dataModel";

export type MoodTag =
  | "command-presence"
  | "stealth-tension"
  | "industrial-hazard"
  | "reactor-glow"
  | "field-fatigue"
  | "ceremonial-clean";

export type WeatheringLevel = "clean" | "light" | "heavy";
export type PromptRunStatus =
  | "ready-for-web"
  | "tested"
  | "selected"
  | "rejected"
  | "archived";
export type PromptVersionStatus = "draft" | "published" | "archived";
export type PromptViewerTab = "system" | "user" | "full";

export type PromptLabDraft = {
  kitVariantId: string;
  stylePresetId: string;
  materialPresetId: string;
  moodTags: MoodTag[];
  weatheringLevel: WeatheringLevel;
  notes: string;
  conceptId: string;
  remixSource: string;
};

export type PromptLabExperimentDraft = {
  providerLabel: string;
  modelLabel: string;
  vendorUrl: string;
  parameterNotes: string;
  outputImageUrl: string;
  outputNotes: string;
  failureTags: string;
  styleHitScore: string;
  silhouetteScore: string;
  paintabilityScore: string;
  promptAdherenceScore: string;
  visualImpactScore: string;
  overallScore: string;
  selectedAsWinner: boolean;
};

export type PromptLabResult = {
  composedPrompt: string;
  negativePrompt?: string;
  warnings: string[];
  usedVariables: string[];
  availableVariables: string[];
  copyBlocks: {
    systemPrompt: string;
    userPrompt: string;
    negativePrompt: string;
  };
  inputSnapshot: unknown;
  templateSnapshot: unknown;
};

export type PromptTemplateVersionRecord = {
  _id: Id<"promptTemplateVersions"> | null;
  version: string;
  status: PromptVersionStatus;
  updatedAt: number;
};

export type PromptTemplateRecord = {
  _id: Id<"promptTemplates">;
  _creationTime: number;
  name: string;
  slug: string;
  kind: string;
  version: string;
  isActive: boolean;
  versions: PromptTemplateVersionRecord[];
};

export type PromptCatalogOption = {
  _id: string;
  name: string;
  slug: string;
};

export type PromptCatalogData = {
  kitVariants: PromptCatalogOption[];
  stylePresets: PromptCatalogOption[];
  materialPresets: PromptCatalogOption[];
};

export type PromptExperimentRun = {
  _id: Id<"promptExperimentRuns">;
  _creationTime: number;
  templateKind: string;
  templateName: string;
  templateVersion: string;
  promptTemplateId?: Id<"promptTemplates">;
  promptTemplateVersionId?: Id<"promptTemplateVersions">;
  composedPrompt: string;
  negativePrompt?: string;
  source: "manual-web" | "api";
  status: PromptRunStatus;
  providerLabel?: string;
  modelLabel?: string;
  vendorUrl?: string;
  parameterNotes?: string;
  outputImageUrl?: string;
  outputNotes?: string;
  failureTags: string[];
  styleHitScore?: number;
  silhouetteScore?: number;
  paintabilityScore?: number;
  promptAdherenceScore?: number;
  visualImpactScore?: number;
  overallScore?: number;
  selectedAsWinner: boolean;
  inputSnapshot: Record<string, unknown> | null;
  templateSnapshot: Record<string, unknown> | null;
  actor: {
    _id: Id<"users">;
    fullName?: string;
    email: string;
    handle?: string;
  } | null;
};

export type PromptRunRegistryResult = {
  page: PromptExperimentRun[];
  selectedRun: PromptExperimentRun | null;
  pageIndex: number;
  pageSize: number;
  pageCount: number;
  filteredTotal: number;
  allTotal: number;
  providers: string[];
};

export type PromptRunFilters = {
  search: string;
  templateId: string;
  provider: string;
  status: "all" | PromptRunStatus;
};

export type PromptLabMutationArgs = {
  promptTemplateId: Id<"promptTemplates">;
  promptTemplateVersionId?: Id<"promptTemplateVersions">;
  kitVariantId?: Id<"baseModels">;
  stylePresetId?: Id<"stylePresets">;
  materialPresetId?: Id<"materialPresets">;
  moodTags: MoodTag[];
  weatheringLevel: WeatheringLevel;
  notes?: string;
  conceptId?: string;
  remixSource?: string;
};
