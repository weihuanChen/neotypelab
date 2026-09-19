import type { JobResultProps } from "./jobWaitTypes";

export function JobResult({
  actions,
  details,
  identity,
  kicker,
  message,
  secondary,
  title,
}: JobResultProps) {
  return (
    <article className="job-result" aria-live="polite">
      <p className="job-wait__identity">{identity}</p>
      <p className="job-result__kicker">{kicker}</p>
      <h2 className="job-result__title">{title}</h2>
      <p className="job-result__message">{message}</p>
      {details ? <div className="job-result__details">{details}</div> : null}
      {actions ? <div className="job-result__actions">{actions}</div> : null}
      {secondary ? <div className="job-result__secondary">{secondary}</div> : null}
    </article>
  );
}
