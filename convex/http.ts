import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { billingWebhookPayloadSchema, verifyBillingWebhookSignature } from "./billingWebhook";

const http = httpRouter();

http.route({
  path: "/billing/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.BILLING_WEBHOOK_SECRET?.trim();
    if (!secret || secret.length < 32) {
      return jsonResponse({ error: "Billing webhook is not configured" }, 503);
    }
    const body = await request.text();
    const verified = await verifyBillingWebhookSignature({
      body,
      signature: request.headers.get("x-neotypelab-signature"),
      timestamp: request.headers.get("x-neotypelab-timestamp"),
      secret,
    });
    if (!verified) return jsonResponse({ error: "Invalid billing webhook signature" }, 401);
    let parsed: ReturnType<typeof billingWebhookPayloadSchema.parse>;
    try {
      parsed = billingWebhookPayloadSchema.parse(JSON.parse(body));
    } catch {
      return jsonResponse({ error: "Invalid billing webhook payload" }, 400);
    }
    try {
      const result = await ctx.runMutation(internal.subscriptions.processWebhookEvent, {
        ...parsed,
        payloadJson: body,
      });
      return jsonResponse(result, 200);
    } catch (error) {
      return jsonResponse({ error: error instanceof Error ? error.message : "Billing event failed" }, 400);
    }
  }),
});

function jsonResponse(value: unknown, status: number) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export default http;
