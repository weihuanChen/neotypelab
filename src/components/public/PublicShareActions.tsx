import { useState } from "react";

type PublicShareActionsProps = {
  className?: string;
  exportImageLabel?: string;
  exportImageUrl?: string;
  extraExportLinks?: PublicShareExportLink[];
  pinterestImageUrl?: string;
  redditImageUrl?: string;
  sharePath?: string;
  text: string;
  title: string;
};

type PublicShareExportLink = {
  href: string;
  label: string;
  tone?: "accent" | "default" | "warm";
};

export function PublicShareActions({
  className,
  exportImageLabel = "Watermarked Export",
  exportImageUrl,
  extraExportLinks = [],
  pinterestImageUrl,
  redditImageUrl,
  sharePath,
  text,
  title,
}: PublicShareActionsProps) {
  const [message, setMessage] = useState<string | null>(null);

  async function copyLink() {
    const url = getShareUrl(sharePath);

    try {
      await navigator.clipboard.writeText(url);
      flashMessage(setMessage, "Link copied");
    } catch {
      flashMessage(setMessage, "Copy failed");
    }
  }

  async function shareNative() {
    const nativeShare =
      typeof navigator !== "undefined" && "share" in navigator
        ? navigator.share.bind(navigator)
        : undefined;

    if (!nativeShare) {
      await copyLink();
      return;
    }

    try {
      await nativeShare({
        title,
        text,
        url: getShareUrl(sharePath),
      });
      flashMessage(setMessage, "Share opened");
    } catch {
      setMessage(null);
    }
  }

  return (
    <div className={className ?? "prototype-action-row"}>
      <button
        className="showcase-button"
        type="button"
        onClick={() => {
          void copyLink();
        }}
      >
        Copy Link
      </button>
      <button
        className="showcase-button is-accent"
        type="button"
        onClick={() => {
          void shareNative();
        }}
      >
        Share
      </button>
      {exportImageUrl ? (
        <a
          className="showcase-button is-warm"
          href={exportImageUrl}
          rel="noreferrer"
          target="_blank"
        >
          {exportImageLabel}
        </a>
      ) : null}
      {pinterestImageUrl ? (
        <a
          className="showcase-button is-warm"
          href={pinterestImageUrl}
          rel="noreferrer"
          target="_blank"
        >
          Pinterest Card
        </a>
      ) : null}
      {redditImageUrl ? (
        <a
          className="showcase-button is-accent"
          href={redditImageUrl}
          rel="noreferrer"
          target="_blank"
        >
          Reddit Card
        </a>
      ) : null}
      {extraExportLinks.map((link) => (
        <a
          className={getExportLinkClassName(link.tone)}
          href={link.href}
          key={link.href}
          rel="noreferrer"
          target="_blank"
        >
          {link.label}
        </a>
      ))}
      {message ? <span className="prototype-action-message">{message}</span> : null}
    </div>
  );
}

function getExportLinkClassName(tone: PublicShareExportLink["tone"]) {
  if (tone === "accent") {
    return "showcase-button is-accent";
  }

  if (tone === "warm") {
    return "showcase-button is-warm";
  }

  return "showcase-button";
}

function getShareUrl(sharePath?: string) {
  if (typeof window === "undefined") {
    return sharePath ?? "/";
  }

  return new URL(sharePath ?? window.location.pathname, window.location.origin)
    .toString();
}

function flashMessage(
  setMessage: (message: string | null) => void,
  message: string
) {
  setMessage(message);
  window.setTimeout(() => setMessage(null), 1800);
}
