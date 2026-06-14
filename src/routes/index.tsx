import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NeotypeLab" },
      {
        name: "description",
        content:
          "Discover public repaint prototypes and open the authenticated NeotypeLab creation terminal.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  return (
    <main className="spike-page">
      <section className="spike-hero">
        <p className="spike-kicker">NeotypeLab</p>
        <h1>Structured repaint concepts, public surfaces, and operator tools.</h1>
        <p>
          Explore creator-ready prototype surfaces, fork public builds into the
          create workflow, and keep generated concepts backed by Convex.
        </p>
        <div className="spike-actions">
          <Link className="spike-button" to="/showcase">
            Open showcase
          </Link>
          <Link className="spike-button" to="/t/create">
            Start creating
          </Link>
          <Link className="spike-button spike-button--ghost" to="/t/library">
            Open library
          </Link>
        </div>
      </section>

      <section className="spike-grid" aria-label="Production surfaces">
        <article className="spike-panel">
          <p className="spike-kicker">01</p>
          <h2>Public Showcase</h2>
          <p>SEO-ready prototype, pilot, creator, and pack surfaces render on Workers.</p>
        </article>
        <article className="spike-panel">
          <p className="spike-kicker">02</p>
          <h2>Create Terminal</h2>
          <p>Authenticated create sessions write concepts, jobs, and recommendations to Convex.</p>
        </article>
        <article className="spike-panel">
          <p className="spike-kicker">03</p>
          <h2>Operator Library</h2>
          <p>Private concepts, saved public builds, and generation ledgers stay in sync.</p>
        </article>
      </section>
    </main>
  );
}
