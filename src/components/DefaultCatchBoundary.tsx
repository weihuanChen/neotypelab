import type { ErrorComponentProps } from "@tanstack/react-router";

export function DefaultCatchBoundary({ error }: ErrorComponentProps) {
  return (
    <main className="spike-page spike-page--compact">
      <section className="spike-panel">
        <p className="spike-kicker">Runtime fault</p>
        <h1>NeotypeLab could not render this route.</h1>
        <pre className="spike-code">
          {error instanceof Error ? error.message : String(error)}
        </pre>
      </section>
    </main>
  );
}
