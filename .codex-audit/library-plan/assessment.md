# Library improvement assessment

## Scope

Evaluate the proposed Library redesign as a professional prototype operations workspace, grounded in the current signed-out Library surface and the existing Library data/actions in the codebase.

## Verdict

The proposed direction is structurally correct. Library should become the operational bridge between Create and Publish, with a dense asset list on the left and a sticky prototype inspector on the right. The plan should proceed with three adjustments: keep concept lifecycle, render-job state, and visibility as separate dimensions; avoid selection checkboxes until batch operations exist; and treat saved public builds as a distinct mode with a different inspector action set.

## Recommended IA

1. Header: Library / Prototype operations and saved builds.
2. Scope switcher: My Prototypes / Saved Builds.
3. Status lens: All / Draft / Queued / Rendering / Ready / Failed / Archived.
4. Toolbar: Search / Kit / Style DNA / Status / Sort / List-Grid switch.
5. Workspace: 64–68% asset list and 32–36% sticky inspector.
6. Inspector: preview, identity, lifecycle state, ontology, generation metadata, visibility, and context-sensitive actions.

## Product-model constraints

- Current concept states are draft, generated, and archived.
- Current job states are queued, running, succeeded, failed, and canceled.
- Visibility is private, unlisted, or public and should not be treated as a lifecycle status.
- Rendering percentages are not currently represented; use an indeterminate running state until real progress data exists.
- Reliable Updated values require a concept updatedAt field rather than creation time alone.
- Refunded credit confirmation needs job-linked credit transaction data.

## Evidence

- `01-current-signed-out.png`: current unauthenticated Library surface at 1440×900.

## Evidence limit

The authenticated Library could not be visually audited because the active browser session is signed out. Existing authenticated operations were checked from the implementation, but their visual behavior and keyboard interaction remain unverified.
