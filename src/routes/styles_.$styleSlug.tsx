import { createFileRoute, notFound } from "@tanstack/react-router";
import { noIndexRobots, publicStylesEnabled } from "@/src/lib/appPaths";
import { getStylePage } from "@/src/lib/styleRouteData";
import { StyleDetail, StylesUnavailable, styleHead } from "@/src/components/styles/StylePages";

export const Route = createFileRoute("/styles_/$styleSlug")({
  beforeLoad: () => {
    if (!publicStylesEnabled) throw notFound();
  },
  loader: async ({ params }) => {
    const result = await getStylePage({ data: { slug: params.styleSlug } });
    if (result.status === "not-found") throw notFound();
    return result;
  },
  head: ({ loaderData, params }) =>
    publicStylesEnabled
      ? styleHead(loaderData?.data?.style.name ?? "Style unavailable", `/styles/${params.styleSlug}`,
          loaderData?.data?.style.description ?? "Repaint style study.", Boolean(loaderData?.data), loaderData?.data?.pairs[0].imageUrl)
      : { meta: [noIndexRobots] },
  component: Page,
});
function Page() {
  const snapshot = Route.useLoaderData();
  return snapshot.data ? <StyleDetail detail={snapshot.data} /> : <StylesUnavailable />;
}
