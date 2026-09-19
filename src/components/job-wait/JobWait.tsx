import { useEffect, useRef, useState } from "react";
import { SystemStateLink } from "@/src/components/system-state";
import { JobPlot } from "./JobPlot";
import type { JobLifecycleKey, JobWaitProps } from "./jobWaitTypes";

const MESSAGE_MS = 10_000;

function formatElapsed(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export function JobWait({
  error,
  primary,
  profile,
  secondary,
  startedAt,
  status = "process",
}: JobWaitProps) {
  const originRef = useRef(startedAt ?? Date.now());
  const [elapsed, setElapsed] = useState(() => Date.now() - originRef.current);
  const [messageIndex, setMessageIndex] = useState(0);
  const interrupted = status === "interrupted";
  const hanging = !interrupted && elapsed >= profile.hangAfterMs;
  const verb = interrupted ? profile.interruptedVerb : profile.verb;
  const summary = interrupted ? profile.interruptedSummary : profile.summary;
  const message = interrupted
    ? { index: "00", title: "Interrupted", body: error ?? profile.interruptedSummary }
    : hanging
      ? { index: "00", title: "Still working", body: profile.hang }
      : profile.messages[messageIndex % profile.messages.length];

  useEffect(() => {
    if (interrupted) return;
    const tick = window.setInterval(() => {
      setElapsed(Date.now() - originRef.current);
    }, 1000);
    return () => window.clearInterval(tick);
  }, [interrupted]);

  useEffect(() => {
    if (interrupted || hanging) return;
    const rotate = window.setInterval(() => {
      setMessageIndex((current) => current + 1);
    }, MESSAGE_MS);
    return () => window.clearInterval(rotate);
  }, [hanging, interrupted]);

  const stageState: Record<JobLifecycleKey, string> = {
    input: "Received",
    process: interrupted ? "Interrupted" : "In progress",
    output: "Pending",
  };

  return (
    <article
      aria-live={interrupted ? "assertive" : "polite"}
      className={`job-wait${interrupted ? " is-interrupted" : ""}`}
      role={interrupted ? "alert" : "status"}
    >
      <p className="job-wait__identity">{profile.identity}</p>
      <div className="job-wait__split">
        <div className="job-wait__copy">
          <h1 className="job-wait__verb">
            {verb}
            <span>{profile.subject}</span>
          </h1>
          <p className="job-wait__summary">{summary}</p>
        </div>
        <JobPlot label={verb} />
      </div>
      <ol className="job-wait__lifecycle">
        {(Object.keys(profile.stages) as JobLifecycleKey[]).map((key, index) => (
          <li className={`is-${key}${key === "process" && interrupted ? " is-interrupted" : ""}`} key={key}>
            <span className="job-wait__index">{String(index + 1).padStart(2, "0")}</span>
            <strong>{profile.stages[key]}</strong>
            <small>{stageState[key]}</small>
          </li>
        ))}
      </ol>
      <div className="job-wait__rail" aria-hidden="true">
        <span className="is-filled" />
        <i />
        <span className={`is-active${interrupted ? " is-interrupted" : ""}`} />
        <i />
        <span />
      </div>
      <div className="job-wait__meta">
        {!interrupted ? (
          <p className="job-wait__elapsed">
            <span>Elapsed</span>
            <time dateTime={`PT${Math.floor(elapsed / 1000)}S`}>{formatElapsed(elapsed)}</time>
          </p>
        ) : null}
        <p className="job-wait__exit">{interrupted ? "Start another direction, or retry the same one." : profile.exit}</p>
        <SystemStateLink to="/library">Open library →</SystemStateLink>
      </div>
      <p className="job-wait__message">
        <span>
          {message.index} / {message.title}
        </span>
        {message.body}
      </p>
      {primary || secondary ? (
        <div className="job-wait__recovery">
          {primary}
          {secondary}
        </div>
      ) : null}
    </article>
  );
}
