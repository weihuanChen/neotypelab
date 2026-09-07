"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useAuth, useUser } from "@clerk/tanstack-react-start";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "@tanstack/react-router";
import { ReactNode, useEffect, useMemo, useState } from "react";

type TemplateDraft = {
  promptTemplateId: string;
  name: string;
  version: string;
  notePolicy: string;
  systemPrompt: string;
  userPromptTemplate: string;
  negativePromptTemplate: string;
  isActive: boolean;
};

type PromptLabDraft = {
  kitVariantId: string;
  stylePresetId: string;
  materialPresetId: string;
  moodTags: MoodTag[];
  weatheringLevel: WeatheringLevel;
  notes: string;
  conceptId: string;
  remixSource: string;
};

type PromptLabResult = {
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

type PromptLabExperimentDraft = {
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

type MoodTag =
  | "command-presence"
  | "stealth-tension"
  | "industrial-hazard"
  | "reactor-glow"
  | "field-fatigue"
  | "ceremonial-clean";

type WeatheringLevel = "clean" | "light" | "heavy";

type PriceRuleDraft = {
  label: string;
  creditCost: string;
  description: string;
  isActive: boolean;
};

type CreditCampaignDraft = {
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  defaultCreditAmount: string;
  maxRedemptions: string;
  perUserLimit: string;
  isActive: boolean;
};

type CodeBatchDraft = {
  count: string;
  creditAmount: string;
  maxRedemptionsPerCode: string;
  prefix: string;
  expiresAt: string;
};

type FeedbackDraft = {
  adminNotes: string;
  priority: string;
  queueStatus: "open" | "in-review" | "done";
  status: "open" | "triaged" | "resolved";
};

type StylePresetDraft = {
  name: string;
  category: string;
  shortDescription: string;
  contrastLevel: string;
  weatheringProfile: string;
  promptKeywords: string;
  negativeKeywords: string;
  recommendedMaterialSlugs: string;
  seoKeywords: string;
  systemPromptFragment: string;
  promptVersion: string;
  visibilityWeight: string;
  creatorUserId: string;
  isFeaturedStyle: boolean;
  isActive: boolean;
};

type MaterialPresetDraft = {
  name: string;
  finishType: string;
  reflectivityLevel: string;
  promptKeywords: string;
  paintFinish: string;
  difficultyLevel: string;
  sheenLevel: string;
  shortDescription: string;
  isActive: boolean;
};

type PaintMappingDraft = {
  brand: string;
  line: string;
  code: string;
  colorName: string;
  finishType: string;
  paintType: string;
  availabilityRegion: string;
  affiliateUrl: string;
  hexPreview: string;
  isActive: boolean;
};

type CreatorPackDraft = {
  name: string;
  creatorUserId: string;
  description: string;
  tagline: string;
  stylePresetIds: string;
  kitVariantIds: string;
  materialPresetIds: string;
  packType: "free" | "premium";
  isFeatured: boolean;
  isActive: boolean;
};

type FlagTone = "neutral" | "cyan" | "green" | "amber" | "red";
export type AdminSectionId = "templates" | "prompt-lab" | "ops" | "access" | "commerce" | "catalog";

type AdminSection = {
  id: AdminSectionId;
  label: string;
  eyebrow: string;
  description: string;
  metric: string;
  tone: FlagTone;
};

const promptLabMoodOptions: Array<{
  value: MoodTag;
  label: string;
}> = [
  { value: "command-presence", label: "Command" },
  { value: "stealth-tension", label: "Stealth" },
  { value: "industrial-hazard", label: "Hazard" },
  { value: "reactor-glow", label: "Reactor" },
  { value: "field-fatigue", label: "Fatigue" },
  { value: "ceremonial-clean", label: "Ceremonial" },
];

const promptLabWeatheringOptions: Array<{
  value: WeatheringLevel;
  label: string;
}> = [
  { value: "clean", label: "Clean" },
  { value: "light", label: "Light" },
  { value: "heavy", label: "Heavy" },
];

const defaultPromptLabDraft: PromptLabDraft = {
  kitVariantId: "none",
  stylePresetId: "none",
  materialPresetId: "none",
  moodTags: [],
  weatheringLevel: "clean",
  notes: "",
  conceptId: "",
  remixSource: "",
};

const defaultPromptLabExperimentDraft: PromptLabExperimentDraft = {
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

const adminSelectedTemplateStorageKey = "neotypelab.admin.selectedTemplateId";
const promptLabDraftStorageKey = "neotypelab.admin.promptLabDraft";
const promptLabExperimentDraftStorageKey = "neotypelab.admin.promptLabExperimentDraft";

export function AdminWorkbench({
  catalogScope,
  section,
  workspaceOnly = false,
}: {
  catalogScope?: "styles" | "materials" | "paints" | "creator-packs";
  section?: AdminSectionId;
  workspaceOnly?: boolean;
} = {}) {
  const navigate = useNavigate();
  const { getToken, isLoaded: isClerkLoaded, isSignedIn, sessionId } = useAuth();
  const { user } = useUser();
  const viewer = useQuery(api.users.viewer);
  const accessStatus = useQuery(api.users.adminAccessStatus);
  const canManagePlatform = Boolean(viewer?.canManagePlatform);
  const overview = useQuery(api.admin.overview, canManagePlatform ? {} : "skip");
  const auditLog = useQuery(api.admin.listAuditLog, canManagePlatform ? {} : "skip");
  const feedbackPipeline = useQuery(
    api.admin.listFeedbackPipeline,
    canManagePlatform ? {} : "skip"
  );
  const catalogData = useQuery(api.admin.listCatalogData, canManagePlatform ? {} : "skip");

  const [userSearch, setUserSearch] = useState("");
  const users = useQuery(
    api.admin.listUsers,
    canManagePlatform ? { search: userSearch.trim() || undefined } : "skip"
  );
  const promptTemplates = useQuery(api.admin.listPromptTemplates, canManagePlatform ? {} : "skip");
  const promptExperimentRuns = useQuery(
    api.admin.listPromptExperimentRuns,
    canManagePlatform ? {} : "skip"
  );
  const priceRules = useQuery(api.admin.listPriceRules, canManagePlatform ? {} : "skip");
  const creditCampaigns = useQuery(
    api.creditCampaigns.listAdminCampaigns,
    canManagePlatform ? {} : "skip"
  );

  const adjustUserCredits = useMutation(api.admin.adjustUserCredits);
  const createCreditCampaign = useMutation(api.creditCampaigns.createCampaign);
  const updateCreditCampaign = useMutation(api.creditCampaigns.updateCampaign);
  const generateActivationCodes = useMutation(api.creditCampaigns.generateActivationCodes);
  const setActivationCodeActive = useMutation(api.creditCampaigns.setActivationCodeActive);
  const updateUserAccess = useMutation(api.admin.updateUserAccess);
  const updatePromptTemplate = useMutation(api.admin.updatePromptTemplate);
  const composePromptLabPreview = useMutation(api.admin.composePromptLabPreview);
  const savePromptExperimentRun = useMutation(api.admin.savePromptExperimentRun);
  const updatePromptExperimentRun = useMutation(api.admin.updatePromptExperimentRun);
  const updatePriceRule = useMutation(api.admin.updatePriceRule);
  const reviewFeedback = useMutation(api.admin.reviewFeedback);
  const updateStylePreset = useMutation(api.admin.updateStylePreset);
  const updateMaterialPreset = useMutation(api.admin.updateMaterialPreset);
  const updatePaintMapping = useMutation(api.admin.updatePaintMapping);
  const upsertCreatorPack = useMutation(api.admin.upsertCreatorPack);
  const storeUser = useMutation(api.users.store);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [clerkTokenStatus, setClerkTokenStatus] = useState<string>("Not checked");
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSectionId>(() =>
    section ?? readInitialAdminSection()
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(() =>
    readStoredString(adminSelectedTemplateStorageKey)
  );
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [promptLabDraft, setPromptLabDraft] = useState<PromptLabDraft>(() =>
    readStoredPromptLabDraft()
  );
  const [promptLabExperimentDraft, setPromptLabExperimentDraft] =
    useState<PromptLabExperimentDraft>(() => readStoredPromptLabExperimentDraft());
  const [promptLabResult, setPromptLabResult] = useState<PromptLabResult | null>(null);
  const [copiedPromptKey, setCopiedPromptKey] = useState<string | null>(null);
  const [priceRuleDrafts, setPriceRuleDrafts] = useState<Record<string, PriceRuleDraft>>({});
  const [newCreditCampaignDraft, setNewCreditCampaignDraft] = useState<CreditCampaignDraft>(
    defaultCreditCampaignDraft
  );
  const [creditCampaignDrafts, setCreditCampaignDrafts] = useState<Record<string, CreditCampaignDraft>>({});
  const [codeBatchDrafts, setCodeBatchDrafts] = useState<Record<string, CodeBatchDraft>>({});
  const [generatedCodeBatches, setGeneratedCodeBatches] = useState<Record<string, string[]>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, FeedbackDraft>>({});
  const [stylePresetDrafts, setStylePresetDrafts] = useState<Record<string, StylePresetDraft>>({});
  const [materialPresetDrafts, setMaterialPresetDrafts] = useState<Record<string, MaterialPresetDraft>>({});
  const [paintMappingDrafts, setPaintMappingDrafts] = useState<Record<string, PaintMappingDraft>>({});
  const [creatorPackDrafts, setCreatorPackDrafts] = useState<Record<string, CreatorPackDraft>>({
    __new__: defaultCreatorPackDraft(),
  });
  const newCreatorPackDraft = creatorPackDrafts.__new__;
  const catalogOpsCount =
    (catalogData?.stylePresets.length ?? 0) +
    (catalogData?.materialPresets.length ?? 0) +
    (catalogData?.paintMappings.length ?? 0) +
    (catalogData?.creatorPacks.length ?? 0);

  const adminSections: AdminSection[] = [
    {
      id: "templates",
      label: "Templates",
      eyebrow: "Prompt workbench",
      description: "Edit prompt composition, versions, activation state, and policy text.",
      metric: `${overview?.activePromptTemplateCount ?? 0}/${overview?.promptTemplateCount ?? 0}`,
      tone: "green",
    },
    {
      id: "prompt-lab",
      label: "Prompt Lab",
      eyebrow: "Manual tests",
      description: "Compose project prompts, copy them to vendor web tools, and log A/B results.",
      metric: `${promptExperimentRuns?.length ?? 0}`,
      tone: "amber",
    },
    {
      id: "ops",
      label: "Ops Queue",
      eyebrow: "Triage",
      description: "Route feedback reports, assign ownership, and resolve generation issues.",
      metric: `${overview?.openFeedbackCount ?? feedbackPipeline?.length ?? 0}`,
      tone: "cyan",
    },
    {
      id: "access",
      label: "Access",
      eyebrow: "Users",
      description: "Manage admins, plans, credits, and creator verification states.",
      metric: `${overview?.adminCount ?? 0}`,
      tone: "amber",
    },
    {
      id: "commerce",
      label: "Commerce",
      eyebrow: "Credits",
      description: "Tune credit campaigns, activation codes, and charge rules.",
      metric: `${creditCampaigns?.length ?? 0}`,
      tone: "red",
    },
    {
      id: "catalog",
      label: "Catalog",
      eyebrow: "Content ops",
      description: "Maintain Style DNA, materials, paint maps, and creator packs.",
      metric: `${catalogOpsCount}`,
      tone: "neutral",
    },
  ];

  const handleAdminSectionChange = (section: AdminSectionId) => {
    if (workspaceOnly) {
      const routes: Record<AdminSectionId, string> = {
        templates: "/admin/templates",
        "prompt-lab": "/admin/prompt-lab",
        ops: "/admin/feedback",
        access: "/admin/users",
        commerce: "/admin/credits",
        catalog: "/admin/styles",
      };
      void navigate({ to: routes[section] as never });
      return;
    }
    setActiveAdminSection(section);
    writeAdminSectionHash(section);
  };

  const selectedTemplate = useMemo(() => {
    if (!promptTemplates || promptTemplates.length === 0) {
      return null;
    }
    return (
      promptTemplates.find((template) => template._id === selectedTemplateId) ??
      promptTemplates[0]
    );
  }, [promptTemplates, selectedTemplateId]);

  const activeTemplateDraft = useMemo(() => {
    if (!selectedTemplate) {
      return null;
    }
    if (templateDraft?.promptTemplateId === selectedTemplate._id) {
      return templateDraft;
    }
    return createTemplateDraft(selectedTemplate);
  }, [selectedTemplate, templateDraft]);

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateDraft(null);
      return;
    }
    setSelectedTemplateId(selectedTemplate._id);
    setTemplateDraft((current) =>
      current?.promptTemplateId === selectedTemplate._id
        ? current
        : createTemplateDraft(selectedTemplate)
    );
  }, [selectedTemplate]);

  useEffect(() => {
    if (section) {
      setActiveAdminSection(section);
    }
  }, [section]);

  useEffect(() => {
    if (section) {
      return;
    }
    if (typeof window === "undefined") {
      return;
    }
    const handleHashChange = () => {
      setActiveAdminSection(readInitialAdminSection());
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [section]);

  useEffect(() => {
    writeStoredString(adminSelectedTemplateStorageKey, selectedTemplateId);
  }, [selectedTemplateId]);

  useEffect(() => {
    writeStoredJson(promptLabDraftStorageKey, promptLabDraft);
  }, [promptLabDraft]);

  useEffect(() => {
    writeStoredJson(promptLabExperimentDraftStorageKey, promptLabExperimentDraft);
  }, [promptLabExperimentDraft]);

  useEffect(() => {
    if (!isClerkLoaded || !isSignedIn || clerkTokenStatus !== "Not checked") {
      return;
    }

    let canceled = false;

    void getToken({ template: "convex" })
      .then((token) => {
        if (canceled) {
          return;
        }
        setClerkTokenStatus(
          token
            ? `Token received (${token.slice(0, 18)}...)`
            : 'No token returned from Clerk for template "convex"'
        );
      })
      .catch((error) => {
        if (canceled) {
          return;
        }
        setClerkTokenStatus(`Token check failed: ${formatClerkError(error)}`);
      });

    return () => {
      canceled = true;
    };
  }, [clerkTokenStatus, getToken, isClerkLoaded, isSignedIn]);

  if (viewer === undefined) {
    return (
      <section className="border-2 border-line-primary bg-surface p-6 text-ink-primary">
        <p className="text-xs uppercase tracking-[0.3em] text-accent-orange">Admin boot</p>
        <h2 className="mt-3 text-3xl font-semibold">Resolving operator privileges</h2>
      </section>
    );
  }

  if (!viewer?.canManagePlatform) {
    return (
      <div className="space-y-6">
        <section className="rounded-[28px] border border-accent-red bg-surface p-6 text-ink-primary">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-red">Access locked</p>
          <h2 className="mt-3 text-3xl font-semibold">Super admin clearance required</h2>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-secondary">
            The current viewer record is not being recognized as a platform admin. Use the
            diagnostics below to confirm which Clerk identity and Convex deployment are active.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <ActionButton
              onClick={() =>
                void runAdminAction({
                  key: "resync-user",
                  action: async () => {
                    await storeUser();
                  },
                  success: "Re-synced viewer profile from Clerk into Convex.",
                  setBusyKey,
                  setErrorMessage,
                  setStatusMessage,
                })
              }
              busy={busyKey === "resync-user"}
            >
              Re-sync Operator Profile
            </ActionButton>
            <ActionButton
              onClick={() =>
                void runAdminAction({
                  key: "check-clerk-token",
                  action: async () => {
                    const token = await getToken({ template: "convex" });
                    setClerkTokenStatus(
                      token
                        ? `Token received (${token.slice(0, 18)}...)`
                        : "No token returned from Clerk for template \"convex\""
                    );
                  },
                  success: "Checked Clerk convex token.",
                  setBusyKey,
                  setErrorMessage,
                  setStatusMessage,
                })
              }
              busy={busyKey === "check-clerk-token"}
            >
              Check Clerk Token
            </ActionButton>
          </div>
        </section>

        {statusMessage ? (
          <div className="rounded-[20px] border border-accent-teal bg-accent-teal/10 p-4 text-sm text-accent-teal">
            {statusMessage}
          </div>
        ) : null}
        {errorMessage ? (
          <div className="rounded-[20px] border border-accent-red bg-accent-red/10 p-4 text-sm text-accent-red">
            {errorMessage}
          </div>
        ) : null}

        <section className="border-2 border-line-primary bg-surface p-6 text-ink-primary">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">Access diagnostics</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <DiagnosticRow label="Clerk Loaded" value={String(isClerkLoaded)} />
            <DiagnosticRow label="Clerk Signed In" value={String(Boolean(isSignedIn))} />
            <DiagnosticRow label="Clerk User Email" value={user?.primaryEmailAddress?.emailAddress ?? "Missing"} />
            <DiagnosticRow label="Clerk Session ID" value={sessionId ?? "Missing"} mono />
            <DiagnosticRow label="Clerk Convex Token" value={clerkTokenStatus} mono />
            <DiagnosticRow label="Connected Deployment" value={accessStatus?.connectedDeploymentUrl ?? "Resolving"} mono />
            <DiagnosticRow label="Clerk Identity Email" value={accessStatus?.identityEmail ?? "Missing"} />
            <DiagnosticRow label="Identity Is Super Admin" value={String(accessStatus?.identityIsSuperAdmin ?? false)} />
            <DiagnosticRow label="Viewer Found" value={String(accessStatus?.viewerFound ?? false)} />
            <DiagnosticRow label="Viewer Email" value={accessStatus?.viewerEmail ?? "No viewer row"} />
            <DiagnosticRow label="Viewer Handle" value={accessStatus?.viewerHandle ?? "No viewer row"} />
            <DiagnosticRow label="Viewer Is Admin" value={String(accessStatus?.viewerIsAdmin ?? false)} />
            <DiagnosticRow label="Viewer Is Super Admin" value={String(accessStatus?.viewerIsSuperAdmin ?? false)} />
            <DiagnosticRow label="Can Manage Platform" value={String(accessStatus?.canManagePlatform ?? false)} />
            <DiagnosticRow label="Credit Balance" value={String(accessStatus?.creditBalance ?? 0)} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={cn("admin-workbench space-y-6 text-ink-primary", workspaceOnly && "is-workspace-only", workspaceOnly && `is-${activeAdminSection}-workspace`)}>
      {!workspaceOnly ? (
        <>
      <section className="border-2 border-line-primary bg-panel p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-accent-orange">Admin terminal</p>
        <h2 className="mt-3 text-3xl font-semibold">Super admin control surface</h2>
        <p className="mt-4 max-w-4xl text-sm leading-6 text-ink-secondary">
          This console governs user access, credits, charge rules, and prompt templates.
          All mutations write into `adminAuditLogs` for traceability.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <FlagPill label={viewer.isSuperAdmin ? "Env Super Admin" : "Manual Admin"} tone="amber" />
          <FlagPill label={`Operator ${viewer.handle}`} tone="cyan" />
          <FlagPill label={`${viewer.credits.balance} personal credits`} tone="neutral" />
        </div>
      </section>

      {statusMessage ? (
        <div className="rounded-[20px] border border-accent-teal bg-accent-teal/10 p-4 text-sm text-accent-teal">
          {statusMessage}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="rounded-[20px] border border-accent-red bg-accent-red/10 p-4 text-sm text-accent-red">
          {errorMessage}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Operators"
          value={`${overview?.userCount ?? 0}`}
          detail={`${overview?.adminCount ?? 0} admins / ${overview?.superAdminCount ?? 0} env super admins`}
        />
        <MetricCard
          label="Credits"
          value={`${overview?.totalCreditBalance ?? 0}`}
          detail="Live balance across all credit accounts"
        />
        <MetricCard
          label="Prompt Templates"
          value={`${overview?.promptTemplateCount ?? 0}`}
          detail={`${overview?.activePromptTemplateCount ?? 0} active templates`}
        />
        <MetricCard
          label="Generation Faults"
          value={`${overview?.failedGenerationCount ?? 0}`}
          detail={`${overview?.queuedGenerationCount ?? 0} queued / ${overview?.openFeedbackCount ?? 0} open feedback`}
        />
      </section>

      <AdminSectionNav
        activeSection={activeAdminSection}
        onSectionChange={handleAdminSectionChange}
        sections={adminSections}
      />
        </>
      ) : null}

      {activeAdminSection === "ops" ? (
      <section className="border-2 border-line-primary bg-surface p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">Feedback triage</p>
            <h3 className="mt-2 text-2xl font-semibold">Expansion queue and lab reports</h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-ink-secondary">
            Route incoming model requests, generation quality reports, and paint mapping
            issues through a controlled admin queue. This is the operational half of the
            P1 feedback pipeline.
          </p>
        </div>
        <div className="mt-5 grid gap-4">
          {feedbackPipeline === undefined ? (
            <div className="rounded-[20px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
              Loading structured feedback reports.
            </div>
          ) : feedbackPipeline.length === 0 ? (
            <div className="rounded-[20px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
              No feedback reports have entered the queue yet.
            </div>
          ) : (
            feedbackPipeline.map((report) => {
              const draft = feedbackDrafts[report._id] ?? {
                adminNotes: report.adminNotes ?? "",
                priority: String(report.queue?.priority ?? 20),
                queueStatus: report.queue?.status ?? "open",
                status: report.status,
              };
              return (
                <article
                  key={report._id}
                  className="rounded-[22px] border border-line-secondary bg-panel p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <FlagPill label={report.category} tone="cyan" />
                        <FlagPill label={report.status} tone={feedbackStatusTone(report.status)} />
                        <FlagPill
                          label={report.queue?.status ?? "no queue"}
                          tone={queueStatusTone(report.queue?.status)}
                        />
                        <FlagPill
                          label={`priority ${report.queue?.priority ?? draft.priority}`}
                          tone="amber"
                        />
                      </div>
                      <h4 className="mt-3 text-xl font-semibold">
                        {report.reporter?.fullName ?? "Unknown operator"}
                      </h4>
                      <p className="mt-1 text-sm text-ink-secondary">
                        {report.reporter?.email ?? "No reporter email"} · @{report.reporter?.handle ?? "unknown"}
                      </p>
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-primary">
                        {report.message}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-4 text-xs text-ink-secondary">
                        {report.kitVariant ? <span>Kit Variant: {report.kitVariant.name}</span> : null}
                        {report.stylePreset ? <span>Style DNA: {report.stylePreset.name}</span> : null}
                        {report.concept ? <span>Concept: {report.concept.title}</span> : null}
                        {report.generationJob ? (
                          <span>
                            Job: {report.generationJob.status} / {report.generationJob.provider ?? "provider pending"}
                          </span>
                        ) : null}
                        {report.sourcePage ? <span>Source: {report.sourcePage}</span> : null}
                      </div>
                    </div>

                    <div className="w-full max-w-[360px] rounded-[20px] border border-line-secondary bg-main p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                        Queue Summary
                      </p>
                      <div className="mt-3 space-y-3 text-sm">
                        <MetaRow
                          label="Assigned"
                          value={
                            report.queue?.assignedToUserId === viewer._id
                              ? "You"
                              : report.queue?.assignedToUserId
                                ? "Another admin"
                                : "Unassigned"
                          }
                        />
                        <MetaRow label="Queue" value={report.queue?.status ?? "Missing"} />
                        <MetaRow label="Feedback" value={report.status} />
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px_220px]">
                    <Field label="Admin Notes">
                      <Textarea
                        value={draft.adminNotes}
                        onChange={(event) =>
                          setFeedbackDrafts((current) => ({
                            ...current,
                            [report._id]: { ...draft, adminNotes: event.target.value },
                          }))
                        }
                        className="min-h-[130px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal"
                      />
                    </Field>
                    <Field label="Feedback Status">
                      <Select
                        value={draft.status}
                        onValueChange={(value: "open" | "triaged" | "resolved") =>
                          setFeedbackDrafts((current) => ({
                            ...current,
                            [report._id]: { ...draft, status: value },
                          }))
                        }
                      >
                        <SelectTrigger className="h-11 border-line-secondary bg-main text-ink-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="triaged">Triaged</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="mt-4">
                        <Field label="Priority">
                          <Input
                            type="number"
                            min="1"
                            value={draft.priority}
                            onChange={(event) =>
                              setFeedbackDrafts((current) => ({
                                ...current,
                                [report._id]: { ...draft, priority: event.target.value },
                              }))
                            }
                            className="h-11 border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal"
                          />
                        </Field>
                      </div>
                    </Field>
                    <Field label="Queue Status">
                      <Select
                        value={draft.queueStatus}
                        onValueChange={(value: "open" | "in-review" | "done") =>
                          setFeedbackDrafts((current) => ({
                            ...current,
                            [report._id]: { ...draft, queueStatus: value },
                          }))
                        }
                      >
                        <SelectTrigger className="h-11 border-line-secondary bg-main text-ink-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="in-review">In Review</SelectItem>
                          <SelectItem value="done">Done</SelectItem>
                        </SelectContent>
                      </Select>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <ActionButton
                          onClick={() =>
                            void runAdminAction({
                              key: `feedback-assign-${report._id}`,
                              action: async () => {
                                await reviewFeedback({
                                  feedbackId: report._id,
                                  adminNotes: draft.adminNotes.trim() || undefined,
                                  status: draft.status,
                                  queueStatus: "in-review",
                                  priority: Number(draft.priority),
                                  assignToSelf: true,
                                });
                              },
                              success: `Assigned feedback ${report._id} to your review queue.`,
                              setBusyKey,
                              setErrorMessage,
                              setStatusMessage,
                            })
                          }
                          busy={busyKey === `feedback-assign-${report._id}`}
                        >
                          Assign To Me
                        </ActionButton>
                        <ActionButton
                          onClick={() =>
                            void runAdminAction({
                              key: `feedback-save-${report._id}`,
                              action: async () => {
                                await reviewFeedback({
                                  feedbackId: report._id,
                                  adminNotes: draft.adminNotes.trim() || undefined,
                                  status: draft.status,
                                  queueStatus: draft.queueStatus,
                                  priority: Number(draft.priority),
                                });
                              },
                              success: `Saved triage state for feedback ${report._id}.`,
                              setBusyKey,
                              setErrorMessage,
                              setStatusMessage,
                            })
                          }
                          busy={busyKey === `feedback-save-${report._id}`}
                        >
                          Save Triage
                        </ActionButton>
                      </div>
                    </Field>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      ) : null}

      {activeAdminSection === "access" ? (
      <div className={cn("grid gap-6", !workspaceOnly && "xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]")}>
        <section className="border-2 border-line-primary bg-surface p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">User control</p>
              <h3 className="mt-2 text-2xl font-semibold">Accounts, roles, and credits</h3>
            </div>
            <Input
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search email, handle, or operator"
              className="h-11 w-full max-w-sm border-line-secondary bg-main text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-blue"
            />
          </div>
          <div className="mt-5 space-y-4">
            {users === undefined ? (
              <div className="rounded-[20px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
                Syncing operator roster.
              </div>
            ) : (
              users.map((user) => (
                <article
                  key={user._id}
                  className="rounded-[22px] border border-line-secondary bg-panel p-4"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <FlagPill label={user.planType} tone="cyan" />
                        <FlagPill label={user.accountStatus} tone={user.accountStatus === "active" ? "green" : "red"} />
                        {user.canManagePlatform ? (
                          <FlagPill label={user.isSuperAdmin ? "super admin" : "admin"} tone="amber" />
                        ) : null}
                        {user.isVerifiedCreator ? <FlagPill label="verified creator" tone="green" /> : null}
                        {user.isFeaturedCreator ? <FlagPill label="featured creator" tone="cyan" /> : null}
                      </div>
                      <h4 className="mt-3 text-xl font-semibold">{user.fullName}</h4>
                      <p className="mt-1 text-sm text-ink-secondary">
                        {user.email} · @{user.handle}
                      </p>
                      {user.creatorTagline ? (
                        <p className="mt-2 text-sm text-ink-muted">{user.creatorTagline}</p>
                      ) : null}
                      {user.creatorSpecialties.length > 0 ? (
                        <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink-muted">
                          {user.creatorSpecialties.join(" / ")}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid min-w-[220px] gap-2 rounded-[18px] border border-line-secondary bg-main p-3 text-sm">
                      <MetaRow label="Balance" value={`${user.credits.balance}`} />
                      <MetaRow label="Granted" value={`${user.credits.lifetimeGranted}`} />
                      <MetaRow label="Spent" value={`${user.credits.lifetimeSpent}`} />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <div className="admin-user-credit-actions contents">
                    <ActionButton
                      onClick={() =>
                        void runAdminAction({
                          key: `credit-${user._id}-plus10`,
                          action: async () => {
                            await adjustUserCredits({
                              userId: user._id,
                              delta: 10,
                              description: `Manual credit grant +10 to ${user.email}`,
                            });
                          },
                          success: `Granted 10 credits to ${user.email}.`,
                          setBusyKey,
                          setErrorMessage,
                          setStatusMessage,
                        })
                      }
                      busy={busyKey === `credit-${user._id}-plus10`}
                    >
                      Grant +10
                    </ActionButton>
                    <ActionButton
                      onClick={() =>
                        void runAdminAction({
                          key: `credit-${user._id}-minus10`,
                          action: async () => {
                            await adjustUserCredits({
                              userId: user._id,
                              delta: -10,
                              description: `Manual credit debit -10 from ${user.email}`,
                            });
                          },
                          success: `Debited 10 credits from ${user.email}.`,
                          setBusyKey,
                          setErrorMessage,
                          setStatusMessage,
                        })
                      }
                      busy={busyKey === `credit-${user._id}-minus10`}
                      tone="danger"
                    >
                      Debit -10
                    </ActionButton>
                    </div>
                    <ActionButton
                      onClick={() =>
                        void runAdminAction({
                          key: `access-${user._id}-admin`,
                          action: async () => {
                            await updateUserAccess({
                              userId: user._id,
                              isAdmin: !user.canManagePlatform,
                            });
                          },
                          success: user.canManagePlatform
                            ? `Removed manual admin access from ${user.email}.`
                            : `Promoted ${user.email} to admin.`,
                          setBusyKey,
                          setErrorMessage,
                          setStatusMessage,
                        })
                      }
                      busy={busyKey === `access-${user._id}-admin`}
                      disabled={user.isSuperAdmin}
                    >
                      {user.isSuperAdmin
                        ? "Env Locked"
                        : user.canManagePlatform
                          ? "Demote Admin"
                          : "Promote Admin"}
                    </ActionButton>
                    <ActionButton
                      onClick={() =>
                        void runAdminAction({
                          key: `access-${user._id}-plan`,
                          action: async () => {
                            await updateUserAccess({
                              userId: user._id,
                              planType: user.planType === "free" ? "pro" : "free",
                            });
                          },
                          success: `Updated ${user.email} plan to ${
                            user.planType === "free" ? "pro" : "free"
                          }.`,
                          setBusyKey,
                          setErrorMessage,
                          setStatusMessage,
                        })
                      }
                      busy={busyKey === `access-${user._id}-plan`}
                    >
                      {user.planType === "free" ? "Set Pro" : "Set Free"}
                    </ActionButton>
                    <ActionButton
                      onClick={() =>
                        void runAdminAction({
                          key: `access-${user._id}-status`,
                          action: async () => {
                            await updateUserAccess({
                              userId: user._id,
                              accountStatus: user.accountStatus === "active" ? "suspended" : "active",
                            });
                          },
                          success: `Updated ${user.email} account status.`,
                          setBusyKey,
                          setErrorMessage,
                          setStatusMessage,
                        })
                      }
                      busy={busyKey === `access-${user._id}-status`}
                      tone={user.accountStatus === "active" ? "danger" : "default"}
                    >
                      {user.accountStatus === "active" ? "Suspend" : "Activate"}
                    </ActionButton>
                    <ActionButton
                      onClick={() =>
                        void runAdminAction({
                          key: `access-${user._id}-creator-verified`,
                          action: async () => {
                            await updateUserAccess({
                              userId: user._id,
                              isVerifiedCreator: !user.isVerifiedCreator,
                            });
                          },
                          success: `Updated verified creator state for ${user.email}.`,
                          setBusyKey,
                          setErrorMessage,
                          setStatusMessage,
                        })
                      }
                      busy={busyKey === `access-${user._id}-creator-verified`}
                    >
                      {user.isVerifiedCreator ? "Remove Verified" : "Mark Verified"}
                    </ActionButton>
                    <ActionButton
                      onClick={() =>
                        void runAdminAction({
                          key: `access-${user._id}-creator-featured`,
                          action: async () => {
                            await updateUserAccess({
                              userId: user._id,
                              isFeaturedCreator: !user.isFeaturedCreator,
                            });
                          },
                          success: `Updated featured creator state for ${user.email}.`,
                          setBusyKey,
                          setErrorMessage,
                          setStatusMessage,
                        })
                      }
                      busy={busyKey === `access-${user._id}-creator-featured`}
                    >
                      {user.isFeaturedCreator ? "Unfeature Creator" : "Feature Creator"}
                    </ActionButton>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        {!workspaceOnly ? <aside className="space-y-6">
          <section className="border-2 border-line-primary bg-surface p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">Failure monitor</p>
            <div className="mt-4 space-y-3">
              {overview?.recentFailedJobs.length ? (
                overview.recentFailedJobs.map((job) => (
                  <div key={job._id} className="rounded-[18px] border border-line-secondary bg-panel p-4">
                    <div className="flex items-center justify-between gap-3">
                      <FlagPill label={job.provider ?? "provider pending"} tone="amber" />
                      <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                        failed
                      </span>
                    </div>
                    <p className="mt-3 break-all font-mono text-[12px] text-ink-secondary">{job._id}</p>
                    {job.errorMessage ? (
                      <p className="mt-3 text-sm leading-6 text-accent-red">{job.errorMessage}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[18px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
                  No failed generation jobs in the recent window.
                </div>
              )}
            </div>
          </section>

          <section className="border-2 border-line-primary bg-surface p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">Audit trail</p>
            <div className="mt-4 space-y-3">
              {auditLog === undefined ? (
                <div className="rounded-[18px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
                  Loading recent mutations.
                </div>
              ) : (
                auditLog.map((entry) => (
                  <div key={entry._id} className="rounded-[18px] border border-line-secondary bg-panel p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] uppercase tracking-[0.2em] text-accent-orange">
                        {entry.action}
                      </span>
                      <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                        {entry.entityType}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-ink-primary">
                      {entry.actor?.fullName ?? "Unknown operator"}
                    </p>
                    <p className="mt-1 text-xs break-all text-ink-secondary">
                      {entry.entityId ?? "No entity reference"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside> : null}
      </div>
      ) : null}

      {activeAdminSection === "commerce" ? (
      <section className="border-2 border-line-primary bg-surface p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent-orange">Credit campaigns</p>
            <h3 className="mt-2 text-2xl font-semibold">Activity code management</h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-ink-secondary">
            Time-boxed credit grants with one-time or capped activation codes.
          </p>
        </div>

        <article className="mt-5 rounded-[22px] border border-dashed border-line-secondary bg-panel p-5">
          <div className="flex flex-wrap items-center gap-2">
            <FlagPill label="new campaign" tone="amber" />
            <FlagPill label={newCreditCampaignDraft.isActive ? "active" : "paused"} tone={newCreditCampaignDraft.isActive ? "green" : "red"} />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Campaign Name">
              <Input
                value={newCreditCampaignDraft.name}
                onChange={(event) =>
                  setNewCreditCampaignDraft((current) => ({ ...current, name: event.target.value }))
                }
                className="h-11 border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
              />
            </Field>
            <Field label="Starts At">
              <Input
                type="datetime-local"
                value={newCreditCampaignDraft.startsAt}
                onChange={(event) =>
                  setNewCreditCampaignDraft((current) => ({ ...current, startsAt: event.target.value }))
                }
                className="h-11 border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
              />
            </Field>
            <Field label="Ends At">
              <Input
                type="datetime-local"
                value={newCreditCampaignDraft.endsAt}
                onChange={(event) =>
                  setNewCreditCampaignDraft((current) => ({ ...current, endsAt: event.target.value }))
                }
                className="h-11 border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
              />
            </Field>
            <Field label="Default Credits">
              <Input
                type="number"
                min="1"
                value={newCreditCampaignDraft.defaultCreditAmount}
                onChange={(event) =>
                  setNewCreditCampaignDraft((current) => ({
                    ...current,
                    defaultCreditAmount: event.target.value,
                  }))
                }
                className="h-11 border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
              />
            </Field>
            <Field label="Campaign Cap">
              <Input
                type="number"
                min="1"
                value={newCreditCampaignDraft.maxRedemptions}
                onChange={(event) =>
                  setNewCreditCampaignDraft((current) => ({
                    ...current,
                    maxRedemptions: event.target.value,
                  }))
                }
                placeholder="Unlimited"
                className="h-11 border-line-secondary bg-main text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-orange"
              />
            </Field>
            <Field label="Per User Limit">
              <Input
                type="number"
                min="1"
                value={newCreditCampaignDraft.perUserLimit}
                onChange={(event) =>
                  setNewCreditCampaignDraft((current) => ({
                    ...current,
                    perUserLimit: event.target.value,
                  }))
                }
                className="h-11 border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
              />
            </Field>
            <div className="md:col-span-2">
              <Field label="Description">
                <Input
                  value={newCreditCampaignDraft.description}
                  onChange={(event) =>
                    setNewCreditCampaignDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="h-11 border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
                />
              </Field>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <ActionButton
              onClick={() =>
                void runAdminAction({
                  key: "credit-campaign-create",
                  action: async () => {
                    await createCreditCampaign({
                      name: newCreditCampaignDraft.name.trim(),
                      description: emptyToUndefined(newCreditCampaignDraft.description),
                      startsAt: parseDateTimeField(newCreditCampaignDraft.startsAt, "Campaign start"),
                      endsAt: parseDateTimeField(newCreditCampaignDraft.endsAt, "Campaign end"),
                      defaultCreditAmount: parseIntegerField(
                        newCreditCampaignDraft.defaultCreditAmount,
                        "Default credits"
                      ),
                      maxRedemptions: parseOptionalIntegerField(
                        newCreditCampaignDraft.maxRedemptions,
                        "Campaign cap"
                      ),
                      perUserLimit: parseIntegerField(
                        newCreditCampaignDraft.perUserLimit,
                        "Per-user limit"
                      ),
                      isActive: newCreditCampaignDraft.isActive,
                    });
                    setNewCreditCampaignDraft(defaultCreditCampaignDraft());
                  },
                  success: `Created credit campaign ${newCreditCampaignDraft.name.trim()}.`,
                  setBusyKey,
                  setErrorMessage,
                  setStatusMessage,
                })
              }
              busy={busyKey === "credit-campaign-create"}
            >
              Create Campaign
            </ActionButton>
            <button
              type="button"
              onClick={() =>
                setNewCreditCampaignDraft((current) => ({
                  ...current,
                  isActive: !current.isActive,
                }))
              }
              className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary"
            >
              {newCreditCampaignDraft.isActive ? "Create Paused" : "Create Active"}
            </button>
          </div>
        </article>

        <div className="mt-5 space-y-4">
          {creditCampaigns === undefined ? (
            <div className="rounded-[20px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
              Loading credit campaigns.
            </div>
          ) : creditCampaigns.length === 0 ? (
            <div className="rounded-[20px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
              No credit campaigns have been created yet.
            </div>
          ) : (
            creditCampaigns.map((campaign) => {
              const draft = creditCampaignDrafts[campaign._id] ?? {
                name: campaign.name,
                description: campaign.description ?? "",
                startsAt: formatDateTimeInput(campaign.startsAt),
                endsAt: formatDateTimeInput(campaign.endsAt),
                defaultCreditAmount: String(campaign.defaultCreditAmount),
                maxRedemptions:
                  campaign.maxRedemptions === undefined ? "" : String(campaign.maxRedemptions),
                perUserLimit: String(campaign.perUserLimit),
                isActive: campaign.isActive,
              };
              const batchDraft = codeBatchDrafts[campaign._id] ?? defaultCodeBatchDraft(campaign);
              const campaignState = getCampaignState(campaign);
              const generatedCodes = generatedCodeBatches[campaign._id] ?? [];

              return (
                <article key={campaign._id} className="rounded-[22px] border border-line-secondary bg-panel p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <FlagPill label={campaignState.label} tone={campaignState.tone} />
                        <FlagPill label={`${campaign.totalRedemptions} redeemed`} tone="green" />
                        <FlagPill label={`${campaign.codeCount} codes`} tone="cyan" />
                        <FlagPill label={`${campaign.activeCodeCount} live`} tone="amber" />
                      </div>
                      <h4 className="mt-3 text-xl font-semibold">{campaign.name}</h4>
                      <p className="mt-2 text-sm leading-6 text-ink-secondary">
                        {formatDateTime(campaign.startsAt)} / {formatDateTime(campaign.endsAt)}
                      </p>
                      {campaign.description ? (
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
                          {campaign.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid min-w-[240px] gap-2 rounded-[18px] border border-line-secondary bg-main p-3 text-sm">
                      <MetaRow label="Default" value={`${campaign.defaultCreditAmount} credits`} />
                      <MetaRow label="Campaign Cap" value={campaign.maxRedemptions ? `${campaign.maxRedemptions}` : "Unlimited"} />
                      <MetaRow label="Per User" value={`${campaign.perUserLimit}`} />
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
                    <div className="rounded-[20px] border border-line-secondary bg-main p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                        Campaign Control
                      </p>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Name">
                          <Input
                            value={draft.name}
                            onChange={(event) =>
                              setCreditCampaignDrafts((current) => ({
                                ...current,
                                [campaign._id]: { ...draft, name: event.target.value },
                              }))
                            }
                            className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
                          />
                        </Field>
                        <Field label="Default Credits">
                          <Input
                            type="number"
                            min="1"
                            value={draft.defaultCreditAmount}
                            onChange={(event) =>
                              setCreditCampaignDrafts((current) => ({
                                ...current,
                                [campaign._id]: { ...draft, defaultCreditAmount: event.target.value },
                              }))
                            }
                            className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
                          />
                        </Field>
                        <Field label="Starts At">
                          <Input
                            type="datetime-local"
                            value={draft.startsAt}
                            onChange={(event) =>
                              setCreditCampaignDrafts((current) => ({
                                ...current,
                                [campaign._id]: { ...draft, startsAt: event.target.value },
                              }))
                            }
                            className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
                          />
                        </Field>
                        <Field label="Ends At">
                          <Input
                            type="datetime-local"
                            value={draft.endsAt}
                            onChange={(event) =>
                              setCreditCampaignDrafts((current) => ({
                                ...current,
                                [campaign._id]: { ...draft, endsAt: event.target.value },
                              }))
                            }
                            className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
                          />
                        </Field>
                        <Field label="Campaign Cap">
                          <Input
                            type="number"
                            min="1"
                            value={draft.maxRedemptions}
                            onChange={(event) =>
                              setCreditCampaignDrafts((current) => ({
                                ...current,
                                [campaign._id]: { ...draft, maxRedemptions: event.target.value },
                              }))
                            }
                            placeholder="Unlimited"
                            className="border-line-secondary bg-main text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-orange"
                          />
                        </Field>
                        <Field label="Per User Limit">
                          <Input
                            type="number"
                            min="1"
                            value={draft.perUserLimit}
                            onChange={(event) =>
                              setCreditCampaignDrafts((current) => ({
                                ...current,
                                [campaign._id]: { ...draft, perUserLimit: event.target.value },
                              }))
                            }
                            className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
                          />
                        </Field>
                        <div className="md:col-span-2">
                          <Field label="Description">
                            <Input
                              value={draft.description}
                              onChange={(event) =>
                                setCreditCampaignDrafts((current) => ({
                                  ...current,
                                  [campaign._id]: { ...draft, description: event.target.value },
                                }))
                              }
                              className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
                            />
                          </Field>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <ActionButton
                          onClick={() =>
                            void runAdminAction({
                              key: `credit-campaign-save-${campaign._id}`,
                              action: async () => {
                                await updateCreditCampaign({
                                  campaignId: campaign._id,
                                  name: draft.name.trim(),
                                  description: emptyToUndefined(draft.description),
                                  startsAt: parseDateTimeField(draft.startsAt, "Campaign start"),
                                  endsAt: parseDateTimeField(draft.endsAt, "Campaign end"),
                                  defaultCreditAmount: parseIntegerField(
                                    draft.defaultCreditAmount,
                                    "Default credits"
                                  ),
                                  maxRedemptions: parseOptionalIntegerField(
                                    draft.maxRedemptions,
                                    "Campaign cap"
                                  ),
                                  perUserLimit: parseIntegerField(draft.perUserLimit, "Per-user limit"),
                                  isActive: draft.isActive,
                                });
                              },
                              success: `Saved credit campaign ${draft.name.trim()}.`,
                              setBusyKey,
                              setErrorMessage,
                              setStatusMessage,
                            })
                          }
                          busy={busyKey === `credit-campaign-save-${campaign._id}`}
                        >
                          Save Campaign
                        </ActionButton>
                        <button
                          type="button"
                          onClick={() =>
                            setCreditCampaignDrafts((current) => ({
                              ...current,
                              [campaign._id]: { ...draft, isActive: !draft.isActive },
                            }))
                          }
                          className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary"
                        >
                          {draft.isActive ? "Pause Campaign" : "Activate Campaign"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-line-secondary bg-main p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                        Code Batch
                      </p>
                      <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <Field label="Count">
                          <Input
                            type="number"
                            min="1"
                            max="200"
                            value={batchDraft.count}
                            onChange={(event) =>
                              setCodeBatchDrafts((current) => ({
                                ...current,
                                [campaign._id]: { ...batchDraft, count: event.target.value },
                              }))
                            }
                            className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                          />
                        </Field>
                        <Field label="Credits">
                          <Input
                            type="number"
                            min="1"
                            value={batchDraft.creditAmount}
                            onChange={(event) =>
                              setCodeBatchDrafts((current) => ({
                                ...current,
                                [campaign._id]: { ...batchDraft, creditAmount: event.target.value },
                              }))
                            }
                            className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                          />
                        </Field>
                        <Field label="Uses Per Code">
                          <Input
                            type="number"
                            min="1"
                            value={batchDraft.maxRedemptionsPerCode}
                            onChange={(event) =>
                              setCodeBatchDrafts((current) => ({
                                ...current,
                                [campaign._id]: {
                                  ...batchDraft,
                                  maxRedemptionsPerCode: event.target.value,
                                },
                              }))
                            }
                            className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                          />
                        </Field>
                        <Field label="Prefix">
                          <Input
                            value={batchDraft.prefix}
                            onChange={(event) =>
                              setCodeBatchDrafts((current) => ({
                                ...current,
                                [campaign._id]: { ...batchDraft, prefix: event.target.value },
                              }))
                            }
                            className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="Expires At">
                            <Input
                              type="datetime-local"
                              value={batchDraft.expiresAt}
                              onChange={(event) =>
                                setCodeBatchDrafts((current) => ({
                                  ...current,
                                  [campaign._id]: { ...batchDraft, expiresAt: event.target.value },
                                }))
                              }
                              className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                            />
                          </Field>
                        </div>
                      </div>
                      <div className="mt-4">
                        <ActionButton
                          onClick={() =>
                            void runAdminAction({
                              key: `credit-code-generate-${campaign._id}`,
                              action: async () => {
                                const response = await generateActivationCodes({
                                  campaignId: campaign._id,
                                  count: parseIntegerField(batchDraft.count, "Code count"),
                                  creditAmount: parseIntegerField(batchDraft.creditAmount, "Code credits"),
                                  maxRedemptionsPerCode: parseIntegerField(
                                    batchDraft.maxRedemptionsPerCode,
                                    "Uses per code"
                                  ),
                                  prefix: emptyToUndefined(batchDraft.prefix),
                                  expiresAt: parseOptionalDateTimeField(
                                    batchDraft.expiresAt,
                                    "Code expiry"
                                  ),
                                });
                                setGeneratedCodeBatches((current) => ({
                                  ...current,
                                  [campaign._id]: response.codes,
                                }));
                              },
                              success: `Generated ${batchDraft.count} activation code(s) for ${campaign.name}.`,
                              setBusyKey,
                              setErrorMessage,
                              setStatusMessage,
                            })
                          }
                          busy={busyKey === `credit-code-generate-${campaign._id}`}
                        >
                          Generate Codes
                        </ActionButton>
                      </div>
                      {generatedCodes.length > 0 ? (
                        <div className="mt-4 rounded-[16px] border border-accent-teal bg-accent-teal/10 p-3">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-[#A6FFD5]">
                            Latest Batch
                          </p>
                          <div className="mt-3 grid gap-2">
                            {generatedCodes.map((code) => (
                              <code
                                key={code}
                                className="rounded-[10px] border border-line-secondary bg-black/25 px-3 py-2 font-mono text-xs text-ink-primary"
                              >
                                {code}
                              </code>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.55fr)]">
                    <div className="rounded-[20px] border border-line-secondary bg-main p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                        Activation Codes
                      </p>
                      <div className="mt-3 grid gap-2">
                        {campaign.codes.length === 0 ? (
                          <p className="text-sm text-ink-secondary">No activation codes generated.</p>
                        ) : (
                          campaign.codes.map((activationCode) => {
                            const codeState = getActivationCodeState(activationCode);
                            return (
                              <div
                                key={activationCode._id}
                                className="grid gap-3 rounded-[16px] border border-line-secondary bg-main p-3 md:grid-cols-[minmax(0,1fr)_120px_120px]"
                              >
                                <div className="min-w-0">
                                  <code className="break-all font-mono text-sm text-ink-primary">
                                    {activationCode.code}
                                  </code>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    <FlagPill label={codeState.label} tone={codeState.tone} />
                                    <FlagPill
                                      label={`${activationCode.creditAmount} credits`}
                                      tone="green"
                                    />
                                  </div>
                                </div>
                                <MetaRow
                                  label="Uses"
                                  value={`${activationCode.redemptionCount}/${activationCode.maxRedemptions}`}
                                />
                                <ActionButton
                                  onClick={() =>
                                    void runAdminAction({
                                      key: `credit-code-active-${activationCode._id}`,
                                      action: async () => {
                                        await setActivationCodeActive({
                                          activationCodeId: activationCode._id,
                                          isActive: !activationCode.isActive,
                                        });
                                      },
                                      success: `Updated activation code ${activationCode.code}.`,
                                      setBusyKey,
                                      setErrorMessage,
                                      setStatusMessage,
                                    })
                                  }
                                  busy={busyKey === `credit-code-active-${activationCode._id}`}
                                  disabled={activationCode.redemptionCount >= activationCode.maxRedemptions}
                                  tone={activationCode.isActive ? "danger" : "default"}
                                >
                                  {activationCode.isActive ? "Disable" : "Enable"}
                                </ActionButton>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-line-secondary bg-main p-4">
                      <p className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                        Recent Redemptions
                      </p>
                      <div className="mt-3 space-y-3">
                        {campaign.recentRedemptions.length === 0 ? (
                          <p className="text-sm text-ink-secondary">No redemptions yet.</p>
                        ) : (
                          campaign.recentRedemptions.map((redemption) => (
                            <div
                              key={redemption._id}
                              className="rounded-[16px] border border-line-secondary bg-main p-3"
                            >
                              <p className="text-sm font-medium text-ink-primary">
                                {redemption.user?.email ?? "Unknown user"}
                              </p>
                              <p className="mt-1 break-all font-mono text-[12px] text-ink-secondary">
                                {redemption.code}
                              </p>
                              <div className="mt-3 grid gap-2 text-sm">
                                <MetaRow label="Credits" value={`${redemption.creditAmount}`} />
                                <MetaRow label="Balance" value={`${redemption.balanceAfter}`} />
                                <MetaRow label="Redeemed" value={formatDateTime(redemption.redeemedAt)} />
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      ) : null}

      {activeAdminSection === "templates" ? (
      <div className="admin-template-workspace grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <section className="border-2 border-line-primary bg-surface p-6" data-template-pane="editor">
            <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">Template editor</p>
            {activeTemplateDraft && selectedTemplate ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Template Name">
                    <Input
                      value={activeTemplateDraft.name}
                      onChange={(event) =>
                        setTemplateDraft((current) =>
                          patchTemplateDraft(current, selectedTemplate, {
                            name: event.target.value,
                          })
                        )
                      }
                      className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                    />
                  </Field>
                  <Field label="Version">
                    <Input
                      value={activeTemplateDraft.version}
                      onChange={(event) =>
                        setTemplateDraft((current) =>
                          patchTemplateDraft(current, selectedTemplate, {
                            version: event.target.value,
                          })
                        )
                      }
                      className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                    />
                  </Field>
                </div>
                <Field label="Note Policy">
                  <Input
                    value={activeTemplateDraft.notePolicy}
                    onChange={(event) =>
                      setTemplateDraft((current) =>
                        patchTemplateDraft(current, selectedTemplate, {
                          notePolicy: event.target.value,
                        })
                      )
                    }
                    className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                  />
                </Field>
                <Field label="System Prompt">
                  <Textarea
                    value={activeTemplateDraft.systemPrompt}
                    onChange={(event) =>
                      setTemplateDraft((current) =>
                        patchTemplateDraft(current, selectedTemplate, {
                          systemPrompt: event.target.value,
                        })
                      )
                    }
                    className="min-h-[150px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                  />
                </Field>
                <Field label="User Prompt Template">
                  <Textarea
                    value={activeTemplateDraft.userPromptTemplate}
                    onChange={(event) =>
                      setTemplateDraft((current) =>
                        patchTemplateDraft(current, selectedTemplate, {
                          userPromptTemplate: event.target.value,
                        })
                      )
                    }
                    className="min-h-[180px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                  />
                </Field>
                <Field label="Negative Prompt Template">
                  <Textarea
                    value={activeTemplateDraft.negativePromptTemplate}
                    onChange={(event) =>
                      setTemplateDraft((current) =>
                        patchTemplateDraft(current, selectedTemplate, {
                          negativePromptTemplate: event.target.value,
                        })
                      )
                    }
                    className="min-h-[120px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <ActionButton
                    onClick={() =>
                      void runAdminAction({
                        key: `template-${selectedTemplate._id}`,
                        action: async () => {
                          await updatePromptTemplate({
                            promptTemplateId: selectedTemplate._id,
                            name: activeTemplateDraft.name.trim(),
                            version: activeTemplateDraft.version.trim(),
                            notePolicy: activeTemplateDraft.notePolicy.trim() || undefined,
                            systemPrompt: activeTemplateDraft.systemPrompt,
                            userPromptTemplate: activeTemplateDraft.userPromptTemplate,
                            negativePromptTemplate: activeTemplateDraft.negativePromptTemplate.trim() || undefined,
                            isActive: activeTemplateDraft.isActive,
                          });
                        },
                        success: `Saved template ${activeTemplateDraft.name}.`,
                        setBusyKey,
                        setErrorMessage,
                        setStatusMessage,
                      })
                    }
                    busy={busyKey === `template-${selectedTemplate._id}`}
                  >
                    Save Template
                  </ActionButton>
                  <button
                    type="button"
                    onClick={() =>
                      setTemplateDraft((current) =>
                        patchTemplateDraft(current, selectedTemplate, {
                          isActive: !activeTemplateDraft.isActive,
                        })
                      )
                    }
                    className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary"
                  >
                    {activeTemplateDraft.isActive ? "Mark Inactive" : "Mark Active"}
                  </button>
                </div>
              </div>
            ) : promptTemplates === undefined ? (
              <div className="mt-4 rounded-[18px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
                Loading prompt template editor.
              </div>
            ) : (
              <div className="mt-4 rounded-[18px] border border-accent-red bg-accent-red/10 p-4 text-sm text-accent-red">
                No editable prompt template is available. Check the promptTemplates seed data.
              </div>
            )}
          </section>

          <section className="border-2 border-line-primary bg-surface p-6" data-template-pane="list">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">
                  Prompt templates
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-ink-primary">
                  Templates
                </h3>
              </div>
              <FlagPill label={`${promptTemplates?.length ?? 0} records`} tone="cyan" />
            </div>
            <div className="mt-4 space-y-2">
              {promptTemplates === undefined ? (
                <div className="rounded-[18px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
                  Loading prompt templates.
                </div>
              ) : promptTemplates.length === 0 ? (
                <div className="rounded-[18px] border border-accent-red bg-accent-red/10 p-4 text-sm text-accent-red">
                  No prompt templates were returned. Run the seed flow or check Convex promptTemplates.
                </div>
              ) : (
                promptTemplates.map((template) => (
                  <button
                    key={template._id}
                    type="button"
                    onClick={() => setSelectedTemplateId(template._id)}
                    className={cn(
                      "w-full rounded-[18px] border p-4 text-left transition-colors",
                      selectedTemplate?._id === template._id
                        ? "border-[#58FFB2]/35 bg-accent-teal/10"
                        : "border-line-secondary bg-panel hover:border-line-active"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.24em] text-ink-muted">
                          {template.kind}
                        </p>
                        <h4 className="mt-2 text-base font-semibold text-ink-primary">
                          {template.name}
                        </h4>
                      </div>
                      <FlagPill label={template.isActive ? "active" : "inactive"} tone={template.isActive ? "green" : "red"} />
                    </div>
                    <p className="mt-2 text-xs text-ink-secondary">Version {template.version}</p>
                  </button>
                ))
              )}
            </div>
          </section>
      </div>
      ) : null}

      {activeAdminSection === "prompt-lab" ? (
        <PromptLabPanel
          busyKey={busyKey}
          catalogData={catalogData}
          composePromptLabPreview={composePromptLabPreview}
          copiedPromptKey={copiedPromptKey}
          draft={promptLabDraft}
          experimentDraft={promptLabExperimentDraft}
          promptExperimentRuns={promptExperimentRuns}
          promptTemplates={promptTemplates}
          result={promptLabResult}
          onOpenTemplateEditor={() => handleAdminSectionChange("templates")}
          savePromptExperimentRun={savePromptExperimentRun}
          selectedTemplateId={selectedTemplateId}
          selectedTemplate={selectedTemplate}
          setBusyKey={setBusyKey}
          setCopiedPromptKey={setCopiedPromptKey}
          setDraft={setPromptLabDraft}
          setErrorMessage={setErrorMessage}
          setExperimentDraft={setPromptLabExperimentDraft}
          setResult={setPromptLabResult}
          setSelectedTemplateId={setSelectedTemplateId}
          setStatusMessage={setStatusMessage}
          updatePromptExperimentRun={updatePromptExperimentRun}
        />
      ) : null}

      {activeAdminSection === "catalog" ? (
      <section className={cn("border-2 border-line-primary bg-surface p-6", catalogScope && `catalog-scope-${catalogScope}`)}>
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">Catalog operations</p>
            <h3 className="mt-2 text-2xl font-semibold">
              {catalogScope === "styles" ? "Style DNA" : catalogScope === "materials" ? "Materials" : catalogScope === "paints" ? "Paint Catalog" : catalogScope === "creator-packs" ? "Creator Packs" : "Style DNA, materials, paint maps"}
            </h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-ink-secondary">
            This is the operational catalog layer behind P1. Each entry can be tuned,
            enabled, or disabled without reseeding the deployment.
          </p>
        </div>

        <div className={cn("mt-5 grid gap-6", catalogScope ? "xl:grid-cols-1" : "xl:grid-cols-2")}>
          <section className="border-2 border-line-primary bg-panel p-5" data-catalog-section="styles">
            <p className="text-xs uppercase tracking-[0.28em] text-accent-orange">Style DNA</p>
            <div className="mt-4 space-y-4">
              {catalogData === undefined ? (
                <CatalogLoading label="Loading style presets." />
              ) : (
                catalogData.stylePresets.map((preset) => {
                  const draft = stylePresetDrafts[preset._id] ?? {
                    name: preset.name,
                    category: preset.category ?? "",
                    shortDescription: preset.shortDescription ?? "",
                    contrastLevel: preset.contrastLevel ?? "",
                    weatheringProfile: preset.weatheringProfile ?? "",
                    promptKeywords: joinCsv(preset.promptKeywords),
                    negativeKeywords: joinCsv(preset.negativeKeywords),
                    recommendedMaterialSlugs: joinCsv(preset.recommendedMaterialSlugs),
                    seoKeywords: joinCsv(preset.seoKeywords),
                    systemPromptFragment: preset.systemPromptFragment ?? "",
                    promptVersion: preset.promptVersion ?? "",
                    visibilityWeight: preset.visibilityWeight?.toString() ?? "",
                    creatorUserId: preset.creatorUserId ?? "none",
                    isFeaturedStyle: preset.isFeaturedStyle,
                    isActive: preset.isActive,
                  };
                  return (
                    <article key={preset._id} className="rounded-[20px] border border-line-secondary bg-main p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <FlagPill label={preset.slug} tone="cyan" />
                        <FlagPill label={draft.isActive ? "active" : "inactive"} tone={draft.isActive ? "green" : "red"} />
                        {draft.isFeaturedStyle ? <FlagPill label="featured style" tone="amber" /> : null}
                      </div>
                      <div className="mt-4 grid gap-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Name">
                            <Input value={draft.name} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, name: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                          </Field>
                          <Field label="Category">
                            <Input value={draft.category} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, category: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                          </Field>
                          <Field label="Contrast">
                            <Input value={draft.contrastLevel} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, contrastLevel: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                          </Field>
                          <Field label="Weathering Profile">
                            <Input value={draft.weatheringProfile} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, weatheringProfile: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                          </Field>
                        </div>
                        <Field label="Short Description">
                          <Textarea value={draft.shortDescription} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, shortDescription: event.target.value } }))} className="min-h-[88px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Prompt Keywords CSV">
                          <Input value={draft.promptKeywords} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, promptKeywords: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Negative Keywords CSV">
                          <Input value={draft.negativeKeywords} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, negativeKeywords: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Recommended Material Slugs CSV">
                          <Input value={draft.recommendedMaterialSlugs} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, recommendedMaterialSlugs: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="SEO Keywords CSV">
                          <Input value={draft.seoKeywords} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, seoKeywords: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Prompt Version">
                            <Input value={draft.promptVersion} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, promptVersion: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                          </Field>
                          <Field label="Visibility Weight">
                            <Input type="number" step="0.01" min="0" max="1" value={draft.visibilityWeight} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, visibilityWeight: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                          </Field>
                          <Field label="Creator Owner">
                            <Select value={draft.creatorUserId} onValueChange={(value) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, creatorUserId: value } }))}>
                              <SelectTrigger className="h-11 border-line-secondary bg-main text-ink-primary">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                                <SelectItem value="none">None</SelectItem>
                                {users?.map((user) => (
                                  <SelectItem key={user._id} value={user._id}>
                                    {user.fullName} · @{user.handle}
                                  </SelectItem>
                                )) ?? null}
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                        <Field label="System Prompt Fragment">
                          <Textarea value={draft.systemPromptFragment} onChange={(event) => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, systemPromptFragment: event.target.value } }))} className="min-h-[100px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <ActionButton
                          onClick={() =>
                            void runAdminAction({
                              key: `style-preset-${preset._id}`,
                              action: async () => {
                                await updateStylePreset({
                                  stylePresetId: preset._id,
                                  name: draft.name.trim(),
                                  category: emptyToUndefined(draft.category),
                                  shortDescription: emptyToUndefined(draft.shortDescription),
                                  contrastLevel: emptyToUndefined(draft.contrastLevel),
                                  weatheringProfile: emptyToUndefined(draft.weatheringProfile),
                                  promptKeywords: parseCsv(draft.promptKeywords),
                                  negativeKeywords: parseCsv(draft.negativeKeywords),
                                  recommendedMaterialSlugs: parseCsv(draft.recommendedMaterialSlugs),
                                  seoKeywords: parseCsv(draft.seoKeywords),
                                  systemPromptFragment: emptyToUndefined(draft.systemPromptFragment),
                                  promptVersion: emptyToUndefined(draft.promptVersion),
                                  visibilityWeight: draft.visibilityWeight.trim() === "" ? undefined : Number(draft.visibilityWeight),
                                  creatorUserId: draft.creatorUserId === "none" ? undefined : draft.creatorUserId as Id<"users">,
                                  isFeaturedStyle: draft.isFeaturedStyle,
                                  isActive: draft.isActive,
                                });
                              },
                              success: `Saved style preset ${draft.name}.`,
                              setBusyKey,
                              setErrorMessage,
                              setStatusMessage,
                            })
                          }
                          busy={busyKey === `style-preset-${preset._id}`}
                        >
                          Save Style DNA
                        </ActionButton>
                        <button type="button" onClick={() => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, isFeaturedStyle: !draft.isFeaturedStyle } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                          {draft.isFeaturedStyle ? "Unfeature Style" : "Feature Style"}
                        </button>
                        <button type="button" onClick={() => setStylePresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, isActive: !draft.isActive } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                          {draft.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="border-2 border-line-primary bg-panel p-5" data-catalog-section="materials">
            <p className="text-xs uppercase tracking-[0.28em] text-accent-teal">Material Presets</p>
            <div className="mt-4 space-y-4">
              {catalogData === undefined ? (
                <CatalogLoading label="Loading material presets." />
              ) : (
                catalogData.materialPresets.map((preset) => {
                  const draft = materialPresetDrafts[preset._id] ?? {
                    name: preset.name,
                    finishType: preset.finishType,
                    reflectivityLevel: preset.reflectivityLevel ?? "",
                    promptKeywords: joinCsv(preset.promptKeywords),
                    paintFinish: preset.paintFinish ?? "",
                    difficultyLevel: preset.difficultyLevel ?? "",
                    sheenLevel: preset.sheenLevel ?? "",
                    shortDescription: preset.shortDescription ?? "",
                    isActive: preset.isActive,
                  };
                  return (
                    <article key={preset._id} className="rounded-[20px] border border-line-secondary bg-main p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <FlagPill label={preset.slug} tone="cyan" />
                        <FlagPill label={draft.isActive ? "active" : "inactive"} tone={draft.isActive ? "green" : "red"} />
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Name">
                          <Input value={draft.name} onChange={(event) => setMaterialPresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, name: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Finish Type">
                          <Input value={draft.finishType} onChange={(event) => setMaterialPresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, finishType: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Reflectivity">
                          <Input value={draft.reflectivityLevel} onChange={(event) => setMaterialPresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, reflectivityLevel: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Paint Finish">
                          <Input value={draft.paintFinish} onChange={(event) => setMaterialPresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, paintFinish: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Difficulty">
                          <Input value={draft.difficultyLevel} onChange={(event) => setMaterialPresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, difficultyLevel: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Sheen">
                          <Input value={draft.sheenLevel} onChange={(event) => setMaterialPresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, sheenLevel: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Prompt Keywords CSV">
                          <Input value={draft.promptKeywords} onChange={(event) => setMaterialPresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, promptKeywords: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                      </div>
                      <div className="mt-4">
                        <Field label="Short Description">
                          <Textarea value={draft.shortDescription} onChange={(event) => setMaterialPresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, shortDescription: event.target.value } }))} className="min-h-[88px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <ActionButton
                          onClick={() =>
                            void runAdminAction({
                              key: `material-preset-${preset._id}`,
                              action: async () => {
                                await updateMaterialPreset({
                                  materialPresetId: preset._id,
                                  name: draft.name.trim(),
                                  finishType: draft.finishType.trim(),
                                  reflectivityLevel: emptyToUndefined(draft.reflectivityLevel),
                                  promptKeywords: parseCsv(draft.promptKeywords),
                                  paintFinish: emptyToUndefined(draft.paintFinish),
                                  difficultyLevel: emptyToUndefined(draft.difficultyLevel),
                                  sheenLevel: emptyToUndefined(draft.sheenLevel),
                                  shortDescription: emptyToUndefined(draft.shortDescription),
                                  isActive: draft.isActive,
                                });
                              },
                              success: `Saved material preset ${draft.name}.`,
                              setBusyKey,
                              setErrorMessage,
                              setStatusMessage,
                            })
                          }
                          busy={busyKey === `material-preset-${preset._id}`}
                        >
                          Save Material
                        </ActionButton>
                        <button type="button" onClick={() => setMaterialPresetDrafts((current) => ({ ...current, [preset._id]: { ...draft, isActive: !draft.isActive } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                          {draft.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="border-2 border-line-primary bg-panel p-5" data-catalog-section="creator-packs">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-accent-blue">Creator Packs</p>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  Bundle creator-owned Style DNA, kit variants, and material presets into shareable starter packs.
                </p>
              </div>
              <ActionButton
                onClick={() =>
                  void runAdminAction({
                    key: "creator-pack-create",
                    action: async () => {
                      const draft = newCreatorPackDraft;
                      if (!draft.creatorUserId) {
                        throw new Error("Select a creator owner before creating a pack");
                      }
                      await upsertCreatorPack({
                        name: draft.name.trim(),
                        creatorUserId: draft.creatorUserId as Id<"users">,
                        description: emptyToUndefined(draft.description),
                        tagline: emptyToUndefined(draft.tagline),
                        stylePresetIds: parseCsv(draft.stylePresetIds) as Id<"stylePresets">[],
                        kitVariantIds: parseCsv(draft.kitVariantIds) as Id<"baseModels">[],
                        materialPresetIds: parseCsv(draft.materialPresetIds) as Id<"materialPresets">[],
                        packType: draft.packType,
                        isFeatured: draft.isFeatured,
                        isActive: draft.isActive,
                      });
                      setCreatorPackDrafts((current) => ({ ...current, __new__: defaultCreatorPackDraft() }));
                    },
                    success: "Created creator pack.",
                    setBusyKey,
                    setErrorMessage,
                    setStatusMessage,
                  })
                }
                busy={busyKey === "creator-pack-create"}
              >
                Create Pack
              </ActionButton>
            </div>
            <div className="mt-4 space-y-4">
              {catalogData === undefined ? (
                <CatalogLoading label="Loading creator packs." />
              ) : (
                <>
                  <article className="rounded-[20px] border border-dashed border-line-secondary bg-main p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <FlagPill label="new pack" tone="cyan" />
                      <FlagPill label={newCreatorPackDraft.packType} tone={newCreatorPackDraft.packType === "premium" ? "amber" : "green"} />
                    </div>
                    <div className="mt-4 grid gap-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Pack Name">
                          <Input value={newCreatorPackDraft.name} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, __new__: { ...newCreatorPackDraft, name: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                        </Field>
                        <Field label="Creator Owner">
                          <Select value={newCreatorPackDraft.creatorUserId || undefined} onValueChange={(value) => setCreatorPackDrafts((current) => ({ ...current, __new__: { ...newCreatorPackDraft, creatorUserId: value } }))}>
                            <SelectTrigger className="h-11 border-line-secondary bg-main text-ink-primary">
                              <SelectValue placeholder="Select creator" />
                            </SelectTrigger>
                            <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                              {users?.map((user) => (
                                <SelectItem key={user._id} value={user._id}>
                                  {user.fullName} · @{user.handle}
                                </SelectItem>
                              )) ?? null}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      <Field label="Tagline">
                        <Input value={newCreatorPackDraft.tagline} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, __new__: { ...newCreatorPackDraft, tagline: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                      </Field>
                      <Field label="Description">
                        <Textarea value={newCreatorPackDraft.description} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, __new__: { ...newCreatorPackDraft, description: event.target.value } }))} className="min-h-[88px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                      </Field>
                      <Field label="Style Preset IDs CSV">
                        <Input value={newCreatorPackDraft.stylePresetIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, __new__: { ...newCreatorPackDraft, stylePresetIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                      </Field>
                      <Field label="Kit Variant IDs CSV">
                        <Input value={newCreatorPackDraft.kitVariantIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, __new__: { ...newCreatorPackDraft, kitVariantIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                      </Field>
                      <Field label="Material Preset IDs CSV">
                        <Input value={newCreatorPackDraft.materialPresetIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, __new__: { ...newCreatorPackDraft, materialPresetIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                      </Field>
                    </div>
                  </article>
                  {catalogData.creatorPacks.map((pack) => {
                    const draft = creatorPackDrafts[pack._id] ?? {
                      name: pack.name,
                      creatorUserId: pack.creatorUserId,
                      description: pack.description ?? "",
                      tagline: pack.tagline ?? "",
                      stylePresetIds: joinCsv(pack.stylePresetIds),
                      kitVariantIds: joinCsv(pack.kitVariantIds),
                      materialPresetIds: joinCsv(pack.materialPresetIds),
                      packType: pack.packType,
                      isFeatured: pack.isFeatured,
                      isActive: pack.isActive,
                    };
                    return (
                      <article key={pack._id} className="rounded-[20px] border border-line-secondary bg-main p-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <FlagPill label={pack.slug} tone="cyan" />
                          <FlagPill label={draft.packType} tone={draft.packType === "premium" ? "amber" : "green"} />
                          <FlagPill label={draft.isActive ? "active" : "inactive"} tone={draft.isActive ? "green" : "red"} />
                          {draft.isFeatured ? <FlagPill label="featured pack" tone="amber" /> : null}
                        </div>
                        <div className="mt-4 grid gap-4">
                          <div className="grid gap-4 md:grid-cols-2">
                            <Field label="Pack Name">
                              <Input value={draft.name} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, name: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                            </Field>
                            <Field label="Creator Owner">
                              <Select value={draft.creatorUserId} onValueChange={(value) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, creatorUserId: value } }))}>
                                <SelectTrigger className="h-11 border-line-secondary bg-main text-ink-primary">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                                  {users?.map((user) => (
                                    <SelectItem key={user._id} value={user._id}>
                                      {user.fullName} · @{user.handle}
                                    </SelectItem>
                                  )) ?? null}
                                </SelectContent>
                              </Select>
                            </Field>
                          </div>
                          <Field label="Tagline">
                            <Input value={draft.tagline} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, tagline: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                          </Field>
                          <Field label="Description">
                            <Textarea value={draft.description} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, description: event.target.value } }))} className="min-h-[88px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                          </Field>
                          <Field label="Style Preset IDs CSV">
                            <Input value={draft.stylePresetIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, stylePresetIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                          </Field>
                          <Field label="Kit Variant IDs CSV">
                            <Input value={draft.kitVariantIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, kitVariantIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                          </Field>
                          <Field label="Material Preset IDs CSV">
                            <Input value={draft.materialPresetIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, materialPresetIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                          </Field>
                        </div>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <ActionButton
                            onClick={() =>
                              void runAdminAction({
                                key: `creator-pack-${pack._id}`,
                                action: async () => {
                                  await upsertCreatorPack({
                                    creatorPackId: pack._id,
                                    name: draft.name.trim(),
                                    creatorUserId: draft.creatorUserId as Id<"users">,
                                    description: emptyToUndefined(draft.description),
                                    tagline: emptyToUndefined(draft.tagline),
                                    stylePresetIds: parseCsv(draft.stylePresetIds) as Id<"stylePresets">[],
                                    kitVariantIds: parseCsv(draft.kitVariantIds) as Id<"baseModels">[],
                                    materialPresetIds: parseCsv(draft.materialPresetIds) as Id<"materialPresets">[],
                                    packType: draft.packType,
                                    isFeatured: draft.isFeatured,
                                    isActive: draft.isActive,
                                  });
                                },
                                success: `Saved creator pack ${draft.name}.`,
                                setBusyKey,
                                setErrorMessage,
                                setStatusMessage,
                              })
                            }
                            busy={busyKey === `creator-pack-${pack._id}`}
                          >
                            Save Creator Pack
                          </ActionButton>
                          <button type="button" onClick={() => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, packType: draft.packType === "free" ? "premium" : "free" } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                            {draft.packType === "free" ? "Set Premium" : "Set Free"}
                          </button>
                          <button type="button" onClick={() => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, isFeatured: !draft.isFeatured } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                            {draft.isFeatured ? "Unfeature Pack" : "Feature Pack"}
                          </button>
                          <button type="button" onClick={() => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, isActive: !draft.isActive } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                            {draft.isActive ? "Disable" : "Enable"}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </>
              )}
            </div>
          </section>

          <section className="border-2 border-line-primary bg-panel p-5" data-catalog-section="paints">
            <p className="text-xs uppercase tracking-[0.28em] text-accent-orange">Paint Mappings</p>
            <div className="mt-4 space-y-4">
              {catalogData === undefined ? (
                <CatalogLoading label="Loading paint mappings." />
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <CommerceStat
                      label="Affiliate-ready"
                      value={`${
                        catalogData.paintMappings.filter((mapping) => Boolean(mapping.affiliateUrl)).length
                      }`}
                      tone="green"
                    />
                    <CommerceStat
                      label="Search-ready"
                      value={`${
                        catalogData.paintMappings.filter(
                          (mapping) =>
                            !mapping.affiliateUrl &&
                            (mapping.availabilityRegion === "global" || mapping.availabilityRegion == null)
                        ).length
                      }`}
                      tone="cyan"
                    />
                    <CommerceStat
                      label="Region-limited"
                      value={`${
                        catalogData.paintMappings.filter(
                          (mapping) =>
                            !mapping.affiliateUrl &&
                            mapping.availabilityRegion != null &&
                            mapping.availabilityRegion !== "global"
                        ).length
                      }`}
                      tone="amber"
                    />
                  </div>
                  {catalogData.paintMappings.map((mapping) => {
                  const draft = paintMappingDrafts[mapping._id] ?? {
                    brand: mapping.brand,
                    line: mapping.line ?? "",
                    code: mapping.code,
                    colorName: mapping.colorName,
                    finishType: mapping.finishType ?? "",
                    paintType: mapping.paintType ?? "",
                    availabilityRegion: mapping.availabilityRegion ?? "",
                    affiliateUrl: mapping.affiliateUrl ?? "",
                    hexPreview: mapping.hexPreview ?? "",
                    isActive: mapping.isActive,
                  };
                  return (
                    <article key={mapping._id} className="rounded-[20px] border border-line-secondary bg-main p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <FlagPill label={mapping.mappingKey} tone="cyan" />
                        <FlagPill label={draft.isActive ? "active" : "inactive"} tone={draft.isActive ? "green" : "red"} />
                        <FlagPill
                          label={
                            draft.affiliateUrl.trim()
                              ? "affiliate-ready"
                              : draft.availabilityRegion.trim() === "" || draft.availabilityRegion.trim() === "global"
                                ? "search-ready"
                                : "region-limited"
                          }
                          tone={
                            draft.affiliateUrl.trim()
                              ? "green"
                              : draft.availabilityRegion.trim() === "" || draft.availabilityRegion.trim() === "global"
                                ? "cyan"
                                : "amber"
                          }
                        />
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Brand">
                          <Input value={draft.brand} onChange={(event) => setPaintMappingDrafts((current) => ({ ...current, [mapping._id]: { ...draft, brand: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Line">
                          <Input value={draft.line} onChange={(event) => setPaintMappingDrafts((current) => ({ ...current, [mapping._id]: { ...draft, line: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Code">
                          <Input value={draft.code} onChange={(event) => setPaintMappingDrafts((current) => ({ ...current, [mapping._id]: { ...draft, code: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Color Name">
                          <Input value={draft.colorName} onChange={(event) => setPaintMappingDrafts((current) => ({ ...current, [mapping._id]: { ...draft, colorName: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Finish Type">
                          <Input value={draft.finishType} onChange={(event) => setPaintMappingDrafts((current) => ({ ...current, [mapping._id]: { ...draft, finishType: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Paint Type">
                          <Input value={draft.paintType} onChange={(event) => setPaintMappingDrafts((current) => ({ ...current, [mapping._id]: { ...draft, paintType: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Availability Region">
                          <Input value={draft.availabilityRegion} onChange={(event) => setPaintMappingDrafts((current) => ({ ...current, [mapping._id]: { ...draft, availabilityRegion: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Hex Preview">
                          <Input value={draft.hexPreview} onChange={(event) => setPaintMappingDrafts((current) => ({ ...current, [mapping._id]: { ...draft, hexPreview: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                        <Field label="Affiliate URL">
                          <Input value={draft.affiliateUrl} onChange={(event) => setPaintMappingDrafts((current) => ({ ...current, [mapping._id]: { ...draft, affiliateUrl: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange" />
                        </Field>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <ActionButton
                          onClick={() =>
                            void runAdminAction({
                              key: `paint-mapping-${mapping._id}`,
                              action: async () => {
                                await updatePaintMapping({
                                  paintMappingId: mapping._id,
                                  brand: draft.brand.trim(),
                                  line: emptyToUndefined(draft.line),
                                  code: draft.code.trim(),
                                  colorName: draft.colorName.trim(),
                                  finishType: emptyToUndefined(draft.finishType),
                                  paintType: emptyToUndefined(draft.paintType),
                                  availabilityRegion: emptyToUndefined(draft.availabilityRegion),
                                  affiliateUrl: emptyToUndefined(draft.affiliateUrl),
                                  hexPreview: emptyToUndefined(draft.hexPreview),
                                  isActive: draft.isActive,
                                });
                              },
                              success: `Saved paint mapping ${draft.brand} ${draft.code}.`,
                              setBusyKey,
                              setErrorMessage,
                              setStatusMessage,
                            })
                          }
                          busy={busyKey === `paint-mapping-${mapping._id}`}
                        >
                          Save Paint Map
                        </ActionButton>
                        <button type="button" onClick={() => setPaintMappingDrafts((current) => ({ ...current, [mapping._id]: { ...draft, isActive: !draft.isActive } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                          {draft.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </article>
                  );
                })}
                </>
              )}
            </div>
          </section>

          <section className="border-2 border-line-primary bg-panel p-5" data-catalog-section="creator-packs">
            <p className="text-xs uppercase tracking-[0.28em] text-accent-blue">Creator Packs</p>
            <div className="mt-4 space-y-4">
              {catalogData === undefined ? (
                <CatalogLoading label="Loading creator packs." />
              ) : (
                catalogData.creatorPacks.map((pack) => {
                  const draft = creatorPackDrafts[pack._id] ?? {
                    name: pack.name,
                    creatorUserId: pack.creatorUserId,
                    description: pack.description ?? "",
                    tagline: pack.tagline ?? "",
                    stylePresetIds: joinCsv(pack.stylePresetIds),
                    kitVariantIds: joinCsv(pack.kitVariantIds),
                    materialPresetIds: joinCsv(pack.materialPresetIds),
                    packType: pack.packType,
                    isFeatured: pack.isFeatured,
                    isActive: pack.isActive,
                  };
                  return (
                    <article key={pack._id} className="rounded-[20px] border border-line-secondary bg-main p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <FlagPill label={pack.slug} tone="cyan" />
                        <FlagPill label={draft.packType} tone={draft.packType === "premium" ? "amber" : "green"} />
                        <FlagPill label={draft.isActive ? "active" : "inactive"} tone={draft.isActive ? "green" : "red"} />
                        {draft.isFeatured ? <FlagPill label="featured pack" tone="amber" /> : null}
                      </div>
                      <div className="mt-4 grid gap-2 text-sm text-ink-muted">
                        <MetaRow label="Pack likes" value={`${pack.analytics.packLikes}`} />
                        <MetaRow label="Pack saves" value={`${pack.analytics.packSaves}`} />
                        <MetaRow label="Public concepts" value={`${pack.analytics.publicConceptCount}`} />
                      </div>
                      <div className="mt-4 grid gap-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="Pack Name">
                            <Input value={draft.name} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, name: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                          </Field>
                          <Field label="Creator Owner">
                            <Select value={draft.creatorUserId} onValueChange={(value) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, creatorUserId: value } }))}>
                              <SelectTrigger className="h-11 border-line-secondary bg-main text-ink-primary">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                                {users?.map((user) => (
                                  <SelectItem key={user._id} value={user._id}>
                                    {user.fullName} · @{user.handle}
                                  </SelectItem>
                                )) ?? null}
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                        <Field label="Tagline">
                          <Input value={draft.tagline} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, tagline: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                        </Field>
                        <Field label="Description">
                          <Textarea value={draft.description} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, description: event.target.value } }))} className="min-h-[88px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                        </Field>
                        <Field label="Style Preset IDs CSV">
                          <Input value={draft.stylePresetIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, stylePresetIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                        </Field>
                        <Field label="Kit Variant IDs CSV">
                          <Input value={draft.kitVariantIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, kitVariantIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                        </Field>
                        <Field label="Material Preset IDs CSV">
                          <Input value={draft.materialPresetIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, materialPresetIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
                        </Field>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <ActionButton
                          onClick={() =>
                            void runAdminAction({
                              key: `creator-pack-${pack._id}`,
                              action: async () => {
                                await upsertCreatorPack({
                                  creatorPackId: pack._id,
                                  name: draft.name.trim(),
                                  creatorUserId: draft.creatorUserId as Id<"users">,
                                  description: emptyToUndefined(draft.description),
                                  tagline: emptyToUndefined(draft.tagline),
                                  stylePresetIds: parseCsv(draft.stylePresetIds) as Id<"stylePresets">[],
                                  kitVariantIds: parseCsv(draft.kitVariantIds) as Id<"baseModels">[],
                                  materialPresetIds: parseCsv(draft.materialPresetIds) as Id<"materialPresets">[],
                                  packType: draft.packType,
                                  isFeatured: draft.isFeatured,
                                  isActive: draft.isActive,
                                });
                              },
                              success: `Saved creator pack ${draft.name}.`,
                              setBusyKey,
                              setErrorMessage,
                              setStatusMessage,
                            })
                          }
                          busy={busyKey === `creator-pack-${pack._id}`}
                        >
                          Save Creator Pack
                        </ActionButton>
                        <button type="button" onClick={() => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, packType: draft.packType === "free" ? "premium" : "free" } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                          {draft.packType === "free" ? "Set Premium" : "Set Free"}
                        </button>
                        <button type="button" onClick={() => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, isFeatured: !draft.isFeatured } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                          {draft.isFeatured ? "Unfeature Pack" : "Feature Pack"}
                        </button>
                        <button type="button" onClick={() => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, isActive: !draft.isActive } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                          {draft.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </section>
      ) : null}

      {activeAdminSection === "commerce" ? (
      <section className="border-2 border-line-primary bg-surface p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-accent-orange">Charge rules</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {priceRules === undefined ? (
            <div className="rounded-[18px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
              Loading credit price rules.
            </div>
          ) : (
            priceRules.map((rule) => {
              const draft = priceRuleDrafts[rule._id] ?? {
                label: rule.label,
                creditCost: String(rule.creditCost),
                description: rule.description ?? "",
                isActive: rule.isActive,
              };
              return (
                <article
                  key={rule._id}
                  className="rounded-[22px] border border-line-secondary bg-panel p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <FlagPill label={rule.actionType} tone="cyan" />
                    <FlagPill label={draft.isActive ? "active" : "inactive"} tone={draft.isActive ? "green" : "red"} />
                  </div>
                  <div className="mt-4 grid gap-4">
                    <Field label="Label">
                      <Input
                        value={draft.label}
                        onChange={(event) =>
                          setPriceRuleDrafts((current) => ({
                            ...current,
                            [rule._id]: { ...draft, label: event.target.value },
                          }))
                        }
                        className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                      />
                    </Field>
                    <Field label="Credit Cost">
                      <Input
                        type="number"
                        min="0"
                        value={draft.creditCost}
                        onChange={(event) =>
                          setPriceRuleDrafts((current) => ({
                            ...current,
                            [rule._id]: { ...draft, creditCost: event.target.value },
                          }))
                        }
                        className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                      />
                    </Field>
                    <Field label="Description">
                      <Textarea
                        value={draft.description}
                        onChange={(event) =>
                          setPriceRuleDrafts((current) => ({
                            ...current,
                            [rule._id]: { ...draft, description: event.target.value },
                          }))
                        }
                        className="min-h-[110px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                      />
                    </Field>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <ActionButton
                      onClick={() =>
                        void runAdminAction({
                          key: `rule-${rule._id}`,
                          action: async () => {
                            await updatePriceRule({
                              priceRuleId: rule._id,
                              label: draft.label.trim(),
                              creditCost: Number(draft.creditCost),
                              description: draft.description.trim() || undefined,
                              isActive: draft.isActive,
                            });
                          },
                          success: `Saved charge rule ${rule.actionType}.`,
                          setBusyKey,
                          setErrorMessage,
                          setStatusMessage,
                        })
                      }
                      busy={busyKey === `rule-${rule._id}`}
                    >
                      Save Rule
                    </ActionButton>
                    <button
                      type="button"
                      onClick={() =>
                        setPriceRuleDrafts((current) => ({
                          ...current,
                          [rule._id]: { ...draft, isActive: !draft.isActive },
                        }))
                      }
                      className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary"
                    >
                      {draft.isActive ? "Disable Rule" : "Enable Rule"}
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>
      ) : null}
    </div>
  );
}

async function runAdminAction({
  key,
  action,
  success,
  setBusyKey,
  setErrorMessage,
  setStatusMessage,
}: {
  key: string;
  action: () => Promise<void>;
  success: string;
  setBusyKey: (key: string | null) => void;
  setErrorMessage: (message: string | null) => void;
  setStatusMessage: (message: string | null) => void;
}) {
  setBusyKey(key);
  setErrorMessage(null);
  setStatusMessage(null);
  try {
    await action();
    setStatusMessage(success);
  } catch (error) {
    setErrorMessage(error instanceof Error ? error.message : "Admin action failed");
  } finally {
    setBusyKey(null);
  }
}

function AdminSectionNav({
  activeSection,
  onSectionChange,
  sections,
}: {
  activeSection: AdminSectionId;
  onSectionChange: (section: AdminSectionId) => void;
  sections: AdminSection[];
}) {
  const activeMeta = sections.find((section) => section.id === activeSection) ?? sections[0];

  return (
    <section className="border-2 border-line-primary bg-surface p-3">
      <div className="grid gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
        <div className="border border-line-secondary bg-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-accent-orange">
            Admin map
          </p>
          <h3 className="mt-2 text-2xl font-semibold text-ink-primary">{activeMeta.label}</h3>
          <p className="mt-3 text-sm leading-6 text-ink-secondary">
            {activeMeta.description}
          </p>
        </div>
        <nav
          aria-label="Admin secondary menu"
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6"
        >
          {sections.map((section) => {
            const isActive = section.id === activeSection;
            return (
              <button
                key={section.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  "group border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-2 focus-visible:ring-offset-main",
                  isActive
                    ? "border-line-primary bg-main shadow-[inset_4px_0_0_0_var(--accent-blue)]"
                    : "border-line-secondary bg-panel hover:border-line-primary hover:bg-hover-surface"
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <p
                    className={cn(
                      "text-[11px] uppercase tracking-[0.22em]",
                      isActive ? "text-ink-primary" : "text-ink-muted"
                    )}
                  >
                    {section.eyebrow}
                  </p>
                  <FlagPill label={section.metric} tone={section.tone} />
                </div>
                <p className="mt-3 text-base font-semibold text-ink-primary">{section.label}</p>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink-secondary">
                  {section.description}
                </p>
              </button>
            );
          })}
        </nav>
      </div>
    </section>
  );
}

function MetricCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[24px] border border-line-secondary bg-surface p-5">
      <p className="text-[11px] uppercase tracking-[0.26em] text-ink-muted">{label}</p>
      <p className="mt-3 text-4xl font-semibold text-ink-primary">{value}</p>
      <p className="mt-2 text-sm leading-6 text-ink-secondary">{detail}</p>
    </article>
  );
}

function PromptLabPanel({
  busyKey,
  catalogData,
  composePromptLabPreview,
  copiedPromptKey,
  draft,
  experimentDraft,
  promptExperimentRuns,
  promptTemplates,
  result,
  onOpenTemplateEditor,
  savePromptExperimentRun,
  selectedTemplateId,
  selectedTemplate,
  setBusyKey,
  setCopiedPromptKey,
  setDraft,
  setErrorMessage,
  setExperimentDraft,
  setResult,
  setSelectedTemplateId,
  setStatusMessage,
  updatePromptExperimentRun,
}: {
  busyKey: string | null;
  catalogData:
    | {
        kitVariants: Array<{ _id: Id<"baseModels">; name: string; slug: string }>;
        materialPresets: Array<{ _id: Id<"materialPresets">; name: string; slug: string }>;
        stylePresets: Array<{ _id: Id<"stylePresets">; name: string; slug: string }>;
      }
    | undefined;
  composePromptLabPreview: ReturnType<typeof useMutation<typeof api.admin.composePromptLabPreview>>;
  copiedPromptKey: string | null;
  draft: PromptLabDraft;
  experimentDraft: PromptLabExperimentDraft;
  promptExperimentRuns:
    | Array<{
        _id: Id<"promptExperimentRuns">;
        _creationTime: number;
        templateKind: string;
        templateName: string;
        templateVersion: string;
        status: "ready-for-web" | "tested" | "selected" | "rejected" | "archived";
        providerLabel?: string;
        modelLabel?: string;
        outputImageUrl?: string;
        outputNotes?: string;
        overallScore?: number;
        selectedAsWinner: boolean;
      }>
    | undefined;
  promptTemplates:
    | Array<{
        _id: Id<"promptTemplates">;
        kind: string;
        name: string;
        version: string;
        isActive: boolean;
      }>
    | undefined;
  result: PromptLabResult | null;
  onOpenTemplateEditor: () => void;
  savePromptExperimentRun: ReturnType<typeof useMutation<typeof api.admin.savePromptExperimentRun>>;
  selectedTemplateId: string | null;
  selectedTemplate: { _id: Id<"promptTemplates">; kind: string; name: string; version: string } | null;
  setBusyKey: (key: string | null) => void;
  setCopiedPromptKey: (key: string | null) => void;
  setDraft: (updater: PromptLabDraft | ((current: PromptLabDraft) => PromptLabDraft)) => void;
  setErrorMessage: (message: string | null) => void;
  setExperimentDraft: (
    updater:
      | PromptLabExperimentDraft
      | ((current: PromptLabExperimentDraft) => PromptLabExperimentDraft)
  ) => void;
  setResult: React.Dispatch<React.SetStateAction<PromptLabResult | null>>;
  setSelectedTemplateId: (templateId: string | null) => void;
  setStatusMessage: (message: string | null) => void;
  updatePromptExperimentRun: ReturnType<typeof useMutation<typeof api.admin.updatePromptExperimentRun>>;
}) {
  const promptLength = result?.composedPrompt.length ?? 0;
  const visibleRuns =
    promptExperimentRuns?.filter((run) => run.status !== "archived").slice(0, 10) ?? [];
  const promptLabArgs = selectedTemplate ? buildPromptLabArgs(selectedTemplate._id, draft) : null;

  return (
    <section className="border-2 border-line-primary bg-surface p-6 text-ink-primary">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-accent-orange">Prompt Lab</p>
          <h3 className="mt-2 text-2xl font-semibold">Manual web experiment bench</h3>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
            Compose the exact project prompt, copy it into vendor web tools, then save
            the observed model, image, notes, and scores as an admin-only experiment run.
          </p>
        </div>
        <div className="min-w-[240px] space-y-3">
          <button
            type="button"
            onClick={onOpenTemplateEditor}
            className="w-full rounded-[16px] border border-line-secondary bg-panel px-4 py-2 text-sm text-ink-secondary transition-colors hover:border-line-active hover:text-ink-primary"
          >
            Open Template Editor
          </button>
          <div className="grid gap-2 rounded-[18px] border border-line-secondary bg-main p-4 text-sm">
            <MetaRow label="Template" value={selectedTemplate?.name ?? "None"} />
            <MetaRow label="Version" value={selectedTemplate?.version ?? "N/A"} />
            <MetaRow label="Prompt chars" value={`${promptLength}`} />
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-[20px] border border-line-secondary bg-panel p-4">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-ink-muted">
              Test template
            </p>
            <p className="mt-2 text-sm leading-6 text-ink-secondary">
              Pick one of the configured base prompt templates before composing a manual web test.
            </p>
          </div>
          <FlagPill label={`${promptTemplates?.length ?? 0} templates`} tone="cyan" />
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {promptTemplates === undefined ? (
            <div className="rounded-[16px] border border-line-secondary bg-main p-4 text-sm text-ink-secondary md:col-span-2 xl:col-span-4">
              Loading prompt templates.
            </div>
          ) : promptTemplates.length === 0 ? (
            <div className="rounded-[16px] border border-accent-red bg-accent-red/10 p-4 text-sm text-accent-red md:col-span-2 xl:col-span-4">
              No prompt templates were returned for this admin session. Check seed data and admin access.
            </div>
          ) : (
            promptTemplates.map((template) => {
              const active = selectedTemplateId === template._id;
              return (
                <button
                  key={template._id}
                  type="button"
                  onClick={() => {
                    setSelectedTemplateId(template._id);
                    setResult(null);
                  }}
                  className={cn(
                    "min-h-[132px] rounded-[18px] border p-4 text-left transition-colors",
                    active
                      ? "border-accent-orange bg-accent-orange/10 shadow-[inset_4px_0_0_0_var(--accent-orange)]"
                      : "border-line-secondary bg-main hover:border-line-active hover:bg-hover-surface"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">
                      {template.kind}
                    </p>
                    <FlagPill
                      label={template.isActive ? "active" : "inactive"}
                      tone={template.isActive ? "green" : "red"}
                    />
                  </div>
                  <h4 className="mt-4 text-base font-semibold text-ink-primary">
                    {template.name}
                  </h4>
                  <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink-secondary">
                    Version {template.version}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="space-y-4">
          <div className="rounded-[20px] border border-line-secondary bg-panel p-4">
            <p className="text-[11px] uppercase tracking-[0.24em] text-ink-muted">Test inputs</p>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <PromptLabSelect
                label="Kit Variant"
                options={catalogData?.kitVariants ?? []}
                value={draft.kitVariantId}
                onChange={(value) => setDraft((current) => ({ ...current, kitVariantId: value }))}
              />
              <PromptLabSelect
                label="Style DNA"
                options={catalogData?.stylePresets ?? []}
                value={draft.stylePresetId}
                onChange={(value) => setDraft((current) => ({ ...current, stylePresetId: value }))}
              />
              <PromptLabSelect
                label="Material"
                options={catalogData?.materialPresets ?? []}
                value={draft.materialPresetId}
                onChange={(value) =>
                  setDraft((current) => ({ ...current, materialPresetId: value }))
                }
              />
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
              <Field label="Mood Vector">
                <div className="flex flex-wrap gap-2">
                  {promptLabMoodOptions.map((option) => {
                    const active = draft.moodTags.includes(option.value);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            moodTags: active
                              ? current.moodTags.filter((tag) => tag !== option.value)
                              : [...current.moodTags, option.value],
                          }))
                        }
                        className={cn(
                          "rounded-[14px] border px-3 py-2 text-xs uppercase tracking-[0.16em] transition-colors",
                          active
                            ? "border-accent-teal bg-accent-teal/15 text-[#A6FFD5]"
                            : "border-line-secondary bg-main text-ink-secondary hover:border-line-active hover:text-ink-primary"
                        )}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </Field>
              <Field label="Weathering">
                <Select
                  value={draft.weatheringLevel}
                  onValueChange={(value: WeatheringLevel) =>
                    setDraft((current) => ({ ...current, weatheringLevel: value }))
                  }
                >
                  <SelectTrigger className="h-11 border-line-secondary bg-main text-ink-primary">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                    {promptLabWeatheringOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="Manual Concept ID">
                <Input
                  value={draft.conceptId}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, conceptId: event.target.value }))
                  }
                  placeholder="Optional stable label"
                  className="border-line-secondary bg-main text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-orange"
                />
              </Field>
              <Field label="Remix Source">
                <Input
                  value={draft.remixSource}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, remixSource: event.target.value }))
                  }
                  placeholder="Optional source title"
                  className="border-line-secondary bg-main text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-orange"
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea
                value={draft.notes}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, notes: event.target.value }))
                }
                className="min-h-[88px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-orange"
              />
            </Field>

            <div className="mt-4 flex flex-wrap gap-3">
              <ActionButton
                onClick={() =>
                  void runAdminAction({
                    key: "prompt-lab-compose",
                    action: async () => {
                      if (!promptLabArgs) {
                        throw new Error("Select a prompt template before composing.");
                      }
                      const response = await composePromptLabPreview(promptLabArgs);
                      setResult(response);
                    },
                    success: "Composed prompt lab preview.",
                    setBusyKey,
                    setErrorMessage,
                    setStatusMessage,
                  })
                }
                busy={busyKey === "prompt-lab-compose"}
                disabled={!selectedTemplate}
              >
                Compose Prompt
              </ActionButton>
              <button
                type="button"
                onClick={() => {
                  setDraft(defaultPromptLabDraft);
                  setResult(null);
                  setExperimentDraft(defaultPromptLabExperimentDraft);
                }}
                className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary"
              >
                Reset Lab
              </button>
            </div>
          </div>

          <PromptLabExperimentForm
            busyKey={busyKey}
            draft={experimentDraft}
            onSave={() =>
              void runAdminAction({
                key: "prompt-lab-save-run",
                action: async () => {
                  if (!promptLabArgs) {
                    throw new Error("Select a prompt template before saving.");
                  }
                  const response = await savePromptExperimentRun({
                    ...promptLabArgs,
                    providerLabel: emptyToUndefined(experimentDraft.providerLabel),
                    modelLabel: emptyToUndefined(experimentDraft.modelLabel),
                    vendorUrl: emptyToUndefined(experimentDraft.vendorUrl),
                    parameterNotes: emptyToUndefined(experimentDraft.parameterNotes),
                    outputImageUrl: emptyToUndefined(experimentDraft.outputImageUrl),
                    outputNotes: emptyToUndefined(experimentDraft.outputNotes),
                    failureTags: parseCsv(experimentDraft.failureTags),
                    styleHitScore: parseOptionalScore(experimentDraft.styleHitScore),
                    silhouetteScore: parseOptionalScore(experimentDraft.silhouetteScore),
                    paintabilityScore: parseOptionalScore(experimentDraft.paintabilityScore),
                    promptAdherenceScore: parseOptionalScore(
                      experimentDraft.promptAdherenceScore
                    ),
                    visualImpactScore: parseOptionalScore(experimentDraft.visualImpactScore),
                    overallScore: parseOptionalScore(experimentDraft.overallScore),
                    selectedAsWinner: experimentDraft.selectedAsWinner,
                  });
                  setResult((current) =>
                    current ? { ...current, warnings: response.warnings } : current
                  );
                  setExperimentDraft(defaultPromptLabExperimentDraft);
                },
                success: "Saved manual prompt experiment run.",
                setBusyKey,
                setErrorMessage,
                setStatusMessage,
              })
            }
            setDraft={setExperimentDraft}
          />
        </div>

        <div className="space-y-4">
          <PromptLabPreview
            copiedPromptKey={copiedPromptKey}
            result={result}
            setCopiedPromptKey={setCopiedPromptKey}
            setErrorMessage={setErrorMessage}
          />
          <PromptLabRunList
            busyKey={busyKey}
            runs={visibleRuns}
            setBusyKey={setBusyKey}
            setErrorMessage={setErrorMessage}
            setStatusMessage={setStatusMessage}
            updatePromptExperimentRun={updatePromptExperimentRun}
          />
        </div>
      </div>
    </section>
  );
}

function PromptLabSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ _id: string; name: string; slug: string }>;
  value: string;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-11 border-line-secondary bg-main text-ink-primary">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-line-secondary bg-panel text-ink-primary">
          <SelectItem value="none">None</SelectItem>
          {options.map((option) => (
            <SelectItem key={option._id} value={option._id}>
              {option.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

function PromptLabExperimentForm({
  busyKey,
  draft,
  onSave,
  setDraft,
}: {
  busyKey: string | null;
  draft: PromptLabExperimentDraft;
  onSave: () => void;
  setDraft: (
    updater:
      | PromptLabExperimentDraft
      | ((current: PromptLabExperimentDraft) => PromptLabExperimentDraft)
  ) => void;
}) {
  return (
    <div className="rounded-[20px] border border-line-secondary bg-panel p-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-ink-muted">Manual web result</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Provider">
          <Input
            value={draft.providerLabel}
            onChange={(event) =>
              setDraft((current) => ({ ...current, providerLabel: event.target.value }))
            }
            placeholder="OpenAI / Midjourney / Ideogram"
            className="border-line-secondary bg-main text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-teal"
          />
        </Field>
        <Field label="Model Label">
          <Input
            value={draft.modelLabel}
            onChange={(event) =>
              setDraft((current) => ({ ...current, modelLabel: event.target.value }))
            }
            placeholder="Web model name or UI preset"
            className="border-line-secondary bg-main text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-teal"
          />
        </Field>
        <Field label="Vendor URL">
          <Input
            value={draft.vendorUrl}
            onChange={(event) =>
              setDraft((current) => ({ ...current, vendorUrl: event.target.value }))
            }
            placeholder="Optional web session link"
            className="border-line-secondary bg-main text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-teal"
          />
        </Field>
        <Field label="Output Image URL">
          <Input
            value={draft.outputImageUrl}
            onChange={(event) =>
              setDraft((current) => ({ ...current, outputImageUrl: event.target.value }))
            }
            placeholder="External image URL"
            className="border-line-secondary bg-main text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-teal"
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Field label="Parameter Notes">
          <Textarea
            value={draft.parameterNotes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, parameterNotes: event.target.value }))
            }
            className="min-h-[96px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal"
          />
        </Field>
        <Field label="Output Notes">
          <Textarea
            value={draft.outputNotes}
            onChange={(event) =>
              setDraft((current) => ({ ...current, outputNotes: event.target.value }))
            }
            className="min-h-[96px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal"
          />
        </Field>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["Style", "styleHitScore"],
          ["Silhouette", "silhouetteScore"],
          ["Paint", "paintabilityScore"],
          ["Adherence", "promptAdherenceScore"],
          ["Impact", "visualImpactScore"],
          ["Overall", "overallScore"],
        ].map(([label, key]) => (
          <ScoreInput
            key={key}
            label={label}
            value={draft[key as keyof PromptLabExperimentDraft] as string}
            onChange={(value) =>
              setDraft((current) => ({
                ...current,
                [key]: value,
              }))
            }
          />
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_190px]">
        <Field label="Failure Tags CSV">
          <Input
            value={draft.failureTags}
            onChange={(event) =>
              setDraft((current) => ({ ...current, failureTags: event.target.value }))
            }
            placeholder="bad-hands, weak-style, off-model"
            className="border-line-secondary bg-main text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-teal"
          />
        </Field>
        <label className="flex items-center gap-3 rounded-[16px] border border-line-secondary bg-main px-4 py-3 text-sm text-ink-secondary">
          <input
            type="checkbox"
            checked={draft.selectedAsWinner}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                selectedAsWinner: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-[#58FFB2]"
          />
          Winner candidate
        </label>
      </div>
      <div className="mt-4">
        <ActionButton
          onClick={onSave}
          busy={busyKey === "prompt-lab-save-run"}
        >
          Save Experiment Run
        </ActionButton>
      </div>
    </div>
  );
}

function ScoreInput({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min="0"
        max="10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal"
      />
    </Field>
  );
}

function PromptLabPreview({
  copiedPromptKey,
  result,
  setCopiedPromptKey,
  setErrorMessage,
}: {
  copiedPromptKey: string | null;
  result: PromptLabResult | null;
  setCopiedPromptKey: (key: string | null) => void;
  setErrorMessage: (message: string | null) => void;
}) {
  return (
    <div className="rounded-[20px] border border-line-secondary bg-panel p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] uppercase tracking-[0.24em] text-ink-muted">Composed prompt</p>
        {result ? (
          <div className="flex flex-wrap gap-2">
            <CopyButton
              copied={copiedPromptKey === "system"}
              label="Copy System"
              onCopy={() =>
                copyPromptBlock({
                  key: "system",
                  value: result.copyBlocks.systemPrompt,
                  setCopiedPromptKey,
                  setErrorMessage,
                })
              }
            />
            <CopyButton
              copied={copiedPromptKey === "user"}
              label="Copy User"
              onCopy={() =>
                copyPromptBlock({
                  key: "user",
                  value: result.copyBlocks.userPrompt,
                  setCopiedPromptKey,
                  setErrorMessage,
                })
              }
            />
            <CopyButton
              copied={copiedPromptKey === "negative"}
              label="Copy Negative"
              onCopy={() =>
                copyPromptBlock({
                  key: "negative",
                  value: result.copyBlocks.negativePrompt,
                  setCopiedPromptKey,
                  setErrorMessage,
                })
              }
            />
          </div>
        ) : null}
      </div>
      {result ? (
        <div className="mt-4 space-y-4">
          {result.warnings.length > 0 ? (
            <div className="rounded-[16px] border border-accent-orange bg-accent-orange/10 p-3 text-sm text-[#FFD499]">
              {result.warnings.join(" ")}
            </div>
          ) : null}
          <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap rounded-[18px] border border-line-secondary bg-black/25 p-4 font-mono text-xs leading-6 text-ink-primary">
            {result.composedPrompt}
          </pre>
          {result.negativePrompt ? (
            <div className="rounded-[18px] border border-line-secondary bg-main p-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">
                Negative prompt
              </p>
              <p className="mt-3 font-mono text-xs leading-6 text-ink-secondary">
                {result.negativePrompt}
              </p>
            </div>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            <VariableList label="Used Variables" values={result.usedVariables} />
            <VariableList label="Available Variables" values={result.availableVariables} />
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[18px] border border-line-secondary bg-main p-4 text-sm leading-6 text-ink-secondary">
          Compose a preview to generate a vendor-ready prompt snapshot.
        </div>
      )}
    </div>
  );
}

function CopyButton({
  copied,
  label,
  onCopy,
}: {
  copied: boolean;
  label: string;
  onCopy: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "rounded-[14px] border px-3 py-2 text-xs uppercase tracking-[0.16em] transition-colors",
        copied
          ? "border-accent-teal bg-accent-teal/15 text-[#A6FFD5]"
          : "border-line-secondary bg-main text-ink-secondary hover:border-line-active hover:text-ink-primary"
      )}
    >
      {copied ? "Copied" : label}
    </button>
  );
}

function VariableList({ label, values }: { label: string; values: string[] }) {
  return (
    <div className="rounded-[18px] border border-line-secondary bg-main p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">{label}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.length === 0 ? (
          <span className="text-sm text-ink-secondary">None</span>
        ) : (
          values.map((value) => (
            <code
              key={value}
              className="rounded-[10px] border border-line-secondary bg-black/20 px-2 py-1 text-xs text-ink-secondary"
            >
              {`{{${value}}}`}
            </code>
          ))
        )}
      </div>
    </div>
  );
}

function PromptLabRunList({
  busyKey,
  runs,
  setBusyKey,
  setErrorMessage,
  setStatusMessage,
  updatePromptExperimentRun,
}: {
  busyKey: string | null;
  runs: Array<{
    _id: Id<"promptExperimentRuns">;
    _creationTime: number;
    templateKind: string;
    templateName: string;
    templateVersion: string;
    status: "ready-for-web" | "tested" | "selected" | "rejected" | "archived";
    providerLabel?: string;
    modelLabel?: string;
    outputImageUrl?: string;
    outputNotes?: string;
    overallScore?: number;
    selectedAsWinner: boolean;
  }>;
  setBusyKey: (key: string | null) => void;
  setErrorMessage: (message: string | null) => void;
  setStatusMessage: (message: string | null) => void;
  updatePromptExperimentRun: ReturnType<typeof useMutation<typeof api.admin.updatePromptExperimentRun>>;
}) {
  return (
    <div className="rounded-[20px] border border-line-secondary bg-panel p-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-ink-muted">
        Recent experiment runs
      </p>
      <div className="mt-4 space-y-3">
        {runs.length === 0 ? (
          <div className="rounded-[16px] border border-line-secondary bg-main p-4 text-sm leading-6 text-ink-secondary">
            No prompt experiments have been saved yet. Use the test template cards above,
            compose a prompt, then save a manual web result to create the first record.
          </div>
        ) : (
          runs.map((run) => (
            <article key={run._id} className="rounded-[18px] border border-line-secondary bg-main p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <FlagPill label={run.status} tone={promptRunStatusTone(run.status)} />
                    <FlagPill label={run.templateKind} tone="cyan" />
                    {run.selectedAsWinner ? <FlagPill label="winner" tone="amber" /> : null}
                  </div>
                  <h4 className="mt-3 text-base font-semibold text-ink-primary">
                    {run.providerLabel || "Manual web"} / {run.modelLabel || "model unlabeled"}
                  </h4>
                  <p className="mt-1 text-xs text-ink-secondary">
                    {run.templateName} v{run.templateVersion} / {formatDateTime(run._creationTime)}
                  </p>
                  {run.outputNotes ? (
                    <p className="mt-3 text-sm leading-6 text-ink-muted">{run.outputNotes}</p>
                  ) : null}
                </div>
                <div className="grid min-w-[150px] gap-2 text-sm">
                  <MetaRow
                    label="Overall"
                    value={run.overallScore === undefined ? "N/A" : `${run.overallScore}/10`}
                  />
                  {run.outputImageUrl ? (
                    <a
                      href={run.outputImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-[14px] border border-accent-blue px-3 py-2 text-center text-xs text-ink-primary transition-colors hover:bg-accent-blue/15"
                    >
                      Open Image
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <ActionButton
                  onClick={() =>
                    void runAdminAction({
                      key: `prompt-run-select-${run._id}`,
                      action: async () => {
                        await updatePromptExperimentRun({
                          runId: run._id,
                          status: "selected",
                          selectedAsWinner: true,
                        });
                      },
                      success: "Marked prompt experiment as selected.",
                      setBusyKey,
                      setErrorMessage,
                      setStatusMessage,
                    })
                  }
                  busy={busyKey === `prompt-run-select-${run._id}`}
                >
                  Select
                </ActionButton>
                <ActionButton
                  onClick={() =>
                    void runAdminAction({
                      key: `prompt-run-reject-${run._id}`,
                      action: async () => {
                        await updatePromptExperimentRun({
                          runId: run._id,
                          status: "rejected",
                          selectedAsWinner: false,
                        });
                      },
                      success: "Marked prompt experiment as rejected.",
                      setBusyKey,
                      setErrorMessage,
                      setStatusMessage,
                    })
                  }
                  busy={busyKey === `prompt-run-reject-${run._id}`}
                  tone="danger"
                >
                  Reject
                </ActionButton>
                <button
                  type="button"
                  onClick={() =>
                    void runAdminAction({
                      key: `prompt-run-archive-${run._id}`,
                      action: async () => {
                        await updatePromptExperimentRun({
                          runId: run._id,
                          status: "archived",
                          selectedAsWinner: false,
                        });
                      },
                      success: "Archived prompt experiment.",
                      setBusyKey,
                      setErrorMessage,
                      setStatusMessage,
                    })
                  }
                  className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary"
                >
                  Archive
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function CatalogLoading({ label }: { label: string }) {
  return (
    <div className="rounded-[18px] border border-line-secondary bg-main p-4 text-sm text-ink-secondary">
      {label}
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-line-guide pb-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">{label}</span>
      <span className="text-sm text-ink-primary">{value}</span>
    </div>
  );
}

function DiagnosticRow({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-line-secondary bg-panel p-4">
      <p className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">{label}</p>
      <p className={cn("mt-2 text-sm text-ink-primary", mono && "break-all font-mono text-[12px]")}>
        {value}
      </p>
    </div>
  );
}

function formatClerkError(error: unknown) {
  if (error && typeof error === "object") {
    const clerkError = error as {
      clerkError?: boolean;
      errors?: Array<{
        code?: string;
        longMessage?: string;
        message?: string;
      }>;
      message?: string;
      status?: number;
    };
    const firstNestedError = clerkError.errors?.[0];
    const nestedMessage =
      firstNestedError?.longMessage ?? firstNestedError?.message ?? firstNestedError?.code;
    const topLevelMessage = clerkError.message?.trim();
    const statusPart = clerkError.status ? `status ${clerkError.status}` : null;
    const parts = [nestedMessage, topLevelMessage, statusPart].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(" / ");
    }
  }

  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }

  return "unknown Clerk error";
}

function joinCsv(values: string[]) {
  return values.join(", ");
}

function isBrowserStorageAvailable() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readStoredString(key: string) {
  if (!isBrowserStorageAvailable()) {
    return null;
  }
  return window.localStorage.getItem(key);
}

function writeStoredString(key: string, value: string | null) {
  if (!isBrowserStorageAvailable()) {
    return;
  }
  if (value === null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, value);
}

function writeStoredJson(key: string, value: unknown) {
  if (!isBrowserStorageAvailable()) {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
}

function isAdminSectionId(value: string | null): value is AdminSectionId {
  return (
    value === "templates" ||
    value === "prompt-lab" ||
    value === "ops" ||
    value === "access" ||
    value === "commerce" ||
    value === "catalog"
  );
}

function readInitialAdminSection(): AdminSectionId {
  if (typeof window === "undefined") {
    return "templates";
  }
  return parseAdminSectionHash(window.location.hash) ?? "templates";
}

function parseAdminSectionHash(hash: string) {
  const value = hash.replace(/^#/, "");
  return isAdminSectionId(value) ? value : null;
}

function writeAdminSectionHash(section: AdminSectionId) {
  if (typeof window === "undefined") {
    return;
  }
  const hash = section === "templates" ? "" : `#${section}`;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
}

function createTemplateDraft(
  template: {
    _id: Id<"promptTemplates">;
    name: string;
    version: string;
    notePolicy?: string;
    systemPrompt: string;
    userPromptTemplate: string;
    negativePromptTemplate?: string;
    isActive: boolean;
  }
): TemplateDraft {
  return {
    promptTemplateId: template._id,
    name: template.name,
    version: template.version,
    notePolicy: template.notePolicy ?? "",
    systemPrompt: template.systemPrompt,
    userPromptTemplate: template.userPromptTemplate,
    negativePromptTemplate: template.negativePromptTemplate ?? "",
    isActive: template.isActive,
  };
}

function patchTemplateDraft(
  current: TemplateDraft | null,
  selectedTemplate: {
    _id: Id<"promptTemplates">;
    name: string;
    version: string;
    notePolicy?: string;
    systemPrompt: string;
    userPromptTemplate: string;
    negativePromptTemplate?: string;
    isActive: boolean;
  },
  patch: Partial<Omit<TemplateDraft, "promptTemplateId">>
) {
  const base =
    current?.promptTemplateId === selectedTemplate._id
      ? current
      : createTemplateDraft(selectedTemplate);
  return { ...base, ...patch };
}

function readStoredPromptLabDraft() {
  return readStoredObject(promptLabDraftStorageKey, defaultPromptLabDraft, isPromptLabDraft);
}

function readStoredPromptLabExperimentDraft() {
  return readStoredObject(
    promptLabExperimentDraftStorageKey,
    defaultPromptLabExperimentDraft,
    isPromptLabExperimentDraft
  );
}

function readStoredObject<T>(key: string, fallback: T, guard: (value: unknown) => value is T) {
  const raw = readStoredString(key);
  if (!raw) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return guard(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function isPromptLabDraft(value: unknown): value is PromptLabDraft {
  if (!value || typeof value !== "object") {
    return false;
  }
  const draft = value as Partial<PromptLabDraft>;
  return (
    typeof draft.kitVariantId === "string" &&
    typeof draft.stylePresetId === "string" &&
    typeof draft.materialPresetId === "string" &&
    Array.isArray(draft.moodTags) &&
    draft.moodTags.every(isMoodTag) &&
    isWeatheringLevel(draft.weatheringLevel) &&
    typeof draft.notes === "string" &&
    typeof draft.conceptId === "string" &&
    typeof draft.remixSource === "string"
  );
}

function isPromptLabExperimentDraft(value: unknown): value is PromptLabExperimentDraft {
  if (!value || typeof value !== "object") {
    return false;
  }
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

function isMoodTag(value: unknown): value is MoodTag {
  return promptLabMoodOptions.some((option) => option.value === value);
}

function isWeatheringLevel(value: unknown): value is WeatheringLevel {
  return promptLabWeatheringOptions.some((option) => option.value === value);
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildPromptLabArgs(promptTemplateId: Id<"promptTemplates">, draft: PromptLabDraft) {
  return {
    promptTemplateId,
    kitVariantId:
      draft.kitVariantId === "none" ? undefined : (draft.kitVariantId as Id<"baseModels">),
    stylePresetId:
      draft.stylePresetId === "none" ? undefined : (draft.stylePresetId as Id<"stylePresets">),
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

function parseOptionalScore(value: string) {
  if (value.trim() === "") {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 10) {
    throw new Error("Scores must be between 0 and 10");
  }
  return parsed;
}

function promptRunStatusTone(status: "ready-for-web" | "tested" | "selected" | "rejected" | "archived"): FlagTone {
  if (status === "selected") {
    return "amber";
  }
  if (status === "tested") {
    return "green";
  }
  if (status === "rejected") {
    return "red";
  }
  if (status === "archived") {
    return "neutral";
  }
  return "cyan";
}

function copyPromptBlock({
  key,
  setCopiedPromptKey,
  setErrorMessage,
  value,
}: {
  key: string;
  setCopiedPromptKey: (key: string | null) => void;
  setErrorMessage: (message: string | null) => void;
  value: string;
}) {
  if (!value.trim()) {
    setErrorMessage("This prompt block is empty.");
    return;
  }
  if (typeof navigator.clipboard.writeText !== "function") {
    setErrorMessage("Clipboard API is not available in this browser context.");
    return;
  }
  void navigator.clipboard
    .writeText(value)
    .then(() => {
      setCopiedPromptKey(key);
      window.setTimeout(() => setCopiedPromptKey(null), 1400);
    })
    .catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Failed to copy prompt block");
    });
}

function defaultCreditCampaignDraft(): CreditCampaignDraft {
  const now = Date.now();
  return {
    name: "",
    description: "",
    startsAt: formatDateTimeInput(now),
    endsAt: formatDateTimeInput(now + 7 * 24 * 60 * 60 * 1000),
    defaultCreditAmount: "20",
    maxRedemptions: "",
    perUserLimit: "1",
    isActive: true,
  };
}

function defaultCodeBatchDraft(campaign: { defaultCreditAmount: number; endsAt: number; name: string }): CodeBatchDraft {
  return {
    count: "10",
    creditAmount: String(campaign.defaultCreditAmount),
    maxRedemptionsPerCode: "1",
    prefix: deriveCodePrefix(campaign.name),
    expiresAt: formatDateTimeInput(campaign.endsAt),
  };
}

function deriveCodePrefix(name: string) {
  const normalized = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "")
    .slice(0, 8);
  return normalized.length >= 2 ? normalized : "NTL";
}

function parseIntegerField(value: string, label: string) {
  const normalized = value.trim();
  const parsed = Number(normalized);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return parsed;
}

function parseOptionalIntegerField(value: string, label: string) {
  if (value.trim() === "") {
    return undefined;
  }
  return parseIntegerField(value, label);
}

function parseDateTimeField(value: string, label: string) {
  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a valid date and time`);
  }
  return parsed;
}

function parseOptionalDateTimeField(value: string, label: string) {
  if (value.trim() === "") {
    return undefined;
  }
  return parseDateTimeField(value, label);
}

function formatDateTimeInput(timestamp: number) {
  const date = new Date(timestamp);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
  return localDate.toISOString().slice(0, 16);
}

function formatDateTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function getCampaignState(campaign: { endsAt: number; isActive: boolean; startsAt: number }): {
  label: string;
  tone: FlagTone;
} {
  const now = Date.now();
  if (!campaign.isActive) {
    return { label: "paused", tone: "red" };
  }
  if (now < campaign.startsAt) {
    return { label: "scheduled", tone: "amber" };
  }
  if (now > campaign.endsAt) {
    return { label: "ended", tone: "neutral" };
  }
  return { label: "live", tone: "green" };
}

function getActivationCodeState(code: {
  expiresAt?: number;
  isActive: boolean;
  maxRedemptions: number;
  redemptionCount: number;
}): {
  label: string;
  tone: FlagTone;
} {
  if (code.redemptionCount >= code.maxRedemptions) {
    return { label: "exhausted", tone: "neutral" };
  }
  if (!code.isActive) {
    return { label: "disabled", tone: "red" };
  }
  if (code.expiresAt !== undefined && Date.now() > code.expiresAt) {
    return { label: "expired", tone: "amber" };
  }
  return { label: "active", tone: "green" };
}

function defaultCreatorPackDraft(): CreatorPackDraft {
  return {
    name: "",
    creatorUserId: "",
    description: "",
    tagline: "",
    stylePresetIds: "",
    kitVariantIds: "",
    materialPresetIds: "",
    packType: "free",
    isFeatured: false,
    isActive: true,
  };
}

function emptyToUndefined(value: string) {
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

function FlagPill({
  label,
  tone,
}: {
  label: string;
  tone: FlagTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-[28px] items-center border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] shadow-[inset_0_-1px_0_rgba(255,255,255,0.55)]",
        tone === "neutral" && "border-[#5F625B] bg-[#ECE4D4] text-[#252B28]",
        tone === "cyan" && "border-[#1F6F89] bg-[#BCEAF3] text-[#0D3F50]",
        tone === "green" && "border-[#24794F] bg-[#C3F0D6] text-[#11462E]",
        tone === "amber" && "border-[#9B5A12] bg-[#F5D28D] text-[#573407]",
        tone === "red" && "border-[#9E3528] bg-[#F3BEB3] text-[#611C15]"
      )}
    >
      {label}
    </span>
  );
}

function CommerceStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: "green" | "cyan" | "amber";
  value: string;
}) {
  return (
    <div className="rounded-[18px] border border-line-secondary bg-main p-4">
      <p
        className={cn(
          "text-[11px] uppercase tracking-[0.18em]",
          tone === "green" && "text-accent-teal",
          tone === "cyan" && "text-accent-blue",
          tone === "amber" && "text-accent-orange"
        )}
      >
        {label}
      </p>
      <p className="mt-3 text-2xl font-semibold text-ink-primary">{value}</p>
    </div>
  );
}

function feedbackStatusTone(status: string): FlagTone {
  if (status === "open") {
    return "cyan";
  }
  if (status === "triaged") {
    return "amber";
  }
  if (status === "resolved") {
    return "green";
  }
  return "red";
}

function queueStatusTone(status?: string): FlagTone {
  if (status === "open") {
    return "cyan";
  }
  if (status === "in-review") {
    return "amber";
  }
  if (status === "done") {
    return "green";
  }
  return "red";
}

function ActionButton({
  busy,
  children,
  disabled,
  onClick,
  tone = "default",
}: {
  busy?: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled || busy}
      className={cn(
        "h-10 rounded-[16px] border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-55",
        tone === "default" && "border-line-primary bg-ink-primary text-surface hover:bg-accent-blue hover:text-white",
        tone === "danger" && "border-[#9E3528] bg-[#F3BEB3] text-[#611C15] hover:bg-[#E9A092]"
      )}
    >
      {busy ? "Processing" : children}
    </Button>
  );
}
