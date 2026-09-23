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
          "NeotypeLab could not load this page just now.",
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
    view: search.view === "trending" ? "trending" : undefined,
    baseModel: parseOptionalSearchValue(search.baseModel),
    style: parseOptionalSearchValue(search.style),
    material: parseOptionalSearchValue(search.material),
    weathering: parseOptionalSearchValue(search.weathering),
    category: parseOptionalSearchValue(search.category),
    creator: parseOptionalSearchValue(search.creator),
    q: parseOptionalSearchValue(search.q),
  };
}

export function buildShowcaseStructuredData(snapshot: ShowcaseSnapshot) {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Gunpla Color Schemes and Mecha Repaint Gallery",
    description:
      "Browse spray-ready Gunpla and mecha model repaints. Compare color schemes, paint maps, and weathering, then remix a plan before you open the paint.",
    url: "/showcase",
    about: [
      {
        "@type": "Thing",
        name: "Mecha repaint ideas",
      },
      {
        "@type": "Thing",
        name: "Gunpla color schemes",
      },
    ],
    keywords: "gunpla color scheme, custom gunpla, gundam custom paint, gunpla gallery, mecha model kit",
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ViewAction",
        userInteractionCount: snapshot.concepts.length,
      },
    ],
  };
}
