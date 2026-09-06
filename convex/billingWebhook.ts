import { z } from "zod";

export const billingWebhookPayloadSchema = z.object({
  eventId: z.string().trim().min(1).max(160),
  provider: z.string().trim().min(1).max(80),
  eventType: z.enum([
    "subscription.started",
    "subscription.renewed",
    "subscription.updated",
    "subscription.payment_failed",
    "subscription.canceled",
    "subscription.refunded",
  ]),
  externalSubscriptionId: z.string().trim().min(1).max(180),
  userId: z.string().trim().min(1).optional(),
  planType: z.enum(["pro", "studio"]),
  periodStart: z.number().int().positive(),
  periodEnd: z.number().int().positive(),
  monthlyCredits: z.number().int().min(0).max(100_000),
  cancelAtPeriodEnd: z.boolean().default(false),
  occurredAt: z.number().int().positive(),
}).strict();

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export async function verifyBillingWebhookSignature(input: {
  body: string;
  signature: string | null;
  timestamp: string | null;
  secret: string;
  now?: number;
}) {
  if (!input.signature || !input.timestamp) return false;
  const timestampSeconds = Number(input.timestamp);
  if (!Number.isInteger(timestampSeconds)) return false;
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(input.secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${input.timestamp}.${input.body}`)
  );
  const expected = `v1=${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  return constantTimeEqual(expected, input.signature.trim().toLowerCase());
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}
