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
        className="showcase-button h-11 px-4 text-sm"
      >
        Copy Link
      </Button>
      <Button
        type="button"
        onClick={() => {
          void onShare();
        }}
        className="showcase-button is-warm h-11 px-4 text-sm"
      >
        Share
      </Button>
      {exportImageUrl ? (
        <a
          href={exportImageUrl}
          target="_blank"
          rel="noreferrer"
          className="showcase-button h-11 px-4 text-sm"
        >
          Watermarked Export
        </a>
      ) : null}
      {pinterestImageUrl ? (
        <a
          href={pinterestImageUrl}
          target="_blank"
          rel="noreferrer"
          className="showcase-button h-11 px-4 text-sm"
        >
          Pinterest Card
        </a>
      ) : null}
      {redditImageUrl ? (
        <a
          href={redditImageUrl}
          target="_blank"
          rel="noreferrer"
          className="showcase-button h-11 px-4 text-sm"
        >
          Reddit Card
        </a>
      ) : null}
      {message ? <span className="text-xs uppercase tracking-[0.18em] text-ink-muted">{message}</span> : null}
    </div>
  );
}
