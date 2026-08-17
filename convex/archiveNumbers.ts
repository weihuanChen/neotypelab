import type { MutationCtx } from "./types";
import { internalMutation } from "./functions";

export type ArchiveSequence = "prototype" | "feedback";

export async function nextArchiveNumber(
  ctx: MutationCtx,
  key: ArchiveSequence
) {
  const counter = await ctx.db
    .query("archiveCounters")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  const value = (counter?.value ?? 0) + 1;

  if (counter) {
    await ctx.db.patch(counter._id, { value });
  } else {
    await ctx.db.insert("archiveCounters", { key, value });
  }

  return value;
}

export const backfillArchiveNumbers = internalMutation({
  args: {},
  async handler(ctx) {
    const concepts = (await ctx.db.query("concepts").collect()).sort(
      (a, b) => a._creationTime - b._creationTime
    );
    const reports = (await ctx.db.query("feedbackReports").collect()).sort(
      (a, b) => a._creationTime - b._creationTime
    );

    const prototypeMax = await backfillRecords(ctx, concepts, "prototype");
    const feedbackMax = await backfillRecords(ctx, reports, "feedback");

    return {
      concepts: concepts.length,
      feedbackReports: reports.length,
      prototypeMax,
      feedbackMax,
    };
  },
});

async function backfillRecords(
  ctx: MutationCtx,
  records: Array<{ _id: any; recordNumber?: number }>,
  key: ArchiveSequence
) {
  let value = records.reduce(
    (max, record) => Math.max(max, record.recordNumber ?? 0),
    0
  );
  for (const record of records) {
    if (record.recordNumber === undefined) {
      value += 1;
      await ctx.db.patch(record._id, { recordNumber: value });
    }
  }

  const counter = await ctx.db
    .query("archiveCounters")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (counter) {
    if (counter.value < value) await ctx.db.patch(counter._id, { value });
  } else {
    await ctx.db.insert("archiveCounters", { key, value });
  }
  return value;
}
