import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@/convex/_generated/api";
import { createConvexHttpClient } from "@/src/lib/convexServer";

const getShowcaseSnapshot = createServerFn({ method: "GET" }).handler(
  async () => {
    const convex = createConvexHttpClient();

    if (!convex) {
      return {
        status: "missing-env" as const,
        conceptCount: 0,
        concepts: [],
        message:
          "NEXT_PUBLIC_CONVEX_URL or VITE_CONVEX_URL is required for SSR Convex reads.",
      };
    }

    try {
      const concepts = await convex.query(api.showcase.listPublicConcepts, {});

      return {
        status: "ok" as const,
        conceptCount: concepts.length,
        concepts: concepts.slice(0, 6).map((concept) => ({
          id: concept._id,
          title: concept.title,
          owner: concept.owner?.handle ?? "anonymous",
          baseModel: concept.baseModel?.name ?? "Unknown base model",
          stylePreset: concept.stylePreset?.name ?? "Unknown Style DNA",
          material: concept.materialPreset?.name ?? "Unknown material",
          previewUrl: concept.previewAsset?.publicUrl ?? null,
          likeCount: concept.engagement.likeCount,
          saveCount: concept.engagement.saveCount,
          remixCount: concept.remixCount,
        })),
        fetchedAt: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: "error" as const,
        conceptCount: 0,
        concepts: [],
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }
);

export const Route = createFileRoute("/showcase")({
  loader: () => getShowcaseSnapshot(),
  head: () => ({
    meta: [
      { title: "Showcase SSR | NeotypeLab TanStack Spike" },
      {
        name: "description",
        content:
          "Public Convex showcase data rendered through TanStack Start on the spike branch.",
      },
    ],
  }),
  component: ShowcaseSpike,
});

function ShowcaseSpike() {
  const snapshot = Route.useLoaderData();

  return (
    <main className="spike-page">
      <section className="spike-hero spike-hero--short">
        <p className="spike-kicker">Convex SSR probe</p>
        <h1>Showcase data is loaded by a TanStack Start server function.</h1>
        <p>
          Status: <strong>{snapshot.status}</strong>
          {" conceptCount" in snapshot ? ` / ${snapshot.conceptCount} public items` : ""}
        </p>
      </section>

      {snapshot.status !== "ok" ? (
        <section className="spike-panel">
          <p className="spike-kicker">Probe output</p>
          <h2>Convex read not available yet</h2>
          <p>{snapshot.message}</p>
        </section>
      ) : (
        <section className="spike-card-grid">
          {snapshot.concepts.map((concept) => (
            <article className="spike-card" key={concept.id}>
              {concept.previewUrl ? (
                <img src={concept.previewUrl} alt="" />
              ) : (
                <div className="spike-card__placeholder">No preview</div>
              )}
              <div>
                <p className="spike-kicker">@{concept.owner}</p>
                <h2>{concept.title}</h2>
                <dl className="spike-facts">
                  <div>
                    <dt>Base</dt>
                    <dd>{concept.baseModel}</dd>
                  </div>
                  <div>
                    <dt>Style</dt>
                    <dd>{concept.stylePreset}</dd>
                  </div>
                  <div>
                    <dt>Material</dt>
                    <dd>{concept.material}</dd>
                  </div>
                </dl>
                <p className="spike-card__meta">
                  {concept.likeCount} likes / {concept.saveCount} saves /{" "}
                  {concept.remixCount} remixes
                </p>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
