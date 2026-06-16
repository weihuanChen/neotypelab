import { createServerFn } from "@tanstack/react-start";
import { api } from "@/convex/_generated/api";
import {
  defaultShowcaseSort,
  parseOptionalSearchValue,
  parseShowcaseSort,
} from "@/src/components/showcase/showcaseUtils";
import type {
  ShowcaseData,
  ShowcaseSearch,
  ShowcaseSnapshot,
} from "@/src/components/showcase/types";
import { createConvexHttpClient } from "@/src/lib/convexServer";

const emptyShowcaseData: ShowcaseData = {
  concepts: [],
  creatorPacks: [],
  rankedCreators: [],
};

export const getShowcaseSnapshot = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShowcaseSnapshot> => {
    const convex = createConvexHttpClient();

    if (!convex) {
      return {
        status: "missing-env",
        ...emptyShowcaseData,
        message:
          "NEXT_PUBLIC_CONVEX_URL or VITE_CONVEX_URL is required for SSR Convex reads.",
      };
    }

    try {
      const [concepts, creatorPacks, rankedCreators] = await Promise.all([
        convex.query(api.showcase.listPublicConcepts, {}),
        convex.query(api.showcase.listPublicCreatorPacks, {}),
        convex.query(api.showcase.listRankedPublicCreators, {}),
      ]);

      return {
        status: "ok",
        concepts,
        creatorPacks,
        rankedCreators,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "error",
        ...emptyShowcaseData,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
);

export function parseShowcaseSearch(search: Record<string, unknown>): ShowcaseSearch {
  const sort = parseShowcaseSort(search.sort);

  return {
    sort: sort === defaultShowcaseSort ? undefined : sort,
    baseModel: parseOptionalSearchValue(search.baseModel),
    style: parseOptionalSearchValue(search.style),
    category: parseOptionalSearchValue(search.category),
    creator: parseOptionalSearchValue(search.creator),
  };
}

export function buildShowcaseStructuredData(snapshot: ShowcaseSnapshot) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "NeotypeLab Showcase",
    description:
      "Browse public mecha repaint prototypes, paint mapping plans, and community-ready Style DNA surfaces.",
    url: "/showcase",
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
    keywords: "trending, recent, most saved, most remixed",
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ViewAction",
        userInteractionCount: snapshot.concepts.length,
      },
    ],
  };
}
