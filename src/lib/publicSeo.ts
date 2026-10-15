export type PublicSeoCopy = {
  title: string;
  description: string;
  keywords: string;
};

const homeKeywords =
  "mecha model kit, model kit painting, custom gunpla, gunpla painting, mecha musume, 30 minute sisters, zoids model kit, girlpla";

export const supportKeywords =
  "mecha model kit, model kit painting, gunpla painting, custom gunpla";

export const publicSeo = {
  home: {
    title: "Mecha Model Kit Paint Plans | NeotypeLab",
    description:
      "Preview spray-ready color schemes for Gunpla, mecha girls, and Zoids before you paint. Upload your own kit, compare weathering, and map the finish to hobby paint.",
    keywords: homeKeywords,
  },
  showcase: {
    title: "Mecha Color Schemes for Gunpla, Girlpla, and Zoids | NeotypeLab",
    description:
      "Browse spray-ready color schemes for Gunpla, mecha girls, and Zoids. Compare paint maps and weathering, then remix a plan before you open the paint.",
    keywords:
      "gundam color scheme, girlpla, 30 minute sisters, megami device, zoids model kit, mecha musume, gunpla weathering",
  },
  archive: {
    title: "Search Mecha Paint Plans by Kit | NeotypeLab",
    description:
      "Search published mecha paint plans by kit, color direction, finish, weathering, and builder, including Gunpla, mecha girls, and Zoids.",
    keywords:
      "mecha model kit, zoids model kit, armored core model kit, 30 minute sisters, megami device, hmm zoids, mecha musume",
  },
  create: {
    title: "Custom Mecha Paint Planner | NeotypeLab",
    description:
      "Upload a photo of your Gunpla, mecha girl, or Zoids kit, describe the colors, and preview a spray-ready paint plan before you open the paint.",
    keywords:
      "custom gunpla, gundam custom, custom gundam builder, 30 minute sisters custom, gunpla weathering, model kit painting",
  },
  pricing: {
    title: "Mecha Paint Plan Credits and Pricing | NeotypeLab",
    description:
      "Credits and plans for prototyping mecha model paint schemes, from a first color study to a spray-ready preview.",
    keywords: "mecha model kit, model kit painting, custom gunpla, gunpla painting",
  },
  feedback: {
    title: "Request a Mecha Kit or Paint Plan Fix | NeotypeLab",
    description:
      "Request a missing mecha model kit, or report a paint-mapping issue so the next repaint plan stays accurate and spray-ready.",
    keywords: "mecha model kit, model kit painting, custom gunpla, gundam custom",
  },
  contact: {
    title: "Contact NeotypeLab for Mecha Paint Planning",
    description:
      "Questions about planning a mecha model paint scheme, partnerships, and preview issues: hello@neotypelab.com.",
    keywords: "mecha model kit, model kit painting, custom gunpla, NeotypeLab",
  },
  legal: {
    title: "Legal | NeotypeLab",
    description:
      "Terms of service, privacy policy, and AI acceptable use policy for NeotypeLab, a planner for spray-ready mecha model paint schemes.",
    keywords: "NeotypeLab, mecha model kit, model kit painting",
  },
  terms: {
    title: "Terms of Service | NeotypeLab",
    description:
      "Terms for using NeotypeLab to plan spray-ready mecha model paint schemes, including credits, public repaints, and generated previews.",
    keywords: "NeotypeLab terms, mecha model kit, model kit painting",
  },
  acceptableUse: {
    title: "AI Acceptable Use Policy | NeotypeLab",
    description:
      "Prohibited content, the AI models NeotypeLab uses, prompt safety screening, enforcement, and how to report a violation or appeal a decision.",
    keywords: "NeotypeLab acceptable use policy, AI content policy, mecha model kit, model kit painting",
  },
  privacy: {
    title: "Privacy Policy | NeotypeLab",
    description:
      "How NeotypeLab handles account and usage data when you plan mecha model paint schemes.",
    keywords: "NeotypeLab privacy, mecha model kit, model kit painting",
  },
} as const satisfies Record<string, PublicSeoCopy>;

export function prototypeSeo(input: {
  title: string;
  baseModelName?: string;
  styleName?: string;
  materialName?: string;
}): PublicSeoCopy {
  const kit = input.baseModelName ?? "this mecha model kit";
  const style = input.styleName ?? "a custom color direction";
  const finish = input.materialName ?? "a hobby paint finish";

  return {
    title: `${input.title} Paint Plan | NeotypeLab`,
    description: `Spray-ready paint plan for ${kit} in ${style}. Finish: ${finish}. Preview the color layout and weathering before you spray.`,
    keywords: `${kit}, ${style}, ${supportKeywords}`,
  };
}

export function pilotSeo(input: {
  fullName: string;
  handle: string;
  publicConcepts: number;
  saves: number;
  remixes: number;
}): PublicSeoCopy {
  return {
    title: `${input.fullName} (@${input.handle}) Mecha Paint Plans | NeotypeLab`,
    description: `${input.fullName}'s public mecha model paint plans: ${input.publicConcepts} spray-ready repaints, ${input.saves} saves, and ${input.remixes} remixes.`,
    keywords: `${input.handle}, ${supportKeywords}`,
  };
}

export function creatorHubSeo(input: {
  fullName: string;
  handle: string;
  publicConcepts: number;
  creatorPacks: number;
  styles: number;
}): PublicSeoCopy {
  return {
    title: `${input.fullName} Mecha Paint Plans | NeotypeLab`,
    description: `${input.fullName}'s creator hub of spray-ready mecha model paint plans: ${input.publicConcepts} repaints, ${input.creatorPacks} color packs, and ${input.styles} reusable directions.`,
    keywords: `${input.handle}, ${supportKeywords}`,
  };
}

export function creatorPackSeo(input: {
  name: string;
  description?: string | null;
  styles: number;
  baseModels: number;
  materials: number;
}): PublicSeoCopy {
  const authorDescription = input.description?.trim();

  return {
    title: `${input.name} | Mecha Paint Pack | NeotypeLab`,
    description:
      authorDescription ||
      `A curated mecha model paint pack: ${input.styles} color directions, ${input.baseModels} kits, and ${input.materials} paint finishes to preview before you spray.`,
    keywords: `${input.name}, ${supportKeywords}`,
  };
}

type DocumentMetaTag = { title: string } | { name: string; content: string } | { property: string; content: string };

export function documentMeta(
  copy: PublicSeoCopy,
  options: {
    ogType?: string;
    twitter?: boolean;
    twitterCard?: "summary" | "summary_large_image";
    imageUrl?: string;
    url?: string;
  } = {},
): DocumentMetaTag[] {
  const meta: DocumentMetaTag[] = [
    { title: copy.title },
    { name: "description", content: copy.description },
    { name: "keywords", content: copy.keywords },
    { property: "og:title", content: copy.title },
    { property: "og:description", content: copy.description },
  ];

  if (options.url) {
    meta.push({ property: "og:url", content: options.url });
  }

  if (options.ogType) {
    meta.push({ property: "og:type", content: options.ogType });
  }

  if (options.twitter) {
    meta.push(
      {
        name: "twitter:card",
        content: options.twitterCard ?? (options.imageUrl ? "summary_large_image" : "summary"),
      },
      { name: "twitter:title", content: copy.title },
      { name: "twitter:description", content: copy.description },
    );
  }

  if (options.imageUrl) {
    meta.push(
      { property: "og:image", content: options.imageUrl },
      { name: "twitter:image", content: options.imageUrl },
    );
  }

  return meta;
}
