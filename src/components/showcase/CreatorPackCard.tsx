import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { getCreatorPackAccessCopy } from "@/lib/creatorPackAccess";
import { PackEngagementBar } from "./EngagementBars";
import type { ShowcaseCreatorPack } from "./types";

export function CreatorPackCard({
  interactive,
  pack,
}: {
  interactive: boolean;
  pack: ShowcaseCreatorPack;
}) {
  return interactive ? (
    <InteractiveCreatorPackCard interactive={interactive} pack={pack} />
  ) : (
    <CreatorPackCardView interactive={interactive} pack={pack} />
  );
}

function InteractiveCreatorPackCard({
  interactive,
  pack,
}: {
  interactive: boolean;
  pack: ShowcaseCreatorPack;
}) {
  const viewer = useQuery(api.users.viewer);

  return (
    <CreatorPackCardView interactive={interactive} pack={pack} viewer={viewer} />
  );
}

function CreatorPackCardView({
  interactive,
  pack,
  viewer,
}: {
  interactive: boolean;
  pack: ShowcaseCreatorPack;
  viewer?: ReturnType<typeof useQuery<typeof api.users.viewer>>;
}) {
  const access = getCreatorPackAccessCopy({
    creatorHandle: pack.creator?.handle,
    packType: pack.packType,
    viewer,
  });
  const previewConcept = pack.previewConcept as
    | typeof pack.previewConcept
    | null;

  return (
    <article className="showcase-card showcase-card--pack">
      <div className="showcase-card__media">
        {previewConcept?.previewAsset?.publicUrl ? (
          <img
            src={previewConcept.previewAsset.publicUrl}
            alt={previewConcept.title}
          />
        ) : (
          <div className="showcase-card__placeholder">Pack preview unavailable</div>
        )}
      </div>
      <div className="showcase-card__body">
        <div className="showcase-pill-row">
          <Pill>{pack.packType}</Pill>
          {pack.isFeatured ? <Pill tone="warm">featured pack</Pill> : null}
          {pack.packType === "premium" ? <Pill tone="blue">{access.badge}</Pill> : null}
        </div>
        <div>
          <a className="showcase-card__title is-small" href={`/creator-pack/${pack.slug}`}>
            {pack.name}
          </a>
          {pack.tagline ? <p className="showcase-card__lede">{pack.tagline}</p> : null}
          <p className="showcase-card__copy">
            {pack.description ??
              "Creator starter pack for Style DNA, base models, and material presets."}
          </p>
        </div>
        <dl className="showcase-meta">
          <MetaRow label="Creator" value={pack.creator ? `@${pack.creator.handle}` : "Unknown"} />
          <MetaRow label="Styles" value={`${pack.stats.styleCount}`} />
          <MetaRow label="Concepts" value={`${pack.stats.publicConceptCount}`} />
        </dl>
        <PackEngagementBar
          compact
          creatorPackId={pack._id}
          interactive={interactive}
          likeCount={pack.engagement.likeCount}
          saveCount={pack.engagement.saveCount}
          viewerHasLiked={pack.engagement.viewerHasLiked}
          viewerHasSaved={pack.engagement.viewerHasSaved}
        />
        {pack.packType === "premium" && !access.allowed ? (
          <div className="showcase-note">{access.message}</div>
        ) : null}
        <div className="showcase-card__actions">
          <a className="showcase-button" href={`/creator-pack/${pack.slug}`}>
            Open Pack
          </a>
          {pack.packType === "premium" && !access.allowed ? (
            <span className="showcase-button is-disabled">Premium Access</span>
          ) : previewConcept ? (
            <a
              className="showcase-button is-warm"
              href={`/t/create?remix=${previewConcept._id}&creatorPack=${pack.slug}&creatorPackVariant=remix-seed`}
            >
              Remix Entry
            </a>
          ) : (
            <a className="showcase-button is-accent" href={`/t/create?creatorPack=${pack.slug}`}>
              Open In Create
            </a>
          )}
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
