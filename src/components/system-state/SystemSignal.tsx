import type { ReactNode } from "react";
import type { SystemSignalKind } from "./systemStateTypes";

const viewBox = "0 0 160 72";

function Mark({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <svg
      aria-hidden="true"
      className="system-signal__glyph"
      fill="none"
      role="img"
      stroke="currentColor"
      strokeLinejoin="miter"
      strokeLinecap="square"
      strokeWidth="1.15"
      viewBox={viewBox}
    >
      <title>{label}</title>
      {children}
    </svg>
  );
}

function MissingMark() {
  return (
    <Mark label="Missing route">
      <line x1="12" y1="22" x2="124" y2="22" />
      <line x1="36" y1="50" x2="148" y2="50" />
      <line x1="96" y1="22" x2="120" y2="50" />
      <line x1="70" y1="10" x2="82" y2="22" />
      <line x1="82" y1="10" x2="70" y2="22" />
    </Mark>
  );
}

function InterruptedMark() {
  return (
    <Mark label="Interrupted system">
      <path d="M12 20 H92 L108 4" />
      <path d="M12 52 H68 L92 20 H148" />
    </Mark>
  );
}

function LockedMark() {
  return (
    <Mark label="Locked access">
      <rect height="36" width="40" x="60" y="18" />
      <path d="M72 18 V10 H88 V18" />
      <line x1="8" y1="36" x2="60" y2="36" />
      <line x1="100" y1="36" x2="152" y2="36" />
    </Mark>
  );
}

function EmptyMark() {
  return (
    <Mark label="Empty archive">
      <circle cx="16" cy="22" r="6" />
      <line x1="22" y1="22" x2="108" y2="22" />
      <circle cx="114" cy="22" r="6" />
      <line x1="118" y1="27" x2="138" y2="54" />
      <circle cx="142" cy="58" r="6" />
    </Mark>
  );
}

function QueryMark() {
  return (
    <Mark label="Empty query">
      <line x1="12" y1="28" x2="92" y2="28" />
      <circle cx="108" cy="28" r="1.8" fill="currentColor" />
      <circle cx="122" cy="28" r="1.8" fill="currentColor" />
      <circle cx="136" cy="28" r="1.8" fill="currentColor" />
    </Mark>
  );
}

function FailedMark() {
  return (
    <Mark label="Failed job">
      <line x1="12" y1="22" x2="92" y2="22" />
      <line x1="86" y1="16" x2="98" y2="28" />
      <line x1="98" y1="16" x2="86" y2="28" />
      <line x1="92" y1="22" x2="114" y2="52" />
      <line x1="114" y1="52" x2="148" y2="52" />
    </Mark>
  );
}

function LoadingMark() {
  return (
    <Mark label="System sync">
      <line x1="12" y1="36" x2="148" y2="36" />
      <circle className="system-signal__node" cx="12" cy="36" r="3.5" fill="currentColor" />
    </Mark>
  );
}

function ReadyMark() {
  return (
    <Mark label="Ready">
      <line x1="12" y1="36" x2="148" y2="36" />
      <circle cx="148" cy="36" r="3.5" fill="currentColor" />
    </Mark>
  );
}

const marks: Record<SystemSignalKind, () => ReactNode> = {
  missing: MissingMark,
  interrupted: InterruptedMark,
  locked: LockedMark,
  empty: EmptyMark,
  query: QueryMark,
  failed: FailedMark,
  loading: LoadingMark,
  ready: ReadyMark,
};

export function SystemSignal({
  kind,
  label,
}: {
  kind: SystemSignalKind;
  label: string;
}) {
  const Glyph = marks[kind];

  return (
    <figure className={`system-signal is-${kind}`} aria-hidden="true">
      <Glyph />
      <figcaption className="system-signal__label">{label}</figcaption>
    </figure>
  );
}
