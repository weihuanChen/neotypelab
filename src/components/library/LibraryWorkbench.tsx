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
import { SignInButton } from "@clerk/tanstack-react-start";
import { ShoppingListActions } from "@/components/public/ShoppingListActions";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChoiceChip,
  FieldHint,
  FocusPanel,
  GhostButton,
  Kicker,
  MetaRow,
  StatusPill,
  WorkbenchNotice,
  mapStatusTone,
} from "@/src/components/ui/workbench";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { usePrivateAssetUrl } from "@/src/hooks/usePrivateAssetUrl";
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { useState, useEffect } from "react";
import { DownloadIcon, LightningBoltIcon, LockClosedIcon, TrashIcon } from "@radix-ui/react-icons";
import type { FunctionReturnType } from "convex/server";
import type { LibrarySearch } from "./librarySearch";

type PublishVisibility = "private" | "unlisted" | "public";
type BuildStage = "primer-pass" | "decal-pass" | "weathering-pass";
type LibraryScope = "prototypes" | "saved";
type LibraryView = "list" | "grid";
type OperationalStatus =
  | "draft"
  | "queued"
  | "rendering"
  | "ready"
  | "failed"
  | "archived";
type StatusFilter = "all" | "draft" | "rendering" | "ready" | "failed";
type CleanupMode = "delete-original" | "clean-old-versions" | "space-saver";
type CleanupIntent = {
  mediaAssetId: Id<"mediaAssets">;
  conceptTitle: string;
  mode: CleanupMode;
  oldVersionCount: number;
};
export function LibraryWorkbench({ search: _search }: { search: LibrarySearch }) {
  return (
    <div className="library-page">
      <AuthLoading>
        <section className="library-empty">
          <p className="showcase-kicker is-teal">Hangar sync</p>
          <h1>Opening operator library.</h1>
          <p>
            Clerk is present and Convex is negotiating the authenticated viewer
            token.
          </p>
        </section>
      </AuthLoading>

      <Unauthenticated>
        <section className="library-empty">
          <p className="showcase-kicker is-orange">Signed out</p>
          <h1>Sign in to open your prototype library.</h1>
          <p>
            The library is backed by your private concepts, saved public builds,
            render tools, and generation job ledger.
          </p>
          <SignInButton mode="modal">
            <button className="showcase-button" type="button">
              Sign in
            </button>
          </SignInButton>
        </section>
      </Unauthenticated>

      <Authenticated>
        <AuthenticatedLibraryWorkbench />
      </Authenticated>
    </div>
  );
}

function AuthenticatedLibraryWorkbench() {
  const concepts = useQuery(api.concepts.listLibrary);
  const savedConcepts = useQuery(api.concepts.listSavedPublicConcepts);
  const storageUsage = useQuery(api.storageAccounting.viewerUsage);
  const entitlements = useQuery(api.entitlements.viewerEffective);
  const setConceptVisibility = useAction(api.publicationNode.setConceptVisibility);
  const cleanPrivateAsset = useAction(api.assetMaintenanceNode.cleanPrivateAsset);
  const createSprayPlan = useMutation(api.sprayPlans.createFromConcept);
  const requestHdRender = useMutation(api.prototypeTools.requestHdRender);
  const requestMultiAnglePreview = useMutation(api.prototypeTools.requestMultiAnglePreview);
  const requestHighFidelityRender = useMutation(api.prototypeTools.requestHighFidelityRender);
  const requestBuildStageVisualization = useMutation(api.prototypeTools.requestBuildStageVisualization);
  const requestWeatheringSimulation = useMutation(api.prototypeTools.requestWeatheringSimulation);
  const requestWeatheringSplitPreview = useMutation(api.prototypeTools.requestWeatheringSplitPreview);
  const requestMaterialFinishComparison = useMutation(api.prototypeTools.requestMaterialFinishComparison);
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
  const [updatingConceptId, setUpdatingConceptId] = useState<string | null>(null);
  const [creatingSprayPlanId, setCreatingSprayPlanId] = useState<string | null>(null);
  const [publishIntent, setPublishIntent] = useState<{
    conceptId: string;
    conceptTitle: string;
    nextVisibility: PublishVisibility;
    currentVisibility: PublishVisibility;
    publicationReady: boolean;
    currentStatus: string;
  } | null>(null);
  const [cleanupIntent, setCleanupIntent] = useState<CleanupIntent | null>(null);
  const [cleaningAssetId, setCleaningAssetId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [scope, setScope] = useState<LibraryScope>("prototypes");
  const [view, setView] = useState<LibraryView>("list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [kitFilter, setKitFilter] = useState("all");
  const [styleFilter, setStyleFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

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
      await setConceptVisibility({ conceptId: conceptId as never, visibility });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update visibility");
    } finally {
      setUpdatingConceptId(null);
    }
  }

  async function onCreateSprayPlan(conceptId: string) {
    setCreatingSprayPlanId(conceptId);
    setErrorMessage(null);
    try {
      await createSprayPlan({ conceptId: conceptId as never });
      window.location.assign("/studio");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create spray plan");
    } finally {
      setCreatingSprayPlanId(null);
    }
  }

  function openPublishReview(input: {
    conceptId: string;
    conceptTitle: string;
    nextVisibility: PublishVisibility;
    currentVisibility: PublishVisibility;
    publicationReady: boolean;
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

  async function confirmStorageCleanup() {
    if (!cleanupIntent) return;
    const intent = cleanupIntent;
    setCleanupIntent(null);
    setCleaningAssetId(intent.mediaAssetId);
    setErrorMessage(null);
    try {
      const result = await cleanPrivateAsset({
        mediaAssetId: intent.mediaAssetId,
        mode: intent.mode,
      });
      if (result.failed > 0) {
        setErrorMessage(`${result.failed} storage object${result.failed === 1 ? "" : "s"} could not be deleted. Retry the cleanup.`);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Storage cleanup failed");
    } finally {
      setCleaningAssetId(null);
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

  useEffect(() => {
    if (!concepts || concepts.length === 0) {
      return;
    }
    if (!selectedConceptId || !concepts.some((concept) => concept._id === selectedConceptId)) {
      setSelectedConceptId(concepts[0]._id);
    }
  }, [concepts, selectedConceptId]);

  useEffect(() => {
    if (!savedConcepts || savedConcepts.length === 0) {
      return;
    }
    if (!selectedSavedId || !savedConcepts.some((concept) => concept._id === selectedSavedId)) {
      setSelectedSavedId(savedConcepts[0]._id);
    }
  }, [savedConcepts, selectedSavedId]);

  if (concepts === undefined || savedConcepts === undefined) {
    return (
      <div className="workbench-page">
        <Kicker>Hangar sync</Kicker>
        <h2>Indexing saved prototypes and reactor jobs</h2>
      </div>
    );
  }

  const statusCounts = concepts.reduce(
    (counts, concept) => {
      const status = getOperationalStatus(concept);
      counts.all += 1;
      if (status === "queued" || status === "rendering") {
        counts.rendering += 1;
      } else if (status === "ready") {
        counts.ready += 1;
      } else if (status === "failed") {
        counts.failed += 1;
      } else if (status === "draft") {
        counts.draft += 1;
      }
      return counts;
    },
    { all: 0, draft: 0, rendering: 0, ready: 0, failed: 0 }
  );
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

  const kitOptions = uniqueValues(concepts.map((concept) => concept.baseModel?.name));
  const styleOptions = uniqueValues(concepts.map((concept) => concept.stylePreset?.name));
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredConcepts = concepts
    .filter((concept) => {
      const status = getOperationalStatus(concept);
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "rendering"
          ? status === "queued" || status === "rendering"
          : status === statusFilter);
      const searchMatches =
        normalizedSearch.length === 0 ||
        [
          concept.title,
          concept.baseModel?.name,
          concept.stylePreset?.name,
          concept.materialPreset?.name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      return (
        statusMatches &&
        searchMatches &&
        (kitFilter === "all" || concept.baseModel?.name === kitFilter) &&
        (styleFilter === "all" || concept.stylePreset?.name === styleFilter)
      );
    })
    .sort((a, b) =>
      sortOrder === "oldest"
        ? a._creationTime - b._creationTime
        : sortOrder === "title"
          ? a.title.localeCompare(b.title)
          : b._creationTime - a._creationTime
    );

  const selectedConcept =
    filteredConcepts.find((concept) => concept._id === selectedConceptId) ??
    filteredConcepts.at(0) ??
    null;
  const selectedSaved =
    savedConcepts.find((concept) => concept._id === selectedSavedId) ??
    savedConcepts.at(0) ??
    null;

  return (
    <div className="library-operations">
      <header className="library-operations__head">
        <div>
          <Kicker>Technical archive / vol.02</Kicker>
          <h2>Prototype operations</h2>
          <FieldHint>Manage every prototype from initialization through render, inspection, and publish.</FieldHint>
        </div>
        <dl className="library-status-strip" aria-label="Prototype status summary">
          {(["all", "rendering", "ready", "failed"] as const).map((status) => (
            <div key={status}>
              <dt>{status === "all" ? "Prototypes" : status}</dt>
              <dd>{statusCounts[status]}</dd>
            </div>
          ))}
        </dl>
      </header>

      <StorageUsageStrip usage={storageUsage} />
      {storageUsage && Object.values(storageUsage).some((category) => typeof category === "object" && category !== null && "overQuota" in category && category.overQuota) ? (
        <WorkbenchNotice tone="danger">
          <p>Your library is over its storage allowance. Existing work remains available, while new generations and imports are paused until storage is cleared or the allowance increases.</p>
        </WorkbenchNotice>
      ) : null}

      <nav className="library-scope-tabs" aria-label="Library scope">
        <button className={scope === "prototypes" ? "is-active" : ""} onClick={() => setScope("prototypes")} type="button">
          My prototypes <span>{concepts.length}</span>
        </button>
        <button className={scope === "saved" ? "is-active" : ""} onClick={() => setScope("saved")} type="button">
          Saved builds <span>{savedConcepts.length}</span>
        </button>
      </nav>

      {scope === "prototypes" ? (
        <>
          <div className="library-status-tabs" aria-label="Prototype status">
            {(["all", "draft", "rendering", "ready", "failed"] as const).map((status) => (
              <button className={statusFilter === status ? "is-active" : ""} key={status} onClick={() => setStatusFilter(status)} type="button">
                {status} <span>{statusCounts[status]}</span>
              </button>
            ))}
          </div>

          <div className="library-toolbar">
            <label className="library-search">
              <span>Search</span>
              <input onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search prototypes..." type="search" value={searchQuery} />
            </label>
            <LibraryToolbarSelect
              label="Kit"
              onValueChange={setKitFilter}
              options={[{ label: "All variants", value: "all" }, ...kitOptions.map((kit) => ({ label: kit, value: kit }))]}
              value={kitFilter}
            />
            <LibraryToolbarSelect
              label="Style DNA"
              onValueChange={setStyleFilter}
              options={[{ label: "All systems", value: "all" }, ...styleOptions.map((style) => ({ label: style, value: style }))]}
              value={styleFilter}
            />
            <LibraryToolbarSelect
              label="Sequence"
              onValueChange={setSortOrder}
              options={[
                { label: "Newest first", value: "newest" },
                { label: "Oldest first", value: "oldest" },
                { label: "Title A–Z", value: "title" },
              ]}
              value={sortOrder}
            />
            <div className="library-view-switch" aria-label="View mode">
              <button aria-label="List view" className={view === "list" ? "is-active" : ""} onClick={() => setView("list")} type="button">List</button>
              <button aria-label="Grid view" className={view === "grid" ? "is-active" : ""} onClick={() => setView("grid")} type="button">Grid</button>
            </div>
          </div>

          <div className="library-operations__workspace">
            <section className="library-assets" aria-label="Prototypes">
              <div className="library-assets__label"><Kicker>Prototypes / {filteredConcepts.length}</Kicker><span>Lifecycle record</span></div>
              {concepts.length === 0 ? (
                <div className="library-compact-empty">
                  <Kicker>No prototypes</Kicker>
                  <p>Your initialized prototypes will appear here.</p>
                  <GhostButton compact href="/create">Initialize first prototype</GhostButton>
                </div>
              ) : filteredConcepts.length === 0 ? (
                <div className="library-compact-empty"><Kicker>No matches</Kicker><p>Adjust the status or discovery controls.</p></div>
              ) : view === "list" ? (
                <div className="library-asset-list">
                  <div className="library-asset-list__head" aria-hidden="true"><span>Preview / Prototype</span><span>Status</span><span>Visibility</span><span>Updated</span></div>
                  {filteredConcepts.map((concept) => {
                    const status = getOperationalStatus(concept);
                    return (
                      <button className={selectedConcept?._id === concept._id ? "library-asset-row is-active" : "library-asset-row"} key={concept._id} onClick={() => setSelectedConceptId(concept._id)} type="button">
                        <div className="library-asset-row__identity">
                          <div className="library-asset-row__thumb">{concept.previewAsset?.publicUrl ? <img alt="" src={concept.previewAsset.publicUrl} /> : <span>{formatRecordNumber(concepts, concept._id)}</span>}</div>
                          <div><span className="library-record-number">N°.{formatRecordNumber(concepts, concept._id)}</span><strong>{concept.title}</strong><small>{concept.baseModel?.name ?? "Unknown kit"} · {concept.stylePreset?.name ?? "Unassigned Style DNA"}</small></div>
                        </div>
                        <LifecycleLabel status={status} />
                        <span className="library-asset-row__meta">{concept.visibility}</span>
                        <time className="library-asset-row__meta" dateTime={new Date(concept._creationTime).toISOString()}>{formatRelativeTime(concept._creationTime)}</time>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="library-asset-grid">
                  {filteredConcepts.map((concept) => {
                    const status = getOperationalStatus(concept);
                    return (
                      <button className={selectedConcept?._id === concept._id ? "library-grid-card is-active" : "library-grid-card"} key={concept._id} onClick={() => setSelectedConceptId(concept._id)} type="button">
                        <div className="library-grid-card__image">{concept.previewAsset?.publicUrl ? <img alt="" src={concept.previewAsset.publicUrl} /> : <span>N°.{formatRecordNumber(concepts, concept._id)}</span>}</div>
                        <span className="library-record-number">N°.{formatRecordNumber(concepts, concept._id)}</span><strong>{concept.title}</strong><small>{concept.baseModel?.name ?? "Unknown kit"}</small><LifecycleLabel status={status} />
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className="library-inspector">
              {selectedConcept ? (
          <LibraryConceptFocus
            concept={selectedConcept}
            creatingSprayPlanId={creatingSprayPlanId}
            recordNumber={formatRecordNumber(concepts, selectedConcept._id)}
            errorMessage={errorMessage}
            feasibility={feasibilityByConceptId.get(selectedConcept._id)}
            onRequestRender={onRequestRender}
            onCreateSprayPlan={onCreateSprayPlan}
            onRetry={onRetry}
            openPublishReview={openPublishReview}
            paintPlan={paintPlanByConceptId.get(selectedConcept._id)}
            recommendation={recommendationsByConceptId.get(selectedConcept._id)}
            renderOutputs={renderHistoryByConceptId.get(selectedConcept._id) ?? []}
            renderingState={renderingState}
            rerunningJobId={rerunningJobId}
            shopping={shoppingByConceptId.get(selectedConcept._id)}
            updatingConceptId={updatingConceptId}
            cleaningAssetId={cleaningAssetId}
            onCleanupRequest={setCleanupIntent}
            originalDownloadAllowed={entitlements?.originalDownloadAllowed ?? false}
          />
              ) : (
                <div className="library-inspector__empty"><Kicker>No selection</Kicker><p>Select a prototype to inspect its configuration and render state.</p></div>
              )}
            </aside>
          </div>
        </>
      ) : (
        <div className="library-operations__workspace">
          <section className="library-assets" aria-label="Saved public builds">
            <div className="library-assets__label"><Kicker>Saved public builds / {savedConcepts.length}</Kicker><span>Reference archive</span></div>
            {savedConcepts.length === 0 ? (
              <div className="library-compact-empty"><Kicker>No saved builds</Kicker><p>Save a public work from Showcase to keep it here.</p><GhostButton compact href="/showcase">Browse showcase</GhostButton></div>
            ) : (
              <div className="library-asset-list">
                {savedConcepts.map((concept) => (
                  <button className={selectedSaved?._id === concept._id ? "library-asset-row is-active" : "library-asset-row"} key={concept._id} onClick={() => setSelectedSavedId(concept._id)} type="button">
                    <div className="library-asset-row__identity"><div className="library-asset-row__thumb">{concept.previewAsset?.publicUrl ? <img alt="" src={concept.previewAsset.publicUrl} /> : null}</div><div><span className="library-record-number">Saved work</span><strong>{concept.title}</strong><small>{concept.baseModel?.name ?? "Unknown kit"} · {concept.stylePreset?.name ?? "Unknown Style DNA"}</small></div></div>
                    <StatusPill label={concept.status} tone={mapStatusTone(concept.status)} />
                  </button>
                ))}
              </div>
            )}
          </section>
          <aside className="library-inspector">
            {selectedSaved ? (
              <div className="library-saved-inspector">
                <Kicker>Saved public build</Kicker>
                <div className="library-saved-inspector__preview">{selectedSaved.previewAsset?.publicUrl ? <img alt={selectedSaved.title} src={selectedSaved.previewAsset.publicUrl} /> : null}</div>
                <h2>{selectedSaved.title}</h2>
                <MetaRow label="Kit" value={selectedSaved.baseModel?.name ?? "Unknown"} />
                <MetaRow label="Style DNA" value={selectedSaved.stylePreset?.name ?? "Unknown"} />
                <GhostButton href={`/prototype/${selectedSaved._id}`}>Open prototype</GhostButton>
                <GhostButton href={`/create?remix=${selectedSaved._id}`}>Remix in create</GhostButton>
              </div>
            ) : <div className="library-inspector__empty"><Kicker>No selection</Kicker><p>Select a saved build to inspect it.</p></div>}
          </aside>
        </div>
      )}

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
                    label="Web renditions"
                    value={publishIntent.publicationReady ? "ready" : "missing"}
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

              {publishIntent.nextVisibility !== "private" && !publishIntent.publicationReady ? (
                <div className="rounded-[18px] border border-accent-red bg-accent-red/10 p-4 text-sm text-accent-red">
                  Master, preview, and thumbnail must finish processing before this concept can be shared.
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
                (publishIntent.nextVisibility !== "private" && !publishIntent.publicationReady)
              }
              onClick={() => {
                void confirmPublishReview();
              }}
              className="border border-line-primary bg-[var(--color-ink)] text-[var(--color-paper)] hover:opacity-90"
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

      <AlertDialog
        open={cleanupIntent !== null}
        onOpenChange={(open) => { if (!open) setCleanupIntent(null); }}
      >
        <AlertDialogContent className="border-line-secondary bg-panel text-ink-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>{cleanupDialogCopy(cleanupIntent).title}</AlertDialogTitle>
            <AlertDialogDescription>{cleanupDialogCopy(cleanupIntent).description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-line-secondary bg-transparent text-ink-primary hover:bg-hover-subtle hover:text-ink-primary">Cancel</AlertDialogCancel>
            <AlertDialogAction className="border border-accent-red bg-accent-red text-white hover:opacity-90" onClick={() => { void confirmStorageCleanup(); }}>
              {cleanupDialogCopy(cleanupIntent).confirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StorageUsageStrip({ usage }: { usage: FunctionReturnType<typeof api.storageAccounting.viewerUsage> | undefined }) {
  if (usage === undefined) {
    return <div className="library-storage-strip is-loading"><span>Calculating storage usage</span></div>;
  }
  if (usage === null) return null;
  const categories = [
    { label: "Library", value: usage.optimized },
    { label: "Temporary Original", value: usage.temporaryOriginal },
    { label: "Pinned Original", value: usage.pinnedOriginal },
  ];
  return (
    <section className="library-storage-strip" aria-label="Storage usage">
      <div className="library-storage-strip__title"><span>Storage</span><small>Reserved space is included</small></div>
      {categories.map(({ label, value }) => {
        const consumed = value.usedBytes + value.reservedBytes;
        const percentage = value.quotaBytes > 0 ? Math.min(100, consumed / value.quotaBytes * 100) : consumed > 0 ? 100 : 0;
        return (
          <div className={value.overQuota ? "library-storage-meter is-over" : "library-storage-meter"} key={label}>
            <span><strong>{label}</strong><small>{formatStorageBytes(consumed)} / {formatStorageBytes(value.quotaBytes)}</small></span>
            <i aria-hidden="true"><b style={{ width: `${percentage}%` }} /></i>
          </div>
        );
      })}
    </section>
  );
}

function LibraryConceptFocus({
  concept,
  creatingSprayPlanId,
  recordNumber,
  errorMessage,
  feasibility,
  onRequestRender,
  onCreateSprayPlan,
  onRetry,
  openPublishReview,
  paintPlan,
  recommendation,
  renderOutputs,
  renderingState,
  rerunningJobId,
  shopping,
  updatingConceptId,
  cleaningAssetId,
  onCleanupRequest,
  originalDownloadAllowed,
}: {
  concept: {
    _id: string;
    title: string;
    status: string;
    visibility: PublishVisibility;
    weatheringLevel: string;
    notes?: string | null;
    moodTags: string[];
    remixCount: number;
    publicationReady: boolean;
    assetStorage?: {
      mediaAssetId: Id<"mediaAssets">;
      versionCount: number;
      oldVersionCount: number;
      oldVersionBytes: number;
      currentOriginal?: {
        storageObjectId: Id<"storageObjects">;
        byteSize: number;
        contentType?: string;
        retainUntil?: number;
        retentionPolicy?: string;
        status: string;
      } | null;
    } | null;
    previewAsset?: {
      publicUrl?: string | null;
      key?: string | null;
      contentType?: string | null;
      storageObjectId?: Id<"storageObjects">;
    } | null;
    generationJob?: {
      _id: string;
      status: string;
      requestedCredits?: number;
      provider?: string | null;
      kind?: string;
      renderMode?: string;
      errorMessage?: string | null;
    } | null;
    baseModel?: { name?: string } | null;
    stylePreset?: { name?: string } | null;
    materialPreset?: { name?: string; finishType?: string } | null;
    sourceConcept?: {
      _id: string;
      title: string;
      visibility: string;
      baseModel?: { name?: string } | null;
      stylePreset?: { name?: string } | null;
      owner?: { handle?: string; fullName?: string } | null;
    } | null;
  };
  creatingSprayPlanId: string | null;
  recordNumber: string;
  errorMessage: string | null;
  feasibility?: {
    summary: string;
    beginnerDifficulty: string;
    maskingComplexity: number;
    estimatedLayerCount: number;
    paintCostBand: string;
  };
  onRequestRender: (
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
  ) => Promise<void>;
  onCreateSprayPlan: (conceptId: string) => Promise<void>;
  onRetry: (jobId: string) => Promise<void>;
  openPublishReview: (input: {
    conceptId: string;
    conceptTitle: string;
    nextVisibility: PublishVisibility;
    currentVisibility: PublishVisibility;
    publicationReady: boolean;
    currentStatus: string;
  }) => void;
  paintPlan?: {
    entries: Array<{
      roleSlug: string;
      roleName: string;
      suggestedPaint?: { brand: string; code: string; colorName: string } | null;
    }>;
    sprayNotes: string[];
  };
  recommendation?: {
    feasibilityBias: string;
    alternativeStyles: unknown[];
    easierMaterials: unknown[];
  };
  renderOutputs: Array<{
    _id: string;
    label: string;
    renderMode?: string;
    asset?: { publicUrl?: string | null } | null;
  }>;
  renderingState: {
    conceptId: string;
    mode: string;
    stage?: BuildStage;
  } | null;
  rerunningJobId: string | null;
  shopping?: {
    conceptTitle: string;
    baseModelName: string;
    stylePresetName: string;
    materialPresetName: string;
    primaryItems: unknown[];
    alternateItems: unknown[];
    procurementConfidence: string;
    purchaseSummary: { affiliateReadyCount: number };
    featuredPurchasePath?: { url: string; type: string } | null;
    bundles: {
      core: Array<{ brand: string; code: string; colorName: string }>;
      support: Array<{ brand: string; code: string; colorName: string }>;
      backup: Array<{ brand: string; code: string; colorName: string }>;
    };
    notes: string[];
  };
  updatingConceptId: string | null;
  cleaningAssetId: string | null;
  onCleanupRequest: (intent: CleanupIntent) => void;
  originalDownloadAllowed: boolean;
}) {
  const createPrivateDownloadUrl = useAction(api.assetNode.createPrivateDownloadUrl);
  const keepOriginal = useAction(api.originalPinNode.keepOriginal);
  const [downloadingOriginal, setDownloadingOriginal] = useState(false);
  const [pinningOriginal, setPinningOriginal] = useState(false);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const privatePreviewUrl = usePrivateAssetUrl(
    concept.previewAsset?.publicUrl ? null : concept.previewAsset?.storageObjectId
  );
  const previewUrl = concept.previewAsset?.publicUrl ?? privatePreviewUrl;
  const operationalStatus = getOperationalStatus(concept);
  const busy =
    concept.status !== "generated" ||
    concept.generationJob?.status === "queued" ||
    concept.generationJob?.status === "running" ||
    renderingState?.conceptId === concept._id;
  const assetStorage = concept.assetStorage;
  const original = assetStorage?.currentOriginal;
  const pinQuote = useQuery(
    api.originalPin.quote,
    original ? { storageObjectId: original.storageObjectId } : "skip"
  );
  const storageBusy = cleaningAssetId === assetStorage?.mediaAssetId;

  async function downloadOriginal() {
    if (!original || original.status !== "ready") return;
    setDownloadingOriginal(true);
    setStorageError(null);
    try {
      const extension = original.contentType === "image/png" ? "png" : original.contentType === "image/jpeg" ? "jpg" : "webp";
      const result = await createPrivateDownloadUrl({
        storageObjectId: original.storageObjectId,
        downloadFileName: `${concept.title}-original.${extension}`,
      });
      const anchor = document.createElement("a");
      anchor.href = result.url;
      anchor.download = "";
      anchor.rel = "noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Original download failed");
    } finally {
      setDownloadingOriginal(false);
    }
  }

  function requestCleanup(mode: CleanupMode) {
    if (!assetStorage) return;
    onCleanupRequest({
      mediaAssetId: assetStorage.mediaAssetId,
      conceptTitle: concept.title,
      mode,
      oldVersionCount: assetStorage.oldVersionCount,
    });
  }

  async function confirmKeepOriginal() {
    if (!original || !pinQuote?.eligible || pinQuote.creditCost === null) return;
    setPinDialogOpen(false);
    setPinningOriginal(true);
    setStorageError(null);
    try {
      const result = await keepOriginal({
        storageObjectId: original.storageObjectId,
        expectedCreditCost: pinQuote.creditCost,
      });
      if (!result.sourceCleaned) {
        setStorageError("Original was kept, but the temporary source copy still needs storage cleanup.");
      }
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Keep Original failed and the credits were refunded");
    } finally {
      setPinningOriginal(false);
    }
  }

  function renderLabel(
    mode: string,
    idle: string,
    busyLabel: string,
    stage?: BuildStage
  ) {
    if (
      renderingState?.conceptId === concept._id &&
      renderingState.mode === mode &&
      (!stage || renderingState.stage === stage)
    ) {
      return busyLabel;
    }
    return idle;
  }

  return (
    <FocusPanel>
      <div className="library-inspector__heading">
        <Kicker>Inspector</Kicker>
        <span>N°.{recordNumber} / Prototype record</span>
      </div>
      <div className="workbench-focus__preview">
        {previewUrl ? (
          <img src={previewUrl} alt={concept.title} />
        ) : (
          <div className="workbench-focus__preview-copy">
            <strong>{concept.title}</strong>
            <span>No public preview yet</span>
          </div>
        )}
      </div>
      <div className="workbench-focus__body library-inspector__body">
        <span className="library-record-number">N°.{recordNumber}</span>
        <h2>{concept.title}</h2>
        <div className="library-inspector__state"><LifecycleLabel status={operationalStatus} /><span>{concept.visibility}</span></div>
        <div className="library-inspector__specimen">
          <MetaRow label="Kit" value={concept.baseModel?.name ?? "Unknown base model"} />
          <MetaRow label="Style DNA" value={concept.stylePreset?.name ?? "Unknown Style DNA"} />
          <MetaRow label="Material" value={concept.materialPreset?.name ?? "Unknown material"} />
          <MetaRow label="Weathering" value={concept.weatheringLevel} />
          {concept.moodTags.length > 0 ? <MetaRow label="Mood" value={concept.moodTags.map(formatMoodTagLabel).join(" / ")} /> : null}
        </div>
        <MetaRow
          label="Credits"
          value={
            concept.generationJob
              ? `${concept.generationJob.requestedCredits} credits`
              : "N/A"
          }
        />
        <MetaRow label="Provider" value={concept.generationJob?.provider ?? "Not assigned"} />
        <MetaRow
          label="Job kind"
          value={formatJobKind(concept.generationJob?.kind, concept.generationJob?.renderMode)}
        />
        {concept.notes?.trim() ? <FieldHint>{concept.notes}</FieldHint> : null}
        {concept.generationJob?.errorMessage ? (
          <WorkbenchNotice tone="danger">
            <p>{concept.generationJob.errorMessage}</p>
          </WorkbenchNotice>
        ) : null}
        {errorMessage ? (
          <WorkbenchNotice tone="danger">
            <p>{errorMessage}</p>
          </WorkbenchNotice>
        ) : null}
        {storageError ? <WorkbenchNotice tone="danger"><p>{storageError}</p></WorkbenchNotice> : null}

        {assetStorage ? (
          <section className="library-asset-storage" aria-label="Asset storage">
            <div className="library-asset-storage__head"><Kicker>Asset storage</Kicker><span>{assetStorage.versionCount} version{assetStorage.versionCount === 1 ? "" : "s"}</span></div>
            <div className="library-original-row">
              <div>
                <strong>Original</strong>
                <span>{original ? `${formatStorageBytes(original.byteSize)} · ${formatOriginalRetention(original)}` : "Removed · Master preserved"}</span>
              </div>
              {original ? (
                <div className="library-original-row__actions">
                  <button aria-label="Download Original" disabled={!originalDownloadAllowed || downloadingOriginal || original.status !== "ready"} onClick={() => { void downloadOriginal(); }} title={originalDownloadAllowed ? "Download Original" : "Original download is not included in the current entitlement"} type="button"><DownloadIcon /></button>
                  <button aria-label="Delete Original" disabled={storageBusy || original.status === "deleting"} onClick={() => requestCleanup("delete-original")} title="Delete Original" type="button"><TrashIcon /></button>
                </div>
              ) : null}
            </div>
            <div className="library-version-row">
              <div><strong>Old versions</strong><span>{assetStorage.oldVersionCount > 0 ? `${assetStorage.oldVersionCount} · ${formatStorageBytes(assetStorage.oldVersionBytes)}` : "No removable versions"}</span></div>
              <button disabled={storageBusy || assetStorage.oldVersionCount === 0} onClick={() => requestCleanup("clean-old-versions")} type="button">Clean old versions</button>
            </div>
            {original && original.retentionPolicy !== "permanent-original" ? (
              <div className="library-keep-original">
                <div>
                  <strong>Keep Original</strong>
                  <span>{pinQuote === undefined ? "Calculating price" : pinQuote?.eligible ? `Move to Pinned Original storage · ${pinQuote.creditCost} credits` : pinQuote?.reason ?? "Unavailable"}</span>
                </div>
                <button disabled={pinningOriginal || !pinQuote?.eligible} onClick={() => setPinDialogOpen(true)} type="button"><LockClosedIcon />{pinningOriginal ? "Keeping" : pinQuote?.creditCost ? `${pinQuote.creditCost} credits` : "Unavailable"}</button>
              </div>
            ) : null}
            <button className="library-space-saver" disabled={storageBusy || (!original && assetStorage.oldVersionCount === 0)} onClick={() => requestCleanup("space-saver")} type="button"><LightningBoltIcon />{storageBusy ? "Cleaning storage" : "Space Saver"}</button>
          </section>
        ) : null}

        <AlertDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
          <AlertDialogContent className="border-line-secondary bg-panel text-ink-primary">
            <AlertDialogHeader>
              <AlertDialogTitle>Keep this Original?</AlertDialogTitle>
              <AlertDialogDescription>
                {pinQuote?.creditCost ?? 0} credits will be charged and {formatStorageBytes(original?.byteSize ?? 0)} will move to Pinned Original storage. The file remains stored while pinned quota is available.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-line-secondary bg-transparent text-ink-primary hover:bg-hover-subtle hover:text-ink-primary">Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={!pinQuote?.eligible || pinningOriginal} className="border border-line-primary bg-[var(--color-ink)] text-[var(--color-paper)] hover:opacity-90" onClick={() => { void confirmKeepOriginal(); }}>
                Keep for {pinQuote?.creditCost ?? 0} credits
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="library-inspector__primary-actions">
          <GhostButton href={`/prototype/${concept._id}`}>Open prototype</GhostButton>
          {(concept.status === "generated" || concept.status === "archived") ? (
            <GhostButton disabled={creatingSprayPlanId === concept._id} onClick={() => void onCreateSprayPlan(concept._id)}>
              {creatingSprayPlanId === concept._id ? "Building spray plan" : "Generate Spray Plan →"}
            </GhostButton>
          ) : null}
          {(concept.status === "generated" || concept.status === "archived") ? <GhostButton href={`/create?remix=${concept._id}`}>Remix</GhostButton> : null}
          {concept.generationJob ? (
            <GhostButton
              href={`/feedback?conceptId=${encodeURIComponent(concept._id)}&generationJobId=${encodeURIComponent(concept.generationJob._id)}&type=generation-quality&source=library`}
            >
              Report issue
            </GhostButton>
          ) : null}
          {concept.generationJob?.status === "failed" ? (
            <GhostButton disabled={rerunningJobId === concept.generationJob._id} onClick={() => void onRetry(concept.generationJob!._id)}>
              {rerunningJobId === concept.generationJob._id ? "Re-dispatching" : "Retry generation"}
            </GhostButton>
          ) : null}
        </div>

        <details className="library-inspector__technical">
          <summary>Technical tools + render outputs</summary>
          <div className="library-inspector__technical-body">

        <div className="workbench-block">
          <Kicker>Publish</Kicker>
          <div className="choice-chip-row">
            {(["private", "unlisted", "public"] as const).map((option) => (
              <ChoiceChip
                key={option}
                active={concept.visibility === option}
                disabled={
                  updatingConceptId === concept._id ||
                  (option !== "private" &&
                    concept.status !== "generated" &&
                    concept.status !== "archived")
                }
                onClick={() => {
                  openPublishReview({
                    conceptId: concept._id,
                    conceptTitle: concept.title,
                    nextVisibility: option,
                    currentVisibility: concept.visibility,
                    publicationReady: concept.publicationReady,
                    currentStatus: concept.status,
                  });
                }}
              >
                {option}
              </ChoiceChip>
            ))}
          </div>
        </div>

        <div className="workbench-block">
          <Kicker>Actions</Kicker>
          {concept.visibility !== "private" ? (
            <GhostButton href={`/prototype/${concept._id}`}>Open share surface</GhostButton>
          ) : null}
          {(concept.status === "generated" || concept.status === "archived") &&
          concept.visibility !== "private" ? (
            <GhostButton href={`/create?remix=${concept._id}`}>Remix in create</GhostButton>
          ) : null}
          <GhostButton
            disabled={busy}
            onClick={() => {
              void onRequestRender(concept._id, "hd-render");
            }}
          >
            {renderLabel("hd-render", "Generate HD render", "Queueing HD render")}
          </GhostButton>
          <GhostButton
            disabled={busy}
            onClick={() => {
              void onRequestRender(concept._id, "multi-angle-preview");
            }}
          >
            {renderLabel(
              "multi-angle-preview",
              "Generate contact sheet",
              "Queueing contact sheet"
            )}
          </GhostButton>
          <GhostButton
            disabled={busy}
            onClick={() => {
              void onRequestRender(concept._id, "high-fidelity-render");
            }}
          >
            {renderLabel(
              "high-fidelity-render",
              "Generate high-fidelity render",
              "Queueing high-fidelity render"
            )}
          </GhostButton>
          <GhostButton
            disabled={busy}
            onClick={() => {
              void onRequestRender(concept._id, "material-finish-comparison");
            }}
          >
            {renderLabel(
              "material-finish-comparison",
              "Generate finish comparison",
              "Queueing finish comparison"
            )}
          </GhostButton>
          <GhostButton
            disabled={busy}
            onClick={() => {
              void onRequestRender(concept._id, "weathering-simulation");
            }}
          >
            {renderLabel(
              "weathering-simulation",
              "Generate weathering simulation",
              "Queueing weathering simulation"
            )}
          </GhostButton>
          <GhostButton
            disabled={busy}
            onClick={() => {
              void onRequestRender(concept._id, "weathering-split-preview");
            }}
          >
            {renderLabel(
              "weathering-split-preview",
              "Generate weathering split",
              "Queueing weathering split"
            )}
          </GhostButton>
          {(["primer-pass", "decal-pass", "weathering-pass"] as const).map((stage) => (
            <GhostButton
              key={stage}
              disabled={busy}
              onClick={() => {
                void onRequestRender(concept._id, "build-stage-visualization", stage);
              }}
            >
              {renderLabel(
                "build-stage-visualization",
                `Generate ${formatBuildStageLabel(stage)}`,
                `Queueing ${formatBuildStageLabel(stage)}`,
                stage
              )}
            </GhostButton>
          ))}
          <GhostButton
            disabled={
              concept.generationJob == null ||
              concept.generationJob.status !== "failed" ||
              rerunningJobId === concept.generationJob._id
            }
            onClick={() => {
              if (concept.generationJob) {
                void onRetry(concept.generationJob._id);
              }
            }}
          >
            {rerunningJobId === concept.generationJob?._id
              ? "Re-dispatching"
              : "Retry failed job"}
          </GhostButton>
        </div>

        {paintPlan ? (
          <div className="workbench-block">
            <Kicker>Paint mapping</Kicker>
            {paintPlan.entries.slice(0, 4).map((entry) => (
              <MetaRow
                key={entry.roleSlug}
                label={entry.roleName}
                value={entry.suggestedPaint?.code ?? "N/A"}
              />
            ))}
          </div>
        ) : null}
        {feasibility ? (
          <div className="workbench-block">
            <Kicker>Spray feasibility</Kicker>
            <FieldHint>{feasibility.summary}</FieldHint>
            <MetaRow label="Difficulty" value={feasibility.beginnerDifficulty} />
            <MetaRow label="Masking" value={`${feasibility.maskingComplexity}/100`} />
          </div>
        ) : null}
        {shopping ? (
          <div className="workbench-block">
            <Kicker>Shopping</Kicker>
            <MetaRow label="Primary items" value={`${shopping.primaryItems.length}`} />
            <MetaRow label="Confidence" value={shopping.procurementConfidence} />
            {shopping.featuredPurchasePath ? (
              <GhostButton href={shopping.featuredPurchasePath.url}>
                {shopping.featuredPurchasePath.type === "affiliate"
                  ? "Open best purchase path"
                  : "Search best purchase path"}
              </GhostButton>
            ) : null}
            <ShoppingListActions
              className="mt-2"
              data={{
                conceptTitle: shopping.conceptTitle,
                baseModelName: shopping.baseModelName,
                stylePresetName: shopping.stylePresetName,
                materialPresetName: shopping.materialPresetName,
                bundles: shopping.bundles,
                notes: shopping.notes,
              }}
            />
          </div>
        ) : null}
        {recommendation ? (
          <div className="workbench-block">
            <Kicker>Recommendation bias</Kicker>
            <FieldHint>
              {recommendation.feasibilityBias === "practical"
                ? "Current guidance leans toward easier execution and safer procurement."
                : "Current guidance balances visual ambition and practical execution."}
            </FieldHint>
            <GhostButton href={`/create?remix=${concept._id}`}>Open in create</GhostButton>
          </div>
        ) : null}
        {renderOutputs.length > 0 ? (
          <div className="workbench-block">
            <Kicker>Render history</Kicker>
            {renderOutputs.slice(0, 4).map((output) => (
              <MetaRow
                key={output._id}
                label={output.label}
                value={
                  output.asset?.publicUrl ? (
                    <a href={output.asset.publicUrl} rel="noreferrer" target="_blank">
                      Open asset
                    </a>
                  ) : (
                    "URL pending"
                  )
                }
              />
            ))}
          </div>
        ) : null}
        {concept.sourceConcept ? (
          <div className="workbench-block">
            <Kicker>Source lineage</Kicker>
            <FieldHint>{concept.sourceConcept.title}</FieldHint>
            {concept.sourceConcept.visibility !== "private" ? (
              <GhostButton href={`/prototype/${concept.sourceConcept._id}`}>
                Open source surface
              </GhostButton>
            ) : null}
          </div>
        ) : null}
          </div>
        </details>
      </div>
    </FocusPanel>
  );
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

function LibraryToolbarSelect({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string;
  onValueChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <Select onValueChange={onValueChange} value={value}>
      <SelectTrigger
        aria-label={label}
        className="library-toolbar-select__trigger"
      >
        <span className="library-toolbar-select__value">
          <span>{label}</span>
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent
        align="start"
        className="library-toolbar-select__content"
        position="popper"
        sideOffset={-1}
      >
        <SelectGroup>
          <SelectLabel className="library-toolbar-select__label">
            {label} index
          </SelectLabel>
          {options.map((option, index) => (
            <SelectItem
              className="library-toolbar-select__item"
              key={option.value}
              value={option.value}
            >
              <span className="library-toolbar-select__option">
                <span>{String(index + 1).padStart(2, "0")}</span>
                {option.label}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function LifecycleLabel({ status }: { status: OperationalStatus }) {
  return (
    <span className={`library-lifecycle is-${status}`}>
      <span aria-hidden="true" />
      {status}
    </span>
  );
}

function getOperationalStatus(concept: {
  status: string;
  previewAsset?: { publicUrl?: string | null } | null;
  generationJob?: { status: string } | null;
}): OperationalStatus {
  if (concept.generationJob?.status === "failed") {
    return "failed";
  }
  if (concept.generationJob?.status === "running") {
    return "rendering";
  }
  if (concept.generationJob?.status === "queued") {
    return "queued";
  }
  if (concept.status === "archived") {
    return "archived";
  }
  if (concept.status === "generated" && concept.previewAsset?.publicUrl) {
    return "ready";
  }
  return "draft";
}

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();
}

function formatRecordNumber<T extends { _id: string; recordNumber?: number }>(
  concepts: T[],
  conceptId: string
) {
  const concept = concepts.find((item) => item._id === conceptId);
  if (concept?.recordNumber) {
    return String(concept.recordNumber).padStart(3, "0");
  }
  const index = concepts.findIndex((concept) => concept._id === conceptId);
  const number = index < 0 ? concepts.length : concepts.length - index;
  return String(number).padStart(3, "0");
}

function formatRelativeTime(timestamp: number) {
  const delta = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(delta / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(
    new Date(timestamp)
  );
}

function formatStorageBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${Math.round(bytes / 1024 ** 3 * 100) / 100} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2 * 10) / 10} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatOriginalRetention(original: {
  retainUntil?: number;
  retentionPolicy?: string;
  status: string;
}) {
  if (original.status === "deleting") return "Deleting";
  if (original.status === "failed") return "Unavailable";
  if (original.retentionPolicy === "permanent-original" || original.retainUntil === undefined) {
    return "Stored while quota is available";
  }
  const remainingMs = original.retainUntil - Date.now();
  if (remainingMs <= 0) return "Scheduled for deletion";
  const remainingHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  if (remainingHours < 48) return `Expires in ${remainingHours}h`;
  return `Expires in ${Math.ceil(remainingHours / 24)} days`;
}

function cleanupDialogCopy(intent: CleanupIntent | null) {
  if (!intent) return { title: "Review storage cleanup", description: "", confirm: "Continue" };
  if (intent.mode === "delete-original") {
    return {
      title: `Delete the Original for ${intent.conceptTitle}?`,
      description: "The optimized Master, Preview, and Thumbnail remain available. The model output cannot be restored after deletion.",
      confirm: "Delete Original",
    };
  }
  if (intent.mode === "clean-old-versions") {
    return {
      title: `Clean ${intent.oldVersionCount} old version${intent.oldVersionCount === 1 ? "" : "s"}?`,
      description: "Only superseded versions are removed. The current version and its web assets remain available.",
      confirm: "Clean old versions",
    };
  }
  return {
    title: `Apply Space Saver to ${intent.conceptTitle}?`,
    description: "This removes the current Original and all superseded versions. The current optimized Master, Preview, and Thumbnail remain available.",
    confirm: "Apply Space Saver",
  };
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
