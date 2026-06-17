export type IpSeriesSeed = {
  name: string;
  slug: string;
  universe?: string;
  manufacturer?: string;
  visualDNA?: string;
  promptAnchor?: string;
  isActive: boolean;
};

export type BaseUnitSeed = {
  ipSeriesSlug: string;
  name: string;
  slug: string;
  unitCode?: string;
  aliases: string[];
  silhouetteType?: string;
  proportionDNA?: string;
  armorDNA?: string;
  keyShapeAnchors: string[];
  forbiddenChanges: string[];
  isActive: boolean;
};

export type BaseModelVariantSeed = {
  baseModelSlug: string;
  baseUnitSlug: string;
  scale?: string;
  releaseVersion?: string;
  panelDensity?: string;
  promptAnchor?: string;
};

export const ipSeriesSeeds: IpSeriesSeed[] = [
  {
    name: "Mobile Suit Gundam",
    slug: "mobile-suit-gundam",
    universe: "Universal Century",
    manufacturer: "Bandai",
    visualDNA: "classic blocky heroic real-robot armor with primary color separation",
    promptAnchor:
      "Universal Century Gundam real-robot world: grounded military hardware, clean humanoid mobile suits, functional armor panels, restrained heroic proportions.",
    isActive: true,
  },
  {
    name: "Mobile Suit Gundam: Char's Counterattack",
    slug: "chars-counterattack",
    universe: "Universal Century",
    manufacturer: "Bandai",
    visualDNA: "late-UC ace mobile suits with larger frames, funnels, and mature military detailing",
    promptAnchor:
      "Char's Counterattack era: advanced Universal Century mobile suits, fin funnels, commander silhouettes, dense panel logic, and restrained late-UC military styling.",
    isActive: true,
  },
  {
    name: "Mobile Suit Gundam: Iron-Blooded Orphans",
    slug: "iron-blooded-orphans",
    universe: "Post Disaster",
    manufacturer: "Bandai",
    visualDNA: "exposed mechanical frames, lean melee-focused armor, raw industrial battlefield forms",
    promptAnchor:
      "Iron-Blooded Orphans world: exposed Gundam frames, utilitarian armor, melee-heavy silhouettes, visible pistons, and harsh industrial combat wear.",
    isActive: true,
  },
  {
    name: "Evangelion",
    slug: "evangelion",
    universe: "Evangelion",
    manufacturer: "Bandai",
    visualDNA: "lanky biomechanical humanoids with organic armor rhythm and vivid restraint accents",
    promptAnchor:
      "Evangelion world: biomechanical humanoid giants, elongated proportions, shoulder pylons, restrained armor plating, and high-contrast experimental color accents.",
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
    proportionDNA: "heroic humanoid, broad chest, squared limbs, compact backpack",
    armorDNA: "white armor, blue torso, red feet, yellow vents, V-fin head",
    keyShapeAnchors: ["V-fin", "dual eye visor", "chest vents", "shield", "beam rifle"],
    forbiddenChanges: ["no wing backpack", "no mono-eye", "no full armor overload", "no organic silhouette"],
    isActive: true,
  },
  {
    ipSeriesSlug: "chars-counterattack",
    name: "MSN-04 Sazabi",
    slug: "msn-04-sazabi",
    unitCode: "MSN-04",
    aliases: ["Sazabi"],
    silhouetteType: "heavy-ace",
    proportionDNA: "large commander frame, broad shoulders, heavy skirt armor, powerful legs",
    armorDNA: "deep red armor, mono-eye head, rounded Neo Zeon armor volumes, dark internal frame",
    keyShapeAnchors: ["mono-eye", "large shoulder armor", "funnel containers", "shield", "beam shot rifle"],
    forbiddenChanges: ["no Gundam face", "no slim hero frame", "no white-blue-red hero palette", "no wing backpack"],
    isActive: true,
  },
  {
    ipSeriesSlug: "iron-blooded-orphans",
    name: "ASW-G-08 Gundam Barbatos",
    slug: "asw-g-08-gundam-barbatos",
    unitCode: "ASW-G-08",
    aliases: ["Barbatos", "Gundam Barbatos"],
    silhouetteType: "agile-frame",
    proportionDNA: "lean exposed frame, narrow waist, long limbs, melee-ready stance",
    armorDNA: "white armor plates over dark mechanical frame, blue torso, red feet, yellow vents",
    keyShapeAnchors: ["exposed waist frame", "mace", "angular head crest", "piston joints", "clawed feet"],
    forbiddenChanges: ["no bulky classic Gundam torso", "no funnel backpack", "no mono-eye", "no smooth organic armor"],
    isActive: true,
  },
  {
    ipSeriesSlug: "chars-counterattack",
    name: "RX-93 Nu Gundam",
    slug: "rx-93-nu-gundam",
    unitCode: "RX-93",
    aliases: ["Nu Gundam"],
    silhouetteType: "hero-long-range",
    proportionDNA: "tall heroic mobile suit, long legs, asymmetrical fin funnel rack, balanced armor mass",
    armorDNA: "white armor, navy torso blocks, yellow vents, red accent parts, black fin funnel patterning",
    keyShapeAnchors: ["V-fin", "fin funnels", "shield", "beam rifle", "chest vents"],
    forbiddenChanges: ["no mono-eye", "no red commander armor", "no missing fin funnels", "no organic EVA proportions"],
    isActive: true,
  },
  {
    ipSeriesSlug: "evangelion",
    name: "EVA Unit-01",
    slug: "eva-unit-01",
    unitCode: "EVA-01",
    aliases: ["Evangelion Unit-01", "Test Type-01"],
    silhouetteType: "agile-experimental",
    proportionDNA: "lanky biomechanical humanoid, narrow waist, long limbs, hunched predatory posture",
    armorDNA: "purple armor, black undersuit, vivid green accents, orange eye details, shoulder pylons",
    keyShapeAnchors: ["single horn", "shoulder pylons", "narrow waist", "green chest accents", "elongated head"],
    forbiddenChanges: ["no Gundam V-fin", "no blocky mobile suit torso", "no heavy skirt armor", "no classic military mono-eye"],
    isActive: true,
  },
];

export const baseModelVariantSeeds: BaseModelVariantSeed[] = [
  {
    baseModelSlug: "rx-78-2",
    baseUnitSlug: "rx-78-2-gundam",
    scale: "1/100",
    panelDensity: "medium",
    promptAnchor:
      "MG RX-78-2 kit variant: preserve classic RX-78-2 proportions, V-fin, chest vents, shield, beam rifle, and clean 1/100 Master Grade panel separation.",
  },
  {
    baseModelSlug: "sazabi",
    baseUnitSlug: "msn-04-sazabi",
    scale: "1/100",
    panelDensity: "high",
    promptAnchor:
      "MG Sazabi kit variant: preserve the large red commander silhouette, mono-eye, heavy shoulders, funnel containers, shield mass, and dense Master Grade armor paneling.",
  },
  {
    baseModelSlug: "barbatos",
    baseUnitSlug: "asw-g-08-gundam-barbatos",
    scale: "1/100",
    panelDensity: "medium",
    promptAnchor:
      "MG Barbatos kit variant: preserve the exposed Gundam frame, narrow waist, mace-ready melee posture, angular armor plates, and visible piston/mechanical detail.",
  },
  {
    baseModelSlug: "nu-gundam",
    baseUnitSlug: "rx-93-nu-gundam",
    scale: "1/144",
    panelDensity: "high",
    promptAnchor:
      "RG Nu Gundam kit variant: preserve the tall RX-93 silhouette, fin funnel rack, V-fin head, shield, beam rifle, and dense Real Grade panel separation.",
  },
  {
    baseModelSlug: "eva-unit-01",
    baseUnitSlug: "eva-unit-01",
    scale: "1/144",
    panelDensity: "high",
    promptAnchor:
      "RG EVA Unit-01 kit variant: preserve the lanky biomechanical body, single horn, shoulder pylons, purple armor, green accents, and experimental organic armor rhythm.",
  },
];

export function buildBaseUnitSearchText(unit: BaseUnitSeed) {
  return [
    unit.name,
    unit.slug,
    unit.unitCode,
    unit.silhouetteType,
    unit.proportionDNA,
    unit.armorDNA,
    ...unit.aliases,
    ...unit.keyShapeAnchors,
    ...unit.forbiddenChanges,
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildBaseModelVariantSearchText(input: {
  name: string;
  series?: string;
  manufacturer?: string;
  grade?: string;
  scale?: string;
  releaseVersion?: string;
  silhouetteType?: string;
  complexityLevel?: string;
  panelDensity?: string;
  aliases: string[];
  tags: string[];
  promptAnchor?: string;
  unitName?: string;
  unitCode?: string;
  ipSeriesName?: string;
  universe?: string;
}) {
  return [
    input.name,
    input.series,
    input.manufacturer,
    input.grade,
    input.scale,
    input.releaseVersion,
    input.silhouetteType,
    input.complexityLevel,
    input.panelDensity,
    input.promptAnchor,
    input.unitName,
    input.unitCode,
    input.ipSeriesName,
    input.universe,
    ...input.aliases,
    ...input.tags,
  ]
    .filter(Boolean)
    .join(" ");
}
