export type IpSeriesSeed = {
  name: string;
  slug: string;
  universe?: string;
  manufacturer?: string;
  rightsOwner?: string;
  visualDNA?: string;
  promptAnchor?: string;
  status?: "active" | "prerelease" | "archived";
  isActive: boolean;
};

export type BaseUnitSeed = {
  ipSeriesSlug: string;
  name: string;
  slug: string;
  unitCode?: string;
  aliases: string[];
  silhouetteType?: string;
  keyShapeAnchors: string[];
  nativeEquipment: string[];
  forbiddenChanges: string[];
  promptAnchor?: string;
  status?: "active" | "prerelease" | "archived";
  isActive: boolean;
};

export type BaseModelVariantSeed = {
  baseModelSlug: string;
  baseUnitSlug: string;
  scale?: string;
  releaseVersion?: string;
  primaryModelBrand?: string;
  panelDensity?: string;
  promptAnchor?: string;
  status?: "active" | "prerelease" | "archived";
};

export const ipSeriesSeeds: IpSeriesSeed[] = [
  {
    name: "Mobile Suit Gundam",
    slug: "mobile-suit-gundam",
    universe: "Universal Century",
    rightsOwner: "Sunrise / Bandai Namco Filmworks",
    visualDNA: "classic blocky heroic real-robot armor with primary color separation",
    promptAnchor:
      "Universal Century Gundam real-robot world: grounded military hardware, clean humanoid mobile suits, functional armor panels, restrained heroic proportions.",
    status: "active",
    isActive: true,
  },
  {
    name: "Mobile Suit Gundam: Char's Counterattack",
    slug: "chars-counterattack",
    universe: "Universal Century",
    rightsOwner: "Sunrise / Bandai Namco Filmworks",
    visualDNA: "late-UC ace mobile suits with larger frames, funnels, and mature military detailing",
    promptAnchor:
      "Char's Counterattack era: advanced Universal Century mobile suits, fin funnels, commander silhouettes, dense panel logic, and restrained late-UC military styling.",
    status: "active",
    isActive: true,
  },
  {
    name: "Mobile Suit Gundam: Iron-Blooded Orphans",
    slug: "iron-blooded-orphans",
    universe: "Post Disaster",
    rightsOwner: "Sunrise / Bandai Namco Filmworks",
    visualDNA: "exposed mechanical frames, lean melee-focused armor, raw industrial battlefield forms",
    promptAnchor:
      "Iron-Blooded Orphans world: exposed Gundam frames, utilitarian armor, melee-heavy silhouettes, visible pistons, and harsh industrial combat wear.",
    status: "active",
    isActive: true,
  },
  {
    name: "Evangelion",
    slug: "evangelion",
    universe: "Evangelion",
    rightsOwner: "khara",
    visualDNA: "lanky biomechanical humanoids with organic armor rhythm and vivid restraint accents",
    promptAnchor:
      "Evangelion world: biomechanical humanoid giants, elongated proportions, shoulder pylons, restrained armor plating, and high-contrast experimental color accents.",
    status: "active",
    isActive: true,
  },
];

export const baseUnitSeeds: BaseUnitSeed[] = [
  {
    ipSeriesSlug: "mobile-suit-gundam",
    name: "RX-78-2 Gundam",
    slug: "rx-78-2-gundam",
    unitCode: "RX-78-2",
    aliases: ["First Gundam", "Grandpa Gundam", "Gundam RX-78-2"],
    silhouetteType: "humanoid-mecha",
    keyShapeAnchors: ["V-fin head", "twin eye sensors", "blue torso block", "yellow chest vents", "red feet"],
    nativeEquipment: ["shield", "beam rifle"],
    forbiddenChanges: ["no mono-eye", "no wing backpack", "no extra armor"],
    promptAnchor: "Keep RX-78-2 Gundam recognizable as the original V-fin hero mobile suit.",
    status: "active",
    isActive: true,
  },
  {
    ipSeriesSlug: "chars-counterattack",
    name: "MSN-04 Sazabi",
    slug: "msn-04-sazabi",
    unitCode: "MSN-04",
    aliases: ["Sazabi"],
    silhouetteType: "heavy-ace",
    keyShapeAnchors: ["mono-eye head", "large shoulder armor", "funnel containers", "heavy skirt armor"],
    nativeEquipment: ["shield", "beam shot rifle", "funnels"],
    forbiddenChanges: ["no Gundam face", "no slim hero frame", "no wing backpack"],
    promptAnchor: "Keep MSN-04 Sazabi recognizable as Char's heavy Neo Zeon commander suit.",
    status: "active",
    isActive: true,
  },
  {
    ipSeriesSlug: "iron-blooded-orphans",
    name: "ASW-G-08 Gundam Barbatos",
    slug: "asw-g-08-gundam-barbatos",
    unitCode: "ASW-G-08",
    aliases: ["Barbatos", "Gundam Barbatos"],
    silhouetteType: "agile-frame",
    keyShapeAnchors: ["exposed waist frame", "angular head crest", "piston joints", "clawed feet"],
    nativeEquipment: ["mace"],
    forbiddenChanges: ["no bulky classic Gundam torso", "no funnel backpack", "no mono-eye"],
    promptAnchor: "Keep ASW-G-08 Barbatos recognizable as a lean exposed-frame melee Gundam.",
    status: "active",
    isActive: true,
  },
  {
    ipSeriesSlug: "chars-counterattack",
    name: "RX-93 Nu Gundam",
    slug: "rx-93-nu-gundam",
    unitCode: "RX-93",
    aliases: ["Nu Gundam"],
    silhouetteType: "hero-long-range",
    keyShapeAnchors: ["V-fin head", "asymmetrical fin funnel rack", "chest vents", "long-range hero silhouette"],
    nativeEquipment: ["fin funnels", "shield", "beam rifle"],
    forbiddenChanges: ["no mono-eye", "no red commander armor", "no missing fin funnels"],
    promptAnchor: "Keep RX-93 Nu Gundam recognizable through its V-fin head and asymmetrical fin funnel identity.",
    status: "active",
    isActive: true,
  },
  {
    ipSeriesSlug: "evangelion",
    name: "EVA Unit-01",
    slug: "eva-unit-01",
    unitCode: "EVA-01",
    aliases: ["Evangelion Unit-01", "Test Type-01"],
    silhouetteType: "agile-experimental",
    keyShapeAnchors: ["single horn", "shoulder pylons", "narrow waist", "green chest accents", "elongated head"],
    nativeEquipment: ["progressive knife", "pallet rifle"],
    forbiddenChanges: ["no Gundam V-fin", "no blocky mobile suit torso", "no classic military mono-eye"],
    promptAnchor: "Keep EVA Unit-01 recognizable as the lanky experimental Evangelion test type.",
    status: "active",
    isActive: true,
  },
];

export const baseModelVariantSeeds: BaseModelVariantSeed[] = [
  {
    baseModelSlug: "rx-78-2",
    baseUnitSlug: "rx-78-2-gundam",
    scale: "1/100",
    primaryModelBrand: "Bandai",
    panelDensity: "medium",
    status: "active",
    promptAnchor:
      "Preserve this kit version rather than simplifying into HG-style surfaces or mixing with other RX-78-2 Gundam versions.",
  },
  {
    baseModelSlug: "sazabi",
    baseUnitSlug: "msn-04-sazabi",
    scale: "1/100",
    primaryModelBrand: "Bandai",
    panelDensity: "high",
    status: "active",
    promptAnchor:
      "Preserve this kit version rather than simplifying its Master Grade surfaces or mixing with other Sazabi versions.",
  },
  {
    baseModelSlug: "barbatos",
    baseUnitSlug: "asw-g-08-gundam-barbatos",
    scale: "1/100",
    primaryModelBrand: "Bandai",
    panelDensity: "medium",
    status: "active",
    promptAnchor:
      "Preserve this kit version rather than simplifying its Master Grade frame detail or mixing with other Barbatos forms.",
  },
  {
    baseModelSlug: "nu-gundam",
    baseUnitSlug: "rx-93-nu-gundam",
    scale: "1/144",
    primaryModelBrand: "Bandai",
    panelDensity: "high",
    status: "active",
    promptAnchor:
      "Preserve this kit version rather than simplifying into HG-style surfaces or mixing with other RX-93 Nu Gundam versions.",
  },
  {
    baseModelSlug: "eva-unit-01",
    baseUnitSlug: "eva-unit-01",
    scale: "1/144",
    primaryModelBrand: "Bandai",
    panelDensity: "high",
    status: "active",
    promptAnchor:
      "Preserve this kit version rather than simplifying its Real Grade surfaces or mixing with other EVA Unit-01 versions.",
  },
];

export function buildBaseUnitSearchText(unit: BaseUnitSeed) {
  return [
    unit.name,
    unit.slug,
    unit.unitCode,
    unit.silhouetteType,
    unit.promptAnchor,
    ...unit.aliases,
    ...unit.keyShapeAnchors,
    ...unit.nativeEquipment,
    ...unit.forbiddenChanges,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildBaseModelVariantSearchText(input: {
  name: string;
  primaryModelBrand?: string;
  grade?: string;
  scale?: string;
  releaseVersion?: string;
  complexityLevel?: string;
  panelDensity?: string;
  aliases: string[];
  tags: string[];
  promptAnchor?: string;
  unitName?: string;
  unitCode?: string;
}) {
  return [
    input.name,
    input.primaryModelBrand,
    input.grade,
    input.scale,
    input.releaseVersion,
    input.complexityLevel,
    input.panelDensity,
    input.promptAnchor,
    input.unitName,
    input.unitCode,
    ...input.aliases,
    ...input.tags,
  ]
    .filter(Boolean)
    .join(" ");
}
