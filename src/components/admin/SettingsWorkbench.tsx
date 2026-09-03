"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import {
  CheckIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  PlusIcon,
  ReloadIcon,
} from "@radix-ui/react-icons";
import { useAction, useMutation, useQuery } from "convex/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import type { AdminSettingsSearch } from "./adminRouteSearch";

type SettingsSection = NonNullable<AdminSettingsSearch["section"]>;
type PipelineAction = "repaint-concept" | "hd-render" | "palette-plan" | "style-suggestion";
type ProviderId = Id<"llmProfiles">;
type TemplateId = Id<"promptTemplates">;
type TemplateVersionId = Id<"promptTemplateVersions">;

type ProviderRecord = {
  _id: ProviderId;
  name: string;
  slug: string;
  provider: ProviderDraft["provider"];
  modelId: string;
  capability: ProviderDraft["capability"];
  apiFormat: "openai-compatible";
  baseUrl: string;
  keyEnvName: string;
  timeoutMs?: number;
  priority: number;
  notes?: string;
  isActive: boolean;
  updatedAt: number;
};

type TemplateRecord = {
  _id: TemplateId;
  name: string;
  kind: PipelineAction;
  isActive: boolean;
  publishedVersionId?: TemplateVersionId;
  versions: Array<{
    _id: TemplateVersionId;
    version: string;
    status: "draft" | "published" | "archived";
  }>;
};

type WorkspaceData = {
  generation: GenerationDraft & { revision: number; updatedAt?: number };
  providers: ProviderRecord[];
  bindings: Array<{
    action: PipelineAction;
    bindingId?: Id<"pipelineTemplateBindings">;
    promptTemplateId?: TemplateId;
    templateName?: string;
    versionPolicy: "follow-published" | "pin-version";
    promptTemplateVersionId?: TemplateVersionId;
    version?: string;
    fallbackPromptTemplateId?: TemplateId;
    fallbackTemplateName?: string;
    effectiveFrom: number;
    updatedAt?: number;
  }>;
  templates: TemplateRecord[];
  defaults: DefaultsDraft & { revision: number; updatedAt?: number };
  system: SystemDraft & { revision: number; updatedAt?: number };
  environment: {
    environment: string;
    applicationVersion: string;
    database: string;
    assetStorage: string;
  };
};

type GenerationDraft = {
  fallbackBehavior: "secondary-provider" | "retry-primary" | "fail-job";
  maxRetryCount: number;
  timeoutSeconds: number;
  failureCreditPolicy: "auto-refund" | "manual-review" | "no-refund";
  concurrentJobsPerUser: number;
  routes: Array<{
    action: PipelineAction;
    primaryProfileId?: ProviderId;
    fallbackProfileId?: ProviderId;
  }>;
};

type ProviderDraft = {
  name: string;
  slug: string;
  provider:
    | "openai"
    | "openrouter"
    | "portkey"
    | "litellm"
    | "vercel-ai-gateway"
    | "custom-openai-compatible";
  modelId: string;
  capability: "text" | "image" | "vision" | "embedding";
  baseUrl: string;
  keyEnvName: string;
  timeoutSeconds: number;
  priority: number;
  notes: string;
  isActive: boolean;
};

type BindingDraft = {
  action: PipelineAction;
  promptTemplateId: TemplateId | "";
  versionPolicy: "follow-published" | "pin-version";
  promptTemplateVersionId: TemplateVersionId | "";
  fallbackPromptTemplateId: TemplateId | "";
};

type DefaultsDraft = {
  weathering: "clean" | "light" | "moderate" | "heavy";
  visibility: "private" | "unlisted" | "public";
  mood: "none" | "heroic" | "industrial" | "cinematic";
  imageCount: number;
  generationQuality: "standard" | "high";
  generationLanguage: "english" | "japanese" | "chinese";
};

type SystemDraft = {
  allowRegistrations: boolean;
  allowPublicPrototypes: boolean;
  allowRemix: boolean;
  enableFeedback: boolean;
  enableCreditRedemption: boolean;
  enablePurchases: boolean;
  maintenanceMode: boolean;
};

type RiskDialogState = {
  title: string;
  description: string;
  confirmLabel: string;
  run: () => Promise<void>;
};

const sections: Array<{
  id: SettingsSection;
  label: string;
  description: string;
}> = [
  { id: "generation", label: "Generation", description: "Routing and job policy" },
  { id: "providers", label: "Providers", description: "Model capability profiles" },
  { id: "bindings", label: "Bindings", description: "Pipeline template map" },
  { id: "defaults", label: "Defaults", description: "Unspecified user choices" },
  { id: "system", label: "System", description: "Platform switches" },
];

const actionLabels: Record<PipelineAction, string> = {
  "repaint-concept": "Repaint Concept",
  "hd-render": "HD Render",
  "palette-plan": "Palette Plan",
  "style-suggestion": "Style Suggestion",
};

const providerLabels: Record<ProviderDraft["provider"], string> = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  portkey: "Portkey",
  litellm: "LiteLLM",
  "vercel-ai-gateway": "Vercel AI Gateway",
  "custom-openai-compatible": "Custom OpenAI-compatible",
};

const emptyProviderDraft: ProviderDraft = {
  name: "",
  slug: "",
  provider: "openai",
  modelId: "",
  capability: "image",
  baseUrl: "https://api.openai.com/v1",
  keyEnvName: "OPENAI_API_KEY",
  timeoutSeconds: 90,
  priority: 0,
  notes: "",
  isActive: true,
};

export function SettingsWorkbench({ search }: { search: AdminSettingsSearch }) {
  const navigate = useNavigate({ from: "/admin/settings" });
  const section = search.section ?? "generation";
  const workspace = useQuery(api.admin.getSettingsWorkspace) as WorkspaceData | undefined;
  const saveGeneration = useMutation(api.admin.saveGenerationSettings);
  const saveDefaults = useMutation(api.admin.savePlatformDefaults);
  const saveSystem = useMutation(api.admin.saveSystemSettings);
  const saveBinding = useMutation(api.admin.savePipelineTemplateBinding);
  const createProvider = useMutation(api.admin.createLlmProfile);
  const updateProvider = useMutation(api.admin.updateLlmProfile);
  const testProvider = useAction(api.generationNode.testLlmProfileConnection);

  const [generationDraft, setGenerationDraft] = useState<GenerationDraft | null>(null);
  const [defaultsDraft, setDefaultsDraft] = useState<DefaultsDraft | null>(null);
  const [systemDraft, setSystemDraft] = useState<SystemDraft | null>(null);
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId | "new" | null>(null);
  const [providerDraft, setProviderDraft] = useState<ProviderDraft | null>(null);
  const [selectedAction, setSelectedAction] = useState<PipelineAction>("repaint-concept");
  const [bindingDraft, setBindingDraft] = useState<BindingDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionResult, setConnectionResult] = useState<{
    ok: boolean;
    message: string;
    latencyMs: number;
  } | null>(null);
  const [riskDialog, setRiskDialog] = useState<RiskDialogState | null>(null);

  const selectedProvider = useMemo(
    () => workspace?.providers.find((item) => item._id === selectedProviderId) ?? null,
    [selectedProviderId, workspace?.providers]
  );
  const selectedBinding = useMemo(
    () => workspace?.bindings.find((item) => item.action === selectedAction) ?? null,
    [selectedAction, workspace?.bindings]
  );
  const compatibleTemplates = useMemo(
    () => workspace?.templates.filter((template) => template.kind === selectedAction) ?? [],
    [selectedAction, workspace?.templates]
  );
  const selectedTemplate = compatibleTemplates.find(
    (template) => template._id === bindingDraft?.promptTemplateId
  );

  useEffect(() => {
    if (!workspace) return;
    setGenerationDraft(stripGenerationMeta(workspace.generation));
  }, [workspace?.generation.revision]);

  useEffect(() => {
    if (!workspace) return;
    setDefaultsDraft(stripDefaultsMeta(workspace.defaults));
  }, [workspace?.defaults.revision]);

  useEffect(() => {
    if (!workspace) return;
    setSystemDraft(stripSystemMeta(workspace.system));
  }, [workspace?.system.revision]);

  useEffect(() => {
    if (!workspace) return;
    if (selectedProviderId === null) {
      setSelectedProviderId(workspace.providers[0]?._id ?? "new");
    }
  }, [selectedProviderId, workspace]);

  useEffect(() => {
    if (selectedProviderId === "new") {
      setProviderDraft({ ...emptyProviderDraft });
      setConnectionResult(null);
      return;
    }
    if (!selectedProvider) return;
    setProviderDraft(providerToDraft(selectedProvider));
    setConnectionResult(null);
  }, [selectedProvider?._id, selectedProvider?.updatedAt, selectedProviderId]);

  useEffect(() => {
    if (!workspace) return;
    setBindingDraft(bindingToDraft(selectedAction, selectedBinding));
  }, [selectedAction, selectedBinding?.updatedAt, workspace]);

  const generationDirty = Boolean(
    workspace && generationDraft && !equalJson(generationDraft, stripGenerationMeta(workspace.generation))
  );
  const defaultsDirty = Boolean(
    workspace && defaultsDraft && !equalJson(defaultsDraft, stripDefaultsMeta(workspace.defaults))
  );
  const systemDirty = Boolean(
    workspace && systemDraft && !equalJson(systemDraft, stripSystemMeta(workspace.system))
  );
  const providerDirty = Boolean(
    providerDraft &&
      (selectedProviderId === "new"
        ? providerDraft.name.trim() || providerDraft.modelId.trim()
        : selectedProvider && !equalJson(providerDraft, providerToDraft(selectedProvider)))
  );
  const bindingDirty = Boolean(
    bindingDraft && !equalJson(bindingDraft, bindingToDraft(selectedAction, selectedBinding))
  );
  const dirty =
    section === "generation"
      ? generationDirty
      : section === "providers"
        ? providerDirty
        : section === "bindings"
          ? bindingDirty
          : section === "defaults"
            ? defaultsDirty
            : systemDirty;

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const changeSection = (next: SettingsSection) => {
    if (next === section) return;
    if (dirty && !window.confirm("Discard the unsaved changes in this settings section?")) return;
    discardCurrent();
    setStatusMessage(null);
    setErrorMessage(null);
    void navigate({ search: { section: next } });
  };

  const runOperation = async (operation: () => Promise<void>) => {
    setBusy(true);
    setStatusMessage(null);
    setErrorMessage(null);
    try {
      await operation();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Settings could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const persistGeneration = async () => {
    if (!workspace || !generationDraft) return;
    await runOperation(async () => {
      await saveGeneration({
        expectedRevision: workspace.generation.revision,
        ...generationDraft,
      });
      setStatusMessage("Generation settings saved.");
    });
  };

  const persistDefaults = async () => {
    if (!workspace || !defaultsDraft) return;
    await runOperation(async () => {
      await saveDefaults({ expectedRevision: workspace.defaults.revision, ...defaultsDraft });
      setStatusMessage("Platform defaults saved.");
    });
  };

  const persistSystem = async () => {
    if (!workspace || !systemDraft) return;
    await runOperation(async () => {
      await saveSystem({ expectedRevision: workspace.system.revision, ...systemDraft });
      setStatusMessage("System settings saved.");
    });
  };

  const persistProvider = async () => {
    if (!providerDraft) return;
    if (!providerDraft.name.trim() || !providerDraft.modelId.trim()) {
      setErrorMessage("Provider name and model are required.");
      return;
    }
    await runOperation(async () => {
      const input = {
        name: providerDraft.name,
        slug: providerDraft.slug || undefined,
        provider: providerDraft.provider,
        capability: providerDraft.capability,
        apiFormat: "openai-compatible" as const,
        baseUrl: providerDraft.baseUrl,
        keyEnvName: providerDraft.keyEnvName,
        modelId: providerDraft.modelId,
        timeoutMs: providerDraft.timeoutSeconds * 1000,
        priority: providerDraft.priority,
        notes: providerDraft.notes,
        isActive: providerDraft.isActive,
      };
      if (selectedProviderId === "new") {
        const providerId = await createProvider(input);
        setSelectedProviderId(providerId);
        setStatusMessage("Provider profile created.");
      } else if (selectedProviderId) {
        await updateProvider({ profileId: selectedProviderId, ...input });
        setStatusMessage("Provider profile saved.");
      }
    });
  };

  const persistBinding = async () => {
    if (!bindingDraft || !bindingDraft.promptTemplateId) {
      setErrorMessage("Select a template before saving the binding.");
      return;
    }
    if (bindingDraft.versionPolicy === "pin-version" && !bindingDraft.promptTemplateVersionId) {
      setErrorMessage("Select a specific version to pin.");
      return;
    }
    await runOperation(async () => {
      await saveBinding({
        action: bindingDraft.action,
        promptTemplateId: bindingDraft.promptTemplateId as TemplateId,
        versionPolicy: bindingDraft.versionPolicy,
        promptTemplateVersionId:
          bindingDraft.versionPolicy === "pin-version" && bindingDraft.promptTemplateVersionId
            ? (bindingDraft.promptTemplateVersionId as TemplateVersionId)
            : undefined,
        fallbackPromptTemplateId: bindingDraft.fallbackPromptTemplateId
          ? (bindingDraft.fallbackPromptTemplateId as TemplateId)
          : undefined,
      });
      setStatusMessage(`${actionLabels[bindingDraft.action]} binding saved.`);
    });
  };

  const requestSave = () => {
    if (section === "generation") {
      setRiskDialog({
        title: "Apply generation routing changes?",
        description:
          "New jobs will use these provider routes, retry limits, and failure-credit rules immediately after saving.",
        confirmLabel: "Apply generation settings",
        run: persistGeneration,
      });
      return;
    }
    if (section === "bindings") {
      setRiskDialog({
        title: `Change the ${actionLabels[selectedAction]} binding?`,
        description:
          "New pipeline runs will resolve their prompt from this template and version policy. Existing run snapshots will not change.",
        confirmLabel: "Save binding",
        run: persistBinding,
      });
      return;
    }
    if (
      section === "system" &&
      workspace &&
      systemDraft?.maintenanceMode !== workspace.system.maintenanceMode
    ) {
      setRiskDialog({
        title: systemDraft?.maintenanceMode ? "Enable maintenance mode?" : "Disable maintenance mode?",
        description:
          "This changes platform availability. Administrators retain access so the setting can be reversed.",
        confirmLabel: systemDraft?.maintenanceMode ? "Enable maintenance" : "Resume platform",
        run: persistSystem,
      });
      return;
    }
    if (
      section === "providers" &&
      selectedProvider &&
      providerDraft?.isActive !== selectedProvider.isActive
    ) {
      setRiskDialog({
        title: providerDraft?.isActive ? "Activate this provider?" : "Deactivate this provider?",
        description:
          "Provider availability affects routing. Generation routes pointing to an inactive provider will fall back to another active profile.",
        confirmLabel: providerDraft?.isActive ? "Activate provider" : "Deactivate provider",
        run: persistProvider,
      });
      return;
    }
    void (section === "providers"
      ? persistProvider()
      : section === "defaults"
        ? persistDefaults()
        : persistSystem());
  };

  const discardCurrent = () => {
    if (!workspace) return;
    if (section === "generation") setGenerationDraft(stripGenerationMeta(workspace.generation));
    if (section === "defaults") setDefaultsDraft(stripDefaultsMeta(workspace.defaults));
    if (section === "system") setSystemDraft(stripSystemMeta(workspace.system));
    if (section === "providers") {
      setProviderDraft(selectedProvider ? providerToDraft(selectedProvider) : { ...emptyProviderDraft });
    }
    if (section === "bindings") {
      setBindingDraft(bindingToDraft(selectedAction, selectedBinding));
    }
    setErrorMessage(null);
  };

  const handleTestConnection = async () => {
    if (!selectedProviderId || selectedProviderId === "new") return;
    setBusy(true);
    setConnectionResult(null);
    setErrorMessage(null);
    try {
      const result = await testProvider({ profileId: selectedProviderId });
      setConnectionResult(result);
    } catch (error) {
      setConnectionResult({
        ok: false,
        latencyMs: 0,
        message: error instanceof Error ? error.message : "Connection test failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  if (!workspace || !generationDraft || !defaultsDraft || !systemDraft) {
    return (
      <div className="settings-console settings-console--loading">
        <p>System settings</p>
        <h2>Loading configuration.</h2>
      </div>
    );
  }

  return (
    <div className={cn("settings-console", dirty && "has-unsaved-changes")}>
      <header className="settings-console__head">
        <p>System configuration</p>
        <h2>Settings</h2>
        <span>Generation providers, routing and system defaults.</span>
      </header>

      <div className="settings-console__frame">
        <nav aria-label="Settings sections" className="settings-subnav">
          <p>Settings</p>
          {sections.map((item) => (
            <button
              aria-current={section === item.id ? "page" : undefined}
              className={cn(section === item.id && "is-active")}
              key={item.id}
              onClick={() => changeSection(item.id)}
              type="button"
            >
              <span>{item.label}</span>
              <small>{item.description}</small>
              <ChevronRightIcon />
            </button>
          ))}
          <div className="settings-subnav__note">
            <LockClosedIcon />
            <span>Credentials are managed separately and never exposed here.</span>
          </div>
        </nav>

        <div className="settings-console__content">
          <div aria-live="polite" className="settings-console__messages">
            {statusMessage ? <p className="is-success"><CheckIcon />{statusMessage}</p> : null}
            {errorMessage ? <p className="is-error"><ExclamationTriangleIcon />{errorMessage}</p> : null}
          </div>

          {section === "generation" ? (
            <GenerationSection
              draft={generationDraft}
              providers={workspace.providers}
              setDraft={setGenerationDraft}
            />
          ) : null}
          {section === "providers" ? (
            <ProvidersSection
              busy={busy}
              connectionResult={connectionResult}
              draft={providerDraft}
              onAdd={() => setSelectedProviderId("new")}
              onSelect={setSelectedProviderId}
              onTest={handleTestConnection}
              providers={workspace.providers}
              selectedId={selectedProviderId}
              setDraft={setProviderDraft}
            />
          ) : null}
          {section === "bindings" ? (
            <BindingsSection
              bindings={workspace.bindings}
              compatibleTemplates={compatibleTemplates}
              draft={bindingDraft}
              selectedAction={selectedAction}
              selectedTemplate={selectedTemplate}
              setDraft={setBindingDraft}
              setSelectedAction={setSelectedAction}
            />
          ) : null}
          {section === "defaults" ? (
            <DefaultsSection draft={defaultsDraft} setDraft={setDefaultsDraft} />
          ) : null}
          {section === "system" ? (
            <SystemSection
              draft={systemDraft}
              environment={workspace.environment}
              setDraft={setSystemDraft}
            />
          ) : null}
        </div>
      </div>

      {dirty ? (
        <div aria-live="polite" className="settings-save-bar">
          <div>
            <strong>You have unsaved changes.</strong>
            <span>Changes apply only after you save this section.</span>
          </div>
          <button disabled={busy} onClick={discardCurrent} type="button">Discard</button>
          <button className="is-primary" disabled={busy} onClick={requestSave} type="button">
            {busy
              ? "Saving…"
              : section === "bindings"
                ? "Save binding"
                : section === "providers"
                  ? "Save provider"
                  : `Save ${section}`}
          </button>
        </div>
      ) : null}

      <AlertDialog onOpenChange={(open) => !open && setRiskDialog(null)} open={riskDialog !== null}>
        <AlertDialogContent className="settings-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>{riskDialog?.title}</AlertDialogTitle>
            <AlertDialogDescription>{riskDialog?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const operation = riskDialog?.run;
                setRiskDialog(null);
                if (operation) void operation();
              }}
            >
              {riskDialog?.confirmLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GenerationSection({
  draft,
  providers,
  setDraft,
}: {
  draft: GenerationDraft;
  providers: ProviderRecord[];
  setDraft: (value: GenerationDraft) => void;
}) {
  const activeProviders = providers.filter((provider) => provider.isActive);
  const changeRoute = (
    action: PipelineAction,
    field: "primaryProfileId" | "fallbackProfileId",
    value: string
  ) => {
    setDraft({
      ...draft,
      routes: draft.routes.map((route) =>
        route.action === action
          ? { ...route, [field]: value ? (value as ProviderId) : undefined }
          : route
      ),
    });
  };

  return (
    <div className="settings-section">
      <SettingsSectionHead
        eyebrow="Generation"
        title="Provider routing"
        description="Choose an explicit primary and fallback capability for every production action."
      />
      <div className="settings-routing-table">
        <div className="settings-routing-table__head">
          <span>Pipeline action</span><span>Primary provider</span><span>Fallback</span>
        </div>
        {draft.routes.map((route) => (
          <div className="settings-routing-row" key={route.action}>
            <div>
              <strong>{actionLabels[route.action]}</strong>
              <small>{route.action === "style-suggestion" ? "Text capability" : "Image capability"}</small>
            </div>
            <select
              aria-label={`${actionLabels[route.action]} primary provider`}
              onChange={(event) => changeRoute(route.action, "primaryProfileId", event.target.value)}
              value={route.primaryProfileId ?? ""}
            >
              <option value="">Use legacy priority</option>
              {activeProviders.map((provider) => (
                <option key={provider._id} value={provider._id}>
                  {provider.name} / {provider.modelId}
                </option>
              ))}
            </select>
            <select
              aria-label={`${actionLabels[route.action]} fallback provider`}
              disabled={!route.primaryProfileId}
              onChange={(event) => changeRoute(route.action, "fallbackProfileId", event.target.value)}
              value={route.fallbackProfileId ?? ""}
            >
              <option value="">None</option>
              {activeProviders
                .filter((provider) => provider._id !== route.primaryProfileId)
                .map((provider) => (
                  <option key={provider._id} value={provider._id}>
                    {provider.name} / {provider.modelId}
                  </option>
                ))}
            </select>
          </div>
        ))}
        {activeProviders.length === 0 ? (
          <p className="settings-inline-note">Add an active provider profile before assigning explicit routes.</p>
        ) : null}
      </div>

      <SettingsDivider />
      <SettingsSectionHead
        eyebrow="Job policy"
        title="Failure and capacity"
        description="These defaults apply to new jobs. Provider-specific timeout overrides still take precedence."
      />
      <div className="settings-form-grid">
        <Field label="Fallback behavior" hint="What happens when the primary route is unavailable.">
          <select
            onChange={(event) => setDraft({ ...draft, fallbackBehavior: event.target.value as GenerationDraft["fallbackBehavior"] })}
            value={draft.fallbackBehavior}
          >
            <option value="secondary-provider">Retry with secondary provider</option>
            <option value="retry-primary">Retry primary provider</option>
            <option value="fail-job">Fail the job</option>
          </select>
        </Field>
        <Field label="Max retry count" hint="Retries before the job reaches a terminal failure.">
          <NumberInput max={3} min={0} onChange={(value) => setDraft({ ...draft, maxRetryCount: value })} suffix="retries" value={draft.maxRetryCount} />
        </Field>
        <Field label="Generation timeout" hint="Used when a provider profile has no override.">
          <NumberInput max={300} min={15} onChange={(value) => setDraft({ ...draft, timeoutSeconds: value })} suffix="sec" value={draft.timeoutSeconds} />
        </Field>
        <Field label="Failure credit policy" hint="Applied only after all retry routes are exhausted.">
          <select
            onChange={(event) => setDraft({ ...draft, failureCreditPolicy: event.target.value as GenerationDraft["failureCreditPolicy"] })}
            value={draft.failureCreditPolicy}
          >
            <option value="auto-refund">Auto refund</option>
            <option value="manual-review">Manual review</option>
            <option value="no-refund">No automatic refund</option>
          </select>
        </Field>
        <Field label="Concurrent jobs per user" hint="Maximum queued or running jobs per account.">
          <NumberInput max={10} min={1} onChange={(value) => setDraft({ ...draft, concurrentJobsPerUser: value })} suffix="jobs" value={draft.concurrentJobsPerUser} />
        </Field>
      </div>
    </div>
  );
}

function ProvidersSection({
  busy,
  connectionResult,
  draft,
  onAdd,
  onSelect,
  onTest,
  providers,
  selectedId,
  setDraft,
}: {
  busy: boolean;
  connectionResult: { ok: boolean; message: string; latencyMs: number } | null;
  draft: ProviderDraft | null;
  onAdd: () => void;
  onSelect: (id: ProviderId | "new") => void;
  onTest: () => void;
  providers: ProviderRecord[];
  selectedId: ProviderId | "new" | null;
  setDraft: (value: ProviderDraft) => void;
}) {
  return (
    <div className="settings-section settings-section--wide">
      <SettingsSectionHead
        action={<button className="settings-text-button" onClick={onAdd} type="button"><PlusIcon />Add provider</button>}
        eyebrow="Providers"
        title="Capability profiles"
        description="Provider profiles are production capability entrances, not experiments."
      />
      <div className="settings-provider-workspace">
        <div aria-label="Provider profiles" className="settings-provider-list">
          {providers.map((provider) => (
            <button
              aria-current={provider._id === selectedId ? "true" : undefined}
              className={cn(provider._id === selectedId && "is-active")}
              key={provider._id}
              onClick={() => onSelect(provider._id)}
              type="button"
            >
              <span className={cn("settings-status-dot", !provider.isActive && "is-inactive")} />
              <span>
                <strong>{provider.name}</strong>
                <small>{providerLabels[provider.provider]} · {provider.modelId}</small>
              </span>
              <em>{provider.capability}</em>
            </button>
          ))}
          {selectedId === "new" ? (
            <button aria-current="true" className="is-active is-new" type="button">
              <span className="settings-status-dot" />
              <span><strong>New provider</strong><small>Unsaved profile</small></span>
              <em>draft</em>
            </button>
          ) : null}
          {providers.length === 0 && selectedId !== "new" ? <p>No provider profiles yet.</p> : null}
        </div>

        <div className="settings-provider-inspector">
          {draft ? (
            <>
              <div className="settings-provider-inspector__title">
                <div><p>Provider profile</p><h3>{draft.name || "New provider"}</h3></div>
                <label className="settings-compact-toggle">
                  <span>{draft.isActive ? "Active" : "Inactive"}</span>
                  <Switch checked={draft.isActive} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
                </label>
              </div>
              <div className="settings-form-grid is-compact">
                <Field label="Profile name"><input onChange={(event) => setDraft({ ...draft, name: event.target.value })} value={draft.name} /></Field>
                <Field label="Slug" hint="Stable internal identifier."><input onChange={(event) => setDraft({ ...draft, slug: event.target.value })} placeholder="generated-from-name" value={draft.slug} /></Field>
                <Field label="Provider">
                  <select onChange={(event) => setDraft({ ...draft, provider: event.target.value as ProviderDraft["provider"] })} value={draft.provider}>
                    {Object.entries(providerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </Field>
                <Field label="Model"><input onChange={(event) => setDraft({ ...draft, modelId: event.target.value })} placeholder="gpt-image-1" value={draft.modelId} /></Field>
                <Field label="Capability">
                  <select onChange={(event) => setDraft({ ...draft, capability: event.target.value as ProviderDraft["capability"] })} value={draft.capability}>
                    <option value="image">Image generation</option><option value="text">Text generation</option><option value="vision">Vision</option><option value="embedding">Embedding</option>
                  </select>
                </Field>
                <Field label="Legacy priority" hint="Higher values win only when no explicit route exists."><NumberInput min={-100} max={100} value={draft.priority} onChange={(value) => setDraft({ ...draft, priority: value })} /></Field>
                <Field label="Base URL" wide><input onChange={(event) => setDraft({ ...draft, baseUrl: event.target.value })} value={draft.baseUrl} /></Field>
                <Field label="Provider timeout"><NumberInput min={1} max={300} suffix="sec" value={draft.timeoutSeconds} onChange={(value) => setDraft({ ...draft, timeoutSeconds: value })} /></Field>
                <Field label="Credential reference"><input onChange={(event) => setDraft({ ...draft, keyEnvName: event.target.value.toUpperCase() })} value={draft.keyEnvName} /></Field>
                <Field label="Notes" wide><textarea onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={3} value={draft.notes} /></Field>
              </div>
              <div className="settings-credential-note">
                <LockClosedIcon />
                <div><strong>Secret value is hidden</strong><span>This profile references {draft.keyEnvName || "an environment secret"}. Replace credentials outside ordinary Settings.</span></div>
              </div>
              <div className="settings-provider-test">
                <button disabled={busy || selectedId === "new"} onClick={onTest} type="button"><ReloadIcon />Test connection</button>
                {connectionResult ? <p className={connectionResult.ok ? "is-success" : "is-error"}>{connectionResult.message}{connectionResult.latencyMs ? ` · ${connectionResult.latencyMs} ms` : ""}</p> : <span>Uses the saved profile and credential reference.</span>}
              </div>
            </>
          ) : <p className="settings-empty">Select a provider profile.</p>}
        </div>
      </div>
    </div>
  );
}

function BindingsSection({
  bindings,
  compatibleTemplates,
  draft,
  selectedAction,
  selectedTemplate,
  setDraft,
  setSelectedAction,
}: {
  bindings: WorkspaceData["bindings"];
  compatibleTemplates: TemplateRecord[];
  draft: BindingDraft | null;
  selectedAction: PipelineAction;
  selectedTemplate?: TemplateRecord;
  setDraft: (value: BindingDraft) => void;
  setSelectedAction: (value: PipelineAction) => void;
}) {
  return (
    <div className="settings-section settings-section--wide">
      <SettingsSectionHead eyebrow="Template bindings" title="Pipeline map" description="Production actions resolve templates here instead of storing a fixed template version in pipeline code." />
      <div className="settings-binding-workspace">
        <div className="settings-binding-table">
          <div className="settings-binding-table__head"><span>Pipeline action</span><span>Template</span><span>Version policy</span></div>
          {bindings.map((binding) => (
            <button className={cn(binding.action === selectedAction && "is-active")} key={binding.action} onClick={() => setSelectedAction(binding.action)} type="button">
              <strong>{actionLabels[binding.action]}</strong>
              <span>{binding.templateName ?? "Not bound"}</span>
              <span>{binding.versionPolicy === "pin-version" ? `Pinned · ${binding.version ?? "—"}` : "Follow published"}</span>
            </button>
          ))}
        </div>
        <aside className="settings-binding-inspector">
          {draft ? (
            <>
              <header><p>Pipeline action</p><h3>{actionLabels[draft.action]}</h3><span>New runs use this resolution immediately after saving.</span></header>
              <div className="settings-form-stack">
                <Field label="Template">
                  <select
                    onChange={(event) => setDraft({ ...draft, promptTemplateId: event.target.value as TemplateId | "", promptTemplateVersionId: "" })}
                    value={draft.promptTemplateId}
                  >
                    <option value="">Select a template</option>
                    {compatibleTemplates.map((template) => <option key={template._id} value={template._id}>{template.name}{template.isActive ? "" : " · inactive"}</option>)}
                  </select>
                </Field>
                <Field label="Version policy">
                  <select onChange={(event) => setDraft({ ...draft, versionPolicy: event.target.value as BindingDraft["versionPolicy"], promptTemplateVersionId: "" })} value={draft.versionPolicy}>
                    <option value="follow-published">Follow published version</option>
                    <option value="pin-version">Pin specific version</option>
                  </select>
                </Field>
                {draft.versionPolicy === "pin-version" ? (
                  <Field label="Pinned version">
                    <select onChange={(event) => setDraft({ ...draft, promptTemplateVersionId: event.target.value as TemplateVersionId | "" })} value={draft.promptTemplateVersionId}>
                      <option value="">Select a version</option>
                      {selectedTemplate?.versions.map((version) => <option key={version._id} value={version._id}>{version.version} · {version.status}</option>)}
                    </select>
                  </Field>
                ) : null}
                <Field label="Fallback template" hint="Used only if the selected template becomes unavailable.">
                  <select onChange={(event) => setDraft({ ...draft, fallbackPromptTemplateId: event.target.value as TemplateId | "" })} value={draft.fallbackPromptTemplateId}>
                    <option value="">None</option>
                    {compatibleTemplates.filter((template) => template._id !== draft.promptTemplateId).map((template) => <option key={template._id} value={template._id}>{template.name}</option>)}
                  </select>
                </Field>
              </div>
              <div className="settings-effective-note"><span>Effective from</span><strong>Immediately after save</strong></div>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function DefaultsSection({ draft, setDraft }: { draft: DefaultsDraft; setDraft: (value: DefaultsDraft) => void }) {
  return (
    <div className="settings-section">
      <SettingsSectionHead eyebrow="Defaults" title="Unspecified choices" description="These values apply only when a user has not made an explicit selection." />
      <div className="settings-form-grid">
        <Field label="Default weathering"><select value={draft.weathering} onChange={(event) => setDraft({ ...draft, weathering: event.target.value as DefaultsDraft["weathering"] })}><option value="clean">Clean</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="heavy">Heavy</option></select></Field>
        <Field label="Default visibility"><select value={draft.visibility} onChange={(event) => setDraft({ ...draft, visibility: event.target.value as DefaultsDraft["visibility"] })}><option value="private">Private</option><option value="unlisted">Unlisted</option><option value="public">Public</option></select></Field>
        <Field label="Default mood"><select value={draft.mood} onChange={(event) => setDraft({ ...draft, mood: event.target.value as DefaultsDraft["mood"] })}><option value="none">None</option><option value="heroic">Heroic</option><option value="industrial">Industrial</option><option value="cinematic">Cinematic</option></select></Field>
        <Field label="Default image count"><NumberInput min={1} max={4} suffix="images" value={draft.imageCount} onChange={(value) => setDraft({ ...draft, imageCount: value })} /></Field>
        <Field label="Default generation quality"><select value={draft.generationQuality} onChange={(event) => setDraft({ ...draft, generationQuality: event.target.value as DefaultsDraft["generationQuality"] })}><option value="standard">Standard</option><option value="high">High</option></select></Field>
        <Field label="Default generation language"><select value={draft.generationLanguage} onChange={(event) => setDraft({ ...draft, generationLanguage: event.target.value as DefaultsDraft["generationLanguage"] })}><option value="english">English</option><option value="japanese">Japanese</option><option value="chinese">Chinese</option></select></Field>
      </div>
      <p className="settings-section-footnote">Explicit user selections always take precedence over these defaults.</p>
    </div>
  );
}

function SystemSection({ draft, environment, setDraft }: { draft: SystemDraft; environment: WorkspaceData["environment"]; setDraft: (value: SystemDraft) => void }) {
  return (
    <div className="settings-section">
      <SettingsSectionHead eyebrow="System" title="Platform switches" description="Low-frequency controls for availability, public content and commerce." />
      <SettingsToggleGroup label="Registration">
        <SwitchRow checked={draft.allowRegistrations} label="Allow new registrations" onChange={(checked) => setDraft({ ...draft, allowRegistrations: checked })} />
      </SettingsToggleGroup>
      <SettingsToggleGroup label="Public content">
        <SwitchRow checked={draft.allowPublicPrototypes} label="Allow public prototypes" onChange={(checked) => setDraft({ ...draft, allowPublicPrototypes: checked, allowRemix: checked ? draft.allowRemix : false })} />
        <SwitchRow checked={draft.allowRemix} disabled={!draft.allowPublicPrototypes} label="Allow remix" onChange={(checked) => setDraft({ ...draft, allowRemix: checked })} />
      </SettingsToggleGroup>
      <SettingsToggleGroup label="Feedback">
        <SwitchRow checked={draft.enableFeedback} label="Enable user feedback" onChange={(checked) => setDraft({ ...draft, enableFeedback: checked })} />
      </SettingsToggleGroup>
      <SettingsToggleGroup label="Commerce">
        <SwitchRow checked={draft.enableCreditRedemption} label="Enable credit redemption" onChange={(checked) => setDraft({ ...draft, enableCreditRedemption: checked })} />
        <SwitchRow checked={draft.enablePurchases} label="Enable purchases" onChange={(checked) => setDraft({ ...draft, enablePurchases: checked })} />
      </SettingsToggleGroup>
      <SettingsToggleGroup label="Maintenance" tone="danger">
        <SwitchRow checked={draft.maintenanceMode} description="Administrators retain access while public workflows are paused." label="Maintenance mode" onChange={(checked) => setDraft({ ...draft, maintenanceMode: checked })} />
      </SettingsToggleGroup>
      <SettingsDivider />
      <SettingsSectionHead eyebrow="Environment" title="Runtime status" description="Read-only deployment context. Operational metrics belong elsewhere." />
      <dl className="settings-environment-list">
        <div><dt>Environment</dt><dd>{environment.environment}</dd></div>
        <div><dt>Application version</dt><dd>{environment.applicationVersion}</dd></div>
        <div><dt>Database</dt><dd><span className="settings-status-dot" />{environment.database}</dd></div>
        <div><dt>Asset storage</dt><dd><span className={cn("settings-status-dot", environment.assetStorage === "Not configured" && "is-inactive")} />{environment.assetStorage}</dd></div>
      </dl>
    </div>
  );
}

function SettingsSectionHead({ action, description, eyebrow, title }: { action?: ReactNode; description: string; eyebrow: string; title: string }) {
  return <header className="settings-section-head"><div><p>{eyebrow}</p><h3>{title}</h3><span>{description}</span></div>{action}</header>;
}

function SettingsDivider() { return <hr className="settings-divider" />; }

function Field({ children, hint, label, wide = false }: { children: ReactNode; hint?: string; label: string; wide?: boolean }) {
  return <label className={cn("settings-field", wide && "is-wide")}><span>{label}</span>{children}{hint ? <small>{hint}</small> : null}</label>;
}

function NumberInput({ max, min, onChange, suffix, value }: { max: number; min: number; onChange: (value: number) => void; suffix?: string; value: number }) {
  return <span className="settings-number-input"><input max={max} min={min} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} />{suffix ? <em>{suffix}</em> : null}</span>;
}

function SettingsToggleGroup({ children, label, tone }: { children: ReactNode; label: string; tone?: "danger" }) {
  return <section className={cn("settings-toggle-group", tone === "danger" && "is-danger")}><h4>{label}</h4>{children}</section>;
}

function SwitchRow({ checked, description, disabled, label, onChange }: { checked: boolean; description?: string; disabled?: boolean; label: string; onChange: (checked: boolean) => void }) {
  return <div className="settings-switch-row"><div><strong>{label}</strong>{description ? <small>{description}</small> : null}</div><span>{checked ? "On" : "Off"}</span><Switch aria-label={label} checked={checked} disabled={disabled} onCheckedChange={onChange} /></div>;
}

function stripGenerationMeta(value: WorkspaceData["generation"]): GenerationDraft {
  return {
    fallbackBehavior: value.fallbackBehavior,
    maxRetryCount: value.maxRetryCount,
    timeoutSeconds: value.timeoutSeconds,
    failureCreditPolicy: value.failureCreditPolicy,
    concurrentJobsPerUser: value.concurrentJobsPerUser,
    routes: value.routes.map((route) => ({ ...route })),
  };
}

function stripDefaultsMeta(value: WorkspaceData["defaults"]): DefaultsDraft {
  return { weathering: value.weathering, visibility: value.visibility, mood: value.mood, imageCount: value.imageCount, generationQuality: value.generationQuality, generationLanguage: value.generationLanguage };
}

function stripSystemMeta(value: WorkspaceData["system"]): SystemDraft {
  return { allowRegistrations: value.allowRegistrations, allowPublicPrototypes: value.allowPublicPrototypes, allowRemix: value.allowRemix, enableFeedback: value.enableFeedback, enableCreditRedemption: value.enableCreditRedemption, enablePurchases: value.enablePurchases, maintenanceMode: value.maintenanceMode };
}

function providerToDraft(provider: ProviderRecord): ProviderDraft {
  return { name: provider.name, slug: provider.slug, provider: provider.provider, modelId: provider.modelId, capability: provider.capability, baseUrl: provider.baseUrl, keyEnvName: provider.keyEnvName, timeoutSeconds: Math.round((provider.timeoutMs ?? 90000) / 1000), priority: provider.priority, notes: provider.notes ?? "", isActive: provider.isActive };
}

function bindingToDraft(action: PipelineAction, binding: WorkspaceData["bindings"][number] | null): BindingDraft {
  return { action, promptTemplateId: binding?.promptTemplateId ?? "", versionPolicy: binding?.versionPolicy ?? "follow-published", promptTemplateVersionId: binding?.promptTemplateVersionId ?? "", fallbackPromptTemplateId: binding?.fallbackPromptTemplateId ?? "" };
}

function equalJson(left: unknown, right: unknown) { return JSON.stringify(left) === JSON.stringify(right); }
