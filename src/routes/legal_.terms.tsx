import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { LegalDocumentPage } from "@/src/components/information/LegalDocumentPage";
import { appPaths } from "@/src/lib/appPaths";

const termsShell = {
  description: "Rules governing use of NeotypeLab.",
  title: "Terms of Service",
} as const;

export const Route = createFileRoute("/legal_/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service | NeotypeLab" },
      {
        name: "description",
        content: "Read the NeotypeLab terms of service.",
      },
    ],
    links: [{ rel: "canonical", href: appPaths.legalTerms }],
  }),
  component: LegalTermsRoute,
});

function LegalTermsRoute() {
  return (
    <AppShell {...termsShell}>
      <LegalDocumentPage id="terms" />
    </AppShell>
  );
}
