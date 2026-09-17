import { createFileRoute, notFound } from "@tanstack/react-router";
import { noIndexRobots, publicStylesEnabled } from "@/src/lib/appPaths";
import { getStyleGallery } from "@/src/lib/styleRouteData";
import { StyleGallery, StylesUnavailable, styleHead } from "@/src/components/styles/StylePages";

export const Route = createFileRoute("/styles")({
  beforeLoad: () => {
    if (!publicStylesEnabled) throw notFound();
  },
  loader: () => getStyleGallery(),
  head: ({ loaderData }) =>
    publicStylesEnabled
      ? styleHead("Repaint styles", "/styles", "Choose a repaint language, then apply it to a kit.", Boolean(loaderData?.data?.length))
      : { meta: [noIndexRobots] },
  component: Page,
});
function Page() {
  const snapshot = Route.useLoaderData();
  return snapshot.data ? <StyleGallery styles={snapshot.data} /> : <StylesUnavailable />;
}
