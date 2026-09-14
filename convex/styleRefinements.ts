import { styleIntentSchema, type StyleIntent } from "./creativeContracts";

export function readStyleIntent(json?: string): StyleIntent | null {
  if (!json) return null;
  try { return styleIntentSchema.parse(JSON.parse(json)); } catch { return null; }
}

export function resolveStyleRefinements<T extends { _id: string; slug: string; finishType: string; sheenLevel?: string }>(
  intent: StyleIntent | null, materials: T[], recommendedSlugs: string[] = [],
) {
  const finish = intent?.finish ?? "satin";
  const synonyms: Record<string, string[]> = {
    matte: ["matte", "flat"], satin: ["satin", "semi-gloss", "semi_gloss"],
    "semi-gloss": ["semi-gloss", "semi_gloss", "satin"], gloss: ["gloss", "glossy"],
  };
  const match = materials.find(material => synonyms[finish].includes(material.finishType.toLowerCase()) ||
    synonyms[finish].includes(material.sheenLevel?.toLowerCase() ?? ""));
  const recommended = materials.find(material => recommendedSlugs.includes(material.slug));
  return {
    material: intent ? match ?? recommended ?? materials.at(0) ?? null : recommended ?? match ?? materials.at(0) ?? null,
    weathering: intent?.weathering ?? "clean",
    mood: intent?.mood ?? "Style default",
  };
}
