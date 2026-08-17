"use client";

import { api } from "@/convex/_generated/api";
import { usePaginatedQuery, useQuery } from "convex/react";
import {
  formatCategory,
  formatFeedbackReference,
  formatPrototypeReference,
  formatReportDate,
  formatStatus,
} from "./FeedbackWorkbench";

export function FeedbackReportsList() {
  const { results, status, loadMore } = usePaginatedQuery(
    api.feedback.listMinePaginated,
    {},
    { initialNumItems: 12 }
  );

  if (status === "LoadingFirstPage") {
    return <FeedbackReportsLoading label="Loading report archive." />;
  }

  return (
    <main className="feedback-archive">
      <header className="feedback-archive__head">
        <div>
          <p>My reports</p>
          <h2>Feedback archive</h2>
          <span>Track every report from receipt through resolution.</span>
        </div>
        <a href="/feedback">＋ New report</a>
      </header>

      {results.length === 0 ? (
        <section className="feedback-archive__empty">
          <strong>No reports filed yet.</strong>
          <p>Your first report will appear here with its review status.</p>
          <a href="/feedback">Send a report →</a>
        </section>
      ) : (
        <div className="feedback-archive__list">
          <div className="feedback-archive__labels" aria-hidden="true">
            <span>Reference</span>
            <span>Report</span>
            <span>Context</span>
            <span>Status</span>
            <span>Submitted</span>
          </div>
          {results.map((report) => (
            <a
              className="feedback-archive__row"
              href={`/feedback/${report._id}`}
              key={report._id}
            >
              <strong>{formatFeedbackReference(report.recordNumber, report._id)}</strong>
              <span>
                <b>{report.title}</b>
                <small>{formatCategory(report.category)}</small>
              </span>
              <span>{report.concept?.title ?? "General feedback"}</span>
              <span className={`feedback-status is-${report.status}`}>
                <i aria-hidden="true" />
                {formatStatus(report.status)}
              </span>
              <time dateTime={new Date(report._creationTime).toISOString()}>
                {formatReportDate(report._creationTime)}
              </time>
            </a>
          ))}
        </div>
      )}

      {status === "CanLoadMore" || status === "LoadingMore" ? (
        <button
          className="feedback-archive__more"
          disabled={status === "LoadingMore"}
          type="button"
          onClick={() => loadMore(12)}
        >
          {status === "LoadingMore" ? "Loading reports…" : "Load more reports"}
        </button>
      ) : null}
    </main>
  );
}

export function FeedbackReportDetail({ feedbackId }: { feedbackId: string }) {
  const report = useQuery(api.feedback.getMine, { feedbackId });

  if (report === undefined) {
    return <FeedbackReportsLoading label="Opening report record." />;
  }
  if (report === null) {
    return (
      <main className="feedback-detail feedback-detail--empty">
        <p>Report unavailable</p>
        <h2>This record does not exist or is not part of your archive.</h2>
        <a href="/feedback/reports">Back to my reports →</a>
      </main>
    );
  }

  return (
    <main className="feedback-detail">
      <nav className="feedback-detail__nav" aria-label="Feedback breadcrumbs">
        <a href="/feedback/reports">My reports</a>
        <span>/</span>
        <strong>{formatFeedbackReference(report.recordNumber, report._id)}</strong>
      </nav>

      <div className="feedback-detail__grid">
        <article className="feedback-detail__report">
          <header>
            <div>
              <p>{formatCategory(report.category)}</p>
              <h2>{report.title}</h2>
            </div>
            <span className={`feedback-status is-${report.status}`}>
              <i aria-hidden="true" />
              {formatStatus(report.status)}
            </span>
          </header>

          <section>
            <span>Report</span>
            <p>{report.message}</p>
          </section>

          {report.attachment?.publicUrl ? (
            <section className="feedback-detail__attachment">
              <span>Attached image</span>
              <a href={report.attachment.publicUrl} target="_blank" rel="noreferrer">
                <img alt="Report attachment" src={report.attachment.publicUrl} />
              </a>
            </section>
          ) : null}

          {report.adminNotes ? (
            <section className="feedback-detail__response">
              <span>Review note</span>
              <p>{report.adminNotes}</p>
            </section>
          ) : null}
        </article>

        <aside className="feedback-detail__meta">
          <p>Record details</p>
          <dl>
            <div>
              <dt>Reference</dt>
              <dd>{formatFeedbackReference(report.recordNumber, report._id)}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(report._creationTime))}</dd>
            </div>
            <div>
              <dt>Prototype</dt>
              <dd>
                {report.concept ? (
                  <a href={`/prototype/${report.concept._id}`}>
                    {formatPrototypeReference(report.concept.recordNumber, report.concept._id)} / {report.concept.title}
                  </a>
                ) : (
                  "Not attached"
                )}
              </dd>
            </div>
            <div>
              <dt>Kit</dt>
              <dd>{report.kitVariant?.name ?? "Not specified"}</dd>
            </div>
            <div>
              <dt>Style DNA</dt>
              <dd>{report.stylePreset?.name ?? "Not specified"}</dd>
            </div>
          </dl>
          <a className="feedback-detail__new" href="/feedback">
            Send another report →
          </a>
        </aside>
      </div>
    </main>
  );
}

function FeedbackReportsLoading({ label }: { label: string }) {
  return (
    <section className="feedback-loading" aria-live="polite">
      <span>Feedback</span>
      <strong>{label}</strong>
    </section>
  );
}
