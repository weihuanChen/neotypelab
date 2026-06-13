import { useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ConceptEngagementBar } from "@/src/components/showcase/EngagementBars";
import { formatMoodTagLabel } from "@/src/components/showcase/showcaseUtils";
import { useStartProviderStatus } from "@/src/providers/StartProviders";
import type {
  PrototypeMetaRowValue,
  PrototypeSnapshot,
  SharedPrototype,
} from "./types";

export function PrototypePublicView({
  conceptId,
  snapshot,
}: {
  conceptId: string;
  snapshot: PrototypeSnapshot;
}) {
  const providerStatus = useStartProviderStatus();
  const canUseLiveData =
    providerStatus.hasClerkProvider && providerStatus.hasConvexClient;

  return canUseLiveData ? (
    <LivePrototypePublicView
      conceptId={conceptId}
      interactive
      providerReady={providerStatus.hasConvexClient}
      snapshot={snapshot}
    />
  ) : (
    <PrototypePublicViewBody
      concept={snapshot.concept}
      interactive={false}
      message={snapshot.status === "ok" ? undefined : snapshot.message}
      providerReady={providerStatus.hasConvexClient}
      status={snapshot.status}
    />
  );
}

function LivePrototypePublicView({
  conceptId,
  interactive,
  providerReady,
  snapshot,
}: {
  conceptId: string;
  interactive: boolean;
  providerReady: boolean;
  snapshot: PrototypeSnapshot;
}) {
  const liveConcept = useQuery(api.showcase.getSharedConcept, {
    conceptId: conceptId as Id<"concepts">,
  });
  const concept =
    liveConcept === undefined ? snapshot.concept : liveConcept;

  return (
    <PrototypePublicViewBody
      concept={concept}
      interactive={interactive}
      isLivePending={liveConcept === undefined}
      message={snapshot.status === "ok" ? undefined : snapshot.message}
      providerReady={providerReady}
      status={snapshot.status}
    />
  );
}

function PrototypePublicViewBody({
  concept,
  interactive,
  isLivePending = false,
  message,
  providerReady,
  status,
}: {
  concept: SharedPrototype | null;
  interactive: boolean;
  isLivePending?: boolean;
  message?: string;
  providerReady: boolean;
  status: PrototypeSnapshot["status"];
}) {
  if (concept === null) {
    return (
      <section className="prototype-empty">
        <p className="showcase-kicker is-orange">Unavailable</p>
        <h1>This prototype is not on a shareable surface.</h1>
        <p>
          {message ??
            "The concept may be private, missing, archived away from public sharing, or unavailable in the current Convex environment."}
        </p>
        <div className="prototype-action-row">
          <a className="showcase-button" href="/showcase">
            Back to Showcase
          </a>
          <a className="showcase-button is-ghost" href="/t/library">
            Open Terminal
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="prototype-stack">
      <section className="prototype-hero-panel">
        <div className="prototype-hero-panel__copy">
          <div className="showcase-pill-row">
            <Pill>{concept.visibility}</Pill>
            <Pill>{concept.status}</Pill>
            {concept.stylePreset?.category ? (
              <Pill>{concept.stylePreset.category}</Pill>
            ) : null}
            {concept.stylePreset?.isFeaturedStyle ? (
              <Pill tone="blue">featured style</Pill>
            ) : null}
            {concept.remixCount > 0 ? (
              <Pill tone="warm">
                {`${concept.remixCount} remix${concept.remixCount === 1 ? "" : "es"}`}
              </Pill>
            ) : null}
          </div>

          <div>
            <p className="showcase-kicker">Prototype Share Surface</p>
            <h1>{concept.title}</h1>
            <p className="prototype-lede">
              {buildPrototypeDescription(concept)}
            </p>
          </div>

          {concept.moodTags.length > 0 ? (
            <p className="prototype-mood">
              Mood Vector / {concept.moodTags.map(formatMoodTagLabel).join(" / ")}
            </p>
          ) : null}

          <ConceptEngagementBar
            conceptId={concept._id}
            interactive={interactive}
            likeCount={concept.engagement.likeCount}
            saveCount={concept.engagement.saveCount}
            viewerHasLiked={concept.engagement.viewerHasLiked}
            viewerHasSaved={concept.engagement.viewerHasSaved}
          />

          <PrototypeActions concept={concept} />

          <div className="prototype-status-line">
            <span>{providerReady ? "Convex live sync ready" : "SSR snapshot mode"}</span>
            {isLivePending ? <span>Hydrating live concept query</span> : null}
            {status !== "ok" && message ? <span>{message}</span> : null}
          </div>
        </div>

        <div className="prototype-hero-panel__media">
          {concept.previewAsset?.publicUrl ? (
            <img src={concept.previewAsset.publicUrl} alt={concept.title} />
          ) : (
            <div className="prototype-media-placeholder">
              <p>Preview unavailable</p>
              {concept.previewAsset?.key ? <span>{concept.previewAsset.key}</span> : null}
            </div>
          )}
        </div>
      </section>

      <LineagePanel concept={concept} />

      <div className="prototype-content-grid">
        <div className="prototype-main-column">
          <PaintPlanPanel concept={concept} />
          <RemixesPanel concept={concept} />
        </div>
        <aside className="prototype-side-column">
          <SourceConceptPanel concept={concept} />
          <MetadataPanel concept={concept} />
          <SprayNotesPanel concept={concept} />
          <OperatorNotePanel concept={concept} />
        </aside>
      </div>
    </div>
  );
}

function PrototypeActions({ concept }: { concept: SharedPrototype }) {
  const [copied, setCopied] = useState(false);
  const styleLandingHref =
    concept.baseModel?.slug && concept.stylePreset?.slug
      ? `/${concept.baseModel.slug}/${concept.stylePreset.slug}`
      : null;

  async function copyShareLink() {
    const sharePath = `/prototype/${concept._id}`;
    const shareUrl =
      typeof window === "undefined"
        ? sharePath
        : new URL(sharePath, window.location.origin).toString();

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="prototype-action-row">
      <a className="showcase-button is-warm" href={`/t/create?remix=${concept._id}`}>
        Remix This Prototype
      </a>
      {styleLandingHref ? (
        <a className="showcase-button is-accent" href={styleLandingHref}>
          Open Style Landing
        </a>
      ) : null}
      <button
        className="showcase-button"
        type="button"
        onClick={() => {
          void copyShareLink();
        }}
      >
        {copied ? "Copied" : "Copy Share Link"}
      </button>
      <a className="showcase-button is-ghost" href="/showcase">
        Back to Showcase
      </a>
    </div>
  );
}

function LineagePanel({ concept }: { concept: SharedPrototype }) {
  if (concept.lineage.length <= 1) {
    return null;
  }

  return (
    <section className="prototype-panel prototype-lineage-panel">
      <div>
        <p className="showcase-kicker is-teal">Lineage chain</p>
        <h2>Branch history</h2>
      </div>
      <div className="prototype-lineage">
        {concept.lineage.map((entry, index) => (
          <div className="prototype-lineage__item" key={entry._id}>
            {index > 0 ? <span className="prototype-lineage__arrow">-&gt;</span> : null}
            <a
              className={
                entry._id === concept._id
                  ? "showcase-chip is-active"
                  : "showcase-chip"
              }
              href={`/prototype/${entry._id}`}
            >
              {entry.title}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}

function PaintPlanPanel({ concept }: { concept: SharedPrototype }) {
  return (
    <section className="prototype-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker is-teal">Paint Mapping Plan</p>
          <h2>{concept.paintPlan.entries.length} spray-ready roles</h2>
        </div>
        <p>
          {concept.paintPlan.baseModelName} / {concept.paintPlan.stylePresetName}
        </p>
      </div>

      {concept.paintPlan.entries.length > 0 ? (
        <div className="prototype-paint-grid">
          {concept.paintPlan.entries.map((entry) => (
            <article className="prototype-paint-row" key={entry.roleSlug}>
              <div className="prototype-paint-row__head">
                <div>
                  <h3>{entry.roleName}</h3>
                  <p>{entry.recommendedArea ?? "Controlled application zone"}</p>
                </div>
                {entry.suggestedPaint?.hexPreview ? (
                  <span
                    className="prototype-swatch"
                    style={{ backgroundColor: entry.suggestedPaint.hexPreview }}
                  />
                ) : null}
              </div>
              <div className="prototype-paint-row__paint">
                <strong>
                  {entry.suggestedPaint
                    ? `${entry.suggestedPaint.brand} ${entry.suggestedPaint.code}`
                    : "No active paint mapping"}
                </strong>
                <span>
                  {entry.suggestedPaint
                    ? `${entry.suggestedPaint.colorName}${
                        entry.suggestedPaint.line ? ` / ${entry.suggestedPaint.line}` : ""
                      }`
                    : "Fallback mapping is not configured for this role."}
                </span>
              </div>
              <p className="prototype-row-copy">{entry.rationale}</p>
              {entry.alternatePaint ? (
                <p className="prototype-alt-paint">
                  Alternate / {entry.alternatePaint.brand} {entry.alternatePaint.code} /{" "}
                  {entry.alternatePaint.colorName}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="prototype-muted">
          Paint roles have not been configured for this concept yet.
        </p>
      )}
    </section>
  );
}

function RemixesPanel({ concept }: { concept: SharedPrototype }) {
  if (concept.remixes.length === 0) {
    return (
      <section className="prototype-panel">
        <p className="showcase-kicker is-orange">Remix branches</p>
        <h2>No public branches yet</h2>
        <p className="prototype-muted">
          This concept has not produced public descendant prototypes yet.
        </p>
        <a className="showcase-button is-warm" href={`/t/create?remix=${concept._id}`}>
          Start First Remix
        </a>
      </section>
    );
  }

  return (
    <section className="prototype-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker is-orange">Remix branches</p>
          <h2>
            {concept.remixCount} community branch
            {concept.remixCount === 1 ? "" : "es"}
          </h2>
        </div>
        <a className="showcase-button is-warm" href={`/t/create?remix=${concept._id}`}>
          Start Your Remix
        </a>
      </div>
      <div className="prototype-remix-grid">
        {concept.remixes.map((remix) => (
          <a className="prototype-remix-card" href={`/prototype/${remix._id}`} key={remix._id}>
            <h3>{remix.title}</h3>
            <p>
              {remix.baseModel?.name ?? "Unknown base model"} /{" "}
              {remix.stylePreset?.name ?? "Unknown Style DNA"}
            </p>
            <span>
              {remix.owner?.handle ? `@${remix.owner.handle}` : "Unknown pilot"} /{" "}
              {remix.weatheringLevel}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

function SourceConceptPanel({ concept }: { concept: SharedPrototype }) {
  if (!concept.sourceConcept) {
    return null;
  }

  const source = concept.sourceConcept;
  const sourceLandingHref =
    source.baseModel?.slug && source.stylePreset?.slug
      ? `/${source.baseModel.slug}/${source.stylePreset.slug}`
      : null;

  return (
    <section className="prototype-panel">
      <p className="showcase-kicker is-teal">Source lineage</p>
      <h2>{source.title}</h2>
      <p className="prototype-muted">
        This prototype is a public branch derived from an earlier shareable concept.
      </p>
      <dl className="showcase-meta">
        <MetaRow
          label="Pilot"
          value={
            source.owner ? (
              <a href={`/pilot/${source.owner.handle}`}>@{source.owner.handle}</a>
            ) : (
              "Unknown"
            )
          }
        />
        <MetaRow label="Base Model" value={source.baseModel?.name ?? "Unknown"} />
        <MetaRow label="Style DNA" value={source.stylePreset?.name ?? "Unknown"} />
      </dl>
      <div className="prototype-action-column">
        <a className="showcase-button" href={`/prototype/${source._id}`}>
          Open Source Prototype
        </a>
        {sourceLandingHref ? (
          <a className="showcase-button is-accent" href={sourceLandingHref}>
            Open Source Landing
          </a>
        ) : null}
      </div>
    </section>
  );
}

function MetadataPanel({ concept }: { concept: SharedPrototype }) {
  return (
    <section className="prototype-panel">
      <p className="showcase-kicker is-orange">Prototype Metadata</p>
      <dl className="showcase-meta prototype-meta-list">
        <MetaRow
          label="Pilot"
          value={
            concept.owner ? (
              <a href={`/pilot/${concept.owner.handle}`}>@{concept.owner.handle}</a>
            ) : (
              "Unknown"
            )
          }
        />
        <MetaRow label="Series" value={concept.baseModel?.series ?? "Unknown"} />
        <MetaRow label="Grade" value={concept.baseModel?.grade ?? "Unknown"} />
        <MetaRow label="Weathering" value={concept.weatheringLevel} />
        <MetaRow label="Finish" value={concept.materialPreset?.finishType ?? "Unknown"} />
        <MetaRow label="Style DNA" value={concept.stylePreset?.name ?? "Unknown"} />
        <MetaRow label="Remixes" value={`${concept.remixCount}`} />
        <MetaRow label="Likes" value={`${concept.engagement.likeCount}`} />
        <MetaRow label="Saves" value={`${concept.engagement.saveCount}`} />
      </dl>
    </section>
  );
}

function SprayNotesPanel({ concept }: { concept: SharedPrototype }) {
  return (
    <section className="prototype-panel">
      <p className="showcase-kicker is-teal">Spray Notes</p>
      <div className="prototype-note-stack">
        {concept.paintPlan.sprayNotes.map((note) => (
          <p key={note}>{note}</p>
        ))}
      </div>
    </section>
  );
}

function OperatorNotePanel({ concept }: { concept: SharedPrototype }) {
  if (!concept.notes) {
    return null;
  }

  return (
    <section className="prototype-panel">
      <p className="showcase-kicker">Operator Note</p>
      <p className="prototype-muted">{concept.notes}</p>
    </section>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: PrototypeMetaRowValue;
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
  tone?: "blue" | "warm";
}) {
  return (
    <span className={tone ? `showcase-pill is-${tone}` : "showcase-pill"}>
      {children}
    </span>
  );
}

function buildPrototypeDescription(concept: SharedPrototype) {
  return [
    concept.baseModel?.name ?? "Unknown base model",
    concept.stylePreset?.name ?? "Unknown Style DNA",
    concept.materialPreset?.name ?? "Unknown material profile",
  ].join(" / ");
}
