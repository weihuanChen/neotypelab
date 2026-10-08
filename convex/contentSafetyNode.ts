"use node";

import { createHash } from "node:crypto";
import { ScanSemanticMode as WaffoSemanticMode, WaffoPancake, WaffoPancakeError } from "@waffo/pancake-ts";
import { internalAction, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  chunkPromptForScan,
  combineScanVerdicts,
  contentSafetyRejectionMessage,
  degradedVerdict,
  detectScanLocale,
  resolveContentSafetyMode,
  resolveSemanticMode,
  type ScanVerdict,
} from "./contentSafetyPolicy";
import { BASE_BLOCKLIST, findBlocklistMatches, type BlocklistTerm } from "./contentBlocklistPolicy";

export type ContentSafetyReference = {
  table: "promptCompositions" | "generationJobs";
  id: string;
};

type ScreenPromptArgs = {
  prompt: string;
  subject: "text" | "image";
  /** Template kind or render mode, for the audit log. */
  stage: string;
  reference?: ContentSafetyReference;
};

const SCAN_TIMEOUT_MS = 15_000;
const semanticModes = {
  off: WaffoSemanticMode.Off,
  shadow: WaffoSemanticMode.Shadow,
  enforce: WaffoSemanticMode.Enforce,
} as const;
const MAX_SCAN_ATTEMPTS = 3;

let cachedClient: { key: string; client: WaffoPancake } | null = null;

function waffoClient(): WaffoPancake | null {
  const merchantId = process.env.WAFFO_MERCHANT_ID?.trim();
  const privateKey = process.env.WAFFO_PRIVATE_KEY?.trim();
  if (!merchantId || !privateKey) return null;
  const key = `${merchantId}:${privateKey.length}`;
  if (cachedClient?.key !== key) {
    // API-key requests derive test/prod from the key itself, as in waffoConnectivity.
    cachedClient = { key, client: new WaffoPancake({ merchantId, privateKey }) };
  }
  return cachedClient.client;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("Content safety scan timed out")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * One chunk, with Waffo's retry guidance: retry degraded verdicts, 429 and 5xx
 * with backoff; never retry other 4xx. Anything unresolved fails closed.
 */
async function scanChunk(client: WaffoPancake, prompt: string): Promise<ScanVerdict> {
  const semantic = resolveSemanticMode(process.env.CONTENT_SAFETY_SEMANTIC);
  let last: ScanVerdict = degradedVerdict();
  for (let attempt = 0; attempt < MAX_SCAN_ATTEMPTS; attempt += 1) {
    if (attempt > 0) await sleep(attempt === 1 ? 2_000 : 5_000);
    try {
      const verdict = await withTimeout(
        client.contentSafety.scanPrompt({
          prompt,
          locale: detectScanLocale(prompt),
          ...(semantic ? { semantic: semanticModes[semantic] } : {}),
        }),
        SCAN_TIMEOUT_MS
      );
      last = {
        action: verdict.action,
        reasonCode: verdict.reasonCode,
        matchedCategories: [...verdict.matchedCategories],
        requestId: verdict.requestId,
        semanticStatus: verdict.semanticStatus,
      };
      if (last.reasonCode !== "service_degraded") return last;
    } catch (error) {
      if (error instanceof WaffoPancakeError && error.status !== 429 && error.status < 500) {
        console.error(`Content safety scan rejected with HTTP ${error.status}`, error.errors);
        return degradedVerdict("scan_request_rejected");
      }
      console.warn("Content safety scan attempt failed", error instanceof Error ? error.message : error);
      last = degradedVerdict();
    }
  }
  return last;
}

/**
 * Screen the exact prompt text that is about to be sent to an AI provider.
 * In enforce mode this throws unless every chunk is allowed; the caller's
 * existing failure path then fails the job and applies its refund policy.
 */
export async function screenPromptBeforeGeneration(
  ctx: ActionCtx,
  { prompt, subject, stage, reference }: ScreenPromptArgs
): Promise<void> {
  const mode = resolveContentSafetyMode(process.env.CONTENT_SAFETY_MODE);
  if (mode === "off") return;

  const chunks = chunkPromptForScan(prompt);
  if (chunks.length === 0) return;

  // Layer 1: the maintained keyword/phrase blocklist (no network call).
  let terms: BlocklistTerm[];
  try {
    terms = await ctx.runQuery(internal.contentBlocklist.activeTerms, {});
  } catch (error) {
    console.error("Content safety: blocklist unavailable, using base list", error);
    terms = [...BASE_BLOCKLIST];
  }
  const blocklistHits = findBlocklistMatches(prompt, terms);
  const verdicts: ScanVerdict[] = [];
  if (blocklistHits.length > 0) {
    verdicts.push({
      action: "block",
      reasonCode: "blocklist_match",
      matchedCategories: [...new Set(blocklistHits.map((hit) => hit.category))],
      requestId: "",
    });
  }

  // Layer 2: Waffo Prompt Sift. Skipped when enforcement already blocks on the
  // blocklist; in monitor mode both layers run so their results can be compared.
  const client = waffoClient();
  if (!client) console.error("Content safety: WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY are not configured");
  const skipRemoteScan = mode === "enforce" && blocklistHits.length > 0;
  for (const chunk of skipRemoteScan ? [] : chunks) {
    const verdict = client ? await scanChunk(client, chunk) : degradedVerdict("not_configured");
    verdicts.push(verdict);
    if (verdict.action === "block") break;
  }
  const combined = combineScanVerdicts(verdicts);
  const blocked = mode === "enforce" && combined.action !== "allow";

  try {
    await ctx.runMutation(internal.contentSafety.recordScan, {
      subject,
      stage,
      mode,
      blocked,
      action: combined.action,
      reasonCode: combined.reasonCode,
      matchedCategories: combined.matchedCategories,
      requestIds: combined.requestIds,
      semanticStatus: combined.semanticStatus,
      promptSha256: createHash("sha256").update(prompt).digest("hex"),
      promptLength: prompt.length,
      chunkCount: chunks.length,
      blocklistTerms: blocklistHits.length > 0 ? blocklistHits.map((hit) => hit.term) : undefined,
      referenceTable: reference?.table,
      referenceId: reference?.id,
    });
  } catch (error) {
    // The verdict, not the audit write, decides whether generation proceeds.
    console.error("Content safety: failed to record scan", error);
  }

  if (blocked) throw new Error(contentSafetyRejectionMessage(combined));
}

/**
 * Pre-deploy check against the target deployment's Waffo credentials:
 * `npx convex run contentSafetyNode:selfTest` (add `--prod` for production).
 * Expects `allow` for the benign sample; reports the active mode either way.
 */
export const selfTest = internalAction({
  args: {},
  handler: async () => {
    const mode = resolveContentSafetyMode(process.env.CONTENT_SAFETY_MODE);
    const client = waffoClient();
    if (!client) return { ok: false as const, mode, problem: "WAFFO_MERCHANT_ID / WAFFO_PRIVATE_KEY are not configured" };
    const verdict = await scanChunk(client, "A crimson and gold repaint concept for a mecha model kit, studio lighting");
    return { ok: verdict.action === "allow", mode, verdict };
  },
});
