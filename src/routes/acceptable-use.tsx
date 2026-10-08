import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { LegalDocumentPage } from "@/src/components/information/LegalDocumentPage";
import { appPaths } from "@/src/lib/appPaths";
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";

const acceptableUseShell = {
  description: "What you may create with NeotypeLab’s AI tools, the models we use, and how we enforce it.",
  title: "AI Acceptable Use Policy",
} as const;

export const Route = createFileRoute("/acceptable-use")({
  head: () => ({
    meta: documentMeta(publicSeo.acceptableUse, { ogType: "website" }),
    links: [{ rel: "canonical", href: appPaths.acceptableUse }],
  }),
  component: AcceptableUseRoute,
});

function AcceptableUseRoute() {
  return (
    <AppShell {...acceptableUseShell}>
      <LegalDocumentPage id="acceptable-use" />
    </AppShell>
  );
}
