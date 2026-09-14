import { createFileRoute } from "@tanstack/react-router";
import { getStyleGallery } from "@/src/lib/styleRouteData";
import { StyleGallery, StylesUnavailable, styleHead } from "@/src/components/styles/StylePages";

export const Route = createFileRoute("/styles")({
  loader: () => getStyleGallery(),
  head: ({ loaderData }) => styleHead("Repaint styles", "/styles", "Choose a repaint language, then apply it to a kit.", Boolean(loaderData?.data?.length)),
  component: Page,
});
function Page() {
  const snapshot = Route.useLoaderData();
  return snapshot.data ? <StyleGallery styles={snapshot.data} /> : <StylesUnavailable />;
}
