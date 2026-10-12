import { createServerOnlyFn } from "@tanstack/react-start";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { SharedPrototype } from "@/src/components/prototype/types";
import { createConvexHttpClient } from "@/src/lib/convexServer";

type PublicConceptResult =
  | { status: "ok"; concept: SharedPrototype }
  | { status: "not-found" | "unavailable"; concept: null };

export const getPublicConcept = createServerOnlyFn(async (conceptId: string): Promise<PublicConceptResult> => {
  // Convex document IDs are lowercase base32 strings. Reject malformed URLs
  // before making a network request; deployment failures must remain 503s.
  if (!/^[a-z0-9]{32}$/.test(conceptId)) return { status: "not-found", concept: null };
  const client = createConvexHttpClient();
  if (!client) return { status: "unavailable", concept: null };
  try {
    const concept = await client.query(api.showcase.getSharedConcept, { conceptId: conceptId as Id<"concepts"> });
    return concept ? { status: "ok", concept } : { status: "not-found", concept: null };
  } catch (error) {
    // A syntactically plausible ID with an invalid checksum is also a missing URL.
    if (error instanceof Error && /ArgumentValidationError|Invalid ID|not a valid ID/i.test(error.message)) {
      return { status: "not-found", concept: null };
    }
    return { status: "unavailable", concept: null };
  }
});

export function unavailablePublicConceptResponse(result: PublicConceptResult): Response | null {
  return result.status === "ok" ? null : new Response(
    result.status === "not-found" ? "Not found" : "Temporarily unavailable",
    { status: result.status === "not-found" ? 404 : 503, headers: {
      "Cache-Control": "no-store", "X-Robots-Tag": "noindex",
      ...(result.status === "unavailable" ? { "Retry-After": "60" } : {}),
    } },
  );
}
