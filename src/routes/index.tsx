import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NeotypeLab TanStack Spike" },
      {
        name: "description",
        content:
          "TanStack Start spike for validating Cloudflare Workers rendering with Convex.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="spike-page">
      <section className="spike-hero">
        <p className="spike-kicker">Migration spike</p>
        <h1>Front-end rendering moves here first. Convex stays canonical.</h1>
        <p>
          This branch validates the smallest useful slice: TanStack Start route
          rendering, Cloudflare Workers configuration, Convex SSR reads, and a
          Clerk-backed terminal entry.
        </p>
        <div className="spike-actions">
          <Link className="spike-button" to="/showcase">
            Check Convex SSR
          </Link>
          <Link className="spike-button spike-button--ghost" to="/t">
            Check auth shell
          </Link>
        </div>
      </section>

      <section className="spike-grid" aria-label="Spike acceptance checks">
        <article className="spike-panel">
          <p className="spike-kicker">01</p>
          <h2>TanStack Start</h2>
          <p>File routes under `src/routes` render independently from Next.</p>
        </article>
        <article className="spike-panel">
          <p className="spike-kicker">02</p>
          <h2>Cloudflare Worker</h2>
          <p>`wrangler.jsonc` targets the Start server entry with Node compat.</p>
        </article>
        <article className="spike-panel">
          <p className="spike-kicker">03</p>
          <h2>Convex Boundary</h2>
          <p>Server rendering reads public Convex data without moving backend logic.</p>
        </article>
      </section>
    </main>
  );
}
