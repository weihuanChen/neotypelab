import {
  MaterialSpec,
  PaintFinishSpec,
  StyleSpec,
  WeatheringLevel,
  WeatheringSpec,
} from "./domain";

export type RenderSpecificationV2 = {
  baseModel: unknown;
  colorPlan: unknown;
  styleSpec: StyleSpec | null;
  materialSpec: MaterialSpec | null;
  paintFinishSpec: PaintFinishSpec | null;
  weatheringSpec: WeatheringSpec;
  identityLock: unknown;
};

const weatheringSpecs: Record<WeatheringLevel, WeatheringSpec> = {
  clean: {
    level: "clean",
    edgeWear: "none",
    dustAccumulation: "none",
    paintChipping: "none",
    staining: "none",
    panelLineEmphasis: "minimal",
    intensityCap: "factory-fresh display finish",
    colorReadabilityRule: "primary and secondary color blocks must remain pristine",
    renderBehavior:
      "Render a clean model finish with no damage, no grime, and only subtle panel definition.",
  },
  light: {
    level: "light",
    edgeWear: "minor exposed-edge wear",
    dustAccumulation: "minor localized dust",
    paintChipping: "minimal chips on high-contact points",
    staining: "very light operational marks",
    panelLineEmphasis: "controlled scale-model panel lining",
    intensityCap: "display-grade weathering that stays secondary to the color layout",
    colorReadabilityRule: "weathering may texture panels but must not obscure the primary color hierarchy",
    renderBehavior:
      "Render restrained scale-model weathering with readable paint blocks and subtle operational marks.",
  },
  heavy: {
    level: "heavy",
    edgeWear: "visible edge wear on exposed high-contact surfaces",
    dustAccumulation: "moderate dust in lower armor, feet, recesses, and field-facing panels",
    paintChipping: "visible but localized paint chips",
    staining: "controlled streaking, soot, and operational staining",
    panelLineEmphasis: "stronger panel definition without muddying armor shapes",
    intensityCap: "heavy weathering must not overpower model identity or color role assignment",
    colorReadabilityRule: "primary color placement must remain readable even under wear",
    renderBehavior:
      "Render advanced weathering as localized wear, dust, chipping, and staining while preserving the repaint plan.",
  },
};

export function getWeatheringSpec(level: WeatheringLevel): WeatheringSpec {
  return weatheringSpecs[level];
}
