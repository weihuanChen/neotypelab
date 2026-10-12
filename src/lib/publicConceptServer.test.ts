import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPublicConcept, unavailablePublicConceptResponse } from "./publicConceptServer";

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ createServerOnlyFn: (fn: unknown) => fn }));
vi.mock("./convexServer", () => ({ createConvexHttpClient: () => ({ query }) }));

const plausibleId = "k".repeat(32);

beforeEach(() => { query.mockReset(); });

describe("public work HTTP classification", () => {
  it("rejects malformed IDs as 404 without consulting the backend", async () => {
    const result = await getPublicConcept("missing-work");
    expect(query).not.toHaveBeenCalled();
    expect(unavailablePublicConceptResponse(result)?.status).toBe(404);
  });

  it("returns 404 when the backend revokes public access", async () => {
    query.mockResolvedValue(null);
    const response = unavailablePublicConceptResponse(await getPublicConcept(plausibleId));
    expect(response?.status).toBe(404);
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("preserves temporary outages as retryable 503s", async () => {
    query.mockRejectedValue(new Error("Network unavailable"));
    const response = unavailablePublicConceptResponse(await getPublicConcept(plausibleId));
    expect(response?.status).toBe(503);
    expect(response?.headers.get("Retry-After")).toBe("60");
    expect(response?.headers.get("Cache-Control")).toBe("no-store");
  });

  it("classifies a rejected document ID as 404", async () => {
    query.mockRejectedValue(new Error("ArgumentValidationError: Invalid ID"));
    expect(unavailablePublicConceptResponse(await getPublicConcept(plausibleId))?.status).toBe(404);
  });
});
