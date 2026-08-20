import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { api } from "@/convex/_generated/api";
import type { AdminPromptLabSearch } from "../adminRouteSearch";
import { ExperimentComposer } from "./ExperimentComposer";
import { ExperimentRunInspector } from "./ExperimentRunInspector";
import { ExperimentRunRegistry } from "./ExperimentRunRegistry";
import { PromptLabExperimentBar } from "./PromptLabExperimentBar";
import { AccessState } from "./PromptLabPrimitives";
import { RunRecorder } from "./RunRecorder";
import type {
  PromptCatalogData,
  PromptExperimentRun,
  PromptLabDraft,
  PromptLabExperimentDraft,
  PromptLabMutationArgs,
  PromptLabResult,
  PromptRunFilters,
  PromptRunRegistryResult,
  PromptRunStatus,
  PromptTemplateRecord,
  PromptTemplateVersionRecord,
} from "./promptLabTypes";
import {
  buildPromptLabArgs,
  defaultExperimentDraft,
  defaultPromptLabDraft,
  emptyToUndefined,
  parseCsv,
  parseOptionalScore,
  promptLabDraftStorageKey,
  promptLabExperimentDraftStorageKey,
  readStoredExperimentDraft,
  readStoredPromptLabDraft,
  readStoredString,
  resolveOverallScore,
  selectedTemplateStorageKey,
  writeStoredJson,
  writeStoredString,
} from "./promptLabUtils";

const defaultRunFilters: PromptRunFilters = {
  search: "",
  templateId: "all",
  provider: "all",
  status: "all",
};

export function PromptLabWorkbench({
  search = {},
}: {
  search?: AdminPromptLabSearch;
}) {
  const navigate = useNavigate({ from: "/admin/prompt-lab" });
  const viewer = useQuery(api.users.viewer);
  const canManagePlatform = Boolean(viewer?.canManagePlatform);
  const catalogData = useQuery(
    api.admin.listCatalogData,
    canManagePlatform ? {} : "skip"
  ) as PromptCatalogData | undefined;
  const promptTemplates = useQuery(
    api.admin.listPromptTemplates,
    canManagePlatform ? {} : "skip"
  ) as PromptTemplateRecord[] | undefined;
  const feedbackContext = useQuery(
    api.admin.getFeedbackPromptLabContext,
    canManagePlatform && search.feedback ? { feedbackId: search.feedback } : "skip"
  );

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    search.template ?? null
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    search.version ?? null
  );
  const [selectedRunId, setSelectedRunId] = useState<string | null>(search.run ?? null);
  const [draft, setDraft] = useState<PromptLabDraft>(defaultPromptLabDraft);
  const [experimentDraft, setExperimentDraft] = useState<PromptLabExperimentDraft>(
    defaultExperimentDraft
  );
  const [result, setResult] = useState<PromptLabResult | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [storedStateReady, setStoredStateReady] = useState(false);
  const [importedFeedbackId, setImportedFeedbackId] = useState<string | null>(null);
  const [runFilters, setRunFilters] = useState<PromptRunFilters>(defaultRunFilters);
  const [pageIndex, setPageIndex] = useState(0);
  const deferredRunSearch = useDeferredValue(runFilters.search.trim());

  useEffect(() => {
    if (!storedStateReady || !feedbackContext || importedFeedbackId === feedbackContext._id) return;
    setDraft((current) => ({
      ...current,
      kitVariantId: feedbackContext.kitVariantId ?? current.kitVariantId,
      stylePresetId: feedbackContext.stylePresetId ?? current.stylePresetId,
      materialPresetId: feedbackContext.materialPresetId ?? current.materialPresetId,
      moodTags: feedbackContext.moodTags.length ? feedbackContext.moodTags : current.moodTags,
      weatheringLevel: feedbackContext.weatheringLevel,
      conceptId: feedbackContext.conceptId ?? search.concept ?? current.conceptId,
      notes: `${feedbackContext.reference} · ${feedbackContext.title}\n${feedbackContext.message}`,
    }));
    setImportedFeedbackId(feedbackContext._id);
    setStatusMessage(`${feedbackContext.reference} context imported from Feedback Triage.`);
  }, [feedbackContext, importedFeedbackId, search.concept, storedStateReady]);

  const registry = useQuery(
    api.admin.listPromptExperimentRunRegistry,
    canManagePlatform
      ? {
          page: pageIndex,
          pageSize: 20,
          search: emptyToUndefined(deferredRunSearch),
          promptTemplateId:
            runFilters.templateId === "all" ? undefined : runFilters.templateId,
          provider: runFilters.provider === "all" ? undefined : runFilters.provider,
          status: runFilters.status === "all" ? undefined : runFilters.status,
          selectedRunId: selectedRunId ?? undefined,
        }
      : "skip"
  ) as PromptRunRegistryResult | undefined;
  const composePromptLabPreview = useMutation(api.admin.composePromptLabPreview);
  const savePromptExperimentRun = useMutation(api.admin.savePromptExperimentRun);
  const updatePromptExperimentRun = useMutation(api.admin.updatePromptExperimentRun);

  const selectedTemplate = useMemo(() => {
    if (!promptTemplates?.length) return null;
    return (
      promptTemplates.find((template) => template._id === selectedTemplateId) ??
      promptTemplates[0]
    );
  }, [promptTemplates, selectedTemplateId]);

  const selectedVersion = useMemo(
    () => resolveSelectedVersion(selectedTemplate, selectedVersionId),
    [selectedTemplate, selectedVersionId]
  );
  const selectedRun = useMemo(() => {
    if (!selectedRunId || !registry) return null;
    return (
      registry.page.find((run) => run._id === selectedRunId) ??
      registry.selectedRun ??
      null
    );
  }, [registry, selectedRunId]);
  const promptLabArgs = selectedTemplate
    ? buildPromptLabArgs(
        selectedTemplate._id,
        selectedVersion?._id ?? undefined,
        draft
      )
    : null;

  const replaceSearch = useCallback(
    (templateId: string | null, versionId: string | null, runId: string | null) => {
      void navigate({
        replace: true,
        search: {
          template: templateId ?? undefined,
          version: versionId ?? undefined,
          run: runId ?? undefined,
          feedback: search.feedback,
          concept: search.concept,
        },
      });
    },
    [navigate, search.concept, search.feedback]
  );

  useEffect(() => {
    setSelectedTemplateId(
      search.template ?? readStoredString(selectedTemplateStorageKey)
    );
    setSelectedVersionId(search.version ?? null);
    setSelectedRunId(search.run ?? null);
  }, [search.run, search.template, search.version]);

  useEffect(() => {
    setDraft(readStoredPromptLabDraft());
    setExperimentDraft(readStoredExperimentDraft());
    setStoredStateReady(true);
  }, []);

  useEffect(() => {
    if (!storedStateReady || !selectedTemplate) return;
    const resolvedVersion = resolveSelectedVersion(selectedTemplate, selectedVersionId);
    const canonicalVersionId = resolvedVersion?._id ?? null;
    const selectionChanged =
      selectedTemplateId !== selectedTemplate._id ||
      selectedVersionId !== canonicalVersionId;
    if (selectionChanged) {
      setSelectedTemplateId(selectedTemplate._id);
      setSelectedVersionId(canonicalVersionId);
      replaceSearch(selectedTemplate._id, canonicalVersionId, selectedRunId);
    }
  }, [
    selectedRunId,
    selectedTemplate,
    selectedTemplateId,
    selectedVersionId,
    replaceSearch,
    storedStateReady,
  ]);

  useEffect(() => {
    if (!storedStateReady) return;
    writeStoredString(selectedTemplateStorageKey, selectedTemplateId);
  }, [selectedTemplateId, storedStateReady]);

  useEffect(() => {
    if (!storedStateReady) return;
    writeStoredJson(promptLabDraftStorageKey, draft);
  }, [draft, storedStateReady]);

  useEffect(() => {
    if (!storedStateReady) return;
    writeStoredJson(promptLabExperimentDraftStorageKey, experimentDraft);
  }, [experimentDraft, storedStateReady]);

  useEffect(() => {
    setPageIndex(0);
  }, [deferredRunSearch, runFilters.provider, runFilters.status, runFilters.templateId]);

  useEffect(() => {
    if (registry && pageIndex >= registry.pageCount && registry.pageCount > 0) {
      setPageIndex(registry.pageCount - 1);
    }
  }, [pageIndex, registry]);

  if (viewer === undefined) {
    return <AccessState eyebrow="Prompt Lab" title="Resolving operator privileges" />;
  }
  if (!viewer?.canManagePlatform) {
    return (
      <AccessState
        danger
        eyebrow="Access locked"
        title="Super admin clearance required"
      />
    );
  }

  const selectTemplate = (templateId: string) => {
    const template = promptTemplates?.find((item) => item._id === templateId) ?? null;
    const version = resolveSelectedVersion(template, null);
    setSelectedTemplateId(templateId);
    setSelectedVersionId(version?._id ?? null);
    setResult(null);
    replaceSearch(templateId, version?._id ?? null, selectedRunId);
  };

  const selectVersion = (versionId: string | null) => {
    setSelectedVersionId(versionId);
    setResult(null);
    replaceSearch(selectedTemplate?._id ?? null, versionId, selectedRunId);
  };

  const selectRun = (run: PromptExperimentRun) => {
    setSelectedRunId(run._id);
    replaceSearch(selectedTemplate?._id ?? null, selectedVersion?._id ?? null, run._id);
  };

  const runAction = async ({
    action,
    key,
    success,
  }: {
    action: () => Promise<void>;
    key: string;
    success: string;
  }) => {
    setBusyKey(key);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await action();
      setStatusMessage(success);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Prompt Lab action failed");
    } finally {
      setBusyKey(null);
    }
  };

  const compose = () =>
    void runAction({
      key: "compose",
      success: "Prompt snapshot composed.",
      action: async () => {
        if (!promptLabArgs) throw new Error("Select a prompt template before composing.");
        const response = await composePromptLabPreview(promptLabArgs);
        setResult(response as PromptLabResult);
      },
    });

  const saveRun = () =>
    void runAction({
      key: "save-run",
      success: "Experiment run saved.",
      action: async () => {
        if (!promptLabArgs) throw new Error("Select a prompt template before saving.");
        const response = await savePromptExperimentRun(
          buildRunMutationArgs(promptLabArgs, experimentDraft)
        );
        setSelectedRunId(response.runId);
        setPageIndex(0);
        setExperimentDraft(defaultExperimentDraft);
        replaceSearch(
          selectedTemplate?._id ?? null,
          selectedVersion?._id ?? null,
          response.runId
        );
      },
    });

  const updateRunStatus = (status: PromptRunStatus, selectedAsWinner: boolean) => {
    if (!selectedRun) return;
    void runAction({
      key: `run-${status}-${selectedRun._id}`,
      success: `Run marked ${status}.`,
      action: async () => {
        await updatePromptExperimentRun({
          runId: selectedRun._id,
          selectedAsWinner,
          status,
        });
      },
    });
  };

  return (
    <div className="prompt-lab-page">
      <PromptLabExperimentBar
        onTemplateChange={selectTemplate}
        onVersionChange={selectVersion}
        runCount={registry?.allTotal ?? 0}
        selectedTemplate={selectedTemplate}
        selectedVersion={selectedVersion}
        templates={promptTemplates}
      />

      {statusMessage ? <div className="prompt-lab-notice is-success">{statusMessage}</div> : null}
      {errorMessage ? <div className="prompt-lab-notice is-error">{errorMessage}</div> : null}

      <ExperimentComposer
        busy={busyKey === "compose"}
        catalog={catalogData}
        disabled={!promptLabArgs}
        draft={draft}
        onCompose={compose}
        onCopyError={setErrorMessage}
        onReset={() => {
          setDraft(defaultPromptLabDraft);
          setResult(null);
        }}
        result={result}
        selectedTemplate={selectedTemplate}
        selectedVersion={selectedVersion}
        setDraft={setDraft}
      />

      <RunRecorder
        busy={busyKey === "save-run"}
        disabled={!promptLabArgs}
        draft={experimentDraft}
        onSave={saveRun}
        providers={registry?.providers ?? []}
        setDraft={setExperimentDraft}
      />

      <div className="prompt-run-workspace">
        <ExperimentRunRegistry
          filters={runFilters}
          loading={registry === undefined}
          onPageChange={setPageIndex}
          onSelect={selectRun}
          pageIndex={pageIndex}
          registry={registry}
          selectedRunId={selectedRunId}
          setFilters={setRunFilters}
          templates={promptTemplates}
        />
        <ExperimentRunInspector
          busyKey={busyKey}
          onStatusChange={updateRunStatus}
          run={selectedRun}
        />
      </div>
    </div>
  );
}

function resolveSelectedVersion(
  template: PromptTemplateRecord | null,
  selectedVersionId: string | null
): PromptTemplateVersionRecord | null {
  if (!template) return null;
  const resolved =
    template.versions.find((version) => version._id === selectedVersionId) ??
    template.versions.find((version) => version.status === "published") ??
    template.versions.find((version) => version.status === "draft") ??
    template.versions.at(0);
  return resolved ?? null;
}

function buildRunMutationArgs(
  promptLabArgs: PromptLabMutationArgs,
  draft: PromptLabExperimentDraft
) {
  return {
    ...promptLabArgs,
    providerLabel: emptyToUndefined(draft.providerLabel),
    modelLabel: emptyToUndefined(draft.modelLabel),
    vendorUrl: emptyToUndefined(draft.vendorUrl),
    parameterNotes: emptyToUndefined(draft.parameterNotes),
    outputImageUrl: emptyToUndefined(draft.outputImageUrl),
    outputNotes: emptyToUndefined(draft.outputNotes),
    failureTags: parseCsv(draft.failureTags),
    styleHitScore: parseOptionalScore(draft.styleHitScore),
    silhouetteScore: parseOptionalScore(draft.silhouetteScore),
    paintabilityScore: parseOptionalScore(draft.paintabilityScore),
    promptAdherenceScore: parseOptionalScore(draft.promptAdherenceScore),
    visualImpactScore: parseOptionalScore(draft.visualImpactScore),
    overallScore: resolveOverallScore(draft),
    selectedAsWinner: draft.selectedAsWinner,
  };
}
