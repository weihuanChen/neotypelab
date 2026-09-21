# Generation workflow

Preview generation runs as a durable Convex Workflow. The client creates a
`creationRuns` record and receives its ID immediately; the workflow then runs
the palette, repaint specification, and image render stages in sequence.

The Workflow component uses its internal Workpool with `maxParallelism: 4`.
This is a deployment-wide limit for concurrently executing workflow steps, not
a per-user limit. The existing per-user active-job checks still apply.

Each stage updates `creationRuns.status` between `queued` and `running`. The
final render writes the private R2 assets before the run becomes `succeeded`.
The frontend continues to subscribe to `creationRuns.latest`, so no polling is
required.

Provider retries remain inside the text and image execution policies. Workflow
action retries are intentionally disabled because an interrupted external image
request does not provide an idempotent completion guarantee. Workflow failures
are handled by `creationRuns.completeWorkflow`, which marks the run failed and
applies the existing one-time credit refund. Users can retry from the last
completed stage.

`creationRuns.workflowId`, `queuedAt`, `startedAt`, and `completedAt` provide
the identifiers and timestamps needed for operational inspection. The existing
25-minute expiration remains as a final safety net for abandoned runs.
