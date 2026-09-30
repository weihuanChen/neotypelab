import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

export function useAdminOverview(enabled = true) {
  const people = useQuery(api.admin.overviewPeople, enabled ? {} : "skip");
  const models = useQuery(api.admin.overviewModels, enabled ? {} : "skip");
  const paints = useQuery(api.admin.overviewPaints, enabled ? {} : "skip");
  const presets = useQuery(api.admin.overviewPresets, enabled ? {} : "skip");
  const desk = useQuery(api.admin.overviewDesk, enabled ? {} : "skip");
  const queued = useQuery(api.admin.overviewJobCount, enabled ? { status: "queued" } : "skip");
  const running = useQuery(api.admin.overviewJobCount, enabled ? { status: "running" } : "skip");
  const succeeded = useQuery(api.admin.overviewJobCount, enabled ? { status: "succeeded" } : "skip");
  const canceled = useQuery(api.admin.overviewJobCount, enabled ? { status: "canceled" } : "skip");
  const failed = useQuery(api.admin.overviewFailedJobs, enabled ? {} : "skip");

  if (!enabled || people === undefined || models === undefined || paints === undefined || presets === undefined || desk === undefined || queued === undefined || running === undefined || succeeded === undefined || canceled === undefined || failed === undefined) {
    return undefined;
  }

  return {
    ...people,
    ...models,
    ...paints,
    ...presets,
    ...desk,
    queuedGenerationCount: queued,
    failedGenerationCount: failed.count,
    recentFailedJobs: failed.recent,
    generationJobCount: queued + running + succeeded + canceled + failed.count,
  };
}
