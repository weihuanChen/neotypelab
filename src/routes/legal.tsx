import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { LegalIndexPage } from "@/src/components/information/LegalIndexPage";
import { appPaths } from "@/src/lib/appPaths";
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";

const legalShell = {
  description: "Terms and privacy for planning spray-ready Gunpla and mecha paint schemes.",
  title: "Legal",
} as const;

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: documentMeta(publicSeo.legal, { ogType: "website" }),
    links: [{ rel: "canonical", href: appPaths.legal }],
  }),
  component: LegalRoute,
});

function LegalRoute() {
  return (
    <AppShell {...legalShell}>
      <LegalIndexPage />
    </AppShell>
  );
}
