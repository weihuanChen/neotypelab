"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";

type CreatorRankingCardProps = {
  creator: {
    _id: string;
    handle: string;
    fullName: string;
    pictureUrl?: string;
    isVerifiedCreator: boolean;
    isFeaturedCreator: boolean;
    creatorTagline?: string;
    creatorSpecialties: string[];
    totals: {
      publicConcepts: number;
      likes: number;
      saves: number;
      remixes: number;
    };
    leadConcept: {
      title: string;
      previewAsset: {
        publicUrl?: string;
        thumbnailUrl?: string;
      } | null;
    } | null;
  };
};

export function CreatorRankingCard({ creator }: CreatorRankingCardProps) {
  return (
    <article className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
      <div className="aspect-[4/3] bg-[#0D1117]">
        {creator.leadConcept?.previewAsset?.thumbnailUrl ?? creator.leadConcept?.previewAsset?.publicUrl ? (
          <img
            src={creator.leadConcept.previewAsset.thumbnailUrl ?? creator.leadConcept.previewAsset.publicUrl}
            alt={creator.leadConcept.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-end p-5">
            <p className="text-sm text-[#9BA7B4]">Creator preview unavailable</p>
          </div>
        )}
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-center gap-3">
          {creator.pictureUrl ? (
            <img
              src={creator.pictureUrl}
              alt={creator.fullName}
              className="h-12 w-12 rounded-full border border-white/10 object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-black/20 text-sm font-semibold text-[#E6EDF3]">
              {creator.handle.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <Link href={`/pilot/${creator.handle}`} className="text-lg font-semibold text-[#E6EDF3]">
              {creator.fullName}
            </Link>
            <p className="text-sm text-[#9BA7B4]">@{creator.handle}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {creator.isFeaturedCreator ? (
            <span className="rounded-full border border-[#3DD9FF]/30 bg-[#3DD9FF]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8FEAFF]">
              featured creator
            </span>
          ) : null}
          {creator.isVerifiedCreator ? (
            <span className="rounded-full border border-[#58FFB2]/30 bg-[#58FFB2]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#A6FFD5]">
              verified creator
            </span>
          ) : null}
        </div>
        {creator.creatorTagline ? (
          <p className="text-sm leading-6 text-[#C7D0DA]">{creator.creatorTagline}</p>
        ) : null}
        <div className="grid gap-2 text-sm text-[#C7D0DA]">
          <MetaRow label="Concepts" value={`${creator.totals.publicConcepts}`} />
          <MetaRow label="Saves" value={`${creator.totals.saves}`} />
          <MetaRow label="Remixes" value={`${creator.totals.remixes}`} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/creator/${creator.handle}`}
            className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
          >
            Open Hub
          </Link>
          <Link
            href={`/showcase?creator=${creator.handle}`}
            className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
          >
            Filter Showcase
          </Link>
        </div>
      </div>
    </article>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-2">
      <span className="text-[11px] uppercase tracking-[0.18em] text-[#6E7A88]">{label}</span>
      <span className="text-sm text-[#E6EDF3]">{value}</span>
    </div>
  );
}
