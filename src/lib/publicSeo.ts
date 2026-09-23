export type PublicSeoCopy = {
  title: string;
  description: string;
  keywords: string;
};

const coreKeywords =
  "gunpla paint, custom gunpla, gundam custom, gunpla weathering, mecha model kit";

export const publicSeo = {
  home: {
    title: "Gunpla Paint Schemes for Custom Mecha Kits | NeotypeLab",
    description:
      "Plan spray-ready Gunpla and mecha model paint schemes before you spray. Preview custom color layouts, real paint maps, and weathering on your kit.",
    keywords: `${coreKeywords}, custom painted gundam`,
  },
  showcase: {
    title: "Gunpla Color Schemes and Mecha Repaint Gallery | NeotypeLab",
    description:
      "Browse spray-ready Gunpla and mecha model repaints. Compare color schemes, paint maps, and weathering, then remix a plan before you open the paint.",
    keywords: "gunpla color scheme, custom gunpla, gundam custom paint, gunpla gallery, mecha model kit",
  },
  archive: {
    title: "Search Gunpla Paint Plans by Kit | NeotypeLab",
    description:
      "Search published Gunpla and mecha model paint plans by kit, color direction, finish, weathering, and builder.",
    keywords: coreKeywords,
  },
  create: {
    title: "Plan a Custom Gunpla Paint Job | NeotypeLab",
    description:
      "Build a spray-ready paint plan for a Gunpla or mecha model kit. Keep the kit identity, map real paints, and preview the finish before you spray.",
    keywords: "gunpla paint, custom gunpla, gundam custom paint, model kit painting, gunpla weathering",
  },
  pricing: {
    title: "Gunpla Paint Plan Credits and Pricing | NeotypeLab",
    description:
      "Credits and plans for prototyping custom Gunpla and mecha model paint schemes, from a first color study to a spray-ready preview.",
    keywords: "gunpla paint, custom gunpla, mecha model kit, model kit painting",
  },
  feedback: {
    title: "Request a Mecha Kit or Paint Plan Fix | NeotypeLab",
    description:
      "Request a missing mecha model kit, or report a paint-mapping issue so the next Gunpla repaint plan stays accurate and spray-ready.",
    keywords: "mecha model kit, gunpla paint, custom gunpla, gundam custom paint",
  },
  contact: {
    title: "Contact NeotypeLab for Gunpla Paint Planning",
    description:
      "Questions about planning a custom Gunpla or mecha model paint scheme, partnerships, and preview issues: hello@neotypelab.com.",
    keywords: "gunpla paint, custom gunpla, mecha model kit, NeotypeLab",
  },
  legal: {
    title: "Legal | NeotypeLab",
    description:
      "Terms of service and privacy policy for NeotypeLab, a planner for spray-ready Gunpla and mecha model paint schemes.",
    keywords: "NeotypeLab, gunpla paint, mecha model kit",
  },
  terms: {
    title: "Terms of Service | NeotypeLab",
    description:
      "Terms for using NeotypeLab to plan spray-ready Gunpla and mecha model paint schemes, including credits, public repaints, and generated previews.",
    keywords: "NeotypeLab terms, gunpla paint, mecha model kit",
  },
  privacy: {
    title: "Privacy Policy | NeotypeLab",
    description:
      "How NeotypeLab handles account and usage data when you plan custom Gunpla and mecha model paint schemes.",
    keywords: "NeotypeLab privacy, gunpla paint, mecha model kit",
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
    keywords: `${kit}, ${style}, gunpla paint, custom gunpla, mecha model kit`,
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
    title: `${input.fullName} (@${input.handle}) Gunpla Paint Plans | NeotypeLab`,
    description: `${input.fullName}'s public Gunpla and mecha model paint plans: ${input.publicConcepts} spray-ready repaints, ${input.saves} saves, and ${input.remixes} remixes.`,
    keywords: `${input.handle}, gunpla paint, custom gunpla, mecha model kit`,
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
    title: `${input.fullName} Gunpla Paint Plans | NeotypeLab`,
    description: `${input.fullName}'s creator hub of spray-ready Gunpla and mecha paint plans: ${input.publicConcepts} repaints, ${input.creatorPacks} color packs, and ${input.styles} reusable directions.`,
    keywords: `${input.handle}, gunpla paint, custom gunpla, mecha model kit`,
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
    title: `${input.name} | Gunpla Paint Pack | NeotypeLab`,
    description:
      authorDescription ||
      `A curated Gunpla and mecha model paint pack: ${input.styles} color directions, ${input.baseModels} kits, and ${input.materials} paint finishes to preview before you spray.`,
    keywords: `${input.name}, gunpla paint, custom gunpla, mecha model kit`,
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
