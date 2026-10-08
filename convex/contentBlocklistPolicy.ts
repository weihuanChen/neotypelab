/**
 * Prompt blocklist: a maintained list of prohibited terms checked before any
 * prompt reaches the external safety scan or an AI model. Pure and
 * runtime-neutral so it can be unit-tested and used from Node actions.
 *
 * The live list is the `contentBlocklistTerms` table (editable via
 * contentBlocklist:addTerm / setTermActive). BASE_BLOCKLIST seeds it and is
 * used as a fallback if the table is empty, so screening never runs listless.
 */

export const blocklistCategories = [
  "sexual",
  "child-safety",
  "violence",
  "hate",
  "deepfake",
  "ip",
  "extremism",
] as const;
export type BlocklistCategory = (typeof blocklistCategories)[number];

export type BlocklistTerm = { term: string; category: BlocklistCategory };

/**
 * Deliberately conservative base list for a mecha / model-kit paint product.
 * Domain words that look risky but are normal here are intentionally absent:
 * "blood red", "battle damage", "weapon", "rifle", "military", "kill marks",
 * kit and paint brands (Gundam, Bandai, Tamiya…), and car brands used as color
 * references. Review false positives in `contentSafetyScans` before adding.
 */
export const BASE_BLOCKLIST: readonly BlocklistTerm[] = [
  // Pornography / NSFW
  ...termsFor("sexual", [
    "nsfw", "porn", "porno", "pornographic", "pornography", "hentai", "nude", "nudes", "nudity",
    "naked", "topless", "bottomless", "nipple", "nipples", "genitals", "genitalia", "penis", "vagina",
    "sex", "sexual", "sexy", "erotic", "erotica", "fetish", "bdsm", "onlyfans", "orgasm", "lingerie",
    "色情", "裸体", "裸照", "黄图", "成人内容", "ヌード", "エロ",
  ]),
  // Child-unsafe content (CSAM)
  ...termsFor("child-safety", [
    "loli", "lolicon", "shota", "shotacon", "jailbait", "child porn", "underage sex", "preteen",
    "csam", "pedo", "pedophile", "paedophile",
    "恋童", "幼女", "儿童色情", "萝莉控", "ロリ",
  ]),
  // Violence / gore
  ...termsFor("violence", [
    "gore", "gory", "decapitated", "decapitation", "beheading", "beheaded", "dismembered",
    "dismemberment", "mutilated", "mutilation", "disemboweled", "disembowelment", "torture",
    "tortured", "corpse", "corpses", "massacre", "school shooting", "mass shooting", "suicide",
    "self harm", "blood splatter", "severed head",
    "血腥", "斩首", "肢解", "虐杀", "尸体", "自杀",
  ]),
  // Hate speech
  ...termsFor("hate", [
    "swastika", "heil hitler", "white power", "white supremacy", "kkk", "ku klux klan",
    "ethnic cleansing", "nigger", "faggot", "kike",
    "纳粹标志", "卐",
  ]),
  // Terrorism / extremism / mass-casualty weapons
  ...termsFor("extremism", [
    "isis flag", "al qaeda", "jihadist", "terrorist attack", "pipe bomb", "how to make a bomb",
    "nerve agent", "bioweapon", "chemical weapon recipe",
    "恐怖袭击", "制造炸弹",
  ]),
  // Deepfakes / impersonation of real people
  ...termsFor("deepfake", [
    "deepfake", "deep fake", "face swap", "faceswap", "photo of a real person",
    "donald trump", "joe biden", "vladimir putin", "xi jinping", "kim jong un", "elon musk",
    "taylor swift",
    "换脸", "深度伪造",
  ]),
  // Copyright / trademark — famous non-mecha characters and brands
  ...termsFor("ip", [
    "mickey mouse", "disney", "pixar", "pikachu", "pokemon", "hello kitty", "spider man",
    "spiderman", "batman", "superman", "iron man", "marvel", "dc comics", "star wars",
    "darth vader", "mario bros", "super mario", "nintendo", "coca cola", "nike logo",
    "remove watermark", "without watermark",
  ]),
];

function termsFor(category: BlocklistCategory, terms: readonly string[]): BlocklistTerm[] {
  return terms.map((term) => ({ term, category }));
}

/**
 * Canonical form for both terms and prompts: Unicode-compatibility folded,
 * lowercase, and with punctuation/separators collapsed to single spaces, so
 * "Spider-Man", "spider_man" and "SPIDER  MAN" all match "spider man".
 */
export function normalizeForBlocklist(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\-_.,;:!?'"`’“”()[\]{}/\\|*+=~^]+/g, " ")
    .trim();
}

const cjk = /[\u3040-\u30ff\u31f0-\u31ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u5350]/;

export type BlocklistMatch = { term: string; category: BlocklistCategory };

/**
 * Whole-word matching for Latin terms (so "sex" does not hit "Essex" and
 * "gore" does not hit "Gorey"); substring matching for CJK terms, which have
 * no word boundaries.
 */
export function findBlocklistMatches(
  prompt: string,
  terms: readonly BlocklistTerm[]
): BlocklistMatch[] {
  const haystack = ` ${normalizeForBlocklist(prompt)} `;
  const matches: BlocklistMatch[] = [];
  const seen = new Set<string>();
  for (const entry of terms) {
    const needle = normalizeForBlocklist(entry.term);
    if (!needle || seen.has(needle)) continue;
    const hit = cjk.test(needle) ? haystack.includes(needle) : haystack.includes(` ${needle} `);
    if (hit) {
      seen.add(needle);
      matches.push({ term: needle, category: entry.category });
    }
  }
  return matches;
}
