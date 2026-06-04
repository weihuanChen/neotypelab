"use client";
/* eslint-disable @next/next/no-img-element */

import { CreatorPackCard } from "@/components/public/CreatorPackCard";
import { PublicShareActions } from "@/components/public/PublicShareActions";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import Link from "next/link";

export function CreatorHubView({ handle }: { handle: string }) {
  const profile = useQuery(api.showcase.getPublicProfile, { handle });

  if (profile === undefined) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Creator Hub</p>
        <h1 className="mt-4 text-3xl font-semibold">Resolving creator hub telemetry</h1>
      </section>
    );
  }

  if (profile === null) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-8 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Unavailable</p>
        <h1 className="mt-4 text-3xl font-semibold">This creator hub is not available.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#9BA7B4]">
          The selected creator may not yet have enough public activity to support a hub surface.
        </p>
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
                className="h-20 w-20 rounded-full border border-white/10 object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-black/20 text-xl font-semibold">
                {profile.pilot.handle.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Creator Hub</p>
              <h1 className="mt-3 text-4xl font-semibold">{profile.pilot.fullName}</h1>
              <p className="mt-2 text-sm text-[#9BA7B4]">@{profile.pilot.handle}</p>
              {profile.pilot.creatorTagline ? (
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#C7D0DA]">{profile.pilot.creatorTagline}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {profile.pilot.isFeaturedCreator ? (
                  <span className="rounded-full border border-[#3DD9FF]/30 bg-[#3DD9FF]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8FEAFF]">
                    featured creator
                  </span>
                ) : null}
                {profile.pilot.isVerifiedCreator ? (
                  <span className="rounded-full border border-[#58FFB2]/30 bg-[#58FFB2]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#A6FFD5]">
                    verified creator
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
            <span>{profile.totals.publicConcepts} public concepts</span>
            <span>{profile.creatorPackCollection.length} creator packs</span>
            <span>{profile.styleCollection.length} creator styles</span>
          </div>
        </div>
        <PublicShareActions
          className="mt-5"
          title={`${profile.pilot.fullName} creator hub`}
          text={`${profile.totals.publicConcepts} concepts · ${profile.creatorPackCollection.length} packs · ${profile.styleCollection.length} styles`}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <HubMetric label="Concepts" value={`${profile.totals.publicConcepts}`} accent="text-[#58FFB2]" />
        <HubMetric label="Likes" value={`${profile.totals.likes}`} accent="text-[#FFB84D]" />
        <HubMetric label="Saves" value={`${profile.totals.saves}`} accent="text-[#3DD9FF]" />
        <HubMetric label="Remixes" value={`${profile.totals.remixes}`} accent="text-[#E6EDF3]" />
        <HubMetric
          label="Pack Saves"
          value={`${profile.creatorPackCollection.reduce((sum, pack) => sum + pack.engagement.saveCount, 0)}`}
          accent="text-[#8FEAFF]"
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)]">
        <div className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Creator Packs</p>
                <h2 className="mt-3 text-2xl font-semibold">Pack hub</h2>
              </div>
              <Link
                href={`/pilot/${profile.pilot.handle}`}
                className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/5"
              >
                Open Profile
              </Link>
            </div>
            {profile.creatorPackCollection.length === 0 ? (
              <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-5 text-sm leading-6 text-[#9BA7B4]">
                No creator packs are publicly available yet.
              </div>
            ) : (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {profile.creatorPackCollection.map((pack) => (
                  <CreatorPackCard key={pack._id} pack={pack} compact />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#FFB84D]">Creator Style DNA</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {profile.styleCollection.map((style) => (
                <article key={style._id} className="rounded-[24px] border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap gap-2">
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
                  <h3 className="mt-4 text-xl font-semibold">{style.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#9BA7B4]">
                    {style.shortDescription ?? "Creator-owned style surface."}
                  </p>
                  <div className="mt-4 grid gap-2 text-sm text-[#C7D0DA]">
                    <HubRow label="Creator concepts" value={`${style.creatorConceptCount}`} />
                    <HubRow label="Community concepts" value={`${style.communityConceptCount}`} />
                    <HubRow label="Lead base model" value={style.leadBaseModel.name} />
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Creator highlights</p>
            <div className="mt-4 space-y-3">
              {profile.published.slice(0, 4).map((concept) => (
                <div key={concept._id} className="rounded-[18px] border border-white/10 bg-black/20 p-4">
                  <Link href={`/prototype/${concept._id}`} className="text-sm font-semibold text-[#E6EDF3]">
                    {concept.title}
                  </Link>
                  <p className="mt-2 text-xs leading-5 text-[#9BA7B4]">
                    {concept.baseModel?.name ?? "Unknown base model"} · {concept.stylePreset?.name ?? "Unknown style"}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Hub notes</p>
            <p className="mt-4 text-sm leading-6 text-[#C7D0DA]">
              This landing surface pulls together creator identity, packs, styles, and public build output into one shareable hub.
            </p>
          </section>
        </aside>
      </section>
    </div>
  );
}

function HubMetric({
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

function HubRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">{label}</span>
      <span className="text-sm text-[#E6EDF3]">{value}</span>
    </div>
  );
}
