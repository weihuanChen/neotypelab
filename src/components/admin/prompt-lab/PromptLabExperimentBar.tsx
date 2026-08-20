import { ExternalLinkIcon } from "@radix-ui/react-icons";
import { Link } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PromptTemplateRecord,
  PromptTemplateVersionRecord,
} from "./promptLabTypes";

const currentVersionValue = "__current__";

export function PromptLabExperimentBar({
  runCount,
  selectedTemplate,
  selectedVersion,
  templates,
  onTemplateChange,
  onVersionChange,
}: {
  runCount: number;
  selectedTemplate: PromptTemplateRecord | null;
  selectedVersion: PromptTemplateVersionRecord | null;
  templates: PromptTemplateRecord[] | undefined;
  onTemplateChange: (templateId: string) => void;
  onVersionChange: (versionId: string | null) => void;
}) {
  const versions = selectedTemplate?.versions ?? [];
  const effectiveStatus = selectedVersion?.status ?? (selectedTemplate?.isActive ? "published" : "archived");

  return (
    <header className="prompt-lab-experiment-bar">
      <div className="prompt-lab-experiment-title">
        <p>Admin / Prompt Lab</p>
        <div>
          <h2>Prompt Lab</h2>
          <span>Manual prompt experiments and evaluation.</span>
        </div>
      </div>

      <div className="prompt-lab-template-controls">
        <label>
          <span>Template</span>
          <Select
            disabled={!templates?.length}
            onValueChange={onTemplateChange}
            value={selectedTemplate?._id ?? ""}
          >
            <SelectTrigger aria-label="Experiment template">
              <SelectValue placeholder="Select template" />
            </SelectTrigger>
            <SelectContent>
              {templates?.map((template) => (
                <SelectItem key={template._id} value={template._id}>
                  {template.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label>
          <span>Version</span>
          <Select
            disabled={!selectedTemplate}
            onValueChange={(value) =>
              onVersionChange(value === currentVersionValue ? null : value)
            }
            value={selectedVersion?._id ?? currentVersionValue}
          >
            <SelectTrigger aria-label="Template version">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {versions.length === 0 ? (
                <SelectItem value={currentVersionValue}>{selectedTemplate?.version ?? "Current"}</SelectItem>
              ) : (
                versions.map((version) => (
                  <SelectItem key={version._id ?? currentVersionValue} value={version._id ?? currentVersionValue}>
                    {version.version} · {version.status}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </label>

        <div className="prompt-lab-template-state" aria-label={`Template status ${effectiveStatus}`}>
          <span>Status</span>
          <strong className={`is-${effectiveStatus}`}>
            <i aria-hidden="true" />
            {effectiveStatus}
          </strong>
        </div>
      </div>

      <div className="prompt-lab-experiment-actions">
        {selectedTemplate ? (
          <Link
            search={{
              template: selectedTemplate._id,
              version: selectedVersion?._id ?? undefined,
            }}
            to="/admin/templates"
          >
            Open template
            <ExternalLinkIcon aria-hidden="true" />
          </Link>
        ) : (
          <span>Open template</span>
        )}
        <strong>
          {runCount}
          <small>runs</small>
        </strong>
      </div>
    </header>
  );
}
