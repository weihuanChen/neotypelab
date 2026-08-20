import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from "@radix-ui/react-icons";
import type { Dispatch, SetStateAction } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LabEmpty, LabSectionLabel, RunStatusMark } from "./PromptLabPrimitives";
import type {
  PromptExperimentRun,
  PromptRunFilters,
  PromptRunRegistryResult,
  PromptRunStatus,
  PromptTemplateRecord,
} from "./promptLabTypes";
import { formatDateTime } from "./promptLabUtils";

const runStatuses: PromptRunStatus[] = [
  "ready-for-web",
  "tested",
  "selected",
  "rejected",
  "archived",
];

export function ExperimentRunRegistry({
  filters,
  loading,
  onPageChange,
  onSelect,
  pageIndex,
  registry,
  selectedRunId,
  setFilters,
  templates,
}: {
  filters: PromptRunFilters;
  loading: boolean;
  onPageChange: (page: number) => void;
  onSelect: (run: PromptExperimentRun) => void;
  pageIndex: number;
  registry: PromptRunRegistryResult | undefined;
  selectedRunId: string | null;
  setFilters: Dispatch<SetStateAction<PromptRunFilters>>;
  templates: PromptTemplateRecord[] | undefined;
}) {
  const runs = registry?.page ?? [];
  const start = registry && registry.filteredTotal > 0 ? pageIndex * registry.pageSize + 1 : 0;
  const end = registry ? Math.min(start + runs.length - 1, registry.filteredTotal) : 0;

  return (
    <section className="prompt-run-registry">
      <LabSectionLabel
        count={registry?.filteredTotal ?? 0}
        description="Search experiments by template, provider and decision status."
        title="Experiment runs"
      />

      <div className="prompt-run-filters">
        <label className="prompt-run-search">
          <MagnifyingGlassIcon aria-hidden="true" />
          <Input
            aria-label="Search experiment runs"
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            placeholder="Search runs"
            value={filters.search}
          />
        </label>
        <Select
          onValueChange={(value) => setFilters((current) => ({ ...current, templateId: value }))}
          value={filters.templateId}
        >
          <SelectTrigger aria-label="Filter by template">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All templates</SelectItem>
            {templates?.map((template) => (
              <SelectItem key={template._id} value={template._id}>{template.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) => setFilters((current) => ({ ...current, provider: value }))}
          value={filters.provider}
        >
          <SelectTrigger aria-label="Filter by provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {registry?.providers.map((provider) => (
              <SelectItem key={provider} value={provider}>{provider}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          onValueChange={(value) =>
            setFilters((current) => ({ ...current, status: value as PromptRunFilters["status"] }))
          }
          value={filters.status}
        >
          <SelectTrigger aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {runStatuses.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="prompt-run-table" role="table" aria-label="Experiment runs">
        <div className="prompt-run-table-head" role="row">
          <span role="columnheader">Status</span>
          <span role="columnheader">Provider</span>
          <span role="columnheader">Template</span>
          <span role="columnheader">Model</span>
          <span role="columnheader">Score</span>
          <span role="columnheader">Date</span>
        </div>
        {loading ? (
          <LabEmpty>Loading experiment runs.</LabEmpty>
        ) : runs.length === 0 ? (
          <LabEmpty>No experiment runs match these filters.</LabEmpty>
        ) : (
          runs.map((run) => (
            <button
              className={cn("prompt-run-table-row", selectedRunId === run._id && "is-active")}
              key={run._id}
              onClick={() => onSelect(run)}
              role="row"
              type="button"
            >
              <span role="cell"><RunStatusMark status={run.status} /></span>
              <span role="cell">{run.providerLabel || "Manual web"}</span>
              <span role="cell">
                <strong>{run.templateName}</strong>
                <small>{run.templateVersion}</small>
              </span>
              <span role="cell">{run.modelLabel || "Unlabeled"}</span>
              <span className="is-score" role="cell">
                {run.overallScore === undefined ? "—" : run.overallScore.toFixed(1)}
              </span>
              <time role="cell">{formatDateTime(run._creationTime)}</time>
            </button>
          ))
        )}
      </div>

      <footer className="prompt-run-pagination">
        <span>{start}–{end} of {registry?.filteredTotal ?? 0}</span>
        <div>
          <button
            aria-label="Previous experiment page"
            disabled={pageIndex <= 0}
            onClick={() => onPageChange(pageIndex - 1)}
            title="Previous page"
            type="button"
          >
            <ChevronLeftIcon />
          </button>
          <button
            aria-label="Next experiment page"
            disabled={!registry || pageIndex + 1 >= registry.pageCount}
            onClick={() => onPageChange(pageIndex + 1)}
            title="Next page"
            type="button"
          >
            <ChevronRightIcon />
          </button>
        </div>
      </footer>
    </section>
  );
}
