import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Link } from "@tanstack/react-router";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";

export function CreationRunNotice() {
  const run = useQuery(api.creationRuns.latest);
  const retry = useMutation(api.creationRuns.retry);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!run || run.status === "succeeded") return null;
  return <section className="create-run-status" aria-live="polite"><div><strong>{run.status === "failed" ? "Preview interrupted" : "Your preview is generating"}</strong><p>{run.status === "failed" ? `All ${run.cost} credits were returned. Retry to continue from the saved plan.` : "You can leave the page. The preview image and paint plan will appear here when ready."}</p>{error ? <p role="alert">{error}</p> : null}</div>
    {run.status === "failed" ? <Button disabled={busy} onClick={() => { setBusy(true); setError(null); void retry({ runId: run.id }).catch(() => setError("Could not restart this preview. Check your balance and try again.")).finally(() => setBusy(false)); }}>Retry · {run.cost} credits</Button> : null}
    {run.conceptId ? <Button asChild variant="outline"><Link to="/library/$conceptId" params={{ conceptId: run.conceptId }} search={{ tab: "overview" }}>View details</Link></Button> : null}
  </section>;
}
