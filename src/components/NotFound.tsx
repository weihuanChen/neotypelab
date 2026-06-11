import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <main className="spike-page spike-page--compact">
      <section className="spike-panel">
        <p className="spike-kicker">404</p>
        <h1>This spike route does not exist.</h1>
        <Link className="spike-button" to="/">
          Back to spike home
        </Link>
      </section>
    </main>
  );
}
