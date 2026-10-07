import { styleIntentSchema, type StyleIntent } from "./creativeContracts";

/**
 * Official style presets added after the initial P1 seed.
 *
 * Each preset carries both the legacy `styleSpec` (used by style suggestion and
 * legacy prompt paths) and an official Style Intent v1 whose palette anchors the
 * palette planner. Palette strings pair a readable colour name with a target HEX
 * so the planner has a concrete anchor while the text stays human-readable.
 *
 * Inserted by `init` on a fresh deployment and by `seedMissingStylePresets` on an
 * existing one (matched by slug; existing rows are never overwritten).
 */

type StylePresetSeed = {
  name: string;
  slug: string;
  category: string;
  shortDescription: string;
  promptKeywords: string[];
  negativeKeywords: string[];
  systemPromptFragment: string;
  styleSpec: {
    colorRelationship: string;
    decalStyle: string;
    markingDensity: string;
    warningMarkingBehavior: string;
    tone: string;
    contrastBehavior: string;
    personalityTags: string[];
    prohibitedEffects: string[];
    identityBoundary: string;
    renderBehavior: string;
  };
  contrastLevel: "low" | "medium" | "high";
  weatheringProfile: "clean" | "light" | "heavy";
  recommendedMaterialSlugs: string[];
  visibilityWeight: number;
  promptVersion: string;
  seoKeywords: string[];
  intent: Omit<StyleIntent, "version" | "source" | "styleType" | "name">;
};

const seeds: StylePresetSeed[] = [
  {
    name: "Armored Core-inspired",
    slug: "armored-core-inspired",
    category: "game-reference",
    shortDescription:
      "Cold and transactional. A hired frame dressed in corporate paperwork, letting one hot signal colour do all the talking.",
    promptKeywords: ["mercenary frame", "corporate decals", "modular armor", "signal orange"],
    negativeKeywords: ["toy-like", "pastel", "glossy candy", "hero tricolor"],
    systemPromptFragment:
      "Treat the kit as a mercenary-built frame: desaturated gunmetal and bone armor blocks, dense but orderly corporate/technical decals, and one controlled hot-orange signal colour.",
    styleSpec: {
      colorRelationship:
        "desaturated gunmetal primary armor against bone off-white secondary blocks, near-black frame, one small hot-orange signal",
      decalStyle:
        "corporate logos, unit emblem on one shoulder, frame part numbers, load-limit and caution text in compact blocks",
      markingDensity: "high",
      warningMarkingBehavior:
        "group caution text and stripes into tidy technical clusters on shoulders, thighs and boosters; never scatter randomly",
      tone: "pragmatic mercenary hardware",
      contrastBehavior: "medium value contrast; saturation reserved for the orange signal and sensors",
      personalityTags: ["mercenary", "modular", "corporate", "decal-dense"],
      prohibitedEffects: ["rainbow parts", "candy gloss", "heroic tricolor", "giant full-body graphics"],
      identityBoundary:
        "Borrow only colour hierarchy and decal language; do not add boosters, weapons or reshape the kit into another frame.",
      renderBehavior:
        "Render as a sharply masked, matte-to-satin frame where decal clusters read as engineering documentation rather than decoration.",
    },
    contrastLevel: "medium",
    weatheringProfile: "light",
    recommendedMaterialSlugs: ["matte-armor", "gunmetal-frame", "burnt-metal"],
    visibilityWeight: 0.88,
    promptVersion: "p6.v1",
    seoKeywords: ["armored core gunpla colors", "mercenary mecha repaint", "ac6 style gunpla"],
    intent: {
      palette: {
        primary: "Battleship gunmetal #4A4F55",
        secondary: "Bone off-white #CFCAB8",
        accent: "Signal orange #E0622A",
        neutrals: ["Carbon frame black #1E2023", "Weathered steel #7C8288", "Coral red sensor #D43A4A"],
      },
      surfaceLogic:
        "Matte-to-satin painted armor over a near-black mechanical frame; edges stay crisp, booster and vent zones may show slight heat tint.",
      graphicLanguage:
        "Dense but orderly corporate decals: manufacturer marks, frame part numbers, a single unit emblem and compact caution-text clusters.",
      contrast: "medium",
      markingDensity: "high",
      materialIntent: ["matte painted armor", "dark gunmetal frame", "heat-tinted booster and vent metal"],
      mood: "Pragmatic, mercenary, mission-worn but maintained",
      weathering: "light",
      finish: "matte",
      paintability: "high",
    },
  },
  {
    name: "Industrial Orange",
    slug: "industrial-orange",
    category: "hard-surface",
    shortDescription:
      "Honest, hard-working and freshly serviced. Built to be seen across a busy site rather than to look dangerous.",
    promptKeywords: ["safety orange", "work machine", "service panels", "maintenance markings"],
    negativeKeywords: ["military camouflage", "neon glow", "glossy candy"],
    systemPromptFragment:
      "Paint the kit as a utility work machine: safety-orange primary armor, light grey service panels, graphite mechanics and small maintenance markings.",
    styleSpec: {
      colorRelationship:
        "safety-orange primary armor, light machine-grey secondary panels, graphite frame; white reflective strips and a small maintenance-blue data plate",
      decalStyle: "maintenance labels, lift points, service intervals and small data plates",
      markingDensity: "medium",
      warningMarkingBehavior: "reflective white strips on limb edges and lift points only",
      tone: "civil engineering work machine",
      contrastBehavior: "strong hue contrast between orange armor and graphite mechanics, moderate value contrast",
      personalityTags: ["industrial", "utility", "work-machine", "high-visibility"],
      prohibitedEffects: ["military camouflage", "neon glow", "chrome armor", "full-body hazard stripes"],
      identityBoundary:
        "Work-machine styling changes paint and markings only; never add tools, buckets or construction attachments.",
      renderBehavior:
        "Render as a freshly serviced work machine with semi-gloss orange armor and readable grey/graphite mechanical separation.",
    },
    contrastLevel: "medium",
    weatheringProfile: "light",
    recommendedMaterialSlugs: ["semi-gloss-armor", "gunmetal-frame"],
    visibilityWeight: 0.84,
    promptVersion: "p6.v1",
    seoKeywords: ["orange mecha repaint", "industrial gunpla colors", "safety orange gunpla"],
    intent: {
      palette: {
        primary: "Safety orange #E2611B",
        secondary: "Light machine grey #B9BCB7",
        accent: "Reflective strip white #F2EFE6",
        neutrals: ["Graphite frame #2A2C2F", "Maintenance blue #1B5E8C"],
      },
      surfaceLogic:
        "Semi-gloss industrial enamel on armor; grey service panels and graphite mechanics read as separate components.",
      graphicLanguage:
        "Maintenance labels, lift-point arrows, service interval tags and one small blue data plate; reflective white strips on limb edges.",
      contrast: "medium",
      markingDensity: "medium",
      materialIntent: ["semi-gloss painted armor", "graphite mechanical frame"],
      mood: "Hard-working, practical, freshly serviced",
      weathering: "light",
      finish: "semi-gloss",
      paintability: "high",
    },
  },
  {
    name: "Excavator Yellow",
    slug: "excavator-yellow",
    category: "hard-surface",
    shortDescription:
      "Loud, heavy and unbothered by mud. Clean shoulders, filthy boots, a full shift on the worksite.",
    promptKeywords: ["construction yellow", "heavy equipment", "hydraulic steel", "mud wear"],
    negativeKeywords: ["clean showroom gloss", "pastel", "neon city"],
    systemPromptFragment:
      "Paint the kit like heavy construction equipment: construction-yellow armor, black chassis blocks, hydraulic steel mechanics, with dirt concentrated on lower limbs.",
    styleSpec: {
      colorRelationship:
        "construction-yellow primary armor, black chassis secondary blocks, hydraulic steel frame, small warning-red lamps",
      decalStyle: "model number in bold block type, load-chart labels, black/yellow chevrons on step and pinch zones",
      markingDensity: "medium",
      warningMarkingBehavior: "black/yellow chevrons only on feet, hand guards and pinch points",
      tone: "heavy construction equipment",
      contrastBehavior: "high value contrast between yellow and black; steel reads as mid-tone",
      personalityTags: ["heavy-equipment", "construction", "rugged", "worksite"],
      prohibitedEffects: ["showroom gloss", "pastel tint", "neon lighting", "added buckets or tracks"],
      identityBoundary:
        "Construction styling is paint and weathering only; never add buckets, tracks, booms or cabs.",
      renderBehavior:
        "Render as worksite machinery: yellow armor with a mud gradient rising from the feet, oily joints and clean upper body.",
    },
    contrastLevel: "high",
    weatheringProfile: "heavy",
    recommendedMaterialSlugs: ["semi-gloss-armor", "gunmetal-frame", "titanium-finish"],
    visibilityWeight: 0.82,
    promptVersion: "p6.v1",
    seoKeywords: ["excavator color gunpla", "construction yellow mecha", "heavy equipment gunpla repaint"],
    intent: {
      palette: {
        primary: "Construction yellow #F2B705",
        secondary: "Chassis black #1D1D1D",
        accent: "Warning lamp red #C62828",
        neutrals: ["Hydraulic steel #5C6065", "Polished cylinder silver #CDD1D4"],
      },
      surfaceLogic:
        "Semi-gloss equipment enamel; hydraulic-style joints and pistons in polished steel; mud and dust concentrated below the knees, oil around joints.",
      graphicLanguage:
        "Bold block model number, load-chart labels and black/yellow chevrons limited to feet, hand guards and pinch points.",
      contrast: "high",
      markingDensity: "medium",
      materialIntent: ["semi-gloss painted armor", "hydraulic steel frame", "polished metal pistons"],
      mood: "Rugged, heavy-duty, worksite-proven",
      weathering: "heavy",
      finish: "semi-gloss",
      paintability: "high",
    },
  },
  {
    name: "Crimson Command",
    slug: "crimson-command",
    category: "command",
    shortDescription: "Proud and disciplined. The unit everyone recognises across the field, trimmed in gold without ever turning gaudy.",
    promptKeywords: ["commander unit", "deep crimson", "gold trim", "ace pilot"],
    negativeKeywords: ["pastel", "camouflage", "neon"],
    systemPromptFragment:
      "Build a commander-unit hierarchy: deep crimson primary armor, darker wine secondary blocks, charcoal frame and small, deliberate gold trim.",
    styleSpec: {
      colorRelationship:
        "two-tone crimson armor (bright over dark wine), charcoal frame, muted gold trim and a single unit crest",
      decalStyle: "unit crest, commander insignia and minimal serials",
      markingDensity: "low",
      warningMarkingBehavior: "avoid caution graphics except tiny functional labels",
      tone: "elite commander unit",
      contrastBehavior: "high contrast between crimson armor and charcoal frame; gold kept to trim lines",
      personalityTags: ["commander", "elite", "crimson", "prestige"],
      prohibitedEffects: ["gold flooding", "chrome armor", "camouflage", "pastel red"],
      identityBoundary:
        "Commander styling changes paint hierarchy only; do not add horns, antennas, capes or crests to the geometry.",
      renderBehavior:
        "Render as a clean satin-finished command unit with crisp two-tone red separation and sparse gold edging.",
    },
    contrastLevel: "high",
    weatheringProfile: "clean",
    recommendedMaterialSlugs: ["semi-gloss-armor", "gunmetal-frame"],
    visibilityWeight: 0.9,
    promptVersion: "p6.v1",
    seoKeywords: ["red commander gunpla", "char custom color scheme", "crimson mecha repaint"],
    intent: {
      palette: {
        primary: "Deep crimson #A51F25",
        secondary: "Dark wine #70151B",
        accent: "Muted gold #C49A45",
        neutrals: ["Charcoal frame #191919", "Parchment detail #E8E1D2"],
      },
      surfaceLogic: "Smooth satin painted armor in two crimson values over a dark charcoal mechanical frame.",
      graphicLanguage: "Single unit crest and commander insignia; minimal serials; gold limited to thin trim lines.",
      contrast: "high",
      markingDensity: "low",
      materialIntent: ["satin painted armor", "dark mechanical frame"],
      mood: "Commanding, prestigious, disciplined",
      weathering: "clean",
      finish: "satin",
      paintability: "high",
    },
  },
  {
    name: "Arctic Ops",
    slug: "arctic-ops",
    category: "environmental",
    shortDescription: "Quiet, cold and patient. It disappears into a snowfield until a flash of red marks it as friendly.",
    promptKeywords: ["arctic camouflage", "winter white", "polar markings", "cold climate"],
    negativeKeywords: ["desert tan", "warm sunset", "neon city"],
    systemPromptFragment:
      "Paint for cold-climate operations: matte winter-white armor, cold grey-blue secondary panels, gunmetal frame, small polar-red identification marks and light frost/soot weathering.",
    styleSpec: {
      colorRelationship:
        "matte winter white primary, cold grey-blue secondary in hard-edged disruptive blocks, gunmetal frame, polar red ID marks",
      decalStyle: "high-visibility polar identification panels, unit numbers and cold-weather service labels",
      markingDensity: "low",
      warningMarkingBehavior: "polar red limited to identification panels and intake rims",
      tone: "cold-climate field operations",
      contrastBehavior: "medium contrast; white dominates, grey-blue breaks up the silhouette",
      personalityTags: ["arctic", "winter", "cold-climate", "field-ops"],
      prohibitedEffects: ["warm tan bias", "glossy ice effects", "snow piles or added cloth"],
      identityBoundary:
        "Winter treatment is paint, frost staining and markings only; do not add snow, cloth or new armor.",
      renderBehavior:
        "Render as a matte winter-ops repaint with subtle exhaust soot and frost-grey grime in recesses.",
    },
    contrastLevel: "medium",
    weatheringProfile: "light",
    recommendedMaterialSlugs: ["ceramic-white", "matte-armor", "gunmetal-frame"],
    visibilityWeight: 0.75,
    promptVersion: "p6.v1",
    seoKeywords: ["arctic mecha colors", "winter camo gunpla", "snow white gunpla repaint"],
    intent: {
      palette: {
        primary: "Winter white #E4E8EA",
        secondary: "Arctic grey-blue #97A6B2",
        accent: "Polar red #C8352B",
        neutrals: ["Cold gunmetal frame #363D44", "Ice blue sensor #7FC4E0"],
      },
      surfaceLogic:
        "Matte white armor broken by hard-edged grey-blue disruptive blocks; soot around exhausts and cool grey grime in recesses.",
      graphicLanguage: "Small polar-red identification panels, stencilled unit numbers and cold-weather service labels.",
      contrast: "medium",
      markingDensity: "low",
      materialIntent: ["matte painted armor", "dark gunmetal frame"],
      mood: "Cold, quiet, operational",
      weathering: "light",
      finish: "matte",
      paintability: "high",
    },
  },
  {
    name: "Racing Livery",
    slug: "racing-livery",
    category: "livery",
    shortDescription: "Bright, cheerful and quick even standing still, like a classic endurance racer polished up for the podium.",
    promptKeywords: ["racing livery", "powder blue", "racing orange", "number roundel"],
    negativeKeywords: ["military camouflage", "heavy weathering", "matte drab"],
    systemPromptFragment:
      "Apply a classic endurance-racing livery: powder-blue primary, a bold orange stripe system, carbon-black frame, white number roundels and a high-gloss clear.",
    styleSpec: {
      colorRelationship:
        "powder-blue primary armor with a continuous racing-orange stripe system, carbon-black frame, white number boards",
      decalStyle: "race numbers in white roundels, generic sponsor-style blocks, pin-stripe edges",
      markingDensity: "high",
      warningMarkingBehavior: "replace caution graphics with livery stripes and number boards",
      tone: "classic motorsport livery",
      contrastBehavior: "high hue contrast between blue and orange, framed by carbon black",
      personalityTags: ["racing", "livery", "motorsport", "gloss"],
      prohibitedEffects: ["real brand logos", "camouflage", "heavy weathering", "aerodynamic add-ons"],
      identityBoundary:
        "Livery is paint and decals only; do not add spoilers, wheels or aero parts.",
      renderBehavior:
        "Render with a deep gloss clear, stripes flowing continuously across adjacent panels, and crisp decal edges.",
    },
    contrastLevel: "high",
    weatheringProfile: "clean",
    recommendedMaterialSlugs: ["semi-gloss-armor", "titanium-finish"],
    visibilityWeight: 0.78,
    promptVersion: "p6.v1",
    seoKeywords: ["racing livery gunpla", "race car mecha colors", "blue orange gunpla repaint"],
    intent: {
      palette: {
        primary: "Powder blue #86BEE0",
        secondary: "Racing orange #EE6F2A",
        accent: "Number-board white #F4F2EC",
        neutrals: ["Carbon black frame #222428", "Polished silver #BFC4C9"],
      },
      surfaceLogic:
        "Gloss-cleared painted armor; the orange stripe system flows continuously across adjacent panels; carbon-black frame.",
      graphicLanguage:
        "White number roundels, generic sponsor-style blocks (no real brands) and thin pin-stripes along panel edges.",
      contrast: "high",
      markingDensity: "high",
      materialIntent: ["gloss painted armor", "carbon-black frame"],
      mood: "Fast, celebratory, showroom-ready",
      weathering: "clean",
      finish: "gloss",
      paintability: "medium",
    },
  },
  {
    name: "Naval Grey",
    slug: "naval-grey",
    category: "grounded",
    shortDescription: "Stoic and sea-worn. Reserved greys and a low line of red, made for long deployments far from port.",
    promptKeywords: ["naval grey", "warship", "hull numbers", "salt weathering"],
    negativeKeywords: ["bright saturated armor", "neon", "desert tan"],
    systemPromptFragment:
      "Paint like a modern warship: haze-grey primary, darker deck-grey blocks, gunmetal frame, anti-fouling red low on the legs and shadow-shaded white hull numbers; light salt and rust streaking.",
    styleSpec: {
      colorRelationship:
        "haze-grey primary armor, darker deck-grey secondary on upper surfaces, gunmetal frame, anti-fouling red limited to lower legs/feet",
      decalStyle: "large shadow-shaded hull numbers, ship-style stencils and draft marks",
      markingDensity: "low",
      warningMarkingBehavior: "stencilled hatch and walkway markings only",
      tone: "naval fleet unit",
      contrastBehavior: "low saturation; contrast comes from grey values and the red lower band",
      personalityTags: ["naval", "fleet", "maritime", "low-saturation"],
      prohibitedEffects: ["saturated armor", "camouflage patterns", "added deck equipment"],
      identityBoundary:
        "Naval styling is paint, stencils and salt weathering only; do not add turrets, masts or hull parts.",
      renderBehavior:
        "Render as a matte fleet-grey unit with subtle salt bloom and thin rust streaks running down from hatches.",
    },
    contrastLevel: "low",
    weatheringProfile: "light",
    recommendedMaterialSlugs: ["matte-armor", "gunmetal-frame"],
    visibilityWeight: 0.72,
    promptVersion: "p6.v1",
    seoKeywords: ["naval grey gunpla", "warship color mecha", "battleship grey gunpla repaint"],
    intent: {
      palette: {
        primary: "Haze grey #8D9396",
        secondary: "Deck grey #50565A",
        accent: "Anti-fouling red #8E2B24",
        neutrals: ["Gunmetal frame #2E3236", "Hull-number white #ECEDE8"],
      },
      surfaceLogic:
        "Matte fleet-grey paint; darker deck grey on upward-facing surfaces; anti-fouling red as a lower-leg band; salt bloom and thin rust streaks from hatches.",
      graphicLanguage: "Large shadow-shaded hull numbers, stencilled hatch labels and draft marks.",
      contrast: "low",
      markingDensity: "low",
      materialIntent: ["matte painted armor", "dark gunmetal frame"],
      mood: "Stoic, disciplined, sea-worn",
      weathering: "light",
      finish: "matte",
      paintability: "high",
    },
  },
];

/**
 * Seed descriptions shipped before 2026-10-07. They listed colours, which the
 * card already shows as a strip; `refreshSeededPresetDescriptions` replaces a
 * row's description only while it still equals one of these, so admin edits win.
 */
export const legacySeedShortDescriptions: Record<string, string> = {
  "armored-core-inspired": "Mercenary frame look: gunmetal and bone armor, dense corporate decals, a single hot orange signal.",
  "industrial-orange": "Safety-orange work machine with light grey service panels and graphite mechanics.",
  "excavator-yellow": "Construction-yellow heavy equipment with black chassis, hydraulic steel and mud-line wear.",
  "crimson-command": "Commander-unit crimson stack with charcoal frame and restrained gold trim.",
  "arctic-ops": "Winter-white armor over cold grey-blue panels with polar red identification marks.",
  "racing-livery": "Endurance-racing powder blue and orange with number roundels and gloss clear.",
  "naval-grey": "Warship haze grey with deck-grey blocks, anti-fouling red and shadowed hull numbers.",
};

export const additionalStylePresets = seeds.map(({ intent, ...seed }) => {
  const styleIntent = styleIntentSchema.parse({
    version: "style-intent.v1",
    source: "official",
    styleType: "preset",
    name: seed.name,
    ...intent,
  });
  return {
    ...seed,
    styleIntentJson: JSON.stringify(styleIntent),
    styleIntentVersion: styleIntent.version,
    isActive: true,
    searchText: [
      seed.name,
      seed.category,
      seed.shortDescription,
      ...seed.promptKeywords,
      ...seed.seoKeywords,
    ].join(" "),
  };
});
