import { SignInButton } from "@clerk/tanstack-react-start";
import { createFileRoute } from "@tanstack/react-router";
import { AuthLoading, Authenticated, Unauthenticated } from "convex/react";
import { Suspense } from "react";
import { AppShell } from "@/src/components/app-shell/AppShell";
import {
  CreateWorkbench,
  parseCreateSearch,
} from "@/src/components/create/CreateWorkbench";

export const Route = createFileRoute("/create")({
  validateSearch: parseCreateSearch,
  head: () => ({
    meta: [
      { title: "Create | NeotypeLab" },
      {
        name: "description",
        content:
          "Prototype spray-ready mecha repaint concepts with structured Style DNA, material presets, and credit-aware generation.",
      },
      { property: "og:title", content: "Create | NeotypeLab" },
      {
        property: "og:description",
        content:
          "Prototype spray-ready mecha repaint concepts with structured Style DNA, material presets, and credit-aware generation.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/create" }],
  }),
  component: CreateRoute,
});

function CreateRoute() {
  const search = Route.useSearch();

  return (
    <AppShell
      description="Select a base model, Style DNA, and material preset to prototype a spray-ready repaint."
      title="Create"
    >
      <AuthLoading>
        <section className="library-empty">
          <p className="showcase-kicker is-teal">Session sync</p>
          <h1>Opening create console.</h1>
        </section>
      </AuthLoading>

      <Unauthenticated>
        <section className="library-empty">
          <p className="showcase-kicker is-orange">Create</p>
          <h1>Prototype a spray-ready repaint before you paint.</h1>
          <p>
            NeotypeLab uses structured inputs instead of open-ended prompts. Pick a
            kit silhouette, apply Style DNA, then generate a concept you can save,
            remix, or publish. Sign in to use your credit balance and private ledger.
          </p>
          <SignInButton mode="modal">
            <button className="showcase-button" type="button">
              Sign in
            </button>
          </SignInButton>
        </section>
      </Unauthenticated>

      <Authenticated>
        <Suspense
          fallback={
            <section className="library-empty">
              <p className="showcase-kicker is-teal">Create</p>
              <h2>Loading creation workbench.</h2>
            </section>
          }
        >
          <CreateWorkbench search={search} />
        </Suspense>
      </Authenticated>
    </AppShell>
  );
}
