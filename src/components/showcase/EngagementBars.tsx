import {
  SignInButton,
  useAuth,
} from "@clerk/tanstack-react-start";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type EngagementKind = "like" | "save";

type ConceptEngagementBarProps = {
  conceptId: Id<"concepts"> | string;
  likeCount: number;
  saveCount: number;
  viewerHasLiked: boolean;
  viewerHasSaved: boolean;
  interactive: boolean;
  compact?: boolean;
};

type PackEngagementBarProps = {
  creatorPackId: Id<"creatorPacks"> | string;
  likeCount: number;
  saveCount: number;
  viewerHasLiked: boolean;
  viewerHasSaved: boolean;
  interactive: boolean;
  compact?: boolean;
};

export function ConceptEngagementBar(props: ConceptEngagementBarProps) {
  if (!props.interactive) {
    return (
      <StaticEngagementBar
        compact={props.compact}
        likeCount={props.likeCount}
        saveCount={props.saveCount}
        viewerHasLiked={props.viewerHasLiked}
        viewerHasSaved={props.viewerHasSaved}
      />
    );
  }

  return <InteractiveConceptEngagementBar {...props} />;
}

export function PackEngagementBar(props: PackEngagementBarProps) {
  if (!props.interactive) {
    return (
      <StaticEngagementBar
        compact={props.compact}
        likeCount={props.likeCount}
        saveCount={props.saveCount}
        viewerHasLiked={props.viewerHasLiked}
        viewerHasSaved={props.viewerHasSaved}
        likeLabel="Like Pack"
        saveLabel="Save Pack"
      />
    );
  }

  return <InteractivePackEngagementBar {...props} />;
}

function InteractiveConceptEngagementBar({
  conceptId,
  likeCount,
  saveCount,
  viewerHasLiked,
  viewerHasSaved,
  compact,
}: ConceptEngagementBarProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const toggleInteraction = useMutation(api.engagement.toggleConceptInteraction);
  const [pendingKind, setPendingKind] = useState<EngagementKind | null>(null);

  async function onToggle(kind: EngagementKind) {
    setPendingKind(kind);
    try {
      await toggleInteraction({
        conceptId: conceptId as Id<"concepts">,
        kind,
      });
    } finally {
      setPendingKind(null);
    }
  }

  return (
    <EngagementButtons
      compact={compact}
      isLoaded={isLoaded}
      isSignedIn={Boolean(isSignedIn)}
      likeCount={likeCount}
      pendingKind={pendingKind}
      saveCount={saveCount}
      viewerHasLiked={viewerHasLiked}
      viewerHasSaved={viewerHasSaved}
      onToggle={onToggle}
    />
  );
}

function InteractivePackEngagementBar({
  creatorPackId,
  likeCount,
  saveCount,
  viewerHasLiked,
  viewerHasSaved,
  compact,
}: PackEngagementBarProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const toggleInteraction = useMutation(api.packEngagement.togglePackInteraction);
  const [pendingKind, setPendingKind] = useState<EngagementKind | null>(null);

  async function onToggle(kind: EngagementKind) {
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
    <EngagementButtons
      compact={compact}
      isLoaded={isLoaded}
      isSignedIn={Boolean(isSignedIn)}
      likeCount={likeCount}
      likeLabel="Like Pack"
      pendingKind={pendingKind}
      saveCount={saveCount}
      saveLabel="Save Pack"
      viewerHasLiked={viewerHasLiked}
      viewerHasSaved={viewerHasSaved}
      onToggle={onToggle}
    />
  );
}

function StaticEngagementBar({
  compact,
  likeCount,
  likeLabel = "Like",
  saveCount,
  saveLabel = "Save",
  viewerHasLiked,
  viewerHasSaved,
}: {
  compact?: boolean;
  likeCount: number;
  likeLabel?: string;
  saveCount: number;
  saveLabel?: string;
  viewerHasLiked: boolean;
  viewerHasSaved: boolean;
}) {
  return (
    <div className={compact ? "showcase-engagement is-compact" : "showcase-engagement"}>
      <span className={viewerHasLiked ? "showcase-chip is-active" : "showcase-chip"}>
        {likeLabel} {likeCount}
      </span>
      <span className={viewerHasSaved ? "showcase-chip is-active" : "showcase-chip"}>
        {saveLabel} {saveCount}
      </span>
    </div>
  );
}

function EngagementButtons({
  compact,
  isLoaded,
  isSignedIn,
  likeCount,
  likeLabel = "Like",
  onToggle,
  pendingKind,
  saveCount,
  saveLabel = "Save",
  viewerHasLiked,
  viewerHasSaved,
}: {
  compact?: boolean;
  isLoaded: boolean;
  isSignedIn: boolean;
  likeCount: number;
  likeLabel?: string;
  onToggle: (kind: EngagementKind) => Promise<void>;
  pendingKind: EngagementKind | null;
  saveCount: number;
  saveLabel?: string;
  viewerHasLiked: boolean;
  viewerHasSaved: boolean;
}) {
  return (
    <div className={compact ? "showcase-engagement is-compact" : "showcase-engagement"}>
      <EngagementButton
        active={viewerHasLiked}
        count={likeCount}
        disabled={!isLoaded || pendingKind !== null}
        label={likeLabel}
        pending={pendingKind === "like"}
        signedIn={isSignedIn}
        onClick={() => onToggle("like")}
      />
      <EngagementButton
        active={viewerHasSaved}
        count={saveCount}
        disabled={!isLoaded || pendingKind !== null}
        label={saveLabel}
        pending={pendingKind === "save"}
        signedIn={isSignedIn}
        onClick={() => onToggle("save")}
      />
    </div>
  );
}

function EngagementButton({
  active,
  count,
  disabled,
  label,
  onClick,
  pending,
  signedIn,
}: {
  active: boolean;
  count: number;
  disabled: boolean;
  label: string;
  onClick: () => Promise<void>;
  pending: boolean;
  signedIn: boolean;
}) {
  const className = active
    ? "showcase-chip is-active"
    : "showcase-chip is-button";
  const content = (
    <button
      className={className}
      disabled={disabled}
      type="button"
      onClick={signedIn ? () => void onClick() : undefined}
    >
      {pending ? `${label}...` : `${label} ${count}`}
    </button>
  );

  if (signedIn) {
    return content;
  }

  return (
    <SignInButton mode="modal">
      {content}
    </SignInButton>
  );
}
