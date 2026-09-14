import { createFileRoute } from "@tanstack/react-router";
import { getCommunityGallery } from "@/src/lib/styleRouteData";
import { styleHead } from "@/src/components/styles/StylePages";
import { CommunityStyleGallery, CommunityUnavailable } from "@/src/components/styles/CommunityStylePages";

export const Route = createFileRoute("/community/styles")({
  loader: () => getCommunityGallery(),
  head: () => styleHead("Community styles", "/community/styles", "Shared repaint directions to save and apply to your kit.", false),
  component: Page,
});
function Page() {
  const snapshot = Route.useLoaderData();
  return snapshot.data ? <CommunityStyleGallery styles={snapshot.data} /> : <CommunityUnavailable />;
}
