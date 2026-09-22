import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { LegalIndexPage } from "@/src/components/information/LegalIndexPage";
import { appPaths } from "@/src/lib/appPaths";

const legalShell = {
  description: "Terms, privacy, and related NeotypeLab legal documents.",
  title: "Legal",
} as const;

export const Route = createFileRoute("/legal")({
  head: () => ({
    meta: [
      { title: "Legal | NeotypeLab" },
      {
        name: "description",
        content:
          "Read NeotypeLab terms of service, privacy policy, and related legal documents.",
      },
    ],
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
