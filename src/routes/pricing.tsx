import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { InformationPagePlaceholder } from "@/src/components/information/InformationPagePlaceholder";
import { appPaths } from "@/src/lib/appPaths";

const pricingShell = {
  description: "Credits, plans, and how NeotypeLab generation usage is priced.",
  title: "Pricing",
} as const;

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing | NeotypeLab" },
      {
        name: "description",
        content:
          "See how NeotypeLab credits and plans work for mecha repaint generation.",
      },
    ],
    links: [{ rel: "canonical", href: appPaths.pricing }],
  }),
  component: PricingRoute,
});

function PricingRoute() {
  return (
    <AppShell {...pricingShell}>
      <InformationPagePlaceholder body="Pricing details are being prepared. This route is live so navigation and SEO can land first." />
    </AppShell>
  );
}
