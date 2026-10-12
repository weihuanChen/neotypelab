import type { StyleIntent } from "./creativeContracts";
import { effectiveStyleForExecution, type ResolvedCreativeIntent } from "./creativeIntentResolver";
import type { VisualPalette } from "./paintRecommendationEngine";

type RenderView = { mode: string; directive: string; layout: string; stage?: string; materialComparison?: string };
type CompileInput = {
  systemPrompt: string;
  userPromptTemplate: string;
  geometry: string;
  palette: VisualPalette;
  specificationJson: string;
  intent: ResolvedCreativeIntent;
  guardedStyle: StyleIntent;
  materialType?: string;
  view: RenderView;
  guards: string[];
};

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Missing approved ${label}`);
  return value as Record<string, unknown>;
}

/** Complete execution data once; lineage, original inputs and catalog metadata stay in storage. */
export function compileRenderIntentPrompt(input: CompileInput) {
  const specification = object(JSON.parse(input.specificationJson), "repaint specification");
  const assignments = specification.panels;
  if (!Array.isArray(assignments) || !assignments.length) throw new Error("The approved specification has no panel assignments");
  const material = object(specification.material, "material instructions");
  const weathering = object(specification.weathering, "weathering instructions");
  const hardConstraints = input.intent.constraints.filter(constraint => constraint.status === "active" && constraint.strength === "hard")
    .map(constraint => ({ property: constraint.property, ...(constraint.colorId ? { colorId: constraint.colorId } : {}), scope: constraint.scope, value: constraint.value }));
  const uniqueConstraints = Array.from(new Map(hardConstraints.map(constraint => [JSON.stringify(constraint), constraint])).values());
  const style = input.guardedStyle;
  const behaviorStyle = effectiveStyleForExecution({ ...input.intent, effectiveStyle: style });
  const contract = {
    version: "render-intent.v1",
    paletteVersion: input.palette.version,
    geometry: input.geometry,
    palette: input.palette.entries.map(entry => ({
      colorId: entry.colorId, colorName: entry.colorName, roleSlug: entry.roleSlug, targetHex: entry.targetHex, paintEffect: entry.paintEffect,
      ...(entry.coverage ? { coverage: { scope: entry.coverage.scope, ...(entry.coverage.part ? { part: entry.coverage.part } : {}), percent: entry.coverage.percent } } : {}),
    })),
    assignments,
    hardConstraints: uniqueConstraints,
    style: behaviorStyle,
    material: { ...material, ...(input.materialType ? { materialType: input.materialType } : {}) },
    weathering,
    decals: specification.decals,
    summary: specification.summary,
    view: input.view,
  };
  const reference = (path: string) => JSON.stringify({ source: "frozen-render-contract", path });
  const values: Record<string, string> = {
    baseModel: reference("geometry"), kitVariant: reference("geometry"), conceptId: "Approved concept",
    stylePreset: reference("style"), mood: style.mood, weatheringLevel: String(weathering.level), materialPreset: reference("material"),
    notes: "Apply the frozen render contract.", colorRoles: reference("palette"), topPalette: reference("palette"), approvedPalette: reference("palette"),
    renderSpecification: reference("assignments, material, weathering, decals"), resolvedIntent: reference("hardConstraints, style"),
    renderMode: input.view.mode, renderDirective: input.view.directive, layoutSpec: input.view.layout,
    simulationStage: input.view.stage ?? "", materialComparison: input.view.materialComparison ?? "",
  };
  const template = input.userPromptTemplate.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
  const prompt = [input.systemPrompt, template, ...input.guards,
    "Complete surface color guard: every painted kit surface must use a target color from the approved palette, including surfaces without an explicit assignment. Freely divide unassigned head, shield, weapon, backpack, leg and foot panels within the approved colors applicable to each surface's armor, frame, sensor or marking role; never inherit the kit's original paint colors or invent another body paint color. Natural lighting highlights and shadows are surface illumination, not additional paint colors.",
    "Approved repaint specification and complete visual palette are expressed once in the following frozen render contract. Color IDs link every assignment to its palette entry; execute all hard constraints. Explicit administrator template camera and layout instructions govern the view; view fields supply defaults where the template is silent. Never render these instructions as text.",
    `Frozen render contract JSON:\n${JSON.stringify(contract)}`,
  ].filter(Boolean).join("\n\n");
  return { prompt, contract };
}
