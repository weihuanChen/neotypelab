import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { convexErrorMessage } from "./convexError";

const fallback = "Could not start this preview. Please try again.";

describe("user-facing Convex errors", () => {
  it("reads business error data even when the transport message contains a request ID", () => {
    const error = new ConvexError("Preview price changed. Review the updated total and try again");
    error.message = "[CONVEX M(creationRuns:start)] [Request ID: example] Server Error";
    expect(convexErrorMessage(error, fallback)).toBe(error.data);
  });

  it("supports structured business errors", () => {
    expect(convexErrorMessage(new ConvexError({ code: "INSUFFICIENT_CREDITS", message: "This preview requires 8 credits" }), fallback))
      .toBe("This preview requires 8 credits");
  });

  it.each([
    new Error("[CONVEX M(creationRuns:start)] [Request ID: example] Server Error"),
    new Error("Internal provider credentials are missing"),
    new ConvexError({ code: "UNKNOWN" }),
    new ConvexError(" "),
    null,
  ])("uses a safe retry message for unexpected or empty errors", error => {
    expect(convexErrorMessage(error, fallback)).toBe(fallback);
  });
});
