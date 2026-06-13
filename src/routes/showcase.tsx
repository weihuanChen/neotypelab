import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@/convex/_generated/api";
import { ShowcaseFeed } from "@/src/components/showcase/ShowcaseFeed";
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

const getShowcaseSnapshot = createServerFn({ method: "GET" }).handler(
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

export const Route = createFileRoute("/showcase")({
  validateSearch: (search): ShowcaseSearch => {
    const sort = parseShowcaseSort(search.sort);

    return {
      sort: sort === defaultShowcaseSort ? undefined : sort,
      baseModel: parseOptionalSearchValue(search.baseModel),
      style: parseOptionalSearchValue(search.style),
      category: parseOptionalSearchValue(search.category),
      creator: parseOptionalSearchValue(search.creator),
    };
  },
  loader: () => getShowcaseSnapshot(),
  head: () => ({
    meta: [
      { title: "NeotypeLab Showcase" },
      {
        name: "description",
        content:
          "Browse public mecha repaint prototypes, paint mapping plans, and community-ready Style DNA surfaces.",
      },
      { property: "og:title", content: "NeotypeLab Showcase" },
      {
        property: "og:description",
        content:
          "Browse public mecha repaint prototypes, paint mapping plans, and community-ready Style DNA surfaces.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ShowcaseRoute,
});

function ShowcaseRoute() {
  const snapshot = Route.useLoaderData();
  const search = Route.useSearch();
  const structuredData = {
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

  return (
    <main className="showcase-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />
      <section className="showcase-topbar">
        <div>
          <p className="showcase-kicker">NeotypeLab Public</p>
          <h1>Published prototype showcase</h1>
        </div>
        <div className="showcase-topbar__actions">
          <a className="showcase-button is-ghost" href="/">
            Home
          </a>
          <a className="showcase-button" href="/t/showcase">
            Open Terminal
          </a>
        </div>
      </section>
      <ShowcaseFeed search={search} snapshot={snapshot} />
    </main>
  );
}
