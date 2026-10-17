import { styleIntentSchema } from "@/convex/creativeContracts";

// Sanitized production case: the two orange descriptors must bind to different anchors.
export const orangeShadesDescription = "Chitine armore with shades of orange, from bright to dark";
export const orangeShadesStyle = styleIntentSchema.parse({
  version: "style-intent.v3", source: "private", styleType: "custom", name: "Chitinous Orange Shell",
  palette: { primary: "Bright Orange", secondary: "Burnt Orange", accent: "Bright Amber" },
  surfaceLogic: "Bright orange carapace armor with dark burnt orange recessed layers and a brown inner frame.",
  graphicLanguage: "Small off-white designation codes.", contrast: "high", markingDensity: "low",
  materialIntent: ["painted armor"], mood: "organic", weathering: "light", finish: "satin", paintability: "high", pattern: "none",
  colors: [
    { name: "Bright Orange", hex: "#FF6600", role: "primary", coverage: 40, scope: { kind: "exterior-armor" } },
    { name: "Burnt Orange", hex: "#A33B00", role: "secondary", coverage: 30, scope: { kind: "exterior-armor" } },
    { name: "Chitin Charcoal Brown", hex: "#2B1D14", role: "frame", coverage: 18, scope: { kind: "inner-frame" } },
    { name: "Bright Amber", hex: "#FFAA00", role: "accent", coverage: 7, scope: { kind: "exterior-armor" } },
    { name: "Fiery Orange Glow", hex: "#FF3300", role: "glow", coverage: 3, scope: { kind: "sensors" } },
    { name: "Warm Off-White", hex: "#F4EBE1", role: "marking", coverage: 2, scope: { kind: "markings" } },
  ],
  explicitRequirements: {
    version: "normalized-user-intent.v1", unresolved: [], requirements: [{
      id: "req-1", property: "colors", operation: "set", scope: { kind: "exterior-armor" },
      colors: [{ name: "bright orange", family: "orange", visualRole: "primary" }, { name: "dark orange", family: "orange", visualRole: "secondary" }],
      evidence: { inputRef: "style-description", quote: "shades of orange, from bright to dark" },
    }],
  },
});

export const localChitinMaterialStyle = styleIntentSchema.parse({
  ...orangeShadesStyle,
  explicitRequirements: {
    ...orangeShadesStyle.explicitRequirements,
    requirements: [...orangeShadesStyle.explicitRequirements!.requirements, {
      id: "req-material", property: "material", operation: "set", scope: { kind: "exterior-armor" },
      value: "chitinous shell finish", evidence: { inputRef: "style-description", quote: "Chitine armore" },
    }],
  },
});
