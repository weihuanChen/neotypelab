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
import { ReactNode, useEffect, useMemo, useState } from "react";

type TemplateDraft = {
  name: string;
  version: string;
  notePolicy: string;
  systemPrompt: string;
  userPromptTemplate: string;
  negativePromptTemplate: string;
  isActive: boolean;
};

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

type BaseModelDraft = {
  name: string;
  series: string;
  manufacturer: string;
  grade: string;
  silhouetteType: string;
  complexityLevel: string;
  aliases: string;
  tags: string;
  defaultMaterialPresetId: string;
  isActive: boolean;
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
  baseModelIds: string;
  materialPresetIds: string;
  packType: "free" | "premium";
  isFeatured: boolean;
  isActive: boolean;
};

type FlagTone = "neutral" | "cyan" | "green" | "amber" | "red";
type AdminSectionId = "templates" | "ops" | "access" | "commerce" | "catalog";

type AdminSection = {
  id: AdminSectionId;
  label: string;
  eyebrow: string;
  description: string;
  metric: string;
  tone: FlagTone;
};

export function AdminWorkbench() {
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
  const updatePriceRule = useMutation(api.admin.updatePriceRule);
  const reviewFeedback = useMutation(api.admin.reviewFeedback);
  const updateBaseModel = useMutation(api.admin.updateBaseModel);
  const updateStylePreset = useMutation(api.admin.updateStylePreset);
  const updateMaterialPreset = useMutation(api.admin.updateMaterialPreset);
  const updatePaintMapping = useMutation(api.admin.updatePaintMapping);
  const upsertCreatorPack = useMutation(api.admin.upsertCreatorPack);
  const storeUser = useMutation(api.users.store);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [clerkTokenStatus, setClerkTokenStatus] = useState<string>("Not checked");
  const [activeAdminSection, setActiveAdminSection] = useState<AdminSectionId>("templates");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft | null>(null);
  const [priceRuleDrafts, setPriceRuleDrafts] = useState<Record<string, PriceRuleDraft>>({});
  const [newCreditCampaignDraft, setNewCreditCampaignDraft] = useState<CreditCampaignDraft>(
    defaultCreditCampaignDraft
  );
  const [creditCampaignDrafts, setCreditCampaignDrafts] = useState<Record<string, CreditCampaignDraft>>({});
  const [codeBatchDrafts, setCodeBatchDrafts] = useState<Record<string, CodeBatchDraft>>({});
  const [generatedCodeBatches, setGeneratedCodeBatches] = useState<Record<string, string[]>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, FeedbackDraft>>({});
  const [baseModelDrafts, setBaseModelDrafts] = useState<Record<string, BaseModelDraft>>({});
  const [stylePresetDrafts, setStylePresetDrafts] = useState<Record<string, StylePresetDraft>>({});
  const [materialPresetDrafts, setMaterialPresetDrafts] = useState<Record<string, MaterialPresetDraft>>({});
  const [paintMappingDrafts, setPaintMappingDrafts] = useState<Record<string, PaintMappingDraft>>({});
  const [creatorPackDrafts, setCreatorPackDrafts] = useState<Record<string, CreatorPackDraft>>({
    __new__: defaultCreatorPackDraft(),
  });
  const newCreatorPackDraft = creatorPackDrafts.__new__;

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
      description: "Maintain base models, Style DNA, materials, paint maps, and creator packs.",
      metric: `${catalogData?.baseModels.length ?? 0}`,
      tone: "neutral",
    },
  ];

  const selectedTemplate = useMemo(() => {
    if (!promptTemplates || promptTemplates.length === 0) {
      return null;
    }
    return (
      promptTemplates.find((template) => template._id === selectedTemplateId) ??
      promptTemplates[0]
    );
  }, [promptTemplates, selectedTemplateId]);

  useEffect(() => {
    if (!selectedTemplate) {
      setTemplateDraft(null);
      return;
    }
    setSelectedTemplateId(selectedTemplate._id);
    setTemplateDraft({
      name: selectedTemplate.name,
      version: selectedTemplate.version,
      notePolicy: selectedTemplate.notePolicy ?? "",
      systemPrompt: selectedTemplate.systemPrompt,
      userPromptTemplate: selectedTemplate.userPromptTemplate,
      negativePromptTemplate: selectedTemplate.negativePromptTemplate ?? "",
      isActive: selectedTemplate.isActive,
    });
  }, [selectedTemplate]);

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
    <div className="space-y-6 text-ink-primary">
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
        onSectionChange={setActiveAdminSection}
        sections={adminSections}
      />

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
                        {report.baseModel ? <span>Base Model: {report.baseModel.name}</span> : null}
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
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

        <aside className="space-y-6">
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
        </aside>
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
      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="border-2 border-line-primary bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">Prompt templates</p>
          <div className="mt-4 space-y-2">
            {promptTemplates === undefined ? (
              <div className="rounded-[18px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
                Loading prompt templates.
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

        <section className="border-2 border-line-primary bg-surface p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">Template editor</p>
          {templateDraft && selectedTemplate ? (
            <div className="mt-4 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Template Name">
                  <Input
                    value={templateDraft.name}
                    onChange={(event) =>
                      setTemplateDraft((current) =>
                        current ? { ...current, name: event.target.value } : current
                      )
                    }
                    className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                  />
                </Field>
                <Field label="Version">
                  <Input
                    value={templateDraft.version}
                    onChange={(event) =>
                      setTemplateDraft((current) =>
                        current ? { ...current, version: event.target.value } : current
                      )
                    }
                    className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                  />
                </Field>
              </div>
              <Field label="Note Policy">
                <Input
                  value={templateDraft.notePolicy}
                  onChange={(event) =>
                    setTemplateDraft((current) =>
                      current ? { ...current, notePolicy: event.target.value } : current
                    )
                  }
                  className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                />
              </Field>
              <Field label="System Prompt">
                <Textarea
                  value={templateDraft.systemPrompt}
                  onChange={(event) =>
                    setTemplateDraft((current) =>
                      current ? { ...current, systemPrompt: event.target.value } : current
                    )
                  }
                  className="min-h-[150px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                />
              </Field>
              <Field label="User Prompt Template">
                <Textarea
                  value={templateDraft.userPromptTemplate}
                  onChange={(event) =>
                    setTemplateDraft((current) =>
                      current ? { ...current, userPromptTemplate: event.target.value } : current
                    )
                  }
                  className="min-h-[180px] border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue"
                />
              </Field>
              <Field label="Negative Prompt Template">
                <Textarea
                  value={templateDraft.negativePromptTemplate}
                  onChange={(event) =>
                    setTemplateDraft((current) =>
                      current ? { ...current, negativePromptTemplate: event.target.value } : current
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
                          name: templateDraft.name.trim(),
                          version: templateDraft.version.trim(),
                          notePolicy: templateDraft.notePolicy.trim() || undefined,
                          systemPrompt: templateDraft.systemPrompt,
                          userPromptTemplate: templateDraft.userPromptTemplate,
                          negativePromptTemplate: templateDraft.negativePromptTemplate.trim() || undefined,
                          isActive: templateDraft.isActive,
                        });
                      },
                      success: `Saved template ${templateDraft.name}.`,
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
                      current ? { ...current, isActive: !current.isActive } : current
                    )
                  }
                  className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary"
                >
                  {templateDraft.isActive ? "Mark Inactive" : "Mark Active"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[18px] border border-line-secondary bg-panel p-4 text-sm text-ink-secondary">
              Select a prompt template to edit its composition rules.
            </div>
          )}
        </section>
      </div>
      ) : null}

      {activeAdminSection === "catalog" ? (
      <section className="border-2 border-line-primary bg-surface p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">Catalog operations</p>
            <h3 className="mt-2 text-2xl font-semibold">Base models, Style DNA, materials, paint maps</h3>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-ink-secondary">
            This is the operational catalog layer behind P1. Each entry can be tuned,
            enabled, or disabled without reseeding the deployment.
          </p>
        </div>

        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <section className="border-2 border-line-primary bg-panel p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-accent-teal">Base Models</p>
            <div className="mt-4 space-y-4">
              {catalogData === undefined ? (
                <CatalogLoading label="Loading base models." />
              ) : (
                catalogData.baseModels.map((model) => {
                  const draft = baseModelDrafts[model._id] ?? {
                    name: model.name,
                    series: model.series ?? "",
                    manufacturer: model.manufacturer ?? "",
                    grade: model.grade ?? "",
                    silhouetteType: model.silhouetteType ?? "",
                    complexityLevel: model.complexityLevel ?? "",
                    aliases: joinCsv(model.aliases),
                    tags: joinCsv(model.tags),
                    defaultMaterialPresetId: model.defaultMaterialPresetId ?? "none",
                    isActive: model.isActive,
                  };
                  return (
                    <article key={model._id} className="rounded-[20px] border border-line-secondary bg-main p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <FlagPill label={model.slug} tone="cyan" />
                        <FlagPill label={draft.isActive ? "active" : "inactive"} tone={draft.isActive ? "green" : "red"} />
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <Field label="Name">
                          <Input value={draft.name} onChange={(event) => setBaseModelDrafts((current) => ({ ...current, [model._id]: { ...draft, name: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Series">
                          <Input value={draft.series} onChange={(event) => setBaseModelDrafts((current) => ({ ...current, [model._id]: { ...draft, series: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Manufacturer">
                          <Input value={draft.manufacturer} onChange={(event) => setBaseModelDrafts((current) => ({ ...current, [model._id]: { ...draft, manufacturer: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Grade">
                          <Input value={draft.grade} onChange={(event) => setBaseModelDrafts((current) => ({ ...current, [model._id]: { ...draft, grade: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Silhouette">
                          <Input value={draft.silhouetteType} onChange={(event) => setBaseModelDrafts((current) => ({ ...current, [model._id]: { ...draft, silhouetteType: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Complexity">
                          <Input value={draft.complexityLevel} onChange={(event) => setBaseModelDrafts((current) => ({ ...current, [model._id]: { ...draft, complexityLevel: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Aliases CSV">
                          <Input value={draft.aliases} onChange={(event) => setBaseModelDrafts((current) => ({ ...current, [model._id]: { ...draft, aliases: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Tags CSV">
                          <Input value={draft.tags} onChange={(event) => setBaseModelDrafts((current) => ({ ...current, [model._id]: { ...draft, tags: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-teal" />
                        </Field>
                        <Field label="Default Material">
                          <Select value={draft.defaultMaterialPresetId} onValueChange={(value) => setBaseModelDrafts((current) => ({ ...current, [model._id]: { ...draft, defaultMaterialPresetId: value } }))}>
                            <SelectTrigger className="h-11 border-line-secondary bg-main text-ink-primary">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="border-line-secondary bg-panel text-ink-primary">
                              <SelectItem value="none">None</SelectItem>
                              {catalogData.materialPresets.map((preset) => (
                                <SelectItem key={preset._id} value={preset._id}>{preset.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </Field>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        <ActionButton
                          onClick={() =>
                            void runAdminAction({
                              key: `base-model-${model._id}`,
                              action: async () => {
                                await updateBaseModel({
                                  baseModelId: model._id,
                                  name: draft.name.trim(),
                                  series: emptyToUndefined(draft.series),
                                  manufacturer: emptyToUndefined(draft.manufacturer),
                                  grade: emptyToUndefined(draft.grade),
                                  silhouetteType: emptyToUndefined(draft.silhouetteType),
                                  complexityLevel: emptyToUndefined(draft.complexityLevel),
                                  aliases: parseCsv(draft.aliases),
                                  tags: parseCsv(draft.tags),
                                  defaultMaterialPresetId: draft.defaultMaterialPresetId === "none" ? undefined : draft.defaultMaterialPresetId as Id<"materialPresets">,
                                  isActive: draft.isActive,
                                });
                              },
                              success: `Saved base model ${draft.name}.`,
                              setBusyKey,
                              setErrorMessage,
                              setStatusMessage,
                            })
                          }
                          busy={busyKey === `base-model-${model._id}`}
                        >
                          Save Base Model
                        </ActionButton>
                        <button type="button" onClick={() => setBaseModelDrafts((current) => ({ ...current, [model._id]: { ...draft, isActive: !draft.isActive } }))} className="rounded-[16px] border border-line-secondary px-4 py-2 text-sm text-ink-secondary transition-colors hover:bg-hover-subtle hover:text-ink-primary">
                          {draft.isActive ? "Disable" : "Enable"}
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="border-2 border-line-primary bg-panel p-5">
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

          <section className="border-2 border-line-primary bg-panel p-5">
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

          <section className="border-2 border-line-primary bg-panel p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-accent-blue">Creator Packs</p>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  Bundle creator-owned Style DNA, base models, and material presets into shareable starter packs.
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
                        baseModelIds: parseCsv(draft.baseModelIds) as Id<"baseModels">[],
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
                      <Field label="Base Model IDs CSV">
                        <Input value={newCreatorPackDraft.baseModelIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, __new__: { ...newCreatorPackDraft, baseModelIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
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
                      baseModelIds: joinCsv(pack.baseModelIds),
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
                          <Field label="Base Model IDs CSV">
                            <Input value={draft.baseModelIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, baseModelIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
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
                                    baseModelIds: parseCsv(draft.baseModelIds) as Id<"baseModels">[],
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

          <section className="border-2 border-line-primary bg-panel p-5">
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

          <section className="border-2 border-line-primary bg-panel p-5">
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
                    baseModelIds: joinCsv(pack.baseModelIds),
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
                        <Field label="Base Model IDs CSV">
                          <Input value={draft.baseModelIds} onChange={(event) => setCreatorPackDrafts((current) => ({ ...current, [pack._id]: { ...draft, baseModelIds: event.target.value } }))} className="border-line-secondary bg-main text-ink-primary focus-visible:ring-accent-blue" />
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
                                  baseModelIds: parseCsv(draft.baseModelIds) as Id<"baseModels">[],
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
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5"
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

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
    baseModelIds: "",
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
