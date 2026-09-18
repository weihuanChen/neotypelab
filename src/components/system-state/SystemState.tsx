import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SystemSignal } from "./SystemSignal";
import type { SystemStateProps } from "./systemStateTypes";

export function SystemState({
  archive,
  code,
  context = "NeotypeLab system",
  details,
  headingLevel,
  headline,
  layout = "embedded",
  message,
  primary,
  purpose,
  secondary,
  signal,
  signalLabel,
  steps,
}: SystemStateProps) {
  const Heading = headingLevel ?? (layout === "page" ? "h1" : "h2");
  const live =
    purpose === "fault" ? "assertive" : purpose === "progress" ? "polite" : undefined;
  const body = (
    <article
      aria-live={live}
      className={`system-state system-state--${layout} is-${purpose}`}
      role={purpose === "fault" ? "alert" : purpose === "progress" ? "status" : undefined}
    >
      <p className="system-state__archive">{archive}</p>
      <div className="system-state__split">
        <div className="system-state__identity">
          <p aria-hidden="true" className="system-state__code">
            {code}
          </p>
          <SystemSignal kind={signal} label={signalLabel} />
        </div>
        <div className="system-state__copy">
          <Heading className="system-state__headline">{headline}</Heading>
          <div className="system-state__message">
            {message.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          {steps && steps.length > 0 ? (
            <ol className="system-state__steps">
              {steps.map((step) => (
                <li key={step.index}>
                  <span>{step.index}</span>
                  {step.label}
                </li>
              ))}
            </ol>
          ) : null}
          {details ? <div className="system-state__details">{details}</div> : null}
          {primary || secondary ? (
            <div className="system-state__recovery">
              {primary}
              {secondary}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );

  if (layout !== "page") {
    return body;
  }

  return (
    <main className="system-state-page">
      <header className="system-state-page__bar">
        <Link aria-label="Return home" className="system-state-page__home" to="/">
          ←
        </Link>
        <Link className="system-state-page__brand" to="/">
          NeotypeLab
        </Link>
      </header>
      <hr className="system-state-page__rule" />
      {body}
      <hr className="system-state-page__rule" />
      <footer className="system-state-page__bar is-footer">
        <span>{context}</span>
        <span>{code}</span>
      </footer>
    </main>
  );
}

export function SystemStateLink({
  children,
  href,
  to,
}: {
  children: ReactNode;
  href?: string;
  to?: LinkProps["to"];
}) {
  if (to) {
    return (
      <Link className="system-state__link" to={to}>
        {children}
      </Link>
    );
  }

  return (
    <a className="system-state__link" href={href}>
      {children}
    </a>
  );
}

export function SystemStateButtonLink({
  children,
  href,
  to,
}: {
  children: ReactNode;
  href?: string;
  to?: LinkProps["to"];
}) {
  if (to) {
    return (
      <Link className="system-state__button" to={to}>
        {children}
      </Link>
    );
  }

  return (
    <a className="system-state__button" href={href}>
      {children}
    </a>
  );
}
