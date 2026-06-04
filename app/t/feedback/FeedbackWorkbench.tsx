"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "convex/react";
import { ReactNode, useMemo, useState } from "react";

const categoryOptions = [
  {
    value: "missing-base-model",
    label: "Missing Base Model",
    detail: "Request a kit or silhouette that is not in the catalog yet.",
  },
  {
    value: "style-request",
    label: "Style Request",
    detail: "Suggest a new Style DNA direction for future prompt templates.",
  },
  {
    value: "generation-quality",
    label: "Generation Quality",
    detail: "Report masking, realism, or rendering behavior that breaks spray logic.",
  },
  {
    value: "paint-mapping",
    label: "Paint Mapping",
    detail: "Flag missing or unrealistic real-world paint recommendations.",
  },
  {
    value: "other",
    label: "Other",
    detail: "Use when the issue does not fit the main structured categories.",
  },
] as const;

type FeedbackCategory = (typeof categoryOptions)[number]["value"];

export function FeedbackWorkbench() {
  const viewer = useQuery(api.users.viewer);
  const catalog = useQuery(api.catalog.listCreateOptions);
  const concepts = useQuery(api.concepts.listLibrary);
  const reports = useQuery(api.feedback.listMine);
  const createFeedback = useMutation(api.feedback.create);

  const [category, setCategory] = useState<FeedbackCategory>("generation-quality");
  const [conceptId, setConceptId] = useState<string>("none");
  const [baseModelId, setBaseModelId] = useState<string>("none");
  const [stylePresetId, setStylePresetId] = useState<string>("none");
  const [titleHint, setTitleHint] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedConcept = useMemo(
    () => concepts?.find((concept) => concept._id === conceptId) ?? null,
    [conceptId, concepts]
  );
  const effectiveBaseModelId =
    baseModelId !== "none"
      ? (baseModelId as Id<"baseModels">)
      : selectedConcept?.baseModelId ?? undefined;
  const effectiveStylePresetId =
    stylePresetId !== "none"
      ? (stylePresetId as Id<"stylePresets">)
      : selectedConcept?.stylePresetId ?? undefined;
  const messageRemaining = 500 - message.length;

  async function onSubmit() {
    setErrorMessage(null);
    setStatusMessage(null);

    if (message.trim().length < 12) {
      setErrorMessage("Feedback needs a little more detail before it can enter the admin queue.");
      return;
    }

    setIsSubmitting(true);
    try {
      await createFeedback({
        category,
        message: titleHint.trim()
          ? `${titleHint.trim()}\n\n${message.trim()}`
          : message.trim(),
        conceptId: conceptId !== "none" ? (conceptId as Id<"concepts">) : undefined,
        baseModelId: effectiveBaseModelId,
        stylePresetId: effectiveStylePresetId,
        sourcePage: "/t/feedback",
      });
      setStatusMessage("Feedback routed into the lab queue. Admin can now triage it.");
      setTitleHint("");
      setMessage("");
      setConceptId("none");
      setBaseModelId("none");
      setStylePresetId("none");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (
    viewer === undefined ||
    catalog === undefined ||
    concepts === undefined ||
    reports === undefined
  ) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Feedback relay</p>
        <h2 className="mt-4 text-3xl font-semibold">Syncing operator feedback channels</h2>
      </section>
    );
  }

  if (viewer === null) {
    return (
      <section className="rounded-[28px] border border-[#FF5F5F]/20 bg-[#161B22] p-6 text-[#E6EDF3]">
        <p className="text-xs uppercase tracking-[0.3em] text-[#FF8E8E]">Session required</p>
        <h2 className="mt-4 text-3xl font-semibold">Operator identity is not available</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9BA7B4]">
          Sign back in before routing feedback into the expansion queue.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_380px]">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6 text-[#E6EDF3]">
          <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">Feedback pipeline</p>
          <h2 className="mt-4 text-3xl font-semibold">Structured lab reports for dataset expansion</h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9BA7B4]">
            This channel turns operator experience into structured product signals. Every
            report enters `feedbackReports`, links to the relevant concept when available,
            and lands in `adminQueue` for internal triage.
          </p>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6 text-[#E6EDF3]">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#6E7A88]">Report composer</p>
              <h3 className="mt-2 text-2xl font-semibold">Capture the issue in product terms</h3>
            </div>
            <p className="max-w-xl text-sm leading-6 text-[#9BA7B4]">
              Keep the report specific. Reference the prototype when relevant, and describe
              what should change in the model catalog, Style DNA library, or generation logic.
            </p>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {categoryOptions.map((option) => {
              const active = category === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setCategory(option.value)}
                  className={cn(
                    "rounded-[22px] border p-4 text-left transition-all",
                    active
                      ? "border-[#58FFB2]/45 bg-[#58FFB2]/10 shadow-[0_0_0_1px_rgba(88,255,178,0.14)]"
                      : "border-white/10 bg-[#161B22] hover:border-white/20 hover:bg-[#1B222C]"
                  )}
                >
                  <p className="text-[11px] uppercase tracking-[0.26em] text-[#3DD9FF]">
                    Category
                  </p>
                  <h4 className="mt-2 text-lg font-semibold">{option.label}</h4>
                  <p className="mt-3 text-sm leading-6 text-[#9BA7B4]">{option.detail}</p>
                </button>
              );
            })}
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Field label="Related Prototype">
              <Select value={conceptId} onValueChange={setConceptId}>
                <SelectTrigger className="h-11 border-white/10 bg-[#161B22] text-[#E6EDF3]">
                  <SelectValue placeholder="Attach a concept if this report came from a prototype" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#11161D] text-[#E6EDF3]">
                  <SelectItem value="none">No concept attachment</SelectItem>
                  {concepts.map((concept) => (
                    <SelectItem key={concept._id} value={concept._id}>
                      {concept.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Operator">
              <Input
                readOnly
                value={`${viewer.fullName} / @${viewer.handle}`}
                className="h-11 border-white/10 bg-[#161B22] text-[#9BA7B4]"
              />
            </Field>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Field label="Base Model Context">
              <Select value={baseModelId} onValueChange={setBaseModelId}>
                <SelectTrigger className="h-11 border-white/10 bg-[#161B22] text-[#E6EDF3]">
                  <SelectValue placeholder="Select base model or inherit from concept" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#11161D] text-[#E6EDF3]">
                  <SelectItem value="none">
                    {selectedConcept?.baseModel?.name
                      ? `Inherit from concept: ${selectedConcept.baseModel.name}`
                      : "No explicit base model"}
                  </SelectItem>
                  {catalog.baseModels.map((model) => (
                    <SelectItem key={model._id} value={model._id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Style DNA Context">
              <Select value={stylePresetId} onValueChange={setStylePresetId}>
                <SelectTrigger className="h-11 border-white/10 bg-[#161B22] text-[#E6EDF3]">
                  <SelectValue placeholder="Select style or inherit from concept" />
                </SelectTrigger>
                <SelectContent className="border-white/10 bg-[#11161D] text-[#E6EDF3]">
                  <SelectItem value="none">
                    {selectedConcept?.stylePreset?.name
                      ? `Inherit from concept: ${selectedConcept.stylePreset.name}`
                      : "No explicit Style DNA"}
                  </SelectItem>
                  {catalog.stylePresets.map((preset) => (
                    <SelectItem key={preset._id} value={preset._id}>
                      {preset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="mt-4 grid gap-4">
            <Field label="Short Signal Header">
              <Input
                value={titleHint}
                onChange={(event) => setTitleHint(event.target.value)}
                placeholder="Example: Missing HG Aerial Rebuild"
                className="h-11 border-white/10 bg-[#161B22] text-[#E6EDF3] placeholder:text-[#6E7A88]"
              />
            </Field>

            <Field label="Feedback Report">
              <div className="rounded-[22px] border border-white/10 bg-[#161B22] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-[#9BA7B4]">
                    Explain the issue or request in plain product language.
                  </p>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-1 text-[11px]",
                      messageRemaining < 0
                        ? "border-[#FF5F5F]/30 text-[#FF8E8E]"
                        : "border-white/10 text-[#9BA7B4]"
                    )}
                  >
                    {message.length}/500
                  </span>
                </div>
                <Textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Example: The masking boundaries between primary armor and accent zones break apart around the shoulder blocks. This makes the scheme feel unpaintable."
                  className="mt-4 min-h-[180px] resize-none border-white/10 bg-[#0D1117] text-[#E6EDF3] placeholder:text-[#6E7A88] focus-visible:ring-[#58FFB2]"
                />
              </div>
            </Field>
          </div>

          {errorMessage ? (
            <div className="mt-4 rounded-[18px] border border-[#FF5F5F]/20 bg-[#FF5F5F]/10 p-4 text-sm text-[#FFD5D5]">
              {errorMessage}
            </div>
          ) : null}
          {statusMessage ? (
            <div className="mt-4 rounded-[18px] border border-[#58FFB2]/20 bg-[#58FFB2]/10 p-4 text-sm text-[#CFFFE6]">
              {statusMessage}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              disabled={isSubmitting || messageRemaining < 0}
              onClick={() => {
                void onSubmit();
              }}
              className="h-12 rounded-[18px] border border-[#58FFB2]/40 bg-[#0F251C] px-5 text-[#E6EDF3] hover:bg-[#163126]"
            >
              {isSubmitting ? "Routing Lab Report" : "Submit Lab Report"}
            </Button>
            <div className="rounded-[18px] border border-white/10 bg-black/20 px-4 py-3 text-xs leading-5 text-[#9BA7B4]">
              Each report becomes a structured expansion signal, not a freeform support ticket.
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <section className="rounded-[28px] border border-white/10 bg-[#11161D] p-6 text-[#E6EDF3]">
          <p className="text-xs uppercase tracking-[0.3em] text-[#3DD9FF]">Context relay</p>
          <div className="mt-5 space-y-4">
            <MetaRow label="Reports filed" value={`${reports.length}`} />
            <MetaRow
              label="Open queue"
              value={`${reports.filter((item) => item.status === "open").length}`}
            />
            <MetaRow
              label="Current concept"
              value={selectedConcept?.title ?? "No concept attached"}
            />
            <MetaRow
              label="Base model"
              value={
                catalog.baseModels.find((item) => item._id === effectiveBaseModelId)?.name ??
                selectedConcept?.baseModel?.name ??
                "Unspecified"
              }
            />
            <MetaRow
              label="Style DNA"
              value={
                catalog.stylePresets.find((item) => item._id === effectiveStylePresetId)?.name ??
                selectedConcept?.stylePreset?.name ??
                "Unspecified"
              }
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-white/10 bg-[#161B22] p-6 text-[#E6EDF3]">
          <p className="text-xs uppercase tracking-[0.3em] text-[#58FFB2]">My reports</p>
          <div className="mt-4 space-y-3">
            {reports.length === 0 ? (
              <div className="rounded-[18px] border border-white/10 bg-[#11161D] p-4 text-sm leading-6 text-[#9BA7B4]">
                No feedback reports yet. The first structured report you send will appear here
                with status and queue context.
              </div>
            ) : (
              reports.map((report) => (
                <article
                  key={report._id}
                  className="rounded-[20px] border border-white/10 bg-[#11161D] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill label={report.category} tone="cyan" />
                    <StatusPill label={report.status} tone={statusTone(report.status)} />
                    {report.queue ? (
                      <StatusPill label={`priority ${report.queue.priority}`} tone="amber" />
                    ) : null}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#E6EDF3]">{report.message}</p>
                  <div className="mt-4 space-y-2 text-xs text-[#9BA7B4]">
                    {report.concept ? <p>Prototype: {report.concept.title}</p> : null}
                    {report.baseModel ? <p>Base Model: {report.baseModel.name}</p> : null}
                    {report.stylePreset ? <p>Style DNA: {report.stylePreset.name}</p> : null}
                    {report.adminNotes ? <p>Admin Notes: {report.adminNotes}</p> : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-[0.22em] text-[#6E7A88]">{label}</span>
      <div className="mt-2">{children}</div>
    </label>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/6 pb-3">
      <span className="text-[11px] uppercase tracking-[0.2em] text-[#6E7A88]">{label}</span>
      <span className="max-w-[58%] text-right text-sm text-[#E6EDF3]">{value}</span>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "cyan" | "green" | "amber" | "red";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.18em]",
        tone === "cyan" && "border-[#3DD9FF]/30 bg-[#3DD9FF]/10 text-[#8FEAFF]",
        tone === "green" && "border-[#58FFB2]/30 bg-[#58FFB2]/10 text-[#A6FFD5]",
        tone === "amber" && "border-[#FFB84D]/30 bg-[#FFB84D]/10 text-[#FFD59A]",
        tone === "red" && "border-[#FF5F5F]/30 bg-[#FF5F5F]/10 text-[#FFD2D2]"
      )}
    >
      {label}
    </span>
  );
}

function statusTone(status: string): "cyan" | "green" | "amber" | "red" {
  if (status === "open") {
    return "cyan";
  }
  if (status === "triaged") {
    return "amber";
  }
  if (status === "resolved") {
    return "green";
  }
  return "red";
}
