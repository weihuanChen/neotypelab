import { absoluteUrl } from "@/lib/site";

export function buildPrototypeStructuredData(input: {
  conceptId: string;
  title: string;
  description: string;
  imageUrl?: string;
  authorHandle?: string;
  authorName?: string;
  baseModelName?: string;
  stylePresetName?: string;
  materialPresetName?: string;
  visibility: "public" | "unlisted";
  likeCount: number;
  saveCount: number;
  remixCount: number;
}) {
  const url = absoluteUrl(`/prototype/${input.conceptId}`);
  const authorName = input.authorName ?? input.authorHandle ?? "Unknown pilot";

  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: input.title,
    description: input.description,
    url,
    image: input.imageUrl ? [input.imageUrl] : undefined,
    author: {
      "@type": "Person",
      name: authorName,
      url: input.authorHandle ? absoluteUrl(`/pilot/${input.authorHandle}`) : undefined,
      identifier: input.authorHandle,
    },
    keywords: [input.baseModelName, input.stylePresetName, input.materialPresetName]
      .filter(Boolean)
      .join(", "),
    genre: "Mecha repaint prototype",
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: input.likeCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/BookmarkAction",
        userInteractionCount: input.saveCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CreateAction",
        userInteractionCount: input.remixCount,
      },
    ],
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Visibility",
        value: input.visibility,
      },
      {
        "@type": "PropertyValue",
        name: "Base Model",
        value: input.baseModelName ?? "Unknown",
      },
      {
        "@type": "PropertyValue",
        name: "Style DNA",
        value: input.stylePresetName ?? "Unknown",
      },
      {
        "@type": "PropertyValue",
        name: "Material Profile",
        value: input.materialPresetName ?? "Unknown",
      },
    ],
  };
}

export function buildPilotProfileStructuredData(input: {
  handle: string;
  fullName: string;
  imageUrl?: string;
  publicConceptCount: number;
  totalLikes: number;
  totalSaves: number;
  totalRemixes: number;
}) {
  const url = absoluteUrl(`/pilot/${input.handle}`);

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url,
    mainEntity: {
      "@type": "Person",
      name: input.fullName,
      alternateName: `@${input.handle}`,
      image: input.imageUrl,
      identifier: input.handle,
      interactionStatistic: [
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/LikeAction",
          userInteractionCount: input.totalLikes,
        },
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/BookmarkAction",
          userInteractionCount: input.totalSaves,
        },
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/CreateAction",
          userInteractionCount: input.totalRemixes,
        },
      ],
    },
    description: `${input.publicConceptCount} public concepts, ${input.totalSaves} saves, ${input.totalRemixes} remix branches.`,
  };
}

export function buildLandingPageStructuredData(input: {
  baseModelSlug: string;
  stylePresetSlug: string;
  baseModelName: string;
  stylePresetName: string;
  description: string;
  imageUrl?: string;
  conceptCount: number;
  likeCount: number;
  saveCount: number;
  remixCount: number;
  seoKeywords: string[];
}) {
  const url = absoluteUrl(`/${input.baseModelSlug}/${input.stylePresetSlug}`);

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${input.baseModelName} ${input.stylePresetName} ideas`,
    description: input.description,
    url,
    image: input.imageUrl ? [input.imageUrl] : undefined,
    keywords: input.seoKeywords.join(", "),
    about: [
      {
        "@type": "Thing",
        name: input.baseModelName,
      },
      {
        "@type": "Thing",
        name: input.stylePresetName,
      },
    ],
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ViewAction",
        userInteractionCount: input.conceptCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: input.likeCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/BookmarkAction",
        userInteractionCount: input.saveCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CreateAction",
        userInteractionCount: input.remixCount,
      },
    ],
  };
}

export function buildShowcaseStructuredData(input: {
  conceptCount: number;
  sorts: string[];
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "NeotypeLab Showcase",
    description:
      "Browse public mecha repaint prototypes, paint mapping plans, and community-ready Style DNA surfaces.",
    url: absoluteUrl("/showcase"),
    about: [
      {
        "@type": "Thing",
        name: "Mecha repaint ideas",
      },
      {
        "@type": "Thing",
        name: "Style DNA discovery",
      },
    ],
    keywords: input.sorts.join(", "),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ViewAction",
        userInteractionCount: input.conceptCount,
      },
    ],
  };
}

export function buildCreatorPackStructuredData(input: {
  slug: string;
  name: string;
  description: string;
  creatorHandle: string;
  creatorName: string;
  imageUrl?: string;
  styleCount: number;
  baseModelCount: number;
  materialCount: number;
  packType: "free" | "premium";
  likeCount: number;
  saveCount: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: absoluteUrl(`/creator-pack/${input.slug}`),
    image: input.imageUrl ? [input.imageUrl] : undefined,
    author: {
      "@type": "Person",
      name: input.creatorName,
      url: absoluteUrl(`/pilot/${input.creatorHandle}`),
      identifier: input.creatorHandle,
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: "Pack Type",
        value: input.packType,
      },
      {
        "@type": "PropertyValue",
        name: "Style Count",
        value: `${input.styleCount}`,
      },
      {
        "@type": "PropertyValue",
        name: "Base Model Count",
        value: `${input.baseModelCount}`,
      },
      {
        "@type": "PropertyValue",
        name: "Material Count",
        value: `${input.materialCount}`,
      },
    ],
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: input.likeCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/BookmarkAction",
        userInteractionCount: input.saveCount,
      },
    ],
  };
}

export function buildCreatorHubStructuredData(input: {
  handle: string;
  fullName: string;
  imageUrl?: string;
  publicConceptCount: number;
  totalLikes: number;
  totalSaves: number;
  totalRemixes: number;
  creatorPackCount: number;
  styleCollectionCount: number;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: absoluteUrl(`/creator/${input.handle}`),
    mainEntity: {
      "@type": "Person",
      name: input.fullName,
      alternateName: `@${input.handle}`,
      image: input.imageUrl,
      identifier: input.handle,
      interactionStatistic: [
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/LikeAction",
          userInteractionCount: input.totalLikes,
        },
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/BookmarkAction",
          userInteractionCount: input.totalSaves,
        },
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/CreateAction",
          userInteractionCount: input.totalRemixes,
        },
      ],
    },
    description: `${input.publicConceptCount} public concepts, ${input.creatorPackCount} creator packs, ${input.styleCollectionCount} creator styles.`,
  };
}
