import { ConvexError } from "convex/values";

/** Only application errors intentionally exposed by the server are user-facing. */
export function convexErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    const message = typeof data === "string" ? data
      : data && typeof data === "object" && "message" in data && typeof data.message === "string" ? data.message : null;
    if (message?.trim()) return message.trim();
  }
  return fallback;
}
