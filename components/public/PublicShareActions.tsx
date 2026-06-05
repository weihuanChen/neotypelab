"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

export function PublicShareActions({
  className,
  exportImageUrl,
  pinterestImageUrl,
  redditImageUrl,
  title,
  text,
}: {
  className?: string;
  exportImageUrl?: string;
  pinterestImageUrl?: string;
  redditImageUrl?: string;
  title: string;
  text: string;
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function onCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("Link copied");
    } catch {
      setMessage("Copy failed");
    }
  }

  async function onShare() {
    const nativeShare = "share" in navigator ? navigator.share.bind(navigator) : undefined;
    if (!nativeShare) {
      await onCopyLink();
      return;
    }

    try {
      await nativeShare({
        title,
        text,
        url: window.location.href,
      });
      setMessage("Share sheet opened");
    } catch {
      setMessage(null);
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Button
        type="button"
        onClick={() => {
          void onCopyLink();
        }}
        className="h-11 rounded-[18px] border border-white/10 bg-transparent px-4 text-sm text-[#E6EDF3] hover:bg-white/10"
      >
        Copy Link
      </Button>
      <Button
        type="button"
        onClick={() => {
          void onShare();
        }}
        className="h-11 rounded-[18px] border border-[#3DD9FF]/35 bg-[#0E2430] px-4 text-sm text-[#E6EDF3] hover:bg-white/10"
      >
        Share
      </Button>
      {exportImageUrl ? (
        <a
          href={exportImageUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-[18px] border border-[#FFB84D]/35 bg-[#2A210F] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
        >
          Watermarked Export
        </a>
      ) : null}
      {pinterestImageUrl ? (
        <a
          href={pinterestImageUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-[18px] border border-[#FFB84D]/35 bg-[#2A210F] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
        >
          Pinterest Card
        </a>
      ) : null}
      {redditImageUrl ? (
        <a
          href={redditImageUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-11 items-center justify-center rounded-[18px] border border-[#58FFB2]/35 bg-[#13241B] px-4 text-sm text-[#E6EDF3] transition-colors hover:bg-white/10"
        >
          Reddit Card
        </a>
      ) : null}
      {message ? <span className="text-xs uppercase tracking-[0.18em] text-[#9BA7B4]">{message}</span> : null}
    </div>
  );
}
