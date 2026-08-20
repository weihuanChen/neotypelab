"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

const categoryOptions = [
  {
    value: "missing-base-model",
    label: "Missing Kit",
    detail: "Request a kit or silhouette that is not available in the catalog yet.",
  },
  {
    value: "style-request",
    label: "Style Request",
    detail: "Suggest a new visual direction for the Style DNA library.",
  },
  {
    value: "generation-quality",
    label: "Generation Issue",
    detail: "Report anatomy, masking, realism, or rendering problems.",
  },
  {
    value: "paint-mapping",
    label: "Paint Mapping",
    detail: "Flag a missing, inaccurate, or impractical paint recommendation.",
  },
  {
    value: "other",
    label: "Other",
    detail: "Send feedback that does not fit the main report types.",
  },
] as const;

export type FeedbackCategory = (typeof categoryOptions)[number]["value"];

export type FeedbackWorkbenchSearch = {
  conceptId?: string;
  generationJobId?: string;
  type?: FeedbackCategory;
  source?: "prototype" | "generation-result" | "showcase" | "library";
};

export function parseFeedbackSearch(
  search: Record<string, unknown>
): FeedbackWorkbenchSearch {
  const conceptId = parseOptionalSearchValue(search.conceptId);
  const generationJobId = parseOptionalSearchValue(search.generationJobId);
  const type = parseOptionalSearchValue(search.type);
  const source = parseOptionalSearchValue(search.source);

  return {
    conceptId,
    generationJobId,
    type: isFeedbackCategory(type) ? type : undefined,
    source: isFeedbackSource(source) ? source : undefined,
  };
}

export function FeedbackWorkbench({
  search,
}: {
  search: FeedbackWorkbenchSearch;
}) {
  const viewer = useQuery(api.users.viewer);
  const concepts = useQuery(api.concepts.listLibrary);
  const reports = useQuery(api.feedback.listMine);
  const createFeedback = useMutation(api.feedback.create);
  const generateUploadUrl = useMutation(api.assets.generateFeedbackUploadUrl);
  const registerScreenshot = useMutation(api.assets.registerFeedbackScreenshot);
  const [category, setCategory] = useState<FeedbackCategory | null>(
    search.type ?? null
  );
  const [conceptId, setConceptId] = useState<string | null>(
    search.conceptId ?? null
  );
  const [generationJobId, setGenerationJobId] = useState<string | null>(
    search.generationJobId ?? null
  );
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<{
    id: string;
    recordNumber: number;
  } | null>(null);
  const receiptRef = useRef<HTMLElement>(null);
  const attachedContext = useQuery(
    api.feedback.getContext,
    conceptId || generationJobId
      ? {
          conceptId: conceptId ?? undefined,
          generationJobId: generationJobId ?? undefined,
        }
      : "skip"
  );
  const selectedCategory = categoryOptions.find(
    (option) => option.value === category
  );
  const recentReports = useMemo(() => reports?.slice(0, 4) ?? [], [reports]);
  const messageRemaining = 500 - message.length;
  const submissionSource = search.source ?? (conceptId
    ? "prototype"
    : generationJobId
      ? "generation-result"
      : "standalone");

  useEffect(() => {
    setCategory(search.type ?? null);
  }, [search.type]);

  useEffect(() => {
    setConceptId(search.conceptId ?? null);
  }, [search.conceptId]);

  useEffect(() => {
    setGenerationJobId(search.generationJobId ?? null);
  }, [search.generationJobId]);

  useEffect(() => {
    if (submittedReport) {
      receiptRef.current?.focus();
    }
  }, [submittedReport]);

  useEffect(() => {
    if (!screenshot) {
      setScreenshotPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(screenshot);
    setScreenshotPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [screenshot]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (!category) {
      setErrorMessage("Choose an issue type before sending your report.");
      return;
    }
    if (title.trim().length < 4) {
      setErrorMessage("Add a short title so the report is easy to identify.");
      return;
    }
    if (message.trim().length < 12) {
      setErrorMessage("Describe the issue in at least 12 characters.");
      return;
    }
    if (messageRemaining < 0) {
      setErrorMessage("Keep the report description to 500 characters or fewer.");
      return;
    }

    setIsSubmitting(true);
    try {
      let relatedAssetId: Id<"assets"> | undefined;
      if (screenshot) {
        const uploadUrl = await generateUploadUrl({});
        const uploadResponse = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": screenshot.type },
          body: screenshot,
        });
        if (!uploadResponse.ok) {
          throw new Error("The screenshot could not be uploaded.");
        }
        const uploadResult = (await uploadResponse.json()) as {
          storageId: Id<"_storage">;
        };
        relatedAssetId = await registerScreenshot({
          storageId: uploadResult.storageId,
        });
      }

      const result = await createFeedback({
        category,
        title: title.trim(),
        message: message.trim(),
        conceptId: attachedContext?.concept?._id,
        relatedGenerationJobId: attachedContext?.generationJob?._id,
        kitVariantId: attachedContext?.kitVariant?._id,
        stylePresetId: attachedContext?.stylePreset?._id,
        relatedAssetId,
        source: submissionSource,
        sourcePage: submissionSource === "prototype" && conceptId
          ? `/prototype/${encodeURIComponent(conceptId)}`
          : submissionSource === "showcase"
            ? "/showcase"
            : submissionSource === "library"
              ? "/library"
              : generationJobId
                ? `/library?generationJobId=${encodeURIComponent(generationJobId)}`
                : "/feedback",
      });

      setSubmittedReport({
        id: result.feedbackId,
        recordNumber: result.recordNumber,
      });
      setTitle("");
      setMessage("");
      setScreenshot(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "The report could not be sent."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (viewer === undefined || concepts === undefined || reports === undefined) {
    return (
      <section className="feedback-loading" aria-live="polite">
        <span>Feedback</span>
        <strong>Preparing your report.</strong>
      </section>
    );
  }

  if (viewer === null) {
    return (
      <section className="feedback-loading is-danger">
        <span>Session required</span>
        <strong>Sign in before sending a report.</strong>
      </section>
    );
  }

  return (
    <main className="feedback-page">
      <div className="feedback-composer-grid">
        <section className="feedback-report" aria-labelledby="feedback-report-title">
          <header className="feedback-report__head">
            <div>
              <p>Feedback report</p>
              <h2 id="feedback-report-title">Tell us what needs attention.</h2>
            </div>
            <span>Operator / @{viewer.handle}</span>
          </header>

          {submittedReport ? (
            <article
              className="feedback-receipt"
              ref={receiptRef}
              tabIndex={-1}
              aria-labelledby="feedback-receipt-title"
            >
              <p className="feedback-receipt__eyebrow">Report received</p>
              <p className="feedback-receipt__reference">
                {formatFeedbackReference(submittedReport.recordNumber)}
              </p>
              <h3 id="feedback-receipt-title">Thanks — we have your report.</h3>
              <p>
                Its status will appear below as it moves from received to review and
                resolution.
              </p>
              <div className="feedback-receipt__actions">
                <a href={`/feedback/${submittedReport.id}`}>View report</a>
                <button type="button" onClick={() => setSubmittedReport(null)}>
                  Done
                </button>
              </div>
            </article>
          ) : (
            <form className="feedback-form" onSubmit={onSubmit} noValidate>
              <fieldset className="feedback-step feedback-type-step">
                <legend>
                  <span>01 /</span> What do you need?
                </legend>
                <div className="feedback-type-selector" role="radiogroup">
                  {categoryOptions.map((option) => (
                    <label
                      key={option.value}
                      className={
                        category === option.value
                          ? "feedback-type-option is-active"
                          : "feedback-type-option"
                      }
                    >
                      <input
                        checked={category === option.value}
                        name="feedback-type"
                        type="radio"
                        value={option.value}
                        aria-describedby={
                          category === option.value
                            ? "feedback-type-description"
                            : undefined
                        }
                        onChange={() => {
                          setCategory(option.value);
                          setErrorMessage(null);
                        }}
                      />
                      <span aria-hidden="true">
                        {category === option.value ? "●" : "○"}
                      </span>
                      {option.label}
                    </label>
                  ))}
                </div>
                <p
                  className="feedback-type-description"
                  id="feedback-type-description"
                  aria-live="polite"
                >
                  {selectedCategory
                    ? selectedCategory.detail
                    : "Choose the report type that best matches what you found."}
                </p>
              </fieldset>

              <section
                className="feedback-step feedback-context-mobile"
                aria-labelledby="feedback-context-mobile-title"
              >
                <div className="feedback-step__title">
                  <h3 id="feedback-context-mobile-title">
                    <span>02 /</span> Context
                  </h3>
                  <em>Optional</em>
                </div>
                <CompactContextSummary
                  context={attachedContext ? {
                    title: attachedContext.concept?.title ?? "Generation run",
                    kitVariant: attachedContext.kitVariant,
                    stylePreset: attachedContext.stylePreset,
                  } : attachedContext}
                  loading={Boolean((conceptId || generationJobId) && attachedContext === undefined)}
                  onRemove={() => {
                    setConceptId(null);
                    setGenerationJobId(null);
                  }}
                />
              </section>

              <section className="feedback-step" aria-labelledby="feedback-details-title">
                <div className="feedback-step__title">
                  <h3 id="feedback-details-title">
                    <span>03 /</span> Report
                  </h3>
                </div>

                <label className="feedback-field">
                  <span>Short title</span>
                  <input
                    autoComplete="off"
                    maxLength={80}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Shoulder masking breaks apart"
                  />
                </label>

                <label className="feedback-field">
                  <span>Describe the issue</span>
                  <textarea
                    aria-describedby="feedback-report-counter"
                    maxLength={501}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="The masking boundary around the shoulder separates from the armor geometry..."
                  />
                  <small
                    className={messageRemaining < 0 ? "is-danger" : undefined}
                    id="feedback-report-counter"
                  >
                    {message.length}/500
                  </small>
                </label>

                <div className="feedback-upload">
                  <div className="feedback-upload__copy">
                    <span>Attachment · Optional</span>
                    <p>PNG / JPG · up to 10 MB</p>
                  </div>
                  {screenshotPreview ? (
                    <div className="feedback-upload__preview">
                      <img alt="Screenshot attachment preview" src={screenshotPreview} />
                      <div>
                        <strong>{screenshot?.name}</strong>
                        <button type="button" onClick={() => setScreenshot(null)}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="feedback-upload__button">
                      <input
                        accept="image/png,image/jpeg"
                        type="file"
                        onChange={(event) => {
                          const file = event.target.files?.[0] ?? null;
                          event.target.value = "";
                          if (!file) return;
                          if (!["image/png", "image/jpeg"].includes(file.type)) {
                            setErrorMessage("Choose a PNG or JPG screenshot.");
                            return;
                          }
                          if (file.size > 10 * 1024 * 1024) {
                            setErrorMessage("Screenshots must be 10 MB or smaller.");
                            return;
                          }
                          setScreenshot(file);
                          setErrorMessage(null);
                        }}
                      />
                      <span>＋ Add screenshot</span>
                    </label>
                  )}
                  {attachedContext?.previewAsset?.publicUrl && !screenshot ? (
                    <p className="feedback-upload__inherited">
                      The prototype image is already included as context.
                    </p>
                  ) : null}
                </div>

                {errorMessage ? (
                  <p className="feedback-error" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <button
                  className="feedback-submit"
                  disabled={isSubmitting || messageRemaining < 0}
                  type="submit"
                >
                  <span>{isSubmitting ? "Sending report" : "Send report"}</span>
                  <span aria-hidden="true">→</span>
                </button>
              </section>
            </form>
          )}
        </section>

        <aside
          className={
            attachedContext ? "feedback-context has-context" : "feedback-context"
          }
          aria-labelledby="feedback-context-title"
        >
          <header>
            <p id="feedback-context-title">Attached context</p>
            <span>{attachedContext ? "Linked" : "Optional"}</span>
          </header>

          {(conceptId || generationJobId) && attachedContext === undefined ? (
            <div className="feedback-context__empty" aria-live="polite">
              <strong>Loading prototype context.</strong>
              <p>Checking the linked build and generation image.</p>
            </div>
          ) : attachedContext ? (
            <>
              <div className="feedback-context__preview">
                {attachedContext.previewAsset?.publicUrl ? (
                  <img
                    alt={`${attachedContext.concept?.title ?? "Generation run"} generated prototype`}
                    src={attachedContext.previewAsset.publicUrl}
                  />
                ) : (
                  <span>Preview unavailable</span>
                )}
              </div>
              <div className="feedback-context__body">
                <p className="feedback-context__record">
                  {attachedContext.concept
                    ? formatPrototypeReference(
                        attachedContext.concept.recordNumber,
                        attachedContext.concept._id
                      )
                    : `RUN / ${attachedContext.generationJob?._id.slice(-6).toUpperCase()}`}
                </p>
                <h3>{attachedContext.concept?.title ?? "Generation result"}</h3>
                <ContextField
                  label="Kit"
                  value={attachedContext.kitVariant?.name ?? "Not specified"}
                />
                <ContextField
                  label="Style DNA"
                  value={attachedContext.stylePreset?.name ?? "Not specified"}
                />
                <ContextField
                  label="Material"
                  value={attachedContext.materialPreset?.name ?? "Not specified"}
                />
                <button
                  className="feedback-context__remove"
                  type="button"
                  onClick={() => {
                    setConceptId(null);
                    setGenerationJobId(null);
                    setPickerOpen(false);
                  }}
                >
                  <span aria-hidden="true">×</span> Remove attachment
                </button>
              </div>
            </>
          ) : (
            <div className="feedback-context__empty">
              <strong>
                {conceptId ? "Prototype could not be attached." : "No prototype attached."}
              </strong>
              <p>You can submit general feedback without attaching a build.</p>
              {pickerOpen ? (
                <label className="feedback-context__picker">
                  <span>Choose one of your prototypes</span>
                  <select
                    value=""
                    onChange={(event) => {
                      if (event.target.value) {
                        setConceptId(event.target.value);
                        setPickerOpen(false);
                      }
                    }}
                  >
                    <option value="">Select prototype…</option>
                    {concepts.map((concept) => (
                      <option key={concept._id} value={concept._id}>
                        {concept.title}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <button
                  className="feedback-context__attach"
                  type="button"
                  onClick={() => setPickerOpen(true)}
                >
                  Attach prototype
                </button>
              )}
            </div>
          )}
        </aside>
      </div>

      <section
        className="feedback-recent"
        id="recent-reports"
        aria-labelledby="recent-reports-title"
      >
        <header>
          <div>
            <p>Recent reports</p>
            <h2 id="recent-reports-title">Your feedback history</h2>
          </div>
          <a href="/feedback/reports">View all reports →</a>
        </header>

        {recentReports.length === 0 ? (
          <p className="feedback-recent__empty">
            Your submitted reports will appear here with their review status.
          </p>
        ) : (
          <div className="feedback-recent__table">
            <div className="feedback-recent__head" aria-hidden="true">
              <span>Reference</span>
              <span>Type</span>
              <span>Context</span>
              <span>Status</span>
              <span>Submitted</span>
            </div>
            {recentReports.map((report) => (
              <a
                className="feedback-recent__row"
                href={`/feedback/${report._id}`}
                key={report._id}
              >
                <strong>{formatFeedbackReference(report.recordNumber, report._id)}</strong>
                <span>{formatCategory(report.category)}</span>
                <span>{report.concept?.title ?? "General feedback"}</span>
                <StatusLabel status={report.status} />
                <time dateTime={new Date(report._creationTime).toISOString()}>
                  {formatReportDate(report._creationTime)}
                </time>
              </a>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function CompactContextSummary({
  context,
  loading,
  onRemove,
}: {
  context:
    | {
        title: string;
        kitVariant: { name: string } | null;
        stylePreset: { name: string } | null;
      }
    | null
    | undefined;
  loading: boolean;
  onRemove: () => void;
}) {
  if (loading) {
    return <p className="feedback-context-mobile__empty">Loading attached prototype…</p>;
  }

  if (!context) {
    return (
      <p className="feedback-context-mobile__empty">
        No prototype attached. Add one from the context panel when needed.
      </p>
    );
  }

  return (
    <div className="feedback-context-mobile__summary">
      <div>
        <strong>{context.title}</strong>
        <span>
          {[context.kitVariant?.name, context.stylePreset?.name]
            .filter(Boolean)
            .join(" / ")}
        </span>
      </div>
      <button type="button" onClick={onRemove}>
        Remove
      </button>
    </div>
  );
}

function ContextField({ label, value }: { label: string; value: string }) {
  return (
    <div className="feedback-context__field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusLabel({ status }: { status: string }) {
  return (
    <span className={`feedback-status is-${status}`}>
      <i aria-hidden="true" />
      {formatStatus(status)}
    </span>
  );
}

function isFeedbackCategory(value: string | undefined): value is FeedbackCategory {
  return categoryOptions.some((option) => option.value === value);
}

function isFeedbackSource(
  value: string | undefined
): value is NonNullable<FeedbackWorkbenchSearch["source"]> {
  return ["prototype", "generation-result", "showcase", "library"].includes(value ?? "");
}

function parseOptionalSearchValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function formatCategory(category: string) {
  return (
    categoryOptions.find((option) => option.value === category)?.label ?? category
  );
}

export function formatStatus(status: string) {
  if (status === "open") {
    return "Received";
  }
  if (status === "triaged" || status === "reviewing") {
    return "Reviewing";
  }
  if (status === "resolved") {
    return "Resolved";
  }
  if (status === "rejected") {
    return "Rejected";
  }
  return status;
}

export function formatFeedbackReference(recordNumber?: number, id?: string) {
  return recordNumber
    ? `F-${String(recordNumber).padStart(4, "0")}`
    : `F-${id?.slice(-6).toUpperCase() ?? "PENDING"}`;
}

export function formatPrototypeReference(recordNumber?: number, id?: string) {
  return recordNumber
    ? `N°.${String(recordNumber).padStart(3, "0")}`
    : id
      ? "Shared prototype"
      : "Prototype";
}

export function formatReportDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}
