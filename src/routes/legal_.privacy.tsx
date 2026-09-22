import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { LegalDocumentPage } from "@/src/components/information/LegalDocumentPage";
import { appPaths } from "@/src/lib/appPaths";

const privacyShell = {
  description: "How account and usage data are handled.",
  title: "Privacy Policy",
} as const;

export const Route = createFileRoute("/legal_/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | NeotypeLab" },
      {
        name: "description",
        content: "Read the NeotypeLab privacy policy.",
      },
    ],
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
