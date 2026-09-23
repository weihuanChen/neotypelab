import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ContactPage } from "@/src/components/information/ContactPage";
import { appPaths } from "@/src/lib/appPaths";
import { documentMeta, publicSeo } from "@/src/lib/publicSeo";

const contactShell = {
  description: "Questions about paint planning, partnerships, and preview issues.",
  title: "Contact",
} as const;

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: documentMeta(publicSeo.contact, { ogType: "website" }),
    links: [{ rel: "canonical", href: appPaths.contact }],
  }),
  component: ContactRoute,
});

function ContactRoute() {
  return (
    <AppShell {...contactShell}>
      <ContactPage />
    </AppShell>
  );
}
