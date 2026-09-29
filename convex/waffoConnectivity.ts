"use node";

import { WaffoPancake, WaffoPancakeError } from "@waffo/pancake-ts";
import { internalAction } from "./_generated/server";

type ConnectivityResult =
  | { ok: true; storeCount: number }
  | { ok: false; phase: "config"; merchantIdPresent: boolean; privateKeyPresent: boolean }
  | { ok: false; phase: "api"; httpStatus?: number; issues?: Array<{ layer: string; message: string }> }
  | { ok: false; phase: "response" | "network-or-key"; errorName?: string };

export const check = internalAction({
  args: {},
  handler: async (): Promise<ConnectivityResult> => {
    const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
    const privateKey = process.env.WAFFO_PRIVATE_KEY?.trim();
    if (!merchantId || !privateKey) {
      return {
        ok: false,
        phase: "config",
        merchantIdPresent: Boolean(merchantId),
        privateKeyPresent: Boolean(privateKey),
      };
    }

    try {
      const client = new WaffoPancake({ merchantId, privateKey });
      const result = await client.graphql.query<{ stores: Array<{ id: string }> }>({
        query: "query { stores { id } }",
      });
      if (result.errors?.length) {
        return {
          ok: false,
          phase: "api",
          issues: result.errors.map((issue) => ({
            layer: issue.layer ?? "unknown",
            message: issue.message.replaceAll(merchantId, "[merchant]").slice(0, 160),
          })),
        };
      }
      if (!result.data || !Array.isArray(result.data.stores)) {
        return { ok: false, phase: "response" };
      }
      return { ok: true, storeCount: result.data.stores.length };
    } catch (error) {
      if (error instanceof WaffoPancakeError) {
        return {
          ok: false,
          phase: "api",
          httpStatus: error.status,
          issues: error.errors.map((issue) => ({
            layer: issue.layer,
            message: issue.message.replaceAll(merchantId, "[merchant]").slice(0, 160),
          })),
        };
      }
      return {
        ok: false,
        phase: "network-or-key",
        errorName: error instanceof Error ? error.name : "unknown",
      };
    }
  },
});
