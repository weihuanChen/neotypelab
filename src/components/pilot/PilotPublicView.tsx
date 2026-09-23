import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PublicShareActions } from "@/src/components/public/PublicShareActions";
import { ConceptEngagementBar, PackEngagementBar } from "@/src/components/showcase/EngagementBars";
import { useStartProviderStatus } from "@/src/providers/StartProviders";
import type {
  PilotConceptCard,
  PilotCreatorPack,
  PilotMetaRowValue,
  PilotSnapshot,
  PublicPilotProfile,
} from "./types";

export function PilotPublicView({
  handle,
  snapshot,
}: {
  handle: string;
  snapshot: PilotSnapshot;
}) {
  const providerStatus = useStartProviderStatus();
  const canUseLiveData =
    providerStatus.hasClerkProvider && providerStatus.hasConvexClient;

  return canUseLiveData ? (
    <LivePilotPublicView
      handle={handle}
      interactive
      providerReady={providerStatus.hasConvexClient}
      snapshot={snapshot}
    />
  ) : (
    <PilotPublicViewBody
      interactive={false}
      message={snapshot.status === "ok" ? undefined : snapshot.message}
      profile={snapshot.profile}
      providerReady={providerStatus.hasConvexClient}
      status={snapshot.status}
    />
  );
}

function LivePilotPublicView({
  handle,
  interactive,
  providerReady,
  snapshot,
}: {
  handle: string;
  interactive: boolean;
  providerReady: boolean;
  snapshot: PilotSnapshot;
}) {
  const liveProfile = useQuery(api.showcase.getPublicProfile, { handle });
  const profile =
    liveProfile === undefined ? snapshot.profile : liveProfile;

  return (
    <PilotPublicViewBody
      interactive={interactive}
      isLivePending={liveProfile === undefined}
      message={snapshot.status === "ok" ? undefined : snapshot.message}
      profile={profile}
      providerReady={providerReady}
      status={snapshot.status}
    />
  );
}

function PilotPublicViewBody({
  interactive,
  isLivePending = false,
  message,
  profile,
  providerReady,
  status,
}: {
  interactive: boolean;
  isLivePending?: boolean;
  message?: string;
  profile: PublicPilotProfile | null;
  providerReady: boolean;
  status: PilotSnapshot["status"];
}) {
  if (profile === null) {
    return (
      <section className="pilot-empty">
        <p className="showcase-kicker is-orange">Unavailable</p>
        <h1>This pilot profile is not available.</h1>
        <p>
          {message ??
            "This builder profile is not public, or the name does not match an account."}
        </p>
        <div className="prototype-action-row">
          <a className="showcase-button" href="/showcase">
            Back to Showcase
          </a>
          <a className="showcase-button is-ghost" href="/library">
            Open Library
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="pilot-stack">
      <section className="pilot-hero-panel">
        <div className="pilot-identity">
          <PilotAvatar profile={profile} />
          <div>
            <div className="showcase-pill-row">
              {profile.pilot.isVerifiedCreator ? (
                <Pill tone="teal">verified creator</Pill>
              ) : null}
              {profile.pilot.isFeaturedCreator ? (
                <Pill tone="blue">featured creator</Pill>
              ) : null}
              {profile.pilot.creatorSpecialties.map((specialty) => (
                <Pill key={specialty}>{specialty}</Pill>
              ))}
            </div>
            <p className="showcase-kicker">Public Pilot Profile</p>
            <h1>{profile.pilot.fullName}</h1>
            <p className="pilot-handle">@{profile.pilot.handle}</p>
            {profile.pilot.creatorTagline ? (
              <p className="pilot-lede">{profile.pilot.creatorTagline}</p>
            ) : (
              <p className="pilot-lede">
                {profile.totals.publicConcepts} paint plans /{" "}
                {profile.totals.saves} saves / {profile.totals.remixes} remixes
              </p>
            )}
          </div>
        </div>

        <div className="pilot-hero-panel__side">
          <MetricCard accent="teal" label="Published" value={`${profile.totals.publicConcepts}`} />
          <MetricCard accent="orange" label="Likes" value={`${profile.totals.likes}`} />
          <MetricCard accent="blue" label="Saves" value={`${profile.totals.saves}`} />
          <MetricCard accent="neutral" label="Remixes" value={`${profile.totals.remixes}`} />
        </div>

        <div className="pilot-hero-panel__actions">
          <PublicShareActions
            className="prototype-action-row"
            exportImageLabel="Profile Image"
            exportImageUrl={`/pilot/${profile.pilot.handle}/opengraph-image`}
            sharePath={`/pilot/${profile.pilot.handle}`}
            text={
              profile.pilot.creatorTagline ??
              `${profile.totals.publicConcepts} paint plans from ${profile.pilot.fullName}`
            }
            title={`${profile.pilot.fullName} | NeotypeLab`}
          />
          <a className="showcase-button is-accent" href={`/showcase?creator=${profile.pilot.handle}`}>
            Filter Showcase
          </a>
          <a className="showcase-button is-ghost" href="/showcase">
            Back to Showcase
          </a>
        </div>

        <div className="prototype-status-line">
          <span>{providerReady ? "Live" : "Cached"}</span>
          {isLivePending ? <span>Updating</span> : null}
          {status !== "ok" && message ? <span>{message}</span> : null}
        </div>
      </section>

      <div className="pilot-content-grid">
        <main className="pilot-main-column">
          <StyleCollectionPanel profile={profile} />
          <CreatorPackPanel interactive={interactive} profile={profile} />
          <ConceptSection
            emptyDescription="Paint plans show up here after this builder publishes one."
            emptyTitle="No paint plans yet."
            eyebrow="Published plans"
            interactive={interactive}
            items={profile.published}
            title="Published plans"
          />
          <ConceptSection
            emptyDescription="Saved plans show up here after this builder saves a public paint plan."
            emptyTitle="No saved plans yet."
            eyebrow="Saved plans"
            interactive={interactive}
            items={profile.saved}
            title="Saved builds"
          />
          <ConceptSection
            emptyDescription="Liked plans show up here after this builder likes a public paint plan."
            emptyTitle="No liked plans yet."
            eyebrow="Liked plans"
            interactive={interactive}
            items={profile.liked}
            title="Liked plans"
          />
        </main>

        <aside className="pilot-side-column">
          <ActivityPanel profile={profile} />
          <RemixHistoryPanel profile={profile} />
          <ProfileMetaPanel profile={profile} />
        </aside>
      </div>
    </div>
  );
}

function PilotAvatar({ profile }: { profile: PublicPilotProfile }) {
  if (profile.pilot.pictureUrl) {
    return (
      <img
        className="pilot-avatar"
        src={profile.pilot.pictureUrl}
        alt={profile.pilot.fullName}
      />
    );
  }

  return (
    <div className="pilot-avatar pilot-avatar--fallback">
      {profile.pilot.handle.slice(0, 2).toUpperCase()}
    </div>
  );
}

function StyleCollectionPanel({ profile }: { profile: PublicPilotProfile }) {
  return (
    <section className="pilot-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker is-orange">Creator style collection</p>
          <h2>Color directions</h2>
        </div>
        <p>{profile.styleCollection.length} creator-linked styles</p>
      </div>

      {profile.styleCollection.length === 0 ? (
        <EmptyPanel
          description="Color directions linked to this builder will appear here."
          title="No color directions yet."
        />
      ) : (
        <div className="pilot-style-grid">
          {profile.styleCollection.map((style) => (
            <article className="pilot-style-card" key={style._id}>
              <div className="showcase-pill-row">
                {style.category ? <Pill>{style.category}</Pill> : null}
                {style.isFeaturedStyle ? <Pill tone="orange">featured style</Pill> : null}
              </div>
              <h3>{style.name}</h3>
              <p>
                {style.shortDescription ??
                  "A reusable color direction for Gunpla and mecha kits."}
              </p>
              <dl className="showcase-meta">
                <MetaRow label="Creator concepts" value={`${style.creatorConceptCount}`} />
                <MetaRow label="Community concepts" value={`${style.communityConceptCount}`} />
                <MetaRow label="Lead base model" value={style.leadBaseModel.name} />
              </dl>
              <div className="prototype-action-row">
                {style.hasLeadBaseModel ? (
                  <a
                    className="showcase-button"
                    href={`/${style.leadBaseModel.slug}/${style.slug}`}
                  >
                    Open Landing
                  </a>
                ) : null}
                <a className="showcase-button is-ghost" href={`/showcase?style=${style.slug}`}>
                  Filter Showcase
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function CreatorPackPanel({
  interactive,
  profile,
}: {
  interactive: boolean;
  profile: PublicPilotProfile;
}) {
  const packLikes = profile.creatorPackCollection.reduce(
    (sum, pack) => sum + pack.engagement.likeCount,
    0
  );
  const packSaves = profile.creatorPackCollection.reduce(
    (sum, pack) => sum + pack.engagement.saveCount,
    0
  );
  const packConcepts = profile.creatorPackCollection.reduce(
    (sum, pack) => sum + pack.stats.publicConceptCount,
    0
  );

  return (
    <section className="pilot-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker">Creator packs</p>
          <h2>Color packs</h2>
        </div>
        <p>{profile.creatorPackCollection.length} active packs</p>
      </div>

      {profile.creatorPackCollection.length > 0 ? (
        <div className="pilot-mini-metrics">
          <MetricCard accent="orange" label="Pack Likes" value={`${packLikes}`} />
          <MetricCard accent="blue" label="Pack Saves" value={`${packSaves}`} />
          <MetricCard accent="teal" label="Pack Concepts" value={`${packConcepts}`} />
        </div>
      ) : null}

      {profile.creatorPackCollection.length === 0 ? (
        <EmptyPanel
          description="Color packs appear here after this builder groups directions, kits, and finishes."
          title="No color packs yet."
        />
      ) : (
        <div className="pilot-pack-grid">
          {profile.creatorPackCollection.map((pack) => (
            <PilotCreatorPackCard
              interactive={interactive}
              key={pack._id}
              pack={pack}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PilotCreatorPackCard({
  interactive,
  pack,
}: {
  interactive: boolean;
  pack: PilotCreatorPack;
}) {
  const previewConcept = pack.previewConcept;

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
          {pack.isFeatured ? <Pill tone="orange">featured pack</Pill> : null}
        </div>
        <div>
          <a className="showcase-card__title is-small" href={`/creator-pack/${pack.slug}`}>
            {pack.name}
          </a>
          {pack.tagline ? <p className="showcase-card__lede">{pack.tagline}</p> : null}
          <p className="showcase-card__copy">
            {pack.description ??
              "A set of color directions, kits, and finishes to preview before you spray."}
          </p>
        </div>
        <dl className="showcase-meta">
          <MetaRow label="Styles" value={`${pack.stats.styleCount}`} />
          <MetaRow label="Materials" value={`${pack.stats.materialCount}`} />
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
        <div className="showcase-card__actions">
          <a className="showcase-button" href={`/creator-pack/${pack.slug}`}>
            Open Pack
          </a>
          {previewConcept ? (
            <a
              className="showcase-button is-warm"
              href={`/create?remix=${previewConcept._id}&creatorPack=${pack.slug}&creatorPackVariant=remix-seed`}
            >
              Remix Entry
            </a>
          ) : (
            <a className="showcase-button is-accent" href={`/create?creatorPack=${pack.slug}`}>
              Open In Create
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function ConceptSection({
  emptyDescription,
  emptyTitle,
  eyebrow,
  interactive,
  items,
  title,
}: {
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  interactive: boolean;
  items: PilotConceptCard[];
  title: string;
}) {
  return (
    <section className="pilot-panel">
      <div className="prototype-section-header">
        <div>
          <p className="showcase-kicker is-teal">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        <p>{items.length} concepts</p>
      </div>

      {items.length === 0 ? (
        <EmptyPanel description={emptyDescription} title={emptyTitle} />
      ) : (
        <div className="pilot-concept-grid">
          {items.map((concept) => (
            <PilotConceptCardView
              concept={concept}
              interactive={interactive}
              key={concept._id}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function PilotConceptCardView({
  concept,
  interactive,
}: {
  concept: PilotConceptCard;
  interactive: boolean;
}) {
  return (
    <article className="showcase-card pilot-concept-card">
      <div className="showcase-card__media">
        {concept.previewAsset?.publicUrl ? (
          <img src={concept.previewAsset.publicUrl} alt={concept.title} />
        ) : (
          <div className="showcase-card__placeholder">Preview unavailable</div>
        )}
      </div>
      <div className="showcase-card__body">
        <div className="showcase-pill-row">
          <Pill>{concept.weatheringLevel}</Pill>
          {concept.stylePreset?.category ? <Pill>{concept.stylePreset.category}</Pill> : null}
          {concept.stylePreset?.isFeaturedStyle ? (
            <Pill tone="orange">featured style</Pill>
          ) : null}
        </div>
        <div>
          <a className="showcase-card__title is-small" href={`/prototype/${concept._id}`}>
            {concept.title}
          </a>
          <p className="showcase-card__copy">
            {concept.baseModel?.name ?? "Unknown base model"} /{" "}
            {concept.stylePreset?.name ?? "Color direction pending"} /{" "}
            {concept.materialPreset?.name ?? "Unknown material profile"}
          </p>
        </div>
        <dl className="showcase-meta">
          <MetaRow
            label="Pilot"
            value={
              concept.owner?.handle ? (
                <a href={`/pilot/${concept.owner.handle}`}>@{concept.owner.handle}</a>
              ) : (
                concept.owner?.fullName ?? "Unknown"
              )
            }
          />
          <MetaRow label="Finish" value={concept.materialPreset?.finishType ?? "Unknown"} />
          <MetaRow label="Remixes" value={`${concept.remixCount}`} />
        </dl>
        <ConceptEngagementBar
          compact
          conceptId={concept._id}
          interactive={interactive}
          likeCount={concept.engagement.likeCount}
          saveCount={concept.engagement.saveCount}
          viewerHasLiked={concept.engagement.viewerHasLiked}
          viewerHasSaved={concept.engagement.viewerHasSaved}
        />
        <div className="showcase-card__actions">
          <a className="showcase-button" href={`/prototype/${concept._id}`}>
            Open Prototype
          </a>
          <a className="showcase-button is-warm" href={`/create?remix=${concept._id}`}>
            Remix
          </a>
        </div>
      </div>
    </article>
  );
}

function ActivityPanel({ profile }: { profile: PublicPilotProfile }) {
  return (
    <section className="pilot-panel">
      <p className="showcase-kicker">Recent activity</p>
      <div className="pilot-list-stack">
        {profile.activityFeed.length > 0 ? (
          profile.activityFeed.map((entry) => (
            <a
              className="pilot-activity-item"
              href={`/prototype/${entry.concept._id}`}
              key={`${entry.type}-${entry.concept._id}`}
            >
              <span>
                {entry.type === "published"
                  ? "Published concept"
                  : entry.type === "saved"
                    ? "Saved concept"
                    : "Liked concept"}
              </span>
              <strong>{entry.concept.title}</strong>
              <p>
                {entry.concept.baseModel?.name ?? "Unknown base model"} /{" "}
                {entry.concept.stylePreset?.name ?? "Color direction pending"}
              </p>
            </a>
          ))
        ) : (
          <p className="prototype-muted">
            Recent public activity will appear after this pilot starts publishing,
            saving, or liking concepts.
          </p>
        )}
      </div>
    </section>
  );
}

function RemixHistoryPanel({ profile }: { profile: PublicPilotProfile }) {
  return (
    <section className="pilot-panel">
      <p className="showcase-kicker is-orange">Remix history</p>
      <div className="pilot-list-stack">
        {profile.remixHistory.length > 0 ? (
          profile.remixHistory.map((entry) => (
            <article className="pilot-remix-item" key={entry.conceptId}>
              <a href={`/prototype/${entry.conceptId}`}>{entry.conceptTitle}</a>
              <p>
                {entry.remixCount} remix
                {entry.remixCount === 1 ? "" : "es"}
              </p>
              {entry.remixes.length > 0 ? (
                <div className="showcase-pill-row">
                  {entry.remixes.map((remix) => (
                    <a className="showcase-chip" href={`/prototype/${remix._id}`} key={remix._id}>
                      {remix.title}
                    </a>
                  ))}
                </div>
              ) : null}
            </article>
          ))
        ) : (
          <p className="prototype-muted">
            Remixes appear here after someone branches one of these paint plans.
          </p>
        )}
      </div>
    </section>
  );
}

function ProfileMetaPanel({ profile }: { profile: PublicPilotProfile }) {
  return (
    <section className="pilot-panel">
      <p className="showcase-kicker is-teal">Profile metadata</p>
      <dl className="showcase-meta prototype-meta-list">
        <MetaRow label="Handle" value={`@${profile.pilot.handle}`} />
        <MetaRow
          label="Verified"
          value={profile.pilot.isVerifiedCreator ? "Yes" : "No"}
        />
        <MetaRow
          label="Featured"
          value={profile.pilot.isFeaturedCreator ? "Yes" : "No"}
        />
        <MetaRow label="Styles" value={`${profile.styleCollection.length}`} />
        <MetaRow label="Packs" value={`${profile.creatorPackCollection.length}`} />
        <MetaRow label="Public concepts" value={`${profile.totals.publicConcepts}`} />
      </dl>
    </section>
  );
}

function MetricCard({
  accent,
  label,
  value,
}: {
  accent: "blue" | "neutral" | "orange" | "teal";
  label: string;
  value: string;
}) {
  return (
    <article className={`pilot-metric is-${accent}`}>
      <p>{label}</p>
      <strong>{value}</strong>
    </article>
  );
}

function EmptyPanel({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="pilot-empty-panel">
      <strong>{title}</strong>
      <p>{description}</p>
    </div>
  );
}

function MetaRow({
  label,
  value,
}: {
  label: string;
  value: PilotMetaRowValue;
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
  tone?: "blue" | "orange" | "teal";
}) {
  const className =
    tone === "teal"
      ? "showcase-pill is-teal"
      : tone === "blue"
        ? "showcase-pill is-blue"
        : tone === "orange"
          ? "showcase-pill is-warm"
          : "showcase-pill";

  return <span className={className}>{children}</span>;
}
