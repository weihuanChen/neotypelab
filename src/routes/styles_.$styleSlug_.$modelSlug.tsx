import { createFileRoute, notFound } from "@tanstack/react-router";
import { noIndexRobots, publicStylesEnabled } from "@/src/lib/appPaths";
import { getStyleModelPage } from "@/src/lib/styleRouteData";
import { StyleModelDetail, StylesUnavailable, styleHead } from "@/src/components/styles/StylePages";

export const Route = createFileRoute("/styles_/$styleSlug_/$modelSlug")({
  beforeLoad: () => {
    if (!publicStylesEnabled) throw notFound();
  },
  loader: async ({ params }) => {
    const result = await getStyleModelPage({ data: { styleSlug: params.styleSlug, modelSlug: params.modelSlug } });
    if (result.status === "not-found") throw notFound();
    return result;
  },
  head: ({ loaderData, params }) =>
    publicStylesEnabled
      ? styleHead(loaderData?.data ? `${loaderData.data.style.name} on ${loaderData.data.model.name}` : "Style study unavailable",
          `/styles/${params.styleSlug}/${params.modelSlug}`, loaderData?.data?.style.description ?? "Repaint style and model study.",
          Boolean(loaderData?.data), loaderData?.data?.imageUrl)
      : { meta: [noIndexRobots] },
  component: Page,
});
function Page() {
  const snapshot = Route.useLoaderData();
  return snapshot.data ? <StyleModelDetail pair={snapshot.data} /> : <StylesUnavailable />;
}
