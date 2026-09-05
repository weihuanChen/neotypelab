import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "expire retained storage objects",
  { minutes: 15 },
  internal.storageLifecycleNode.runExpirationSweep
);

crons.daily(
  "audit private storage orphans",
  { hourUTC: 3, minuteUTC: 20 },
  internal.storageLifecycleNode.auditPrivateStorageOrphans
);

export default crons;
