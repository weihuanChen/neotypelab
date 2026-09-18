import type { ReactNode } from "react";

export type SystemSignalKind =
  | "missing"
  | "interrupted"
  | "locked"
  | "empty"
  | "query"
  | "failed"
  | "loading"
  | "ready";

export type SystemStateLayout = "page" | "embedded" | "inline";

export type SystemStatePurpose =
  | "error"
  | "fault"
  | "access"
  | "empty"
  | "onboarding"
  | "progress";

export type SystemStateDefinition = {
  code: string;
  archive: string;
  headline: string;
  message: string[];
  signal: SystemSignalKind;
  signalLabel: string;
  purpose: SystemStatePurpose;
  context?: string;
  steps?: Array<{ index: string; label: string }>;
};

export type SystemStateProps = SystemStateDefinition & {
  layout?: SystemStateLayout;
  primary?: ReactNode;
  secondary?: ReactNode;
  details?: ReactNode;
  headingLevel?: "h1" | "h2";
};
