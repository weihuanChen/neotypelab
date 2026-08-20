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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ReactNode, RefObject, useEffect, useMemo, useRef, useState } from "react";
import type { AdminTemplatesSearch } from "./adminRouteSearch";

type VersionStatus = "draft" | "published" | "archived";

type TemplateVersion = {
  _id: Id<"promptTemplateVersions"> | null;
  version: string;
  status: VersionStatus;
  systemPrompt: string;
  userPromptTemplate: string;
  negativePromptTemplate?: string;
  notePolicy?: string;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
  usedVariables: string[];
};

type TemplateWorkspaceRecord = {
  _id: Id<"promptTemplates">;
  _creationTime: number;
  name: string;
  slug: string;
  kind: string;
  isActive: boolean;
  publishedVersionId?: Id<"promptTemplateVersions">;
  updatedAt: number;
  current: { version: string };
  versions: TemplateVersion[];
  variables: Array<{
    key: string;
    label: string;
    description: string;
    example: string;
    token: string;
  }>;
  usage: {
    last24h: number;
    total: number;
    lastFailureAt?: number;
    lastFailure?: string;
    latestExperimentAt?: number;
    latestExperimentStatus?: string;
  };
  bindings: Array<{
    _id: Id<"promptTemplateBindings">;
    generationKind?: string;
    renderMode?: string;
    isActive: boolean;
    isDefault: boolean;
    profileName: string;
    modelId: string;
  }>;
};

type PromptDraft = {
  notePolicy: string;
  systemPrompt: string;
  userPromptTemplate: string;
  negativePromptTemplate: string;
};

const selectedTemplateStorageKey = "neotypelab.admin.selectedTemplateId";

export function TemplatesWorkbench({
  search: routeSearch = {},
}: {
  search?: AdminTemplatesSearch;
}) {
  const navigate = useNavigate({ from: "/admin/templates" });
  const viewer = useQuery(api.users.viewer);
  const canManagePlatform = Boolean(viewer?.canManagePlatform);
  const workspace = useQuery(
    api.admin.listPromptTemplateWorkspace,
    canManagePlatform ? {} : "skip"
  ) as TemplateWorkspaceRecord[] | undefined;
  const createDraft = useMutation(api.admin.createPromptTemplateDraft);
  const updateDraft = useMutation(api.admin.updatePromptTemplateDraft);
  const publishVersion = useMutation(api.admin.publishPromptTemplateVersion);
  const archiveVersion = useMutation(api.admin.archivePromptTemplateVersion);
  const updateTemplate = useMutation(api.admin.updatePromptTemplate);

  const [search, setSearch] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    routeSearch.template ?? null
  );
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(
    routeSearch.version ?? null
  );
  const [drafts, setDrafts] = useState<Record<string, PromptDraft>>({});
  const [storedSelectionReady, setStoredSelectionReady] = useState(false);
  const systemPromptRef = useRef<HTMLTextAreaElement>(null);
  const userPromptRef = useRef<HTMLTextAreaElement>(null);
  const negativePromptRef = useRef<HTMLTextAreaElement>(null);

  const selectedTemplate = useMemo(() => {
    if (!workspace?.length) return null;
    return workspace.find((item) => item._id === selectedTemplateId) ?? workspace[0];
  }, [selectedTemplateId, workspace]);

  const selectedVersion = useMemo(() => {
    if (!selectedTemplate) return null;
    return (
      selectedTemplate.versions.find((item) => item._id === selectedVersionId) ??
      selectedTemplate.versions.find((item) => item.status === "draft") ??
      selectedTemplate.versions.find((item) => item.status === "published") ??
      selectedTemplate.versions[0]
    );
  }, [selectedTemplate, selectedVersionId]);

  const activeDraftKey =
    selectedTemplate && selectedVersion
      ? draftKey(selectedTemplate._id, selectedVersion._id)
      : null;
  const activeDraft =
    activeDraftKey && selectedVersion
      ? drafts[activeDraftKey] ?? createPromptDraft(selectedVersion)
      : null;
  const isDirty = Boolean(
    activeDraft && selectedVersion && !draftMatchesVersion(activeDraft, selectedVersion)
  );
  const usedVariables = useMemo(
    () => extractVariables(activeDraft?.userPromptTemplate ?? ""),
    [activeDraft?.userPromptTemplate]
  );
  const unresolvedVariables = useMemo(() => {
    if (!selectedTemplate) return [];
    const allowed = new Set(selectedTemplate.variables.map((item) => item.key));
    return usedVariables.filter((item) => !allowed.has(item));
  }, [selectedTemplate, usedVariables]);
  const filteredTemplates = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!workspace || !needle) return workspace ?? [];
    return workspace.filter((item) =>
      [item.name, item.slug, item.kind, item.current.version]
        .join(" ")
        .toLowerCase()
        .includes(needle)
    );
  }, [search, workspace]);

  useEffect(() => {
    setSelectedTemplateId(
      routeSearch.template ?? readStoredString(selectedTemplateStorageKey)
    );
    setSelectedVersionId(routeSearch.version ?? null);
    setStoredSelectionReady(true);
  }, [routeSearch.template, routeSearch.version]);

  useEffect(() => {
    if (!storedSelectionReady) return;
    if (!selectedTemplate) return;
    setSelectedTemplateId(selectedTemplate._id);
    if (!selectedTemplate.versions.some((item) => item._id === selectedVersionId)) {
      const preferred =
        selectedTemplate.versions.find((item) => item.status === "draft") ??
        selectedTemplate.versions.find((item) => item.status === "published") ??
        selectedTemplate.versions[0];
      setSelectedVersionId(preferred._id);
      void navigate({
        replace: true,
        search: {
          template: selectedTemplate._id,
          version: preferred._id ?? undefined,
        },
      });
    }
  }, [navigate, selectedTemplate, selectedVersionId, storedSelectionReady]);

  useEffect(() => {
    if (!storedSelectionReady) return;
    writeStoredString(selectedTemplateStorageKey, selectedTemplateId);
  }, [selectedTemplateId, storedSelectionReady]);

  useEffect(() => {
    const hasDirtyDraft = workspace?.some((template) =>
      template.versions.some((version) => {
        const key = draftKey(template._id, version._id);
        if (!(key in drafts)) return false;
        return !draftMatchesVersion(drafts[key], version);
      })
    );
    if (!hasDirtyDraft) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [drafts, workspace]);

  if (viewer === undefined) {
    return <AccessState eyebrow="Template boot" title="Resolving operator privileges" />;
  }
  if (!viewer?.canManagePlatform) {
    return (
      <AccessState
        danger
        eyebrow="Access locked"
        title="Super admin clearance required"
        description="Prompt templates are platform configuration and require admin access."
      />
    );
  }

  const updateActiveDraft = (patch: Partial<PromptDraft>) => {
    if (!activeDraftKey || !activeDraft) return;
    setDrafts((current) => ({
      ...current,
      [activeDraftKey]: { ...activeDraft, ...patch },
    }));
  };

  const insertVariable = (token: string) => {
    if (!activeDraft || selectedVersion?.status !== "draft") return;
    const textarea = userPromptRef.current;
    const value = activeDraft.userPromptTemplate;
    const start = textarea?.selectionStart ?? value.length;
    const end = textarea?.selectionEnd ?? start;
    updateActiveDraft({
      userPromptTemplate: `${value.slice(0, start)}${token}${value.slice(end)}`,
    });
    window.requestAnimationFrame(() => {
      const cursor = start + token.length;
      textarea?.focus();
      textarea?.setSelectionRange(cursor, cursor);
    });
  };

  const runAction = (input: { key: string; action: () => Promise<void>; success: string }) =>
    runTemplateAction({ ...input, setBusyKey, setErrorMessage, setStatusMessage });
  const selectWorkspaceRecord = (
    templateId: string,
    versionId: Id<"promptTemplateVersions"> | null
  ) => {
    setSelectedTemplateId(templateId);
    setSelectedVersionId(versionId);
    void navigate({
      replace: true,
      search: {
        template: templateId,
        version: versionId ?? undefined,
      },
    });
  };

  return (
    <div className="space-y-3 text-ink-primary">
      <header className="border-b-2 border-line-primary pb-3">
        <div className="flex flex-col gap-2 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent-orange">
              Admin console / Templates
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              Prompt configuration and version control
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-ink-secondary">
              Define model behavior here. Compile and evaluate versions in Prompt Lab before publication.
            </p>
          </div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-ink-muted">
            {workspace?.length ?? 0} configurations · {workspace?.filter((item) => item.isActive).length ?? 0} online
          </p>
        </div>
      </header>

      <FeedbackStrip tone="success" message={statusMessage} />
      <FeedbackStrip tone="danger" message={errorMessage} />

      <div className="grid border-2 border-line-primary bg-surface xl:grid-cols-[minmax(210px,22%)_minmax(0,1fr)]">
        <aside className="border-b border-line-primary bg-panel xl:min-h-[760px] xl:border-b-0 xl:border-r">
          <div className="border-b border-line-secondary p-3">
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-accent-teal">Templates</p>
                <p className="mt-1 text-xs text-ink-muted">System prompt configurations</p>
              </div>
              <span className="font-mono text-lg">{workspace?.length ?? 0}</span>
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search templates..."
              aria-label="Search templates"
              className="mt-3 h-9 rounded-none border-line-secondary bg-main text-sm text-ink-primary placeholder:text-ink-muted focus-visible:ring-accent-teal"
            />
          </div>
          <div className="flex max-h-[560px] overflow-x-auto xl:block xl:max-h-[calc(100vh-290px)] xl:overflow-x-hidden xl:overflow-y-auto">
            {workspace === undefined ? (
              <LibraryMessage>Loading template library.</LibraryMessage>
            ) : filteredTemplates.length === 0 ? (
              <LibraryMessage>No templates match this search.</LibraryMessage>
            ) : (
              filteredTemplates.map((template) => {
                const draft = template.versions.find((item) => item.status === "draft");
                const selected = selectedTemplate?._id === template._id;
                return (
                  <button
                    key={template._id}
                    type="button"
                    onClick={() => {
                      selectWorkspaceRecord(
                        template._id,
                        draft?._id ?? template.publishedVersionId ?? null
                      );
                    }}
                    className={cn(
                      "relative flex min-h-[66px] w-full min-w-[210px] items-center justify-between gap-3 border-b border-r border-line-guide px-3 py-3 text-left transition-colors xl:min-w-0 xl:border-r-0",
                      selected
                        ? "bg-accent-teal/10 before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-ink-primary"
                        : "text-ink-secondary hover:bg-hover-subtle hover:text-ink-primary"
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{shortName(template.name)}</span>
                      <span className="mt-1 block truncate font-mono text-[11px] text-ink-muted">
                        {template.kind} · {draft?.version ?? template.current.version}
                      </span>
                    </span>
                    {draft ? (
                      <StatusLabel status="draft" />
                    ) : (
                      <span
                        className={cn("template-status-dot h-2 w-2 shrink-0", template.isActive ? "bg-accent-teal" : "bg-ink-muted")}
                        aria-label={template.isActive ? "Active" : "Inactive"}
                      />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="min-w-0">
          {selectedTemplate && selectedVersion && activeDraft ? (
            <>
              <section className="border-b border-line-primary bg-panel px-4 py-4 lg:px-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-accent-blue">{selectedTemplate.kind} template</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-semibold">{selectedTemplate.name}</h3>
                      <StatusLabel status={selectedVersion.status} />
                      {isDirty ? <span className="text-xs text-accent-orange">Unsaved</span> : null}
                    </div>
                    <p className="mt-2 font-mono text-xs text-ink-secondary">
                      {selectedTemplate.slug} · {selectedVersion.version} · Updated {formatDate(selectedVersion.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      search={{
                        template: selectedTemplate._id,
                        version: selectedVersion._id ?? undefined,
                      }}
                      to="/admin/prompt-lab"
                      className="inline-flex h-10 items-center border border-accent-blue bg-accent-blue/10 px-4 text-sm font-medium text-ink-primary hover:bg-accent-blue/20"
                    >
                      Open in Prompt Lab
                    </Link>
                    {selectedVersion.status === "draft" ? (
                      <>
                        <ActionButton
                          busy={busyKey === `save-${selectedVersion._id}`}
                          disabled={!isDirty}
                          onClick={() =>
                            void runAction({
                              key: `save-${selectedVersion._id}`,
                              action: async () => {
                                if (!selectedVersion._id) throw new Error("Draft version is missing an ID");
                                await updateDraft({
                                  promptTemplateVersionId: selectedVersion._id,
                                  notePolicy: emptyToUndefined(activeDraft.notePolicy),
                                  systemPrompt: activeDraft.systemPrompt,
                                  userPromptTemplate: activeDraft.userPromptTemplate,
                                  negativePromptTemplate: emptyToUndefined(activeDraft.negativePromptTemplate),
                                });
                              },
                              success: `Saved draft ${selectedVersion.version}.`,
                            })
                          }
                        >
                          Save Draft
                        </ActionButton>
                        <PublishDialog
                          disabled={isDirty || unresolvedVariables.length > 0}
                          version={selectedVersion.version}
                          onPublish={() =>
                            void runAction({
                              key: `publish-${selectedVersion._id}`,
                              action: async () => {
                                if (!selectedVersion._id) throw new Error("Draft version is missing an ID");
                                await publishVersion({ promptTemplateVersionId: selectedVersion._id });
                              },
                              success: `Published ${selectedVersion.version}.`,
                            })
                          }
                        />
                      </>
                    ) : (
                      <ActionButton
                        busy={busyKey === `create-${selectedTemplate._id}`}
                        onClick={() =>
                          void runAction({
                            key: `create-${selectedTemplate._id}`,
                            action: async () => {
                              const result = await createDraft({ promptTemplateId: selectedTemplate._id });
                              selectWorkspaceRecord(selectedTemplate._id, result.versionId);
                            },
                            success: "Draft workspace is ready.",
                          })
                        }
                      >
                        Create New Version
                      </ActionButton>
                    )}
                  </div>
                </div>
              </section>

              <section className="border-b border-line-primary bg-surface px-4 py-3 lg:px-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.22em]">General</h4>
                  <p className="text-xs text-ink-muted">Stable identity and operator policy.</p>
                </div>
                <div className="mt-3 grid border border-line-secondary sm:grid-cols-2 xl:grid-cols-4">
                  <ReadOnlyField label="Name" value={selectedTemplate.name} />
                  <ReadOnlyField label="Key" value={selectedTemplate.slug} mono />
                  <ReadOnlyField label="Version" value={selectedVersion.version} mono />
                  <div className="border-t border-line-secondary p-3 sm:border-l xl:border-t-0">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">Status</p>
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <span className="truncate text-sm text-ink-secondary">{selectedTemplate.isActive ? "Pipeline online" : "Pipeline disabled"}</span>
                      <Switch
                        checked={selectedTemplate.isActive}
                        disabled={busyKey === `active-${selectedTemplate._id}`}
                        onCheckedChange={(checked) =>
                          void runAction({
                            key: `active-${selectedTemplate._id}`,
                            action: async () => {
                              await updateTemplate({ promptTemplateId: selectedTemplate._id, isActive: checked });
                            },
                            success: checked ? "Template enabled." : "Template disabled.",
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 xl:grid-cols-[9rem_minmax(0,1fr)] xl:items-center">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em]">Note Policy</p>
                    <p className="mt-1 text-[11px] text-ink-muted">Operator note rules</p>
                  </div>
                  <Input
                    value={activeDraft.notePolicy}
                    readOnly={selectedVersion.status !== "draft"}
                    onChange={(event) => updateActiveDraft({ notePolicy: event.target.value })}
                    className="h-9 rounded-none border-line-secondary bg-main text-sm text-ink-primary focus-visible:ring-accent-blue read-only:text-ink-secondary"
                  />
                </div>
              </section>

              <div className="grid xl:grid-cols-[minmax(0,1fr)_250px]">
                <div className="min-w-0 space-y-6 p-4 lg:p-5">
                  <PromptEditor
                    label="System Prompt"
                    description="Defines global model behavior."
                    value={activeDraft.systemPrompt}
                    textareaRef={systemPromptRef}
                    readOnly={selectedVersion.status !== "draft"}
                    minHeight="min-h-[230px]"
                    onChange={(value) => updateActiveDraft({ systemPrompt: value })}
                  />
                  <PromptEditor
                    label="User Prompt Template"
                    description="Runtime variables are injected during composition."
                    value={activeDraft.userPromptTemplate}
                    textareaRef={userPromptRef}
                    readOnly={selectedVersion.status !== "draft"}
                    minHeight="min-h-[340px]"
                    onChange={(value) => updateActiveDraft({ userPromptTemplate: value })}
                  />
                  <PromptEditor
                    label="Negative Prompt"
                    description="Exclusions applied to compatible image models."
                    value={activeDraft.negativePromptTemplate}
                    textareaRef={negativePromptRef}
                    readOnly={selectedVersion.status !== "draft"}
                    minHeight="min-h-[150px]"
                    onChange={(value) => updateActiveDraft({ negativePromptTemplate: value })}
                  />
                </div>

                <aside className="border-t border-line-primary bg-panel xl:border-l xl:border-t-0">
                  <ContextSection title="Variables" metric={`${selectedTemplate.variables.length}`}>
                    <p className="mb-3 text-xs leading-5 text-ink-muted">Insert into the User Prompt Template at its current cursor.</p>
                    <div className="space-y-1">
                      {selectedTemplate.variables.map((variable) => (
                        <button
                          key={variable.key}
                          type="button"
                          disabled={selectedVersion.status !== "draft"}
                          onClick={() => insertVariable(variable.token)}
                          title={`${variable.description} Example: ${variable.example}`}
                          className="group w-full border-b border-line-guide py-2 text-left disabled:cursor-default"
                        >
                          <span className="flex items-center justify-between gap-2">
                            <code className="text-xs text-accent-blue">{variable.token}</code>
                            <span className={cn("template-status-dot h-1.5 w-1.5", usedVariables.includes(variable.key) ? "bg-accent-teal" : "bg-line-active")} />
                          </span>
                          <span className="mt-1 block text-[11px] leading-4 text-ink-muted group-hover:text-ink-secondary">{variable.description}</span>
                        </button>
                      ))}
                    </div>
                    {unresolvedVariables.length > 0 ? (
                      <div className="mt-4 border border-accent-red bg-accent-red/10 p-3 text-xs text-accent-red">
                        Unsupported: {unresolvedVariables.map((item) => `{{${item}}}`).join(", ")}
                      </div>
                    ) : null}
                  </ContextSection>

                  <ContextSection title="Version History" metric={`${selectedTemplate.versions.length}`}>
                    {selectedTemplate.versions.map((version) => (
                      <button
                        key={version._id ?? `legacy-${version.version}`}
                        type="button"
                        onClick={() => selectWorkspaceRecord(selectedTemplate._id, version._id)}
                        className={cn("flex w-full items-center justify-between gap-3 border-b border-line-guide py-2 text-left", selectedVersion._id === version._id ? "text-ink-primary" : "text-ink-secondary")}
                      >
                        <span>
                          <span className="block font-mono text-xs">{version.version}</span>
                          <span className="mt-1 block text-[10px] text-ink-muted">{formatDate(version.updatedAt)}</span>
                        </span>
                        <StatusLabel status={version.status} />
                      </button>
                    ))}
                    {selectedVersion.status === "draft" && selectedVersion._id ? (
                      <button
                        type="button"
                        onClick={() =>
                          void runAction({
                            key: `archive-${selectedVersion._id}`,
                            action: async () => {
                              await archiveVersion({ promptTemplateVersionId: selectedVersion._id! });
                            },
                            success: `Archived ${selectedVersion.version}.`,
                          })
                        }
                        className="mt-3 text-xs text-ink-muted underline decoration-line-active underline-offset-4 hover:text-ink-primary"
                      >
                        Archive this draft
                      </button>
                    ) : null}
                  </ContextSection>

                  <ContextSection title="Used By" metric={`${selectedTemplate.bindings.length}`}>
                    {selectedTemplate.bindings.length ? (
                      selectedTemplate.bindings.map((binding) => (
                        <div key={binding._id} className="border-b border-line-guide py-2 first:pt-0">
                          <p className="text-xs font-medium text-ink-primary">{binding.profileName}</p>
                          <p className="mt-1 font-mono text-[10px] text-ink-muted">{binding.modelId}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-ink-secondary">{binding.renderMode ?? binding.generationKind ?? "Default route"}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-ink-muted">No explicit LLM binding.</p>
                    )}
                    <div className="mt-4 grid grid-cols-2 border border-line-secondary">
                      <Metric label="Last 24h" value={`${selectedTemplate.usage.last24h}`} />
                      <Metric label="All time" value={`${selectedTemplate.usage.total}`} />
                    </div>
                    <div className="mt-3 text-xs leading-5 text-ink-muted">
                      <p>Last failure</p>
                      <p className={selectedTemplate.usage.lastFailure ? "text-accent-red" : "text-accent-teal"}>{selectedTemplate.usage.lastFailure ?? "None"}</p>
                      {selectedTemplate.usage.latestExperimentAt ? (
                        <p className="mt-2">Lab {selectedTemplate.usage.latestExperimentStatus} · {formatDate(selectedTemplate.usage.latestExperimentAt)}</p>
                      ) : null}
                    </div>
                  </ContextSection>
                </aside>
              </div>
            </>
          ) : (
            <div className="p-8 text-sm text-ink-secondary">{workspace === undefined ? "Loading Prompt IDE." : "No prompt template is available."}</div>
          )}
        </main>
      </div>
    </div>
  );
}

function PromptEditor({ description, label, minHeight, onChange, readOnly, textareaRef, value }: {
  description: string;
  label: string;
  minHeight: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  textareaRef: RefObject<HTMLTextAreaElement>;
  value: string;
}) {
  return (
    <section>
      <FieldHeader label={label} detail={description} suffix={`${value.length.toLocaleString()} chars`} />
      <Textarea
        ref={textareaRef}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
        className={cn("mt-3 resize-y rounded-none border-line-secondary bg-main p-4 font-mono text-[13px] leading-6 text-ink-primary focus-visible:ring-accent-blue read-only:cursor-default read-only:text-ink-secondary", minHeight)}
      />
    </section>
  );
}

function FieldHeader({ detail, label, suffix }: { detail: string; label: string; suffix?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line-secondary pb-2">
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-[0.22em]">{label}</h4>
        <p className="mt-1 text-xs text-ink-muted">{detail}</p>
      </div>
      {suffix ? <span className="font-mono text-[11px] text-ink-muted">{suffix}</span> : null}
    </div>
  );
}

function ReadOnlyField({ label, mono, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className="border-t border-line-secondary p-3 first:border-t-0 sm:[&:nth-child(2)]:border-l sm:[&:nth-child(-n+2)]:border-t-0 xl:border-t-0 xl:[&:not(:first-child)]:border-l">
      <p className="text-[10px] uppercase tracking-[0.18em] text-ink-muted">{label}</p>
      <p className={cn("mt-2 truncate text-sm", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}

function ContextSection({ children, metric, title }: { children: ReactNode; metric: string; title: string }) {
  return (
    <section className="border-b border-line-primary p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.22em]">{title}</h4>
        <span className="font-mono text-xs text-ink-muted">{metric}</span>
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 first:border-r first:border-line-secondary">
      <p className="text-[10px] uppercase tracking-[0.14em] text-ink-muted">{label}</p>
      <p className="mt-2 font-mono text-lg">{value}</p>
    </div>
  );
}

function StatusLabel({ status }: { status: VersionStatus }) {
  return (
    <span className={cn(
      "shrink-0 border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
      status === "published" && "border-accent-teal/50 text-accent-teal",
      status === "draft" && "border-accent-orange/60 text-accent-orange",
      status === "archived" && "border-line-secondary text-ink-muted"
    )}>
      {status === "published" ? "Active" : status}
    </span>
  );
}

function PublishDialog({ disabled, onPublish, version }: { disabled: boolean; onPublish: () => void; version: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" disabled={disabled} className="h-10 rounded-none border border-accent-teal bg-accent-teal/15 px-4 text-sm text-ink-primary hover:bg-accent-teal/25 disabled:opacity-45">Publish</Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="rounded-none border-2 border-line-primary bg-panel text-ink-primary">
        <AlertDialogHeader>
          <AlertDialogTitle>Publish {version}?</AlertDialogTitle>
          <AlertDialogDescription className="text-ink-secondary">This version becomes the active pipeline configuration. The current published version will be archived.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-none border-line-secondary bg-surface text-ink-secondary">Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onPublish} className="rounded-none bg-ink-primary text-surface hover:bg-accent-teal hover:text-black">Publish Version</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function ActionButton({ busy, children, disabled, onClick }: { busy?: boolean; children: ReactNode; disabled?: boolean; onClick: () => void }) {
  return (
    <Button type="button" onClick={onClick} disabled={disabled || busy} className="h-10 rounded-none border border-line-primary bg-ink-primary px-4 text-sm text-surface hover:bg-accent-blue hover:text-white disabled:opacity-45">
      {busy ? "Working..." : children}
    </Button>
  );
}

function FeedbackStrip({ message, tone }: { message: string | null; tone: "success" | "danger" }) {
  if (!message) return null;
  return <div className={cn("border-l-4 px-4 py-3 text-sm", tone === "success" ? "border-accent-teal bg-accent-teal/10 text-accent-teal" : "border-accent-red bg-accent-red/10 text-accent-red")}>{message}</div>;
}

function AccessState({ danger, description, eyebrow, title }: { danger?: boolean; description?: string; eyebrow: string; title: string }) {
  return (
    <section className={cn("border-2 bg-surface p-6 text-ink-primary", danger ? "border-accent-red" : "border-line-primary")}>
      <p className={cn("text-xs uppercase tracking-[0.3em]", danger ? "text-accent-red" : "text-accent-orange")}>{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-semibold">{title}</h2>
      {description ? <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-secondary">{description}</p> : null}
    </section>
  );
}

function LibraryMessage({ children }: { children: ReactNode }) {
  return <div className="border-b border-line-guide p-4 text-sm text-ink-muted">{children}</div>;
}

async function runTemplateAction({ key, action, success, setBusyKey, setErrorMessage, setStatusMessage }: {
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
    setErrorMessage(error instanceof Error ? error.message : "Template action failed");
  } finally {
    setBusyKey(null);
  }
}

function createPromptDraft(version: TemplateVersion): PromptDraft {
  return {
    notePolicy: version.notePolicy ?? "",
    systemPrompt: version.systemPrompt,
    userPromptTemplate: version.userPromptTemplate,
    negativePromptTemplate: version.negativePromptTemplate ?? "",
  };
}

function draftMatchesVersion(draft: PromptDraft, version: TemplateVersion) {
  return draft.notePolicy === (version.notePolicy ?? "") &&
    draft.systemPrompt === version.systemPrompt &&
    draft.userPromptTemplate === version.userPromptTemplate &&
    draft.negativePromptTemplate === (version.negativePromptTemplate ?? "");
}

function extractVariables(value: string) {
  return Array.from(value.matchAll(/\{\{(\w+)\}\}/g), (match) => match[1]).filter(
    (item, index, items) => items.indexOf(item) === index
  );
}

function draftKey(templateId: string, versionId: string | null) {
  return `${templateId}:${versionId ?? "legacy"}`;
}

function shortName(name: string) {
  return name.replace(/\s+Template$/i, "");
}

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(timestamp));
}

function emptyToUndefined(value: string) {
  const normalized = value.trim();
  return normalized === "" ? undefined : normalized;
}

function readStoredString(key: string) {
  return typeof window === "undefined" ? null : window.localStorage.getItem(key);
}

function writeStoredString(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
}
