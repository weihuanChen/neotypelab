import { CopyIcon, ExternalLinkIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { LabActionButton, LabEmpty, RunStatusMark } from "./PromptLabPrimitives";
import type { PromptExperimentRun, PromptRunStatus } from "./promptLabTypes";
import {
  formatDateTime,
  shortRunId,
  snapshotName,
  snapshotRecord,
} from "./promptLabUtils";

const scoreRows: Array<[string, keyof PromptExperimentRun]> = [
  ["Silhouette", "silhouetteScore"],
  ["Style", "styleHitScore"],
  ["Paintability", "paintabilityScore"],
  ["Adherence", "promptAdherenceScore"],
  ["Impact", "visualImpactScore"],
];

export function ExperimentRunInspector({
  busyKey,
  onStatusChange,
  run,
}: {
  busyKey: string | null;
  onStatusChange: (status: PromptRunStatus, selectedAsWinner: boolean) => void;
  run: PromptExperimentRun | null;
}) {
  const [copied, setCopied] = useState(false);
  if (!run) {
    return <aside className="prompt-run-inspector"><LabEmpty>Select a run to inspect its output and snapshots.</LabEmpty></aside>;
  }

  const input = run.inputSnapshot;
  const kit = snapshotName(input?.kitVariant) ?? snapshotName(input?.baseModel) ?? "Not selected";
  const style = snapshotName(input?.stylePreset) ?? "Not selected";
  const material = snapshotName(input?.materialPreset) ?? "Not selected";
  const moodTags = Array.isArray(input?.moodTags) ? input.moodTags.join(", ") : "None";
  const weathering = typeof input?.weatheringLevel === "string" ? input.weatheringLevel : "—";
  const notes = typeof input?.notes === "string" ? input.notes : undefined;
  const template = snapshotRecord(run.templateSnapshot);
  const systemPrompt = typeof template?.systemPrompt === "string" ? template.systemPrompt : "";
  const fullPrompt = [systemPrompt ? `SYSTEM\n${systemPrompt}` : "", `USER\n${run.composedPrompt}`]
    .filter(Boolean)
    .join("\n\n");
  const imageUrl = validHttpUrl(run.outputImageUrl);

  const copyPrompt = async () => {
    await navigator.clipboard.writeText(fullPrompt);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  return (
    <aside className="prompt-run-inspector">
      <header>
        <div>
          <p>Run #{shortRunId(run._id)}</p>
          <h3>{run.providerLabel || "Manual web"} / {run.modelLabel || "Unlabeled model"}</h3>
          <span>{formatDateTime(run._creationTime)}</span>
        </div>
        <RunStatusMark status={run.status} />
      </header>

      {imageUrl ? (
        <figure className="prompt-run-output">
          <img alt={`Output for ${run.templateName} ${run.templateVersion}`} src={imageUrl} />
          <a href={imageUrl} rel="noreferrer" target="_blank">
            Open image <ExternalLinkIcon aria-hidden="true" />
          </a>
        </figure>
      ) : (
        <div className="prompt-run-no-output">No valid output image URL recorded.</div>
      )}

      <InspectorSection title="Input">
        <InspectorRows rows={[
          ["Kit", kit],
          ["Style DNA", style],
          ["Material", material],
          ["Mood", moodTags],
          ["Weathering", weathering],
        ]} />
      </InspectorSection>

      <InspectorSection title="Evaluation">
        <InspectorRows
          rows={scoreRows.map(([label, key]) => [
            label,
            typeof run[key] === "number" ? `${run[key]}/10` : "—",
          ])}
        />
        <div className="prompt-run-overall">
          <span>Overall</span>
          <strong>{run.overallScore === undefined ? "—" : run.overallScore.toFixed(1)}</strong>
        </div>
      </InspectorSection>

      {run.outputNotes || notes ? (
        <InspectorSection title="Notes">
          {run.outputNotes ? <p>{run.outputNotes}</p> : null}
          {notes ? <small>Input note: {notes}</small> : null}
        </InspectorSection>
      ) : null}

      {run.failureTags.length ? (
        <InspectorSection title="Failure tags">
          <div className="prompt-run-tags">
            {run.failureTags.map((tag) => <code key={tag}>{tag}</code>)}
          </div>
        </InspectorSection>
      ) : null}

      <InspectorSection title="Prompt snapshot">
        <div className="prompt-run-snapshot-head">
          <span>{run.templateName}<small>{run.templateVersion} · {fullPrompt.length.toLocaleString()} chars</small></span>
          {run.promptTemplateId ? (
            <Link
              aria-label="Open run template"
              search={{
                template: run.promptTemplateId,
                version: run.promptTemplateVersionId,
              }}
              title="Open template"
              to="/admin/templates"
            >
              <ExternalLinkIcon />
            </Link>
          ) : null}
        </div>
        <details className="prompt-run-prompt-details">
          <summary>View prompt</summary>
          <pre>{fullPrompt}</pre>
        </details>
        <button className="prompt-run-copy" onClick={() => void copyPrompt()} type="button">
          <CopyIcon aria-hidden="true" />
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </InspectorSection>

      <div className="prompt-run-inspector-actions">
        <LabActionButton
          busy={busyKey === `run-selected-${run._id}`}
          disabled={run.status === "selected"}
          onClick={() => onStatusChange("selected", true)}
        >
          Select
        </LabActionButton>
        <LabActionButton
          busy={busyKey === `run-rejected-${run._id}`}
          disabled={run.status === "rejected"}
          onClick={() => onStatusChange("rejected", false)}
          tone="danger"
        >
          Reject
        </LabActionButton>
        <LabActionButton
          busy={busyKey === `run-archived-${run._id}`}
          disabled={run.status === "archived"}
          onClick={() => onStatusChange("archived", false)}
          tone="quiet"
        >
          Archive
        </LabActionButton>
      </div>
    </aside>
  );
}

function InspectorSection({ children, title }: { children: React.ReactNode; title: string }) {
  return <section className="prompt-run-inspector-section"><h4>{title}</h4>{children}</section>;
}

function InspectorRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className="prompt-run-inspector-rows">
      {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
    </dl>
  );
}

function validHttpUrl(value?: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
