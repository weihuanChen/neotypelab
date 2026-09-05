import type { RankedPublicCreator } from "./types";

export function CreatorRankingCard({ creator }: { creator: RankedPublicCreator }) {
  const leadConcept = creator.leadConcept as typeof creator.leadConcept | null;

  return (
    <article className="showcase-card showcase-card--compact">
      <div className="showcase-card__media">
        {leadConcept?.previewAsset?.thumbnailUrl ?? leadConcept?.previewAsset?.publicUrl ? (
          <img
            src={leadConcept.previewAsset.thumbnailUrl ?? leadConcept.previewAsset.publicUrl}
            alt={leadConcept.title}
          />
        ) : (
          <div className="showcase-card__placeholder">Creator preview unavailable</div>
        )}
      </div>
      <div className="showcase-card__body">
        <div className="showcase-creator-row">
          {creator.pictureUrl ? (
            <img
              className="showcase-avatar"
              src={creator.pictureUrl}
              alt={creator.fullName}
            />
          ) : (
            <span className="showcase-avatar showcase-avatar--fallback">
              {creator.handle.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <a className="showcase-card__title is-small" href={`/pilot/${creator.handle}`}>
              {creator.fullName}
            </a>
            <p>@{creator.handle}</p>
          </div>
        </div>
        <div className="showcase-pill-row">
          {creator.isFeaturedCreator ? <Pill>featured creator</Pill> : null}
          {creator.isVerifiedCreator ? <Pill>verified creator</Pill> : null}
        </div>
        {creator.creatorTagline ? (
          <p className="showcase-card__copy">{creator.creatorTagline}</p>
        ) : null}
        <dl className="showcase-meta">
          <MetaRow label="Concepts" value={`${creator.totals.publicConcepts}`} />
          <MetaRow label="Saves" value={`${creator.totals.saves}`} />
          <MetaRow label="Remixes" value={`${creator.totals.remixes}`} />
        </dl>
        <div className="showcase-card__actions">
          <a className="showcase-button" href={`/creator/${creator.handle}`}>
            Open Hub
          </a>
          <a className="showcase-button is-ghost" href={`/showcase?creator=${creator.handle}`}>
            Filter Showcase
          </a>
        </div>
      </div>
    </article>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Pill({ children }: { children: string }) {
  return <span className="showcase-pill">{children}</span>;
}
