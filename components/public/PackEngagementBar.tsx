"use client";

import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type PackEngagementBarProps = {
  creatorPackId: Id<"creatorPacks"> | string;
  likeCount: number;
  saveCount: number;
  viewerHasLiked: boolean;
  viewerHasSaved: boolean;
  compact?: boolean;
  className?: string;
};

export function PackEngagementBar({
  creatorPackId,
  likeCount,
  saveCount,
  viewerHasLiked,
  viewerHasSaved,
  compact = false,
  className,
}: PackEngagementBarProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  type TogglePackInteractionRef = (args: {
    creatorPackId: Id<"creatorPacks">;
    kind: "like" | "save";
  }) => Promise<unknown>;
  const toggleInteraction = useMutation(
    (api as typeof api & {
      packEngagement: {
        togglePackInteraction: TogglePackInteractionRef;
      };
    }).packEngagement.togglePackInteraction
  );
  const [pendingKind, setPendingKind] = useState<"like" | "save" | null>(null);
  const redirectUrl = buildCurrentUrl(pathname, searchParams);

  async function onToggle(kind: "like" | "save") {
    setPendingKind(kind);
    try {
      await toggleInteraction({
        creatorPackId: creatorPackId as Id<"creatorPacks">,
        kind,
      });
    } finally {
      setPendingKind(null);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2",
        compact ? "text-xs" : "text-sm",
        className
      )}
    >
      <EngagementButton
        active={viewerHasLiked}
        compact={compact}
        count={likeCount}
        disabled={!isLoaded || pendingKind !== null}
        label="Like Pack"
        pending={pendingKind === "like"}
        signedIn={Boolean(isSignedIn)}
        signInRedirectUrl={redirectUrl}
        onClick={() => {
          void onToggle("like");
        }}
      />
      <EngagementButton
        active={viewerHasSaved}
        compact={compact}
        count={saveCount}
        disabled={!isLoaded || pendingKind !== null}
        label="Save Pack"
        pending={pendingKind === "save"}
        signedIn={Boolean(isSignedIn)}
        signInRedirectUrl={redirectUrl}
        onClick={() => {
          void onToggle("save");
        }}
      />
    </div>
  );
}

function EngagementButton({
  active,
  compact,
  count,
  disabled,
  label,
  onClick,
  pending,
  signedIn,
  signInRedirectUrl,
}: {
  active: boolean;
  compact: boolean;
  count: number;
  disabled: boolean;
  label: string;
  onClick: () => void;
  pending: boolean;
  signedIn: boolean;
  signInRedirectUrl: string;
}) {
  const className = cn(
    "inline-flex items-center justify-center rounded-[16px] border transition-colors",
    compact ? "h-9 px-3 text-xs" : "h-10 px-4 text-sm",
    active
      ? "border-[#58FFB2]/35 bg-[#13241B] text-[#E6EDF3]"
      : "border-white/10 bg-black/20 text-[#9BA7B4] hover:border-white/20 hover:text-[#E6EDF3]"
  );
  const content = (
    <button
      type="button"
      disabled={disabled}
      onClick={signedIn ? onClick : undefined}
      className={className}
    >
      {pending ? `${label}...` : `${label} ${count}`}
    </button>
  );

  if (signedIn) {
    return content;
  }

  return (
    <SignInButton mode="modal" redirectUrl={signInRedirectUrl}>
      {content}
    </SignInButton>
  );
}

function buildCurrentUrl(
  pathname: string,
  searchParams: ReturnType<typeof useSearchParams>
) {
  const query = searchParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}
