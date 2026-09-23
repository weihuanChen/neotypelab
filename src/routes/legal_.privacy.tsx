import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { LegalDocumentPage } from "@/src/components/information/LegalDocumentPage";
import { appPaths } from "@/src/lib/appPaths";
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";

const privacyShell = {
  description: "How NeotypeLab handles your account and paint-plan data.",
  title: "Privacy Policy",
} as const;

export const Route = createFileRoute("/legal_/privacy")({
  head: () => ({
    meta: documentMeta(publicSeo.privacy, { ogType: "website" }),
    links: [{ rel: "canonical", href: appPaths.legalPrivacy }],
  }),
  component: LegalPrivacyRoute,
});

function LegalPrivacyRoute() {
  return (
    <AppShell {...privacyShell}>
      <LegalDocumentPage id="privacy" />
    </AppShell>
  );
}
