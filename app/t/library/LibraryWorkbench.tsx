"use client";
/* eslint-disable @next/next/no-img-element */

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
import { Button } from "@/components/ui/button";
import { ConceptEngagementBar } from "@/components/public/ConceptEngagementBar";
import { ShoppingListActions } from "@/components/public/ShoppingListActions";
import { api } from "@/convex/_generated/api";
import { cn } from "@/lib/utils";
import { useAction, useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useState } from "react";

type PublishVisibility = "private" | "unlisted" | "public";
type BuildStage = "primer-pass" | "decal-pass" | "weathering-pass";

export function LibraryWorkbench() {
  const viewer = useQuery(api.users.viewer);
  const concepts = useQuery(api.concepts.listLibrary);
  const savedConcepts = useQuery(api.concepts.listSavedPublicConcepts);
  const jobs = useQuery(api.generation.listViewerJobs);
  const updateConcept = useMutation(api.concepts.update);
  const requestHdRender = useMutation(api.prototypeTools.requestHdRender);
  const requestMultiAnglePreview = useMutation(api.prototypeTools.requestMultiAnglePreview);
  const requestHighFidelityRender = useMutation(api.prototypeTools.requestHighFidelityRender);
  const requestBuildStageVisualization = useMutation(api.prototypeTools.requestBuildStageVisualization);
  const requestWeatheringSimulation = useMutation(api.prototypeTools.requestWeatheringSimulation);
  const requestWeatheringSplitPreview = useMutation(api.prototypeTools.requestWeatheringSplitPreview);
  const requestMaterialFinishComparison = useMutation(api.prototypeTools.requestMaterialFinishComparison);
  const stabilizeConceptPreviewAsset = useAction(api.generationNode.stabilizeConceptPreviewAsset);
  const paintPlans = useQuery(
    api.paintMappingPlans.listForViewerConcepts,
    concepts ? { conceptIds: concepts.map((concept) => concept._id) } : "skip"
  );
  const feasibility = useQuery(
    api.feasibility.listForViewerConcepts,
    concepts ? { conceptIds: concepts.map((concept) => concept._id) } : "skip"
  );
  const shopping = useQuery(
    api.shopping.listForViewerConcepts,
    concepts ? { conceptIds: concepts.map((concept) => concept._id) } : "skip"
  );
  const recommendations = useQuery(
    api.recommendations.listForViewerConcepts,
    concepts ? { conceptIds: concepts.map((concept) => concept._id) } : "skip"
  );
  const renderHistory = useQuery(
    api.renderHistory.listForViewerConcepts,
    concepts ? { conceptIds: concepts.map((concept) => concept._id) } : "skip"
  );
  const rerunJob = useAction(api.generationNode.rerunJob);
  const [rerunningJobId, setRerunningJobId] = useState<string | null>(null);
  const [renderingState, setRenderingState] = useState<{
    conceptId: string;
    mode:
      | "hd-render"
      | "multi-angle-preview"
      | "high-fidelity-render"
      | "build-stage-visualization"
      | "weathering-simulation"
      | "weathering-split-preview"
      | "material-finish-comparison";
    stage?: BuildStage;
  } | null>(null);
  const [stabilizingConceptId, setStabilizingConceptId] = useState<string | null>(null);
  const [updatingConceptId, setUpdatingConceptId] = useState<string | null>(null);
  const [publishIntent, setPublishIntent] = useState<{
    conceptId: string;
    conceptTitle: string;
    nextVisibility: PublishVisibility;
    currentVisibility: PublishVisibility;
    previewUrlAvailable: boolean;
    currentStatus: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function onRetry(jobId: string) {
    setRerunningJobId(jobId);
    setErrorMessage(null);
    try {
      await rerunJob({ generationJobId: jobId as never });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to retry generation job");
    } finally {
      setRerunningJobId(null);
    }
  }

  async function onVisibilityChange(
    conceptId: string,
    visibility: PublishVisibility
  ) {
    setUpdatingConceptId(conceptId);
    setErrorMessage(null);
    try {
      await updateConcept({ conceptId: conceptId as never, visibility });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update visibility");
    } finally {
      setUpdatingConceptId(null);
    }
  }

  function openPublishReview(input: {
    conceptId: string;
    conceptTitle: string;
    nextVisibility: PublishVisibility;
    currentVisibility: PublishVisibility;
    previewUrlAvailable: boolean;
    currentStatus: string;
  }) {
    setErrorMessage(null);
    setPublishIntent(input);
  }

  async function confirmPublishReview() {
    if (publishIntent === null) {
      return;
    }

    await onVisibilityChange(publishIntent.conceptId, publishIntent.nextVisibility);
    setPublishIntent(null);
  }

  async function onStabilizePreviewAsset(conceptId: string) {
    setStabilizingConceptId(conceptId);
    setErrorMessage(null);
    try {
      await stabilizeConceptPreviewAsset({ conceptId: conceptId as never });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to stabilize public preview URL"
      );
    } finally {
      setStabilizingConceptId(null);
    }
  }

  async function onRequestRender(
    conceptId: string,
    mode:
      | "hd-render"
      | "multi-angle-preview"
      | "high-fidelity-render"
      | "build-stage-visualization"
      | "weathering-simulation"
      | "weathering-split-preview"
      | "material-finish-comparison",
    stage?: BuildStage
  ) {
    setRenderingState({ conceptId, mode, stage });
    setErrorMessage(null);
    try {
      if (mode === "multi-angle-preview") {
        await requestMultiAnglePreview({ conceptId: conceptId as never });
      } else if (mode === "build-stage-visualization") {
        await requestBuildStageVisualization({ conceptId: conceptId as never, stage: stage as never });
      } else if (mode === "weathering-simulation") {
        await requestWeatheringSimulation({ conceptId: conceptId as never });
      } else if (mode === "weathering-split-preview") {
        await requestWeatheringSplitPreview({ conceptId: conceptId as never });
      } else if (mode === "material-finish-comparison") {
        await requestMaterialFinishComparison({ conceptId: conceptId as never });
      } else if (mode === "high-fidelity-render") {
        await requestHighFidelityRender({ conceptId: conceptId as never });
      } else {
        await requestHdRender({ conceptId: conceptId as never });
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to queue render");
    } finally {
      setRenderingState(null);
    }
  }

  if (concepts === undefined || savedConcepts === undefined || jobs === undefined) {
    return (
      <section className="border-2 border-line-primary bg-surface p-6 text-ink-primary">
        <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">Hangar sync</p>
        <h2 className="mt-4 text-3xl font-semibold">Indexing saved prototypes and reactor jobs</h2>
      </section>
    );
  }

  const queuedJobs = jobs.filter((job) => job.status === "queued" || job.status === "running");
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const successfulJobs = jobs.filter((job) => job.status === "succeeded");
  const paintPlanByConceptId = new Map((paintPlans ?? []).map((plan) => [plan.conceptId, plan]));
  const feasibilityByConceptId = new Map(
    (feasibility ?? []).map((entry) => [entry.conceptId, entry])
  );
  const shoppingByConceptId = new Map((shopping ?? []).map((entry) => [entry.conceptId, entry]));
  const recommendationsByConceptId = new Map(
    (recommendations ?? []).map((entry) => [entry.conceptId, entry])
  );
  const renderHistoryByConceptId = new Map(
    (renderHistory ?? []).map((entry) => [entry.conceptId, entry.outputs])
  );
  const renderOutputCount = (renderHistory ?? []).reduce(
    (sum, entry) => sum + entry.outputs.length,
    0
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px]">
      <div className="space-y-6">
        <section className="border-2 border-line-primary bg-panel p-6 text-ink-primary">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">Saved Hangar</p>
          <h2 className="mt-4 text-3xl font-semibold">Prototype library and generation ledger</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
            This is the operator archive for draft concepts, successful previews,
            and failed simulation attempts. Every item here is backed by the current
            P1 domain model: concept, generation job, asset record, and credit transaction.
          </p>
        </section>

        <section className="border-2 border-line-primary bg-surface p-6 text-ink-primary">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">Saved Public Builds</p>
              <h3 className="mt-3 text-2xl font-semibold">Bookmarked showcase concepts in your hangar</h3>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-ink-secondary">
                Public concepts you save from showcase, profile, and landing pages now land here for
                quick recall inside the terminal.
              </p>
            </div>
            <div className="grid gap-2 text-right text-sm text-ink-secondary">
              <span>{savedConcepts.length} saved public build{savedConcepts.length === 1 ? "" : "s"}</span>
              <span>Syncs from public share surfaces</span>
            </div>
          </div>

          {savedConcepts.length === 0 ? (
            <div className="mt-5 rounded-[20px] border border-line-secondary bg-main p-5">
              <p className="text-sm font-semibold text-ink-primary">No saved public builds yet.</p>
              <p className="mt-2 text-sm leading-6 text-ink-secondary">
                Visit the public showcase, a pilot profile, or a style landing page and save a concept
                to pin it into your terminal library.
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {savedConcepts.map((concept) => (
                <article
                  key={concept._id}
                  className="overflow-hidden rounded-[24px] border border-line-secondary bg-main"
                >
                  <div className="aspect-[4/3] bg-main">
                    {concept.previewAsset?.publicUrl ? (
                      <img
                        src={concept.previewAsset.publicUrl}
                        alt={concept.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-end p-5">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">
                            Preview unavailable
                          </p>
                          <p className="mt-2 text-sm leading-6 text-ink-secondary">
                            Asset exists, but no public URL is attached yet.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill label={concept.visibility} tone="neutral" />
                      <StatusPill label={concept.status} tone={statusTone(concept.status)} />
                      {concept.remixCount > 0 ? (
                        <StatusPill label={`${concept.remixCount} remix${concept.remixCount === 1 ? "" : "es"}`} tone="amber" />
                      ) : null}
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold tracking-tight">{concept.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-ink-secondary">
                        {concept.baseModel?.name ?? "Unknown base model"} ·{" "}
                        {concept.stylePreset?.name ?? "Unknown Style DNA"} ·{" "}
                        {concept.materialPreset?.name ?? "Unknown material profile"}
                      </p>
                      {concept.owner ? (
                        <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-muted">
                          Pilot · @{concept.owner.handle}
                        </p>
                      ) : null}
                    </div>
                    <div className="grid gap-2 text-sm text-ink-muted">
                      <MetaRow label="Weathering" value={concept.weatheringLevel} />
                      <MetaRow label="Finish" value={concept.materialPreset?.finishType ?? "Unknown"} />
                    </div>
                    <ConceptEngagementBar
                      conceptId={concept._id}
                      likeCount={concept.engagement.likeCount}
                      saveCount={concept.engagement.saveCount}
                      viewerHasLiked={concept.engagement.viewerHasLiked}
                      viewerHasSaved={concept.engagement.viewerHasSaved}
                      compact
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      {!concept.previewAsset?.publicUrl && concept.previewAsset?.key ? (
                        <Button
                          type="button"
                          disabled={stabilizingConceptId === concept._id}
                          onClick={() => {
                            void onStabilizePreviewAsset(concept._id);
                          }}
                          className="h-11 rounded-[18px] border border-accent-teal bg-[#13241B] text-ink-primary hover:bg-white/10"
                        >
                          {stabilizingConceptId === concept._id
                            ? "Stabilizing Preview"
                            : "Stabilize Public Preview"}
                        </Button>
                      ) : null}
                      <Link
                        href={`/prototype/${concept._id}`}
                        className="inline-flex h-11 items-center justify-center rounded-[18px] border border-accent-blue bg-[#0E2430] px-4 text-sm font-medium text-ink-primary transition-colors hover:bg-white/10"
                      >
                        Open Share Surface
                      </Link>
                      <Link
                        href={`/t/create?remix=${concept._id}`}
                        className="inline-flex h-11 items-center justify-center rounded-[18px] border border-accent-orange bg-[#2A210F] px-4 text-sm font-medium text-ink-primary transition-colors hover:bg-white/10"
                      >
                        Remix in Create
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {concepts.length === 0 ? (
          <section className="border-2 border-line-primary bg-surface p-8 text-ink-primary">
            <p className="text-xs uppercase tracking-[0.28em] text-accent-blue">Library empty</p>
            <h3 className="mt-4 text-2xl font-semibold">No prototypes have been initialized yet.</h3>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-secondary">
              Use the Create terminal to dispatch the first structured concept. Once
              queued, succeeded, or failed, it will appear here with job and credit context.
            </p>
          </section>
        ) : (
          <section className="grid gap-4">
            {concepts.map((concept) => {
              const paintPlan = paintPlanByConceptId.get(concept._id);
              const feasibilityEntry = feasibilityByConceptId.get(concept._id);
              const shoppingEntry = shoppingByConceptId.get(concept._id);
              const recommendationEntry = recommendationsByConceptId.get(concept._id);
              const renderOutputs = renderHistoryByConceptId.get(concept._id) ?? [];
              return (
              <article
                key={concept._id}
                className="rounded-[28px] border border-line-secondary bg-surface p-5 text-ink-primary"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusPill label={concept.status} tone={statusTone(concept.status)} />
                      {concept.generationJob?.status ? (
                        <StatusPill
                          label={`job ${concept.generationJob.status}`}
                          tone={statusTone(concept.generationJob.status)}
                        />
                      ) : null}
                      <StatusPill label={concept.visibility} tone="neutral" />
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                      {concept.title}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-ink-secondary">
                      {concept.baseModel?.name ?? "Unknown base model"} ·{" "}
                      {concept.stylePreset?.name ?? "Unknown Style DNA"} ·{" "}
                      {concept.materialPreset?.name ?? "Unknown material profile"}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                      {concept.sourceConcept ? (
                        <span>Remix Source · {concept.sourceConcept.title}</span>
                      ) : (
                        <span>Direct Prototype</span>
                      )}
                      {concept.remixCount > 0 ? <span>Outbound Remixes · {concept.remixCount}</span> : null}
                    </div>
                    {concept.moodTags.length > 0 ? (
                      <p className="mt-3 text-xs uppercase tracking-[0.18em] text-ink-muted">
                        Mood Vector · {concept.moodTags.map(formatMoodTagLabel).join(" / ")}
                      </p>
                    ) : null}
                  </div>
                  <div className="w-full max-w-[320px] rounded-[22px] border border-line-secondary bg-main p-4">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-accent-blue">
                      Reactor record
                    </p>
                    <div className="mt-4 space-y-3 text-sm">
                      <MetaRow label="Weathering" value={concept.weatheringLevel} />
                      <MetaRow
                        label="Credits"
                        value={
                          concept.generationJob
                            ? `${concept.generationJob.requestedCredits} credits`
                            : "N/A"
                        }
                      />
                      <MetaRow
                        label="Provider"
                        value={concept.generationJob?.provider ?? "Not assigned"}
                      />
                      <MetaRow
                        label="Job Kind"
                        value={formatJobKind(concept.generationJob?.kind, concept.generationJob?.renderMode)}
                      />
                      <MetaRow
                        label="Asset"
                        value={concept.previewAsset?.contentType ?? "No preview asset yet"}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <div className="rounded-[22px] border border-line-secondary bg-panel p-4">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-accent-teal">
                      Notes + status
                    </p>
                    <p className="mt-3 text-sm leading-6 text-ink-muted">
                      {concept.notes?.trim() || "No additional operator note was attached."}
                    </p>
                    {concept.generationJob?.errorMessage ? (
                      <div className="mt-4 rounded-[18px] border border-accent-red bg-accent-red/10 p-4 text-sm text-accent-red">
                        {concept.generationJob.errorMessage}
                      </div>
                    ) : null}
                    {concept.previewAsset?.key ? (
                      <p className="mt-4 break-all text-xs leading-5 text-ink-muted">
                        Asset key: {concept.previewAsset.key}
                      </p>
                    ) : null}
                    {concept.sourceConcept ? (
                      <div className="mt-4 rounded-[18px] border border-line-secondary bg-main p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-teal">
                          Source lineage
                        </p>
                        <p className="mt-3 text-sm text-ink-primary">{concept.sourceConcept.title}</p>
                        <p className="mt-2 text-xs leading-5 text-ink-secondary">
                          {concept.sourceConcept.baseModel?.name ?? "Unknown base model"} ·{" "}
                          {concept.sourceConcept.stylePreset?.name ?? "Unknown Style DNA"} ·{" "}
                          {concept.sourceConcept.owner?.handle ?? concept.sourceConcept.owner?.fullName ?? "Unknown pilot"}
                        </p>
                        {concept.sourceConcept.visibility !== "private" ? (
                          <Link
                            href={`/prototype/${concept.sourceConcept._id}`}
                            className="mt-3 inline-flex h-9 items-center justify-center rounded-[14px] border border-accent-blue bg-[#0E2430] px-3 text-xs text-ink-primary transition-colors hover:bg-white/10"
                          >
                            Open Source Surface
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                    {renderOutputs.length > 0 ? (
                      <div className="mt-4 rounded-[18px] border border-[#8FEAFF]/20 bg-main p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-[11px] uppercase tracking-[0.22em] text-accent-blue">
                              Render History
                            </p>
                            <p className="mt-2 text-sm leading-6 text-ink-muted">
                              {renderOutputs.length} archived render output{renderOutputs.length === 1 ? "" : "s"} for
                              this concept.
                            </p>
                          </div>
                          <StatusPill label="independent assets" tone="cyan" />
                        </div>
                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {renderOutputs.slice(0, 4).map((output) => (
                            <div
                              key={output._id}
                              className="overflow-hidden rounded-[16px] border border-line-secondary bg-main"
                            >
                              <div className="aspect-[16/10] bg-main/30">
                                {output.asset?.publicUrl ? (
                                  <img
                                    src={output.asset.publicUrl}
                                    alt={output.label}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full items-end p-3">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                                      Asset URL pending
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="space-y-3 p-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <StatusPill
                                    label={formatJobKind("hd-preview", output.renderMode)}
                                    tone="green"
                                  />
                                  {output.simulationStage ? (
                                    <StatusPill
                                      label={formatSimulationStagePill(output.simulationStage)}
                                      tone="amber"
                                    />
                                  ) : null}
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-ink-primary">{output.label}</p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.16em] text-ink-muted">
                                    {formatHistoryTimestamp(output._creationTime)}
                                  </p>
                                </div>
                                {output.summary?.layoutSpec ? (
                                  <p className="rounded-[12px] border border-[#8FEAFF]/15 bg-[#8FEAFF]/5 p-2 text-xs leading-5 text-ink-muted">
                                    {output.summary.layoutSpec}
                                  </p>
                                ) : null}
                                {output.summary?.materialComparisonVariants?.length ? (
                                  <div className="rounded-[12px] border border-[#EFCB7A]/15 bg-[#EFCB7A]/5 p-2 text-xs leading-5 text-ink-muted">
                                    {output.summary.materialComparisonVariants
                                      .slice(0, 4)
                                      .map((variant) => variant.name)
                                      .join(" / ")}
                                  </div>
                                ) : null}
                                <div className="grid gap-2 text-xs text-ink-secondary">
                                  <span>{output.job?.provider ?? "provider pending"}</span>
                                  <span>{output.asset?.contentType ?? "asset pending"}</span>
                                  <span className="break-all font-mono">{output.generationJobId}</span>
                                </div>
                                {output.asset?.publicUrl ? (
                                  <a
                                    href={output.asset.publicUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex h-9 items-center justify-center rounded-[14px] border border-accent-blue bg-[#0E2430] px-3 text-xs text-ink-primary transition-colors hover:bg-white/10"
                                  >
                                    Open Render Asset
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          ))}
                        </div>
                        {renderOutputs.length > 4 ? (
                          <p className="mt-3 text-xs leading-5 text-ink-secondary">
                            {renderOutputs.length - 4} older render output{renderOutputs.length - 4 === 1 ? "" : "s"} retained in
                            history.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {paintPlan ? (
                      <div className="mt-4 rounded-[18px] border border-line-secondary bg-main p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-orange">
                          Paint Mapping Plan
                        </p>
                        <div className="mt-3 space-y-3">
                          {paintPlan.entries.slice(0, 4).map((entry) => (
                            <div key={entry.roleSlug} className="rounded-[14px] border border-line-secondary p-3">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-sm text-ink-primary">{entry.roleName}</span>
                                <span className="text-[11px] uppercase tracking-[0.16em] text-ink-secondary">
                                  {entry.suggestedPaint?.code ?? "N/A"}
                                </span>
                              </div>
                              <p className="mt-2 text-xs text-ink-muted">
                                {entry.suggestedPaint
                                  ? `${entry.suggestedPaint.brand} ${entry.suggestedPaint.colorName}`
                                  : "No active paint mapping"}
                              </p>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 space-y-2 text-xs leading-5 text-ink-secondary">
                          {paintPlan.sprayNotes.slice(0, 2).map((note) => (
                            <p key={note}>{note}</p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {feasibilityEntry ? (
                      <div className="mt-4 rounded-[18px] border border-line-secondary bg-main p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-orange">
                          Spray Feasibility
                        </p>
                        <p className="mt-3 text-sm leading-6 text-ink-muted">
                          {feasibilityEntry.summary}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <FeasibilityStat
                            label="Beginner difficulty"
                            value={feasibilityEntry.beginnerDifficulty}
                          />
                          <FeasibilityStat
                            label="Masking"
                            value={`${feasibilityEntry.maskingComplexity}/100`}
                          />
                          <FeasibilityStat
                            label="Estimated layers"
                            value={`${feasibilityEntry.estimatedLayerCount}`}
                          />
                          <FeasibilityStat
                            label="Paint cost"
                            value={feasibilityEntry.paintCostBand}
                          />
                        </div>
                      </div>
                    ) : null}
                    {shoppingEntry ? (
                      <div className="mt-4 rounded-[18px] border border-line-secondary bg-main p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-blue">
                          Shopping Readiness
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <FeasibilityStat
                            label="Primary items"
                            value={`${shoppingEntry.primaryItems.length}`}
                          />
                          <FeasibilityStat
                            label="Alternate items"
                            value={`${shoppingEntry.alternateItems.length}`}
                          />
                          <FeasibilityStat
                            label="Confidence"
                            value={shoppingEntry.procurementConfidence}
                          />
                          <FeasibilityStat
                            label="Affiliate-ready"
                            value={`${shoppingEntry.purchaseSummary.affiliateReadyCount}`}
                          />
                        </div>
                        <p className="mt-4 text-xs leading-5 text-ink-secondary">
                          This concept already has a P3 shopping list model behind it, including primary purchase items
                          and fallback sourcing options.
                        </p>
                        {shoppingEntry.bundles.core[0] ? (
                          <div className="mt-4 rounded-[16px] border border-line-secondary bg-main p-3">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                              Core Anchor
                            </p>
                            <p className="mt-2 text-sm text-ink-primary">
                              {shoppingEntry.bundles.core[0].brand} {shoppingEntry.bundles.core[0].code}
                            </p>
                            <p className="mt-1 text-xs text-ink-secondary">
                              {shoppingEntry.bundles.core[0].colorName}
                            </p>
                          </div>
                        ) : null}
                        {shoppingEntry.featuredPurchasePath ? (
                          <a
                            href={shoppingEntry.featuredPurchasePath.url}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                              "mt-4 inline-flex h-10 items-center justify-center rounded-[16px] px-4 text-sm text-ink-primary transition-colors",
                              shoppingEntry.featuredPurchasePath.type === "affiliate"
                                ? "border border-accent-teal bg-[#13241B] hover:bg-white/10"
                                : "border border-accent-blue bg-[#0E2430] hover:bg-white/10"
                            )}
                          >
                            {shoppingEntry.featuredPurchasePath.type === "affiliate"
                              ? "Open Best Purchase Path"
                              : "Search Best Purchase Path"}
                          </a>
                        ) : null}
                        <ShoppingListActions
                          className="mt-4"
                          data={{
                            conceptTitle: shoppingEntry.conceptTitle,
                            baseModelName: shoppingEntry.baseModelName,
                            stylePresetName: shoppingEntry.stylePresetName,
                            materialPresetName: shoppingEntry.materialPresetName,
                            bundles: shoppingEntry.bundles,
                            notes: shoppingEntry.notes,
                          }}
                        />
                      </div>
                    ) : null}
                    {recommendationEntry ? (
                      <div className="mt-4 rounded-[18px] border border-line-secondary bg-main p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-accent-teal">
                          Recommendation Bias
                        </p>
                        <p className="mt-3 text-sm leading-6 text-ink-muted">
                          {recommendationEntry.feasibilityBias === "practical"
                            ? "Current guidance is leaning toward easier execution and safer procurement paths."
                            : "Current guidance is balanced between visual ambition and practical execution."}
                        </p>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <FeasibilityStat
                            label="Style alternatives"
                            value={`${recommendationEntry.alternativeStyles.length}`}
                          />
                          <FeasibilityStat
                            label="Material alternatives"
                            value={`${recommendationEntry.easierMaterials.length}`}
                          />
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <Link
                            href={`/t/create?remix=${concept._id}`}
                            className="inline-flex h-10 items-center justify-center rounded-[16px] border border-accent-blue bg-[#0E2430] px-4 text-sm text-ink-primary transition-colors hover:bg-white/10"
                          >
                            Open In Create
                          </Link>
                          <div className="rounded-[16px] border border-line-secondary bg-main p-3 text-xs leading-5 text-ink-secondary">
                            Use the recommendation bridge from the prototype page when you want the create session to
                            preload a specific style, material, or workflow recommendation.
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[22px] border border-line-secondary bg-panel p-4">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-accent-orange">
                      Action surface
                    </p>
                    <div className="mt-4 space-y-3">
                      <div className="rounded-[18px] border border-line-secondary bg-main p-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-ink-secondary">
                          Publish workflow
                        </p>
                        <div className="mt-3 grid gap-2">
                          {(["private", "unlisted", "public"] as const).map((option) => (
                            <button
                              key={option}
                              type="button"
                              disabled={
                                updatingConceptId === concept._id ||
                                (option !== "private" &&
                                  (concept.status !== "generated" && concept.status !== "archived"))
                              }
                              onClick={() => {
                                openPublishReview({
                                  conceptId: concept._id,
                                  conceptTitle: concept.title,
                                  nextVisibility: option,
                                  currentVisibility: concept.visibility,
                                  previewUrlAvailable: Boolean(concept.previewAsset?.publicUrl),
                                  currentStatus: concept.status,
                                });
                              }}
                              className={cn(
                                "rounded-[14px] border px-3 py-2 text-left text-xs uppercase tracking-[0.18em] transition-colors",
                                concept.visibility === option
                                  ? "border-accent-blue bg-accent-blue/10 text-ink-primary"
                                  : "border-line-secondary text-ink-secondary hover:border-line-active hover:text-ink-primary"
                              )}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        <div className="mt-3 rounded-[14px] border border-line-secondary bg-main p-3 text-xs leading-5 text-ink-secondary">
                          `private` keeps the concept internal.
                          `unlisted` creates a direct-link share surface.
                          `public` sends it to the showcase, landing pages, and profile surfaces.
                        </div>
                      </div>
                      {concept.visibility !== "private" ? (
                        <Link
                          href={`/prototype/${concept._id}`}
                          className="inline-flex h-11 w-full items-center justify-center rounded-[18px] border border-accent-teal bg-[#13241B] px-4 text-sm text-ink-primary transition-colors hover:bg-white/10"
                        >
                          Open Share Surface
                        </Link>
                      ) : null}
                      {(concept.status === "generated" || concept.status === "archived") &&
                      concept.visibility !== "private" ? (
                        <Link
                          href={`/t/create?remix=${concept._id}`}
                          className="inline-flex h-11 w-full items-center justify-center rounded-[18px] border border-accent-orange bg-[#2A210F] px-4 text-sm text-ink-primary transition-colors hover:bg-white/10"
                        >
                          Remix in Create
                        </Link>
                      ) : null}
                      {!concept.previewAsset?.publicUrl && concept.previewAsset?.key ? (
                        <Button
                          type="button"
                          disabled={stabilizingConceptId === concept._id}
                          onClick={() => {
                            void onStabilizePreviewAsset(concept._id);
                          }}
                          className="h-11 w-full rounded-[18px] border border-accent-teal bg-[#13241B] text-ink-primary hover:bg-white/10"
                        >
                          {stabilizingConceptId === concept._id
                            ? "Stabilizing Public Preview"
                            : "Stabilize Public Preview"}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        disabled={
                          concept.status !== "generated" ||
                          concept.generationJob?.status === "queued" ||
                          concept.generationJob?.status === "running" ||
                          renderingState?.conceptId === concept._id
                        }
                        onClick={() => {
                          void onRequestRender(concept._id, "hd-render");
                        }}
                        className="h-11 w-full rounded-[18px] border border-accent-blue bg-[#0E2430] text-ink-primary hover:bg-white/10"
                      >
                        {renderingState &&
                        renderingState.conceptId === concept._id &&
                        renderingState.mode === "hd-render"
                          ? "Queueing HD Render"
                          : "Generate HD Render"}
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          concept.status !== "generated" ||
                          concept.generationJob?.status === "queued" ||
                          concept.generationJob?.status === "running" ||
                          renderingState?.conceptId === concept._id
                        }
                        onClick={() => {
                          void onRequestRender(concept._id, "multi-angle-preview");
                        }}
                        className="h-11 w-full rounded-[18px] border border-accent-teal bg-[#13241B] text-ink-primary hover:bg-white/10"
                      >
                        {renderingState &&
                        renderingState.conceptId === concept._id &&
                        renderingState.mode === "multi-angle-preview"
                          ? "Queueing Contact Sheet"
                          : "Generate Contact Sheet"}
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          concept.status !== "generated" ||
                          concept.generationJob?.status === "queued" ||
                          concept.generationJob?.status === "running" ||
                          renderingState?.conceptId === concept._id
                        }
                        onClick={() => {
                          void onRequestRender(concept._id, "high-fidelity-render");
                        }}
                        className="h-11 w-full rounded-[18px] border border-accent-orange bg-[#2C2211] text-ink-primary hover:bg-[#3A2C15]"
                      >
                        {renderingState &&
                        renderingState.conceptId === concept._id &&
                        renderingState.mode === "high-fidelity-render"
                          ? "Queueing High-fidelity Render"
                          : "Generate High-fidelity Render"}
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          concept.status !== "generated" ||
                          concept.generationJob?.status === "queued" ||
                          concept.generationJob?.status === "running" ||
                          renderingState?.conceptId === concept._id
                        }
                        onClick={() => {
                          void onRequestRender(concept._id, "material-finish-comparison");
                        }}
                        className="h-11 w-full rounded-[18px] border border-[#EFCB7A]/40 bg-[#292414] text-ink-primary hover:bg-[#38301A]"
                      >
                        {renderingState &&
                        renderingState.conceptId === concept._id &&
                        renderingState.mode === "material-finish-comparison"
                          ? "Queueing Finish Comparison"
                          : "Generate Finish Comparison"}
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          concept.status !== "generated" ||
                          concept.generationJob?.status === "queued" ||
                          concept.generationJob?.status === "running" ||
                          renderingState?.conceptId === concept._id
                        }
                        onClick={() => {
                          void onRequestRender(concept._id, "weathering-simulation");
                        }}
                        className="h-11 w-full rounded-[18px] border border-[#8FEAFF]/40 bg-[#113042] text-ink-primary hover:bg-[#174155]"
                      >
                        {renderingState &&
                        renderingState.conceptId === concept._id &&
                        renderingState.mode === "weathering-simulation"
                          ? "Queueing Weathering Simulation"
                          : "Generate Weathering Simulation"}
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          concept.status !== "generated" ||
                          concept.generationJob?.status === "queued" ||
                          concept.generationJob?.status === "running" ||
                          renderingState?.conceptId === concept._id
                        }
                        onClick={() => {
                          void onRequestRender(concept._id, "weathering-split-preview");
                        }}
                        className="h-11 w-full rounded-[18px] border border-accent-orange bg-[#2B1F16] text-ink-primary hover:bg-[#3A2B1D]"
                      >
                        {renderingState &&
                        renderingState.conceptId === concept._id &&
                        renderingState.mode === "weathering-split-preview"
                          ? "Queueing Weathering Split"
                          : "Generate Weathering Split"}
                      </Button>
                      {(["primer-pass", "decal-pass", "weathering-pass"] as const).map((stage) => (
                        <Button
                          key={stage}
                          type="button"
                          disabled={
                            concept.status !== "generated" ||
                            concept.generationJob?.status === "queued" ||
                            concept.generationJob?.status === "running" ||
                            renderingState?.conceptId === concept._id
                          }
                          onClick={() => {
                            void onRequestRender(concept._id, "build-stage-visualization", stage);
                          }}
                          className="h-11 w-full rounded-[18px] border border-[#8FEAFF]/35 bg-[#102632] text-ink-primary hover:bg-[#173444]"
                        >
                          {renderingState &&
                          renderingState.conceptId === concept._id &&
                          renderingState.mode === "build-stage-visualization" &&
                          renderingState.stage === stage
                            ? `Queueing ${formatBuildStageLabel(stage)}`
                            : `Generate ${formatBuildStageLabel(stage)}`}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        disabled={
                          concept.generationJob === null ||
                          concept.generationJob.status !== "failed" ||
                          rerunningJobId === concept.generationJob._id
                        }
                        onClick={() => {
                          if (concept.generationJob) {
                            void onRetry(concept.generationJob._id);
                          }
                        }}
                        className="h-11 w-full rounded-[18px] border border-accent-orange bg-[#2C2211] text-ink-primary hover:bg-[#3A2C15]"
                      >
                        {rerunningJobId === concept.generationJob?._id
                          ? "Re-dispatching"
                          : "Retry Failed Job"}
                      </Button>
                      <div className="rounded-[18px] border border-line-secondary bg-main p-3 text-xs leading-5 text-ink-secondary">
                        Publishing now runs through a review gate before the concept moves onto
                        public or unlisted surfaces. Retry remains available only for failed jobs.
                      </div>
                    </div>
                  </div>
                </div>
              </article>
              );
            })}
          </section>
        )}
      </div>

      <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <section className="border-2 border-line-primary bg-panel p-6 text-ink-primary">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-blue">Operator ledger</p>
          <div className="mt-5 space-y-4">
            <MetaRow label="Pilot" value={viewer?.handle ?? "Unknown"} />
            <MetaRow label="Credits" value={`${viewer?.credits.balance ?? 0}`} />
            <MetaRow label="Drafts + outputs" value={`${concepts.length}`} />
            <MetaRow label="Render outputs" value={`${renderOutputCount}`} />
            <MetaRow label="Queued / running" value={`${queuedJobs.length}`} />
            <MetaRow label="Failed jobs" value={`${failedJobs.length}`} />
            <MetaRow label="Succeeded jobs" value={`${successfulJobs.length}`} />
          </div>
        </section>

        <section className="border-2 border-line-primary bg-surface p-6 text-ink-primary">
          <p className="text-xs uppercase tracking-[0.3em] text-accent-teal">Queue monitor</p>
          <div className="mt-4 space-y-3">
            {jobs.slice(0, 6).map((job) => (
              <div
                key={job._id}
                className="rounded-[18px] border border-line-secondary bg-main p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <StatusPill label={job.status} tone={statusTone(job.status)} />
                  <span className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                    {job.requestedCredits} credits
                  </span>
                </div>
                <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-ink-muted">
                  {formatJobKind(job.kind, job.renderMode)}
                </p>
                <p className="mt-3 break-all font-mono text-[12px] leading-5 text-ink-secondary">
                  {job._id}
                </p>
                {job.errorMessage ? (
                  <p className="mt-3 text-xs leading-5 text-accent-red">{job.errorMessage}</p>
                ) : null}
              </div>
            ))}
          </div>
          {errorMessage ? (
            <div className="mt-4 rounded-[18px] border border-accent-red bg-accent-red/10 p-4 text-sm text-accent-red">
              {errorMessage}
            </div>
          ) : null}
        </section>
      </aside>

      <AlertDialog
        open={publishIntent !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPublishIntent(null);
          }
        }}
      >
        <AlertDialogContent className="border-line-secondary bg-panel text-ink-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Review publish change</AlertDialogTitle>
            <AlertDialogDescription className="text-ink-secondary">
              Confirm how this concept should move between private, direct-share, and public surfaces.
            </AlertDialogDescription>
          </AlertDialogHeader>

          {publishIntent ? (
            <div className="space-y-4">
              <div className="rounded-[18px] border border-line-secondary bg-main p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-accent-teal">Concept</p>
                <p className="mt-3 text-lg font-semibold">{publishIntent.conceptTitle}</p>
                <div className="mt-4 space-y-3 text-sm">
                  <MetaRow label="Current visibility" value={publishIntent.currentVisibility} />
                  <MetaRow label="Next visibility" value={publishIntent.nextVisibility} />
                  <MetaRow label="Concept status" value={publishIntent.currentStatus} />
                  <MetaRow
                    label="Public preview URL"
                    value={publishIntent.previewUrlAvailable ? "ready" : "missing"}
                  />
                </div>
              </div>

              <div className="rounded-[18px] border border-line-secondary bg-main p-4 text-sm leading-6 text-ink-muted">
                {publishIntent.nextVisibility === "private" ? (
                  <p>
                    This will remove the concept from all public and direct-share surfaces. Existing public discovery
                    and direct links will stop resolving.
                  </p>
                ) : publishIntent.nextVisibility === "unlisted" ? (
                  <p>
                    This will publish the concept to a direct-link share surface without sending it into showcase feeds,
                    style landing pages, or public discovery grids.
                  </p>
                ) : (
                  <p>
                    This will publish the concept to the full public surface: showcase feed, pilot profile, SEO landing
                    pages, and remix discovery routes.
                  </p>
                )}
              </div>

              {(publishIntent.nextVisibility !== "private" &&
                publishIntent.currentStatus !== "generated" &&
                publishIntent.currentStatus !== "archived") ? (
                <div className="rounded-[18px] border border-accent-red bg-accent-red/10 p-4 text-sm text-accent-red">
                  Only generated or archived concepts can move onto shared surfaces.
                </div>
              ) : null}

              {publishIntent.nextVisibility !== "private" && !publishIntent.previewUrlAvailable ? (
                <div className="rounded-[18px] border border-accent-red bg-accent-red/10 p-4 text-sm text-accent-red">
                  A public preview URL is required before this concept can be shared. Generate or stabilize a public
                  preview asset first.
                </div>
              ) : null}
            </div>
          ) : null}

          <AlertDialogFooter>
            <AlertDialogCancel className="border-line-secondary bg-transparent text-ink-primary hover:bg-hover-subtle hover:text-ink-primary">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                publishIntent === null ||
                updatingConceptId !== null ||
                (publishIntent.nextVisibility !== "private" &&
                  publishIntent.currentStatus !== "generated" &&
                  publishIntent.currentStatus !== "archived") ||
                (publishIntent.nextVisibility !== "private" && !publishIntent.previewUrlAvailable)
              }
              onClick={() => {
                void confirmPublishReview();
              }}
              className="border border-accent-teal bg-[#13241B] text-ink-primary hover:bg-white/10"
            >
              {publishIntent?.nextVisibility === "private"
                ? "Confirm unpublish"
                : publishIntent?.nextVisibility === "unlisted"
                  ? "Confirm direct share"
                  : "Confirm public publish"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-line-guide pb-3">
      <span className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">{label}</span>
      <span className="max-w-[58%] text-right text-sm text-ink-primary">{value}</span>
    </div>
  );
}

function FeasibilityStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] border border-line-secondary p-3">
      <p className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">{label}</p>
      <p className="mt-2 text-sm text-ink-primary">{value}</p>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "neutral" | "cyan" | "green" | "amber" | "red";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
        tone === "neutral" && "border-line-secondary text-ink-secondary",
        tone === "cyan" && "border-accent-blue bg-accent-blue/10 text-accent-blue",
        tone === "green" && "border-accent-teal bg-accent-teal/10 text-accent-teal",
        tone === "amber" && "border-accent-orange bg-accent-orange/10 text-accent-orange",
        tone === "red" && "border-accent-red bg-accent-red/10 text-[#FFD2D2]"
      )}
    >
      {label}
    </span>
  );
}

function statusTone(status: string): "neutral" | "cyan" | "green" | "amber" | "red" {
  if (status === "queued" || status === "draft" || status === "running") {
    return "cyan";
  }
  if (status === "generated" || status === "succeeded") {
    return "green";
  }
  if (status === "archived") {
    return "amber";
  }
  if (status === "failed") {
    return "red";
  }
  return "neutral";
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
  return "Not assigned";
}

function formatBuildStageLabel(stage: BuildStage) {
  if (stage === "primer-pass") {
    return "Primer Pass Visualization";
  }
  if (stage === "decal-pass") {
    return "Decal Pass Visualization";
  }
  return "Weathering Pass Visualization";
}

function formatSimulationStagePill(stage: string) {
  if (stage === "primer-pass") {
    return "Primer Pass";
  }
  if (stage === "decal-pass") {
    return "Decal Pass";
  }
  if (stage === "weathering-pass") {
    return "Weathering Pass";
  }
  return "Build Stage";
}

function formatHistoryTimestamp(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatMoodTagLabel(tag: string) {
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
  if (tag === "ceremonial-clean") {
    return "Ceremonial Clean";
  }
  return tag;
}
