"use client";
/* eslint-disable @next/next/no-img-element */

import { ConceptEngagementBar } from "@/components/public/ConceptEngagementBar";
import { CreatorPackCard } from "@/components/public/CreatorPackCard";
import { PublicShareActions } from "@/components/public/PublicShareActions";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Link from "next/link";

type ProfileConceptCard = NonNullable<
  NonNullable<ReturnType<typeof useQuery<typeof api.showcase.getPublicProfile>>>["published"]
>[number];

export function PilotPublicView({ handle }: { handle: string }) {
  const profile = useQuery(api.showcase.getPublicProfile, { handle });

  if (profile === undefined) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Pilot Surface</p>
        <h1 className="mt-4 text-3xl font-semibold">Resolving pilot telemetry</h1>
      </section>
    );
  }

  if (profile === null) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-8 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Unavailable</p>
        <h1 className="mt-4 text-3xl font-semibold">This pilot profile is not available.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9BA7B4]">
          The handle may be missing or not yet connected to a public prototype surface.
        </p>
        <Link
          href="/showcase"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-[18px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
        >
          Back to Showcase
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-6 text-[#E6EDF3]">
      <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {profile.pilot.pictureUrl ? (
              <img
                src={profile.pilot.pictureUrl}
                alt={profile.pilot.fullName}
                className="h-16 w-16 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-black/20 text-lg font-semibold">
                {profile.pilot.handle.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Public Pilot Profile</p>
              <h1 className="mt-3 text-3xl font-semibold">{profile.pilot.fullName}</h1>
              <p className="mt-2 text-sm text-[#9BA7B4]">@{profile.pilot.handle}</p>
              {profile.pilot.creatorTagline ? (
                <p className="mt-3 text-sm leading-6 text-[#C7D0DA]">{profile.pilot.creatorTagline}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.pilot.isVerifiedCreator ? (
                  <span className="rounded-full border border-[#58FFB2]/30 bg-[#58FFB2]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#A6FFD5]">
                    verified creator
                  </span>
                ) : null}
                {profile.pilot.isFeaturedCreator ? (
                  <span className="rounded-full border border-[#3DD9FF]/30 bg-[#3DD9FF]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8FEAFF]">
                    featured creator
                  </span>
                ) : null}
                {profile.pilot.creatorSpecialties.map((specialty) => (
                  <span
                    key={specialty}
                    className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="grid gap-2 text-right text-sm text-[#9BA7B4]">
            <span>{profile.totals.publicConcepts} published concepts</span>
            <span>{profile.totals.saves} saves received</span>
            <span>{profile.totals.remixes} remix branches launched</span>
          </div>
        </div>
        <PublicShareActions
          className="mt-5"
          title={`${profile.pilot.fullName} (@${profile.pilot.handle})`}
          text={`${profile.totals.publicConcepts} public concepts · ${profile.totals.remixes} remix branches`}
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/creator/${profile.pilot.handle}`}
            className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#58FFB2]/35 bg-[#13241B] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
          >
            Open Creator Hub
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Published" value={`${profile.totals.publicConcepts}`} accent="text-[#58FFB2]" />
        <MetricCard label="Likes" value={`${profile.totals.likes}`} accent="text-[#FFB84D]" />
        <MetricCard label="Saves" value={`${profile.totals.saves}`} accent="text-[#3DD9FF]" />
        <MetricCard label="Remixes" value={`${profile.totals.remixes}`} accent="text-[#E6EDF3]" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Creator style collection</p>
            <h2 className="mt-3 text-2xl font-semibold">Owned Style DNA</h2>
            {profile.styleCollection.length === 0 ? (
              <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-[#E6EDF3]">No owned Style DNA yet.</p>
                <p className="mt-2 text-sm leading-6 text-[#9BA7B4]">
                  Style presets assigned to this creator will appear here once they are linked in the admin catalog.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {profile.styleCollection.map((style) => (
                  <article
                    key={style._id}
                    className="rounded-[24px] border border-white/10 bg-black/20 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      {style.category ? (
                        <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
                          {style.category}
                        </span>
                      ) : null}
                      {style.isFeaturedStyle ? (
                        <span className="rounded-full border border-[#FFB84D]/30 bg-[#FFB84D]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#FFD9A0]">
                          featured style
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-[#E6EDF3]">{style.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#9BA7B4]">
                      {style.shortDescription ??
                        "Creator-linked Style DNA collection for remix, discovery, and landing page exploration."}
                    </p>
                    <div className="mt-4 grid gap-2 text-sm text-[#C7D0DA]">
                      <MetaRow label="Creator concepts" value={`${style.creatorConceptCount}`} />
                      <MetaRow label="Community concepts" value={`${style.communityConceptCount}`} />
                      <MetaRow
                        label="Lead base model"
                        value={style.leadBaseModel.name}
                      />
                    </div>
                    {style.hasLeadBaseModel ? (
                      <div className="mt-4 flex flex-wrap gap-3">
                        <Link
                          href={`/${style.leadBaseModel.slug}/${style.slug}`}
                          className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
                        >
                          Open Landing
                        </Link>
                        <Link
                          href={`/showcase?style=${style.slug}`}
                          className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
                        >
                          Filter Showcase
                        </Link>
                      </div>
                    ) : (
                      <Link
                        href={`/showcase?style=${style.slug}`}
                        className="mt-4 inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
                      >
                        Filter Showcase
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Creator packs</p>
            <h2 className="mt-3 text-2xl font-semibold">Packaged starter sets</h2>
            {profile.creatorPackCollection.length > 0 ? (
              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <MetricCard
                  label="Pack Likes"
                  value={`${profile.creatorPackCollection.reduce((sum, pack) => sum + pack.engagement.likeCount, 0)}`}
                  accent="text-[#FFB84D]"
                />
                <MetricCard
                  label="Pack Saves"
                  value={`${profile.creatorPackCollection.reduce((sum, pack) => sum + pack.engagement.saveCount, 0)}`}
                  accent="text-[#3DD9FF]"
                />
                <MetricCard
                  label="Pack Concepts"
                  value={`${profile.creatorPackCollection.reduce((sum, pack) => sum + pack.stats.publicConceptCount, 0)}`}
                  accent="text-[#58FFB2]"
                />
              </div>
            ) : null}
            {profile.creatorPackCollection.length === 0 ? (
              <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-[#E6EDF3]">No creator packs published yet.</p>
                <p className="mt-2 text-sm leading-6 text-[#9BA7B4]">
                  Creator packs will appear here once this pilot bundles Style DNA, base models, and materials into reusable sets.
                </p>
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {profile.creatorPackCollection.map((pack) => (
                  <CreatorPackCard key={pack._id} pack={pack} compact />
                ))}
              </div>
            )}
          </section>

          <ProfileSection
            title="Published concepts"
            eyebrow="Public Launches"
            emptyTitle="No public concepts yet."
            emptyDescription="This pilot has not moved a generated concept onto a public showcase surface yet."
            items={profile.published}
          />

          <ProfileSection
            title="Saved builds"
            eyebrow="Saved Surfaces"
            emptyTitle="No saved public builds yet."
            emptyDescription="Saved concepts will appear here once this pilot bookmarks public showcase entries."
            items={profile.saved}
          />

          <ProfileSection
            title="Liked concepts"
            eyebrow="Liked Surfaces"
            emptyTitle="No liked public concepts yet."
            emptyDescription="Liked concepts will appear here once this pilot signals interest on public surfaces."
            items={profile.liked}
          />
        </div>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Recent activity</p>
            <div className="mt-4 space-y-3">
              {profile.activityFeed.length > 0 ? (
                profile.activityFeed.map((entry) => (
                  <div key={`${entry.type}-${entry.concept._id}`} className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">
                      {entry.type === "published"
                        ? "Published concept"
                        : entry.type === "saved"
                          ? "Saved concept"
                          : "Liked concept"}
                    </p>
                    <Link href={`/prototype/${entry.concept._id}`} className="mt-2 block text-sm font-semibold text-[#E6EDF3]">
                      {entry.concept.title}
                    </Link>
                    <p className="mt-2 text-xs leading-5 text-[#9BA7B4]">
                      {entry.concept.baseModel?.name ?? "Unknown base model"} ·{" "}
                      {entry.concept.stylePreset?.name ?? "Unknown Style DNA"}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#9BA7B4]">
                  Recent public activity will appear once this pilot starts publishing, saving, or liking concepts.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Remix history</p>
            <div className="mt-4 space-y-3">
              {profile.remixHistory.length > 0 ? (
                profile.remixHistory.map((entry) => (
                    <div key={entry.conceptId} className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                      <Link href={`/prototype/${entry.conceptId}`} className="text-sm font-semibold text-[#E6EDF3]">
                        {entry.conceptTitle}
                      </Link>
                      <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[#9BA7B4]">
                        {entry.remixCount} remix branch{entry.remixCount === 1 ? "" : "es"}
                      </p>
                      {entry.remixes.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                        {entry.remixes.map((remix) => (
                          <Link
                            key={remix._id}
                            href={`/prototype/${remix._id}`}
                            className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-[#9BA7B4] transition-colors hover:border-white/20 hover:text-[#E6EDF3]"
                          >
                            {remix.title}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs leading-5 text-[#6E7A88]">
                      Use this surface to trace where this pilot&apos;s concepts are spawning new public branches.
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-6 text-[#9BA7B4]">
                  Remix history will appear once this pilot&apos;s public concepts start branching.
                </p>
              )}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Profile note</p>
            <p className="mt-4 text-sm leading-6 text-[#C7D0DA]">
              This first public profile surface only exposes public concepts and saved public builds.
              Unlisted share links remain excluded from profile listings.
            </p>
          </section>
        </aside>
      </section>
    </div>
  );
}

function MetricCard({
  accent,
  label,
  value,
}: {
  accent: string;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[24px] border border-white/10 bg-[#161B22] p-5">
      <p className={`text-xs uppercase tracking-[0.24em] ${accent}`}>{label}</p>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function ProfileSection({
  emptyDescription,
  emptyTitle,
  eyebrow,
  items,
  title,
}: {
  emptyDescription: string;
  emptyTitle: string;
  eyebrow: string;
  items: ProfileConceptCard[];
  title: string;
}) {
  return (
    <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
      <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">{eyebrow}</p>
      <h2 className="mt-3 text-2xl font-semibold">{title}</h2>
      {items.length === 0 ? (
        <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-5">
          <p className="text-sm font-semibold text-[#E6EDF3]">{emptyTitle}</p>
          <p className="mt-2 text-sm leading-6 text-[#9BA7B4]">{emptyDescription}</p>
        </div>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {items.map((concept) => (
            <article key={concept._id} className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
              <div className="aspect-[4/3] bg-[#0D1117]">
                {concept.previewAsset?.publicUrl ? (
                  <img
                    src={concept.previewAsset.publicUrl}
                    alt={concept.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-end p-5">
                    <p className="text-sm text-[#9BA7B4]">Preview unavailable</p>
                  </div>
                )}
              </div>
              <div className="space-y-4 p-5">
                <div>
                  <Link href={`/prototype/${concept._id}`} className="text-xl font-semibold text-[#E6EDF3]">
                    {concept.title}
                  </Link>
                  <p className="mt-2 text-sm leading-6 text-[#9BA7B4]">
                    {concept.baseModel?.name ?? "Unknown base model"} ·{" "}
                    {concept.stylePreset?.name ?? "Unknown Style DNA"} ·{" "}
                    {concept.materialPreset?.name ?? "Unknown material profile"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {concept.stylePreset?.category ? (
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
                        {concept.stylePreset.category}
                      </span>
                    ) : null}
                    {concept.stylePreset?.isFeaturedStyle ? (
                      <span className="rounded-full border border-[#FFB84D]/30 bg-[#FFB84D]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#FFD9A0]">
                        featured style
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-2 text-sm text-[#C7D0DA]">
                  <MetaRow label="Pilot" value={concept.owner?.handle ?? concept.owner?.fullName ?? "Unknown"} />
                  <MetaRow label="Weathering" value={concept.weatheringLevel} />
                  <MetaRow label="Remixes" value={`${concept.remixCount}`} />
                </div>
                <ConceptEngagementBar
                  conceptId={concept._id}
                  likeCount={concept.engagement.likeCount}
                  saveCount={concept.engagement.saveCount}
                  viewerHasLiked={concept.engagement.viewerHasLiked}
                  viewerHasSaved={concept.engagement.viewerHasSaved}
                  compact
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">{label}</span>
      <span className="max-w-[58%] text-right text-sm text-[#E6EDF3]">{value}</span>
    </div>
  );
}
