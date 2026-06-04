# NeotypeLab P3 Advanced Rendering Backlog

Last updated: 2026-05-24

## Purpose

This backlog breaks the `advanced rendering / simulation` track into a practical execution order.

It assumes the current system already supports:

- HD render
- multi-angle preview
- high-fidelity render
- render queueing from the library

The goal now is to turn rendering from a simple upscale path into a more simulation-oriented system.

## Top 10

1. `Build-stage visualization` first pass  
Status: first pass implemented  
Add render-stage previews such as `primer pass`, `decal pass`, and `weathering pass` on top of the existing queue.

2. `Damage / weathering simulation` first pass  
Status: first pass implemented  
Introduce a distinct render directive that visualizes wear, dust, burn marks, and abrasion without mutating the base paint plan.

3. `Turntable / rotation render spec`  
Design a render output mode for rotation-ready or sequence-ready previews, even if the first version is still image based.

4. `Multi-angle contact sheet layout`  
Evolve multi-angle preview from a generic mode into a more explicit sheet-style output for front / side / rear readability.

5. `Material finish comparison render`  
Allow a concept to be previewed across multiple material finish interpretations for decision support.

6. `Before / after weathering split preview`  
Expose a visual comparison between clean and weathered states to make the finishing layer easier to reason about.

7. `Render history labeling and retrieval`  
Make advanced render outputs easier to distinguish and revisit inside the library.

8. `Creator pack rendering presets`  
Let creator packs define recommended advanced render starter modes or simulation defaults.

9. `Render quality review / operator diagnostics`  
Surface render-mode specific telemetry and review notes for internal QA.

10. `Simulation-aware public sharing`  
Expand social/export surfaces so advanced rendering outputs can become shareable assets in their own right.

## Execution Note

The first implementation focus is:

`build-stage visualization`

This is the best next step because it:

- fits the current render queue architecture
- does not require payments or new billing primitives
- creates an immediately understandable new public/product capability
- sets up later weathering and process visualization work
