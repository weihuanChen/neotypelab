import { Link } from "@tanstack/react-router";
import { SystemSignal } from "@/src/components/system-state/SystemSignal";
import { appPaths } from "@/src/lib/appPaths";

const CONTACT_EMAIL = "hello@neotypelab.com";

const statusRows = [
  { label: "Platform", value: "Operational", tone: "healthy" },
  { label: "Generation", value: "Operational", tone: "healthy" },
  { label: "Support desk", value: "Open", tone: "healthy" },
  { label: "Mail routing", value: CONTACT_EMAIL, tone: "neutral" },
  { label: "Response window", value: "1–2 working days", tone: "neutral" },
] as const;

export function ContactPage() {
  return (
    <article className="contact-page">
      <p className="information-doc__archive">Contact / N°02</p>

      <div className="contact-page__split">
        <div className="contact-page__main">
          <section className="information-doc__block" aria-labelledby="contact-hello">
            <h2 className="information-doc__headline" id="contact-hello">
              Say hello.
            </h2>
            <p className="information-doc__lede">
              Questions, feedback, partnerships,
              <br />
              or something that isn&apos;t working.
            </p>
            <a className="information-doc__email" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            <p className="information-doc__note">
              Typical response
              <br />
              within 1–2 working days.
            </p>
          </section>

          <hr className="information-doc__rule" />

          <section className="information-doc__block" aria-labelledby="contact-issue">
            <h2 className="information-doc__headline" id="contact-issue">
              Report an issue
            </h2>
            <p className="information-doc__lede">
              For a preview or paint-plan problem, include
              <br />
              the Build N° when possible.
            </p>
            <Link
              className="information-doc__action"
              preload="intent"
              to={appPaths.feedback}
            >
              Report issue →
            </Link>
          </section>
        </div>

        <aside aria-labelledby="contact-status-title" className="contact-status">
          <p className="contact-status__kicker" id="contact-status-title">
            System / Board
          </p>
          <SystemSignal kind="ready" label="Signal / Ready" />
          <dl className="contact-status__list">
            {statusRows.map((row) => (
              <div className="contact-status__row" key={row.label}>
                <dt>{row.label}</dt>
                <dd className={`is-${row.tone}`}>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="contact-status__footnote">
            Public status board. For a preview or paint-plan problem, open a
            report with the Build N°.
          </p>
        </aside>
      </div>
    </article>
  );
}
