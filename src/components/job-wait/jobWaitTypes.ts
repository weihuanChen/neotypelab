import type { ReactNode } from "react";

export type JobWaitStatus = "process" | "interrupted";

export type JobLifecycleKey = "input" | "process" | "output";

export type JobWaitMessage = {
  index: string;
  title: string;
  body: string;
};

export type JobWaitProfile = {
  id: string;
  identity: string;
  verb: string;
  subject: string;
  summary: string;
  stages: Record<JobLifecycleKey, string>;
  messages: JobWaitMessage[];
  exit: string;
  hangAfterMs: number;
  hang: string;
  interruptedVerb: string;
  interruptedSummary: string;
};

export type JobWaitProps = {
  profile: JobWaitProfile;
  status?: JobWaitStatus;
  startedAt?: number;
  error?: string;
  primary?: ReactNode;
  secondary?: ReactNode;
};

export type JobResultPhase = "review" | "stored";

export type JobResultProps = {
  identity: string;
  kicker: string;
  title: string;
  message: string;
  details?: ReactNode;
  actions?: ReactNode;
  secondary?: ReactNode;
};

/**
 * Custom Style completion contract.
 *
 * INPUT → EXISTING? → FORMING → REVIEW → STORED
 *              ↘ open record / use style
 *                         ↘ INTERRUPTED → retry or INPUT
 *
 * EXISTING asks before reuse: open a prior record, or form again.
 * REVIEW is 回看: interpretation exists, userStyle is not written yet.
 * STORED is 入库: userStyle is saved privately.
 * REVIEW, STORED and EXISTING return to INPUT:
 *   - Revise direction keeps the text
 *   - New style clears the draft
 * FORMING never claims Library storage. Styles stay in Create → Saved.
 */
export type StyleJobPhase = "input" | "existing" | "forming" | "review" | "stored" | "interrupted";
