"use client";
/* eslint-disable @next/next/no-img-element */

import { PackEngagementBar } from "@/components/public/PackEngagementBar";
import { api } from "@/convex/_generated/api";
import { getCreatorPackAccessCopy } from "@/lib/creatorPackAccess";
import { useQuery } from "convex/react";
import Link from "next/link";

type CreatorPackCardProps = {
  pack: {
    _id: string;
    name: string;
    slug: string;
    description?: string;
    tagline?: string;
    packType: "free" | "premium";
    isFeatured: boolean;
    engagement: {
      likeCount: number;
      saveCount: number;
      viewerHasLiked: boolean;
      viewerHasSaved: boolean;
    };
    creator: {
      handle: string;
      fullName: string;
    } | null;
    stats: {
      styleCount: number;
      baseModelCount: number;
      materialCount: number;
      publicConceptCount: number;
    };
    previewConcept: {
      _id: string;
      title: string;
      previewAsset: {
        publicUrl?: string;
      } | null;
    } | null;
  };
  compact?: boolean;
};

export function CreatorPackCard({ pack, compact = false }: CreatorPackCardProps) {
  const viewer = useQuery(api.users.viewer);
  const access = getCreatorPackAccessCopy({
    creatorHandle: pack.creator?.handle,
    packType: pack.packType,
    viewer,
  });

  return (
    <article className="overflow-hidden rounded-[24px] border border-white/10 bg-black/20">
      <div className="aspect-[4/3] bg-[#0D1117]">
        {pack.previewConcept?.previewAsset?.publicUrl ? (
          <img
            src={pack.previewConcept.previewAsset.publicUrl}
            alt={pack.previewConcept.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-end p-5">
            <p className="text-sm text-[#9BA7B4]">Pack preview unavailable</p>
          </div>
        )}
      </div>
      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#9BA7B4]">
            {pack.packType}
          </span>
          {pack.isFeatured ? (
            <span className="rounded-full border border-[#FFB84D]/30 bg-[#FFB84D]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#FFD9A0]">
              featured pack
            </span>
          ) : null}
          {pack.packType === "premium" ? (
            <span className="rounded-full border border-[#3DD9FF]/30 bg-[#3DD9FF]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#8FEAFF]">
              {access.badge}
            </span>
          ) : null}
        </div>
        <div>
          <Link href={`/creator-pack/${pack.slug}`} className="text-xl font-semibold text-[#E6EDF3]">
            {pack.name}
          </Link>
          {pack.tagline ? (
            <p className="mt-2 text-sm text-[#C7D0DA]">{pack.tagline}</p>
          ) : null}
          <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">
            {pack.description ??
              "Creator starter pack for Style DNA, base models, and material presets."}
          </p>
        </div>
        <div className="grid gap-2 text-sm text-[#C7D0DA]">
          <MetaRow label="Creator" value={pack.creator ? `@${pack.creator.handle}` : "Unknown"} />
          <MetaRow label="Styles" value={`${pack.stats.styleCount}`} />
          <MetaRow label="Concepts" value={`${pack.stats.publicConceptCount}`} />
        </div>
        <PackEngagementBar
          creatorPackId={pack._id}
          likeCount={pack.engagement.likeCount}
          saveCount={pack.engagement.saveCount}
          viewerHasLiked={pack.engagement.viewerHasLiked}
          viewerHasSaved={pack.engagement.viewerHasSaved}
          compact={compact}
        />
        {pack.packType === "premium" && !access.allowed ? (
          <div className="rounded-[16px] border border-[#3DD9FF]/20 bg-[#3DD9FF]/10 p-3 text-xs leading-5 text-[#C7D0DA]">
            {access.message}
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href={`/creator-pack/${pack.slug}`}
            className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
          >
            Open Pack
          </Link>
          {pack.packType === "premium" && !access.allowed ? (
            <span className="inline-flex h-10 items-center justify-center rounded-[16px] border border-white/10 px-4 text-sm text-[#6E7A88]">
              Premium Access
            </span>
          ) : pack.previewConcept ? (
            <Link
              href={`/t/create?remix=${pack.previewConcept._id}&creatorPack=${pack.slug}&creatorPackVariant=remix-seed`}
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#FFB84D]/35 bg-[#2A210F] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
            >
              Remix Entry
            </Link>
          ) : (
            <Link
              href={`/t/create?creatorPack=${pack.slug}`}
              className="inline-flex h-10 items-center justify-center rounded-[16px] border border-[#58FFB2]/35 bg-[#13241B] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
            >
              Open In Create
            </Link>
          )}
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
