import { createFileRoute, notFound } from "@tanstack/react-router";
import { getCommunityStylePage } from "@/src/lib/styleRouteData";
import { styleHead } from "@/src/components/styles/StylePages";
import { CommunityStyleDetail, CommunityUnavailable } from "@/src/components/styles/CommunityStylePages";

export const Route = createFileRoute("/c/$styleId")({
  loader: async ({ params }) => {
    const result = await getCommunityStylePage({ data: { styleId: params.styleId } });
    if (result.status === "not-found") throw notFound();
    return result;
  },
  head: ({ loaderData, params }) => styleHead(loaderData?.data?.name ?? "Shared style unavailable", `/c/${params.styleId}`,
    loaderData?.data?.intent.graphicLanguage ?? "Community repaint style.", false, loaderData?.data?.preview?.imageUrl),
  component: Page,
});
function Page() {
  const snapshot = Route.useLoaderData();
  return snapshot.data ? <CommunityStyleDetail style={snapshot.data} /> : <CommunityUnavailable />;
}
