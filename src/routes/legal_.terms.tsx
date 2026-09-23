import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { LegalDocumentPage } from "@/src/components/information/LegalDocumentPage";
import { appPaths } from "@/src/lib/appPaths";
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";

const termsShell = {
  description: "The rules for using NeotypeLab to plan spray-ready paint schemes.",
  title: "Terms of Service",
} as const;

export const Route = createFileRoute("/legal_/terms")({
  head: () => ({
    meta: documentMeta(publicSeo.terms, { ogType: "website" }),
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
