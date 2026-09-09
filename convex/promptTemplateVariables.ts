import { PromptTemplateKind } from "./domain";

export type PromptTemplateVariableDefinition = {
  key: string;
  label: string;
  description: string;
  kinds: PromptTemplateKind[];
  example: string;
};

export const promptTemplateVariableDefinitions: PromptTemplateVariableDefinition[] = [
  { key: "paintCatalog", label: "Paint catalog capabilities", description: "Available paint effects and catalog sample count.", kinds: ["palette-plan"], example: "solid, metallic" },
  { key: "approvedPalette", label: "Approved palette", description: "Full persisted palette JSON.", kinds: ["repaint-concept", "hd-render"], example: "Approved color-role paint assignments" },
  { key: "renderSpecification", label: "Approved repaint specification", description: "Persisted panel, material, weathering and decal instructions.", kinds: ["hd-render"], example: "Approved repaint specification JSON" },
  {
    key: "baseModel",
    label: "Base Model",
    description: "Full kit grounding and silhouette context.",
    kinds: ["palette-plan", "style-suggestion", "repaint-concept", "hd-render"],
    example: "RX-78-2 / Master Grade",
  },
  {
    key: "kitVariant",
    label: "Kit Variant",
    description: "Alias for the selected kit prompt context.",
    kinds: ["palette-plan", "style-suggestion", "repaint-concept", "hd-render"],
    example: "Selected kit variant",
  },
  {
    key: "stylePreset",
    label: "Style DNA",
    description: "Selected visual language and paint logic.",
    kinds: ["palette-plan", "repaint-concept", "hd-render"],
    example: "Industrial Hazard",
  },
  {
    key: "materialPreset",
    label: "Material Profile",
    description: "Surface, reflectivity, and coating behavior.",
    kinds: ["palette-plan", "repaint-concept", "hd-render"],
    example: "Satin coated alloy",
  },
  {
    key: "weatheringLevel",
    label: "Weathering",
    description: "Clean, light, or heavy finish treatment.",
    kinds: ["palette-plan", "repaint-concept", "hd-render"],
    example: "light",
  },
  {
    key: "mood",
    label: "Mood Vector",
    description: "Selected mood modifiers formatted for the model.",
    kinds: ["palette-plan", "style-suggestion", "repaint-concept", "hd-render"],
    example: "Command presence, reactor glow",
  },
  {
    key: "notes",
    label: "Operator Notes",
    description: "Sanitized user guidance from the creation flow.",
    kinds: ["palette-plan", "style-suggestion", "repaint-concept", "hd-render"],
    example: "Keep shoulder markings restrained.",
  },
  {
    key: "availableStyles",
    label: "Available Styles",
    description: "Active Style DNA names available for recommendation.",
    kinds: ["style-suggestion"],
    example: "Command, Stealth, Industrial",
  },
  {
    key: "colorRoles",
    label: "Color Roles",
    description: "Ordered semantic paint roles from the catalog.",
    kinds: ["palette-plan", "repaint-concept"],
    example: "Primary armor, frame, accent",
  },
  {
    key: "conceptId",
    label: "Concept ID",
    description: "Approved concept identifier used for render continuity.",
    kinds: ["hd-render"],
    example: "concept_01",
  },
  {
    key: "topPalette",
    label: "Palette Lock",
    description: "Resolved paint mappings for the leading color roles.",
    kinds: ["hd-render"],
    example: "Primary: Tamiya XF-24 Dark Grey",
  },
  {
    key: "remixSource",
    label: "Remix Source",
    description: "Optional source concept title for remix continuity.",
    kinds: ["repaint-concept", "hd-render"],
    example: "Urban Night Test",
  },
];

export const promptTemplateVariableKeys = new Set(
  promptTemplateVariableDefinitions.map((definition) => definition.key)
);
