import type { RepaintV3, IntentScope } from "./creativeContracts";
import type { ResolvedCreativeIntent } from "./creativeIntentResolver";

const armorRoles = new Set(["primary-armor", "secondary-armor", "accent"]);
function appliesToArea(scope: IntentScope, role: string, area: string) {
  if (scope.kind === "part") {
    const part = scope.part!.toLowerCase();
    const escaped = part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return /^[a-z0-9 _-]+$/i.test(part)
      ? new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, "i").test(area)
      : area.toLowerCase().includes(part);
  }
  if (scope.kind === "exterior-armor") return armorRoles.has(role);
  if (scope.kind === "inner-frame") return role === "inner-frame";
  if (scope.kind === "sensors") return role === "sensor-color";
  if (scope.kind === "markings") return role === "markings";
  return false;
}

/** Bind immutable user materials to actual surfaces, without changing global finish or inferred prose. */
export function bindScopedMaterialIntents(specification: RepaintV3, intent: ResolvedCreativeIntent): RepaintV3 {
  const constraints = intent.constraints.filter(c => c.status === "active" && c.strength === "hard" && c.property === "material" && c.scope.kind !== "whole-kit");
  const matched = new Set<string>();
  const selectedAreas = new Map<string, Set<string>>();
  for (const panel of specification.panels) {
    for (const area of panel.areas) {
      const candidates = constraints.filter(c => appliesToArea(c.scope, panel.roleSlug, area));
      if (candidates.some(c => c.scope.kind === "part") && /\s(?:and|&)\s|[,;/]/i.test(area)) {
        throw new Error("Specification must split named local material targets into separate area labels");
      }
      for (const candidate of candidates) matched.add(candidate.id);
      const specific = candidates.some(c => c.scope.kind === "part") ? candidates.filter(c => c.scope.kind === "part") : candidates;
      if (new Set(specific.map(c => JSON.stringify(c.value))).size > 1) throw new Error(`Specification has conflicting local materials for ${area}`);
      const selected = specific[0];
      if (!selected) continue;
      const areas = selectedAreas.get(selected.id) ?? new Set<string>();
      areas.add(area);
      selectedAreas.set(selected.id, areas);
    }
  }
  for (const constraint of constraints) {
    if (!matched.has(constraint.id)) throw new Error(`Specification omitted the local material scope ${constraint.scope.part ?? constraint.scope.kind}`);
  }
  const scopedIntents = constraints.flatMap(constraint => {
    const areas = selectedAreas.get(constraint.id);
    return areas?.size ? [{ constraintId: constraint.id, scope: { ...constraint.scope },
      intent: Array.isArray(constraint.value) ? constraint.value.join(", ") : String(constraint.value), areas: [...areas] }] : [];
  });
  if (specification.material.scopedIntents?.length && JSON.stringify(specification.material.scopedIntents) !== JSON.stringify(scopedIntents)) {
    throw new Error("Specification changed the resolved local material assignments");
  }
  if (scopedIntents.length) specification.material.scopedIntents = scopedIntents;
  else delete specification.material.scopedIntents;
  return specification;
}
