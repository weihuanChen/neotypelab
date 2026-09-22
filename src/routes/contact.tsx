import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/src/components/app-shell/AppShell";
import { ContactPage } from "@/src/components/information/ContactPage";
import { appPaths } from "@/src/lib/appPaths";

const contactShell = {
  description: "Questions, partnerships, and generation issues.",
  title: "Contact",
} as const;

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact | NeotypeLab" },
      {
        name: "description",
        content:
          "Contact NeotypeLab at hello@neotypelab.com for product questions, partnerships, and generation issues.",
      },
    ],
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
