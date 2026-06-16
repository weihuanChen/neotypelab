import { SignInButton } from "@clerk/tanstack-react-start";
import {
  AuthLoading,
  Authenticated,
  Unauthenticated,
  useAction,
  useMutation,
  useQuery,
} from "convex/react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConceptEngagementBar } from "@/src/components/showcase/EngagementBars";
import {
  formatMoodTagLabel,
  parseOptionalSearchValue,
} from "@/src/components/showcase/showcaseUtils";
import type {
  ConceptVisibility,
  LibraryConcept,
  SavedPublicConcept,
  ViewerJob,
} from "./types";

type LibrarySearch = {
  filter?: "all" | "draft" | "generated" | "archived" | "saved" | "jobs";
};

export function LibraryWorkbench({ search }: { search: LibrarySearch }) {
  return (
    <main className="library-page">
      <AuthLoading>
        <LibraryShell>
          <LibraryStatePanel
            copy="Clerk is present and Convex is negotiating the authenticated viewer token."
            kicker="Hangar sync"
            title="Opening operator library"
          />
        </LibraryShell>
      </AuthLoading>

      <Unauthenticated>
        <LibraryShell>
          <section className="library-empty">
            <p className="showcase-kicker is-orange">Signed out</p>
            <h1>Sign in to open your prototype library.</h1>
            <p>
              The library is backed by your private concepts, saved public builds,
              and generation job ledger.
            </p>
            <SignInButton mode="modal">
              <button className="showcase-button" type="button">
                Sign in
              </button>
            </SignInButton>
          </section>
        </LibraryShell>
      </Unauthenticated>

      <Authenticated>
        <AuthenticatedLibrary search={search} />
      </Authenticated>
    </main>
  );
}

function AuthenticatedLibrary({ search }: { search: LibrarySearch }) {
  const viewer = useQuery(api.users.viewer);
  const concepts = useQuery(api.concepts.listLibrary);
  const savedConcepts = useQuery(api.concepts.listSavedPublicConcepts);
  const jobs = useQuery(api.generation.listViewerJobs);
  const updateConcept = useMutation(api.concepts.update);
  const rerunJob = useAction(api.generationNode.rerunJob);
  const stabilizeConceptPreviewAsset = useAction(
    api.generationNode.stabilizeConceptPreviewAsset
  );
  const [busyConceptId, setBusyConceptId] = useState<string | null>(null);
  const [busyJobId, setBusyJobId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeFilter = parseLibraryFilter(search.filter);

  const conceptStats = useMemo(() => {
    const rows = concepts ?? [];
    return {
      all: rows.length,
      archived: rows.filter((concept) => concept.status === "archived").length,
      draft: rows.filter((concept) => concept.status === "draft").length,
      generated: rows.filter((concept) => concept.status === "generated").length,
      public: rows.filter((concept) => concept.visibility === "public").length,
      unlisted: rows.filter((concept) => concept.visibility === "unlisted").length,
    };
  }, [concepts]);

  async function onVisibilityChange(
    concept: LibraryConcept,
    visibility: ConceptVisibility
  ) {
    if (concept.visibility === visibility) {
      return;
    }

    setBusyConceptId(concept._id);
    setNotice(null);
    setErrorMessage(null);

    try {
      await updateConcept({
        conceptId: concept._id as Id<"concepts">,
        visibility,
      });
      setNotice(`${concept.title} visibility set to ${visibility}.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update visibility."
      );
    } finally {
      setBusyConceptId(null);
    }
  }

  async function onStabilizePreviewAsset(concept: LibraryConcept) {
    setBusyConceptId(concept._id);
    setNotice(null);
    setErrorMessage(null);

    try {
      const result = await stabilizeConceptPreviewAsset({
        conceptId: concept._id as Id<"concepts">,
      });
      setNotice(
        result.status === "already-configured"
          ? "Preview URL is already configured."
          : "Preview URL stabilized for publishing."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to stabilize public preview URL."
      );
    } finally {
      setBusyConceptId(null);
    }
  }

  async function onRetryJob(job: ViewerJob) {
    setBusyJobId(job._id);
    setNotice(null);
    setErrorMessage(null);

    try {
      await rerunJob({ generationJobId: job._id as Id<"generationJobs"> });
      setNotice("Generation job queued for retry.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to retry generation job."
      );
    } finally {
      setBusyJobId(null);
    }
  }

  if (viewer === undefined || concepts === undefined || savedConcepts === undefined || jobs === undefined) {
    return (
      <LibraryShell>
        <LibraryStatePanel
          copy="Fetching private concepts, saved public builds, and generation jobs through the authenticated Convex client."
          kicker="Hangar sync"
          title="Indexing library records"
        />
      </LibraryShell>
    );
  }

  if (viewer === null) {
    return (
      <LibraryShell>
        <LibraryStatePanel
          copy="The authenticated session is active and the terminal is creating the Convex viewer record."
          kicker="Viewer provisioning"
          title="Preparing your operator account"
        />
      </LibraryShell>
    );
  }

  const filteredConcepts =
    activeFilter === "all"
      ? concepts
      : activeFilter === "saved" || activeFilter === "jobs"
        ? concepts
        : concepts.filter((concept) => concept.status === activeFilter);
  const queuedJobs = jobs.filter(
    (job) => job.status === "queued" || job.status === "running"
  );
  const failedJobs = jobs.filter((job) => job.status === "failed");
  const succeededJobs = jobs.filter((job) => job.status === "succeeded");

  return (
    <LibraryShell>
      <section className="library-hero">
        <div>
          <p className="showcase-kicker is-teal">Saved Hangar</p>
          <h1>Prototype library and generation ledger</h1>
          <p>
            Private drafts, generated concepts, saved public builds, and render jobs
            stay organized here.
          </p>
        </div>
        <div className="library-hero__stats">
          <Metric label="Concepts" value={`${conceptStats.all}`} />
          <Metric label="Public" value={`${conceptStats.public}`} tone="teal" />
          <Metric label="Saved" value={`${savedConcepts.length}`} tone="blue" />
          <Metric label="Jobs" value={`${jobs.length}`} tone="orange" />
        </div>
      </section>

      {notice ? <div className="library-notice">{notice}</div> : null}
      {errorMessage ? <div className="library-error">{errorMessage}</div> : null}

      <section className="library-filter-bar">
        <FilterLink active={activeFilter === "all"} href="/t/library" label="All" />
        <FilterLink
          active={activeFilter === "generated"}
          href="/t/library?filter=generated"
          label={`Generated ${conceptStats.generated}`}
        />
        <FilterLink
          active={activeFilter === "draft"}
          href="/t/library?filter=draft"
          label={`Draft ${conceptStats.draft}`}
        />
        <FilterLink
          active={activeFilter === "archived"}
          href="/t/library?filter=archived"
          label={`Archived ${conceptStats.archived}`}
        />
        <FilterLink
          active={activeFilter === "saved"}
          href="/t/library?filter=saved"
          label={`Saved ${savedConcepts.length}`}
        />
        <FilterLink
          active={activeFilter === "jobs"}
          href="/t/library?filter=jobs"
          label={`Jobs ${jobs.length}`}
        />
      </section>

      <div className="library-content-grid">
        <div className="library-main-column">
          {activeFilter === "saved" ? (
            <SavedConceptsSection savedConcepts={savedConcepts} />
          ) : activeFilter === "jobs" ? (
            <JobsSection
              busyJobId={busyJobId}
              jobs={jobs}
              onRetryJob={onRetryJob}
            />
          ) : (
            <OwnedConceptsSection
              busyConceptId={busyConceptId}
              concepts={filteredConcepts}
              onStabilizePreviewAsset={onStabilizePreviewAsset}
              onVisibilityChange={onVisibilityChange}
            />
          )}
        </div>

        <aside className="library-side-column">
          <ViewerPanel viewer={viewer} />
          <JobSummaryPanel
            failedJobs={failedJobs}
            queuedJobs={queuedJobs}
            succeededJobs={succeededJobs}
          />
          <SavedConceptsMiniPanel savedConcepts={savedConcepts} />
        </aside>
      </div>
    </LibraryShell>
  );
}

function LibraryShell({ children }: { children: ReactNode }) {
  return (
    <div className="library-shell">
      <section className="showcase-topbar">
        <div>
          <p className="showcase-kicker">NeotypeLab Terminal</p>
          <h1>Library</h1>
        </div>
        <div className="showcase-topbar__actions">
          <a className="showcase-button is-ghost" href="/t">
            Auth
          </a>
          <a className="showcase-button is-ghost" href="/t/feedback">
            Feedback
          </a>
          <a className="showcase-button" href="/showcase">
            Showcase
          </a>
        </div>
      </section>
      {children}
    </div>
  );
}

function OwnedConceptsSection({
  busyConceptId,
  concepts,
  onStabilizePreviewAsset,
  onVisibilityChange,
}: {
  busyConceptId: string | null;
  concepts: LibraryConcept[];
  onStabilizePreviewAsset: (concept: LibraryConcept) => Promise<void>;
  onVisibilityChange: (
    concept: LibraryConcept,
    visibility: ConceptVisibility
  ) => Promise<void>;
}) {
  if (concepts.length === 0) {
    return (
      <LibraryStatePanel
        copy="Generated and draft concepts will appear here after the create flow writes them to Convex."
        kicker="No concepts"
        title="Your private hangar is empty"
      />
    );
  }

  return (
    <section className="library-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker is-teal">Owned Concepts</p>
          <h2>{concepts.length} operator concepts</h2>
        </div>
        <p>Share state updates immediately for each concept.</p>
      </div>
      <div className="library-card-grid">
        {concepts.map((concept) => (
          <OwnedConceptCard
            busy={busyConceptId === concept._id}
            concept={concept}
            key={concept._id}
            onStabilizePreviewAsset={onStabilizePreviewAsset}
            onVisibilityChange={onVisibilityChange}
          />
        ))}
      </div>
    </section>
  );
}

function OwnedConceptCard({
  busy,
  concept,
  onStabilizePreviewAsset,
  onVisibilityChange,
}: {
  busy: boolean;
  concept: LibraryConcept;
  onStabilizePreviewAsset: (concept: LibraryConcept) => Promise<void>;
  onVisibilityChange: (
    concept: LibraryConcept,
    visibility: ConceptVisibility
  ) => Promise<void>;
}) {
  const hasPublicPreview = Boolean(concept.previewAsset?.publicUrl);
  const canShare =
    (concept.status === "generated" || concept.status === "archived") &&
    Boolean(concept.previewAsset);

  return (
    <article className="library-card">
      <div className="library-card__media">
        {concept.previewAsset?.publicUrl ? (
          <img src={concept.previewAsset.publicUrl} alt={concept.title} />
        ) : (
          <div className="library-card__placeholder">
            <span>{concept.previewAsset ? "Preview URL unavailable" : "No preview asset"}</span>
          </div>
        )}
      </div>
      <div className="library-card__body">
        <div className="showcase-pill-row">
          <Pill>{concept.status}</Pill>
          <Pill tone={concept.visibility === "public" ? "teal" : "neutral"}>
            {concept.visibility}
          </Pill>
          {concept.remixCount > 0 ? <Pill tone="orange">{`${concept.remixCount} remix`}</Pill> : null}
        </div>
        <div>
          <h3>{concept.title}</h3>
          <p>
            {concept.baseModel?.name ?? "Unknown base model"} /{" "}
            {concept.stylePreset?.name ?? "Unknown Style DNA"} /{" "}
            {concept.materialPreset?.name ?? "Unknown material profile"}
          </p>
          {concept.moodTags.length > 0 ? (
            <span className="library-card__mood">
              {concept.moodTags.map(formatMoodTagLabel).join(" / ")}
            </span>
          ) : null}
        </div>
        <dl className="showcase-meta">
          <MetaRow label="Weathering" value={concept.weatheringLevel} />
          <MetaRow label="Finish" value={concept.materialPreset?.finishType ?? "Unknown"} />
          <MetaRow
            label="Job"
            value={concept.generationJob?.status ?? "No generation job"}
          />
        </dl>
        <label className="library-select-row">
          <span>Visibility</span>
          <select
            disabled={busy}
            value={concept.visibility}
            onChange={(event) => {
              void onVisibilityChange(
                concept,
                event.currentTarget.value as ConceptVisibility
              );
            }}
          >
            <option value="private">Private</option>
            <option value="unlisted">Unlisted</option>
            <option value="public">Public</option>
          </select>
        </label>
        <div className="library-action-grid">
          {concept.visibility !== "private" ? (
            <a className="showcase-button" href={`/prototype/${concept._id}`}>
              Open Share
            </a>
          ) : (
            <span className="showcase-button is-disabled">Private</span>
          )}
          {canShare && !hasPublicPreview ? (
            <button
              className="showcase-button is-accent"
              disabled={busy}
              type="button"
              onClick={() => {
                void onStabilizePreviewAsset(concept);
              }}
            >
              Stabilize URL
            </button>
          ) : (
            <a className="showcase-button is-warm" href={`/t/create?remix=${concept._id}`}>
              Remix
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function SavedConceptsSection({
  savedConcepts,
}: {
  savedConcepts: SavedPublicConcept[];
}) {
  if (savedConcepts.length === 0) {
    return (
      <LibraryStatePanel
        copy="Use public showcase, pilot profile, or style landing pages to save concepts into this hangar."
        kicker="No saved builds"
        title="No bookmarked public builds yet"
      />
    );
  }

  return (
    <section className="library-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker">Saved Public Builds</p>
          <h2>{savedConcepts.length} bookmarked concepts</h2>
        </div>
        <p>Saved from public share surfaces into this authenticated library.</p>
      </div>
      <div className="library-card-grid">
        {savedConcepts.map((concept) => (
          <SavedConceptCard concept={concept} key={concept._id} />
        ))}
      </div>
    </section>
  );
}

function SavedConceptCard({ concept }: { concept: SavedPublicConcept }) {
  return (
    <article className="library-card">
      <div className="library-card__media">
        {concept.previewAsset?.publicUrl ? (
          <img src={concept.previewAsset.publicUrl} alt={concept.title} />
        ) : (
          <div className="library-card__placeholder">
            <span>Preview unavailable</span>
          </div>
        )}
      </div>
      <div className="library-card__body">
        <div className="showcase-pill-row">
          <Pill>{concept.visibility}</Pill>
          <Pill>{concept.status}</Pill>
          {concept.stylePreset?.category ? <Pill>{concept.stylePreset.category}</Pill> : null}
        </div>
        <div>
          <h3>{concept.title}</h3>
          <p>
            {concept.baseModel?.name ?? "Unknown base model"} /{" "}
            {concept.stylePreset?.name ?? "Unknown Style DNA"} /{" "}
            {concept.materialPreset?.name ?? "Unknown material profile"}
          </p>
          {concept.owner ? (
            <span className="library-card__mood">Pilot / @{concept.owner.handle}</span>
          ) : null}
        </div>
        <dl className="showcase-meta">
          <MetaRow label="Weathering" value={concept.weatheringLevel} />
          <MetaRow label="Finish" value={concept.materialPreset?.finishType ?? "Unknown"} />
          <MetaRow label="Remixes" value={`${concept.remixCount}`} />
        </dl>
        <ConceptEngagementBar
          compact
          conceptId={concept._id}
          interactive
          likeCount={concept.engagement.likeCount}
          saveCount={concept.engagement.saveCount}
          viewerHasLiked={concept.engagement.viewerHasLiked}
          viewerHasSaved={concept.engagement.viewerHasSaved}
        />
        <div className="library-action-grid">
          <a className="showcase-button" href={`/prototype/${concept._id}`}>
            Open Prototype
          </a>
          <a className="showcase-button is-warm" href={`/t/create?remix=${concept._id}`}>
            Remix
          </a>
        </div>
      </div>
    </article>
  );
}

function JobsSection({
  busyJobId,
  jobs,
  onRetryJob,
}: {
  busyJobId: string | null;
  jobs: ViewerJob[];
  onRetryJob: (job: ViewerJob) => Promise<void>;
}) {
  if (jobs.length === 0) {
    return (
      <LibraryStatePanel
        copy="Generation and render jobs will appear here once create starts writing work into Convex."
        kicker="No jobs"
        title="Generation ledger is empty"
      />
    );
  }

  return (
    <section className="library-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker is-orange">Generation Ledger</p>
          <h2>{jobs.length} jobs</h2>
        </div>
        <p>Failed jobs can be queued again from this ledger.</p>
      </div>
      <div className="library-job-list">
        {jobs.map((job) => (
          <article className="library-job-row" key={job._id}>
            <div>
              <div className="showcase-pill-row">
                <Pill tone={job.status === "failed" ? "orange" : "neutral"}>
                  {job.status}
                </Pill>
                <Pill>{job.kind}</Pill>
                {job.renderMode ? <Pill>{job.renderMode}</Pill> : null}
              </div>
              <h3>{job.provider}</h3>
              <p>
                {job.requestedCredits} credits /{" "}
                {new Date(job._creationTime).toLocaleString()}
              </p>
              {job.errorMessage ? <span>{job.errorMessage}</span> : null}
            </div>
            <div className="library-job-row__actions">
              {job.conceptId ? (
                <a className="showcase-button is-ghost" href={`/prototype/${job.conceptId}`}>
                  Prototype
                </a>
              ) : null}
              {job.status === "failed" ? (
                <button
                  className="showcase-button is-warm"
                  disabled={busyJobId === job._id}
                  type="button"
                  onClick={() => {
                    void onRetryJob(job);
                  }}
                >
                  {busyJobId === job._id ? "Retrying" : "Retry"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ViewerPanel({
  viewer,
}: {
  viewer: NonNullable<ReturnType<typeof useQuery<typeof api.users.viewer>>>;
}) {
  return (
    <section className="library-panel">
      <p className="showcase-kicker">Operator</p>
      <h2>{viewer.fullName}</h2>
      <dl className="showcase-meta prototype-meta-list">
        <MetaRow label="Handle" value={viewer.handle} />
        <MetaRow label="Plan" value={viewer.planType} />
        <MetaRow label="Credits" value={`${viewer.credits.balance}`} />
        <MetaRow
          label="Access"
          value={viewer.canManagePlatform ? "Platform" : "Standard"}
        />
      </dl>
    </section>
  );
}

function JobSummaryPanel({
  failedJobs,
  queuedJobs,
  succeededJobs,
}: {
  failedJobs: ViewerJob[];
  queuedJobs: ViewerJob[];
  succeededJobs: ViewerJob[];
}) {
  return (
    <section className="library-panel">
      <p className="showcase-kicker is-orange">Job status</p>
      <dl className="showcase-meta prototype-meta-list">
        <MetaRow label="Queued / running" value={`${queuedJobs.length}`} />
        <MetaRow label="Succeeded" value={`${succeededJobs.length}`} />
        <MetaRow label="Failed" value={`${failedJobs.length}`} />
      </dl>
    </section>
  );
}

function SavedConceptsMiniPanel({
  savedConcepts,
}: {
  savedConcepts: SavedPublicConcept[];
}) {
  return (
    <section className="library-panel">
      <p className="showcase-kicker is-teal">Saved quick list</p>
      {savedConcepts.length === 0 ? (
        <p className="prototype-muted">No saved public builds yet.</p>
      ) : (
        <div className="library-mini-list">
          {savedConcepts.slice(0, 6).map((concept) => (
            <a href={`/prototype/${concept._id}`} key={concept._id}>
              <strong>{concept.title}</strong>
              <span>{concept.stylePreset?.name ?? "Unknown Style DNA"}</span>
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function LibraryStatePanel({
  copy,
  kicker,
  title,
}: {
  copy: string;
  kicker: string;
  title: string;
}) {
  return (
    <section className="library-empty">
      <p className="showcase-kicker is-teal">{kicker}</p>
      <h1>{title}</h1>
      <p>{copy}</p>
    </section>
  );
}

function Metric({
  label,
  tone,
  value,
}: {
  label: string;
  tone?: "blue" | "orange" | "teal";
  value: string;
}) {
  return (
    <div className={tone ? `library-metric is-${tone}` : "library-metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FilterLink({
  active,
  href,
  label,
}: {
  active: boolean;
  href: string;
  label: string;
}) {
  return (
    <a className={active ? "showcase-filter is-active" : "showcase-filter"} href={href}>
      {label}
    </a>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Pill({
  children,
  tone,
}: {
  children: string;
  tone?: "neutral" | "orange" | "teal";
}) {
  const className =
    tone === "teal"
      ? "showcase-pill is-teal"
      : tone === "orange"
        ? "showcase-pill is-warm"
        : "showcase-pill";

  return <span className={className}>{children}</span>;
}

export function parseLibrarySearch(search: Record<string, unknown>): LibrarySearch {
  const filter = parseOptionalSearchValue(search.filter);

  return {
    filter: parseLibraryFilter(filter),
  };
}

function parseLibraryFilter(value: unknown): NonNullable<LibrarySearch["filter"]> {
  return value === "draft" ||
    value === "generated" ||
    value === "archived" ||
    value === "saved" ||
    value === "jobs"
    ? value
    : "all";
}
