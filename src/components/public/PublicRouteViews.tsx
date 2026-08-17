import { ConceptEngagementBar, PackEngagementBar } from "@/src/components/showcase/EngagementBars";
import { PublicShareActions } from "./PublicShareActions";
import type {
  CreatorHubData,
  CreatorPackData,
  SeoLandingData,
} from "./types";

export function PublicUnavailable({
  message,
  title,
}: {
  message?: string;
  title: string;
}) {
  return (
    <section className="public-empty">
      <p className="showcase-kicker is-orange">Unavailable</p>
      <h1>{title}</h1>
      <p>
        {message ??
          "This public surface is not available in the current deployment."}
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

export function SeoLandingView({ landing }: { landing: SeoLandingData }) {
  const featured = landing.featuredConcept;

  return (
    <div className="public-stack">
      <section className="public-hero">
        <div className="public-hero__copy">
          <div className="showcase-pill-row">
            <Pill>{landing.baseModel.grade ?? "unknown grade"}</Pill>
            <Pill>{landing.stylePreset.category ?? "uncategorized"}</Pill>
            {landing.stylePreset.isFeaturedStyle ? (
              <Pill tone="warm">featured style</Pill>
            ) : null}
          </div>
          <p className="showcase-kicker">Style Landing Surface</p>
          <h1>
            {landing.baseModel.name} in {landing.stylePreset.name}
          </h1>
          <p className="public-lede">
            {landing.stylePreset.shortDescription ??
              "Public concept references, paint mapping cues, and remix-ready surfaces for this base model and Style DNA pairing."}
          </p>
          <div className="public-metrics">
            <Metric label="Concepts" value={`${landing.conceptCount}`} tone="teal" />
            <Metric label="Likes" value={`${landing.aggregate.likes}`} tone="orange" />
            <Metric label="Saves" value={`${landing.aggregate.saves}`} tone="blue" />
            <Metric label="Remixes" value={`${landing.aggregate.remixes}`} />
          </div>
          <div className="prototype-action-row">
            <a className="showcase-button is-warm" href={`/create?recommendedBaseModel=${landing.baseModel.slug}&recommendedStyle=${landing.stylePreset.slug}`}>
              Launch Create
            </a>
            <a className="showcase-button is-ghost" href="/showcase">
              Browse Showcase
            </a>
          </div>
          <PublicShareActions
            className="prototype-action-row"
            exportImageLabel="Landing Image"
            exportImageUrl={`/${landing.baseModel.slug}/${landing.stylePreset.slug}/opengraph-image`}
            sharePath={`/${landing.baseModel.slug}/${landing.stylePreset.slug}`}
            text={
              landing.stylePreset.shortDescription ??
              `${landing.baseModel.name} in ${landing.stylePreset.name}`
            }
            title={`${landing.baseModel.name} in ${landing.stylePreset.name}`}
          />
        </div>
        <PreviewMedia
          alt={featured.title}
          className="public-hero__media"
          src={featured.previewAsset?.publicUrl}
        />
      </section>

      <div className="public-content-grid">
        <main className="public-main-column">
          <section className="public-panel">
            <SectionHeader
              kicker="Featured Public Concept"
              title={featured.title}
              note={`${featured.engagement.likeCount} likes / ${featured.engagement.saveCount} saves`}
            />
            <PublicConceptFeature concept={featured} />
          </section>

          <section className="public-panel">
            <SectionHeader
              kicker="Public Concept References"
              title={`${landing.concepts.length} concept surfaces`}
              note="Shared build references for this pairing."
            />
            <div className="public-card-grid">
              {landing.concepts.map((concept) => (
                <PublicConceptCard concept={concept} key={concept._id} />
              ))}
            </div>
          </section>
        </main>

        <aside className="public-side-column">
          <section className="public-panel">
            <p className="showcase-kicker is-orange">Style DNA Overview</p>
            <dl className="showcase-meta prototype-meta-list">
              <MetaRow label="Base model" value={landing.baseModel.name} />
              <MetaRow label="Series" value={landing.baseModel.series ?? "Unknown"} />
              <MetaRow label="Grade" value={landing.baseModel.grade ?? "Unknown"} />
              <MetaRow label="Style DNA" value={landing.stylePreset.name} />
              <MetaRow label="Category" value={landing.stylePreset.category ?? "Unknown"} />
              <MetaRow label="Contrast" value={landing.stylePreset.contrastLevel ?? "Unknown"} />
              <MetaRow label="Weathering" value={landing.stylePreset.weatheringProfile ?? "Unknown"} />
            </dl>
          </section>

          {landing.paintPlan ? (
            <section className="public-panel">
              <p className="showcase-kicker is-teal">Paint Mapping Cues</p>
              <div className="public-mini-list">
                {landing.paintPlan.entries.slice(0, 5).map((entry) => (
                  <div className="public-mini-row" key={entry.roleSlug}>
                    <strong>{entry.roleName}</strong>
                    <span>
                      {entry.suggestedPaint
                        ? `${entry.suggestedPaint.brand} ${entry.suggestedPaint.colorName}`
                        : "No active paint mapping"}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="public-panel">
            <p className="showcase-kicker">SEO Keywords</p>
            <div className="showcase-pill-row">
              {landing.stylePreset.seoKeywords.map((keyword) => (
                <Pill key={keyword}>{keyword}</Pill>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

export function CreatorPackView({ pack }: { pack: CreatorPackData }) {
  return (
    <div className="public-stack">
      <section className="public-hero public-hero--pack">
        <div className="public-hero__copy">
          <div className="showcase-pill-row">
            <Pill>{`${pack.packType} pack`}</Pill>
            {pack.isFeatured ? <Pill tone="warm">featured pack</Pill> : null}
            <Pill>{`${pack.styles.length} styles`}</Pill>
            <Pill>{`${pack.materials.length} materials`}</Pill>
          </div>
          <p className="showcase-kicker">Creator Pack</p>
          <h1>{pack.name}</h1>
          {pack.tagline ? <p className="public-lede">{pack.tagline}</p> : null}
          <p className="public-muted">
            {pack.description ??
              "Curated starter set built from creator-owned Style DNA, supported base models, and material presets."}
          </p>
          <PackEngagementBar
            compact
            creatorPackId={pack._id}
            interactive={false}
            likeCount={pack.engagement.likeCount}
            saveCount={pack.engagement.saveCount}
            viewerHasLiked={pack.engagement.viewerHasLiked}
            viewerHasSaved={pack.engagement.viewerHasSaved}
          />
          <div className="prototype-action-row">
            <a className="showcase-button is-warm" href={buildCreateHref(pack)}>
              Launch Pack
            </a>
            <a className="showcase-button is-accent" href={`/creator/${pack.creator.handle}`}>
              Creator Hub
            </a>
            <a className="showcase-button is-ghost" href={`/pilot/${pack.creator.handle}`}>
              Pilot Profile
            </a>
          </div>
          <PublicShareActions
            className="prototype-action-row"
            exportImageLabel="Pack Image"
            exportImageUrl={`/creator-pack/${pack.slug}/opengraph-image`}
            sharePath={`/creator-pack/${pack.slug}`}
            text={
              pack.tagline ??
              pack.description ??
              `${pack.name} creator pack by ${pack.creator.fullName}`
            }
            title={`${pack.name} | NeotypeLab`}
          />
        </div>
        <PreviewMedia
          alt={pack.name}
          className="public-hero__media"
          src={pack.concepts[0]?.previewAsset?.publicUrl ?? pack.creator.pictureUrl}
        />
      </section>

      <section className="public-metrics public-metrics--wide">
        <Metric label="Styles" value={`${pack.styles.length}`} tone="teal" />
        <Metric label="Concepts" value={`${pack.analytics.publicConceptCount}`} tone="blue" />
        <Metric label="Likes" value={`${pack.analytics.publicLikeCount}`} tone="orange" />
        <Metric label="Saves" value={`${pack.analytics.publicSaveCount}`} />
        <Metric label="Remixes" value={`${pack.analytics.publicRemixCount}`} tone="teal" />
      </section>

      <div className="public-content-grid">
        <main className="public-main-column">
          <section className="public-panel">
            <SectionHeader
              kicker="Pack Style DNA"
              title="Creator style collection"
              note={`${pack.analytics.featuredStyleCount} featured styles`}
            />
            <div className="public-card-grid">
              {pack.styles.map((style) => (
                <article className="public-text-card" key={style._id}>
                  <div className="showcase-pill-row">
                    {style.category ? <Pill>{style.category}</Pill> : null}
                    {style.isFeaturedStyle ? <Pill tone="warm">featured style</Pill> : null}
                  </div>
                  <h3>{style.name}</h3>
                  <p>{style.shortDescription ?? "Creator-linked style preset in this pack."}</p>
                  <a className="showcase-button is-ghost" href={`/showcase?style=${style.slug}`}>
                    Filter Showcase
                  </a>
                </article>
              ))}
            </div>
          </section>

          <section className="public-panel">
            <SectionHeader
              kicker="Related Public Concepts"
              title={`${pack.concepts.length} attached concepts`}
              note="Prototype references linked to this pack."
            />
            {pack.concepts.length === 0 ? (
              <EmptyInset copy="No public concepts are currently attached to this pack." />
            ) : (
              <div className="public-card-grid">
                {pack.concepts.map((concept) => (
                  <PublicConceptCard
                    concept={concept}
                    key={concept._id}
                    remixHref={`/create?remix=${concept._id}&creatorPack=${pack.slug}&creatorPackVariant=remix-seed`}
                  />
                ))}
              </div>
            )}
          </section>
        </main>

        <aside className="public-side-column">
          <section className="public-panel">
            <p className="showcase-kicker">Creator</p>
            <div className="public-creator-row">
              <Avatar
                alt={pack.creator.fullName}
                fallback={pack.creator.handle.slice(0, 2)}
                src={pack.creator.pictureUrl}
              />
              <div>
                <h3>{pack.creator.fullName}</h3>
                <a href={`/creator/${pack.creator.handle}`}>@{pack.creator.handle}</a>
              </div>
            </div>
          </section>

          <CollectionPanel
            items={pack.baseModels.map((model) => ({
              id: model._id,
              title: model.name,
              copy: `${model.series ?? "Unknown series"} / ${model.grade ?? "Unknown grade"}`,
            }))}
            kicker="Supported Base Models"
          />
          <CollectionPanel
            items={pack.materials.map((material) => ({
              id: material._id,
              title: material.name,
              copy: material.finishType,
            }))}
            kicker="Recommended Materials"
          />
        </aside>
      </div>
    </div>
  );
}

export function CreatorHubView({ profile }: { profile: CreatorHubData }) {
  const packSaveCount = profile.creatorPackCollection.reduce(
    (sum, pack) => sum + pack.engagement.saveCount,
    0
  );

  return (
    <div className="public-stack">
      <section className="public-hero public-hero--hub">
        <div className="public-hero__copy">
          <div className="public-identity">
            <Avatar
              alt={profile.pilot.fullName}
              fallback={profile.pilot.handle.slice(0, 2)}
              src={profile.pilot.pictureUrl}
            />
            <div>
              <div className="showcase-pill-row">
                {profile.pilot.isVerifiedCreator ? <Pill tone="teal">verified creator</Pill> : null}
                {profile.pilot.isFeaturedCreator ? <Pill tone="blue">featured creator</Pill> : null}
                {profile.pilot.creatorSpecialties.map((specialty) => (
                  <Pill key={specialty}>{specialty}</Pill>
                ))}
              </div>
              <p className="showcase-kicker">Creator Hub</p>
              <h1>{profile.pilot.fullName}</h1>
              <p className="public-handle">@{profile.pilot.handle}</p>
            </div>
          </div>
          <p className="public-lede">
            {profile.pilot.creatorTagline ??
              `${profile.totals.publicConcepts} public concepts / ${profile.creatorPackCollection.length} creator packs / ${profile.styleCollection.length} creator styles`}
          </p>
          <div className="prototype-action-row">
            <a className="showcase-button is-accent" href={`/pilot/${profile.pilot.handle}`}>
              Pilot Profile
            </a>
            <a className="showcase-button is-ghost" href={`/showcase?creator=${profile.pilot.handle}`}>
              Filter Showcase
            </a>
          </div>
          <PublicShareActions
            className="prototype-action-row"
            exportImageLabel="Hub Image"
            exportImageUrl={`/creator/${profile.pilot.handle}/opengraph-image`}
            sharePath={`/creator/${profile.pilot.handle}`}
            text={
              profile.pilot.creatorTagline ??
              `${profile.totals.publicConcepts} public concepts from ${profile.pilot.fullName}`
            }
            title={`${profile.pilot.fullName} Creator Hub | NeotypeLab`}
          />
        </div>
        <div className="public-hero__stats">
          <Metric label="Concepts" value={`${profile.totals.publicConcepts}`} tone="teal" />
          <Metric label="Likes" value={`${profile.totals.likes}`} tone="orange" />
          <Metric label="Saves" value={`${profile.totals.saves}`} tone="blue" />
          <Metric label="Pack Saves" value={`${packSaveCount}`} />
        </div>
      </section>

      <div className="public-content-grid public-content-grid--balanced">
        <main className="public-main-column">
          <section className="public-panel">
            <SectionHeader
              kicker="Creator Packs"
              title="Pack hub"
              note={`${profile.creatorPackCollection.length} public packs`}
            />
            {profile.creatorPackCollection.length === 0 ? (
              <EmptyInset copy="No creator packs are publicly available yet." />
            ) : (
              <div className="public-card-grid">
                {profile.creatorPackCollection.map((pack) => (
                  <article className="public-text-card" key={pack._id}>
                    <div className="showcase-pill-row">
                      <Pill>{`${pack.packType} pack`}</Pill>
                      {pack.isFeatured ? <Pill tone="warm">featured</Pill> : null}
                    </div>
                    <h3>{pack.name}</h3>
                    <p>
                      {pack.description ??
                        "Creator starter pack for Style DNA, base models, and material presets."}
                    </p>
                    <PackEngagementBar
                      compact
                      creatorPackId={pack._id}
                      interactive={false}
                      likeCount={pack.engagement.likeCount}
                      saveCount={pack.engagement.saveCount}
                      viewerHasLiked={pack.engagement.viewerHasLiked}
                      viewerHasSaved={pack.engagement.viewerHasSaved}
                    />
                    <a className="showcase-button" href={`/creator-pack/${pack.slug}`}>
                      Open Pack
                    </a>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="public-panel">
            <SectionHeader
              kicker="Creator Style DNA"
              title={`${profile.styleCollection.length} style surfaces`}
              note="Creator-owned style presets."
            />
            <div className="public-card-grid">
              {profile.styleCollection.map((style) => (
                <article className="public-text-card" key={style._id}>
                  <div className="showcase-pill-row">
                    {style.category ? <Pill>{style.category}</Pill> : null}
                    {style.isFeaturedStyle ? <Pill tone="warm">featured</Pill> : null}
                  </div>
                  <h3>{style.name}</h3>
                  <p>{style.shortDescription ?? "Creator-owned style surface."}</p>
                  <dl className="showcase-meta prototype-meta-list">
                    <MetaRow label="Creator concepts" value={`${style.creatorConceptCount}`} />
                    <MetaRow label="Community concepts" value={`${style.communityConceptCount}`} />
                    <MetaRow label="Lead model" value={style.leadBaseModel.name} />
                  </dl>
                </article>
              ))}
            </div>
          </section>
        </main>

        <aside className="public-side-column">
          <section className="public-panel">
            <p className="showcase-kicker is-teal">Creator Highlights</p>
            <div className="public-mini-list">
              {profile.published.slice(0, 5).map((concept) => (
                <a className="public-mini-row" href={`/prototype/${concept._id}`} key={concept._id}>
                  <strong>{concept.title}</strong>
                  <span>
                    {concept.baseModel?.name ?? "Unknown base model"} /{" "}
                    {concept.stylePreset?.name ?? "Unknown style"}
                  </span>
                </a>
              ))}
            </div>
          </section>

          <section className="public-panel">
            <p className="showcase-kicker">Hub Metrics</p>
            <dl className="showcase-meta prototype-meta-list">
              <MetaRow label="Public concepts" value={`${profile.totals.publicConcepts}`} />
              <MetaRow label="Creator packs" value={`${profile.creatorPackCollection.length}`} />
              <MetaRow label="Creator styles" value={`${profile.styleCollection.length}`} />
              <MetaRow label="Remix branches" value={`${profile.totals.remixes}`} />
            </dl>
          </section>
        </aside>
      </div>
    </div>
  );
}

type LandingConcept = SeoLandingData["concepts"][number];

function PublicConceptFeature({ concept }: { concept: LandingConcept }) {
  return (
    <article className="public-feature">
      <PreviewMedia
        alt={concept.title}
        className="public-feature__media"
        src={concept.previewAsset?.publicUrl}
      />
      <div className="public-feature__body">
        <a className="showcase-card__title" href={`/prototype/${concept._id}`}>
          {concept.title}
        </a>
        <p className="public-muted">
          {concept.materialPreset?.name ?? "Unknown material profile"} /{" "}
          {concept.weatheringLevel}
        </p>
        {concept.owner ? (
          <a className="public-inline-link" href={`/pilot/${concept.owner.handle}`}>
            @{concept.owner.handle}
          </a>
        ) : null}
        <ConceptEngagementBar
          compact
          conceptId={concept._id}
          interactive={false}
          likeCount={concept.engagement.likeCount}
          saveCount={concept.engagement.saveCount}
          viewerHasLiked={concept.engagement.viewerHasLiked}
          viewerHasSaved={concept.engagement.viewerHasSaved}
        />
      </div>
    </article>
  );
}

function PublicConceptCard({
  concept,
  remixHref,
}: {
  concept: LandingConcept;
  remixHref?: string;
}) {
  const landingHref =
    concept.baseModel?.slug && concept.stylePreset?.slug
      ? `/${concept.baseModel.slug}/${concept.stylePreset.slug}`
      : null;

  return (
    <article className="public-card">
      <PreviewMedia
        alt={concept.title}
        className="public-card__media"
        src={concept.previewAsset?.publicUrl}
      />
      <div className="public-card__body">
        <a className="showcase-card__title is-small" href={`/prototype/${concept._id}`}>
          {concept.title}
        </a>
        <p>
          {concept.baseModel?.name ?? "Unknown base model"} /{" "}
          {concept.stylePreset?.name ?? "Unknown Style DNA"}
        </p>
        <ConceptEngagementBar
          compact
          conceptId={concept._id}
          interactive={false}
          likeCount={concept.engagement.likeCount}
          saveCount={concept.engagement.saveCount}
          viewerHasLiked={concept.engagement.viewerHasLiked}
          viewerHasSaved={concept.engagement.viewerHasSaved}
        />
        <div className="showcase-card__actions">
          {remixHref ? (
            <a className="showcase-button is-warm" href={remixHref}>
              Remix
            </a>
          ) : (
            <a className="showcase-button is-warm" href={`/create?remix=${concept._id}`}>
              Remix
            </a>
          )}
          {landingHref ? (
            <a className="showcase-button is-ghost" href={landingHref}>
              Landing
            </a>
          ) : (
            <a className="showcase-button is-ghost" href="/showcase">
              Showcase
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function PreviewMedia({
  alt,
  className,
  src,
}: {
  alt: string;
  className: string;
  src?: string;
}) {
  return (
    <div className={className}>
      {src ? (
        <img src={src} alt={alt} />
      ) : (
        <div className="public-placeholder">
          <span>Preview unavailable</span>
        </div>
      )}
    </div>
  );
}

function Avatar({
  alt,
  fallback,
  src,
}: {
  alt: string;
  fallback: string;
  src?: string;
}) {
  if (src) {
    return <img className="public-avatar" src={src} alt={alt} />;
  }

  return <div className="public-avatar public-avatar--fallback">{fallback.toUpperCase()}</div>;
}

function CollectionPanel({
  items,
  kicker,
}: {
  items: Array<{ id: string; title: string; copy: string }>;
  kicker: string;
}) {
  return (
    <section className="public-panel">
      <p className="showcase-kicker">{kicker}</p>
      <div className="public-mini-list">
        {items.map((item) => (
          <div className="public-mini-row" key={item.id}>
            <strong>{item.title}</strong>
            <span>{item.copy}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({
  kicker,
  note,
  title,
}: {
  kicker: string;
  note: string;
  title: string;
}) {
  return (
    <div className="prototype-section-header">
      <div>
        <p className="showcase-kicker is-teal">{kicker}</p>
        <h2>{title}</h2>
      </div>
      <p>{note}</p>
    </div>
  );
}

function EmptyInset({ copy }: { copy: string }) {
  return (
    <div className="public-empty-inset">
      <p>{copy}</p>
    </div>
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
    <div className={tone ? `public-metric is-${tone}` : "public-metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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
  tone?: "blue" | "teal" | "warm";
}) {
  const className =
    tone === "blue"
      ? "showcase-pill is-blue"
      : tone === "teal"
        ? "showcase-pill is-teal"
        : tone === "warm"
          ? "showcase-pill is-warm"
          : "showcase-pill";

  return <span className={className}>{children}</span>;
}

function buildCreateHref(pack: CreatorPackData) {
  const params = new URLSearchParams();

  if (pack.baseModels[0]?.slug) {
    params.set("recommendedBaseModel", pack.baseModels[0].slug);
  }
  if (pack.styles[0]?.slug) {
    params.set("recommendedStyle", pack.styles[0].slug);
  }
  if (pack.materials[0]?.slug) {
    params.set("recommendedMaterial", pack.materials[0].slug);
  }
  params.set("creatorPack", pack.slug);
  params.set("creatorPackVariant", "baseline");

  return `/create?${params.toString()}`;
}
