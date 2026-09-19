import type { JobWaitProfile } from "./jobWaitTypes";

export const jobWaitProfiles = {
  customStyle: {
    id: "custom-style",
    identity: "Custom Style / Forming",
    verb: "Forming",
    subject: "Your style",
    summary: "Turning your direction into a reusable visual system.",
    stages: {
      input: "Direction",
      process: "Forming",
      output: "Style",
    },
    messages: [
      {
        index: "01",
        title: "Reusable",
        body: "Styles keep a visual direction consistent across future builds.",
      },
      {
        index: "02",
        title: "Flexible",
        body: "A Style defines direction without locking every generation to the same result.",
      },
      {
        index: "03",
        title: "Available",
        body: "Finished Styles stay available for future projects in Create.",
      },
    ],
    exit: "You can leave this page. Return here to review the style when it is ready.",
    hangAfterMs: 45_000,
    hang: "Still forming. You can leave and come back to review it.",
    interruptedVerb: "Interrupted",
    interruptedSummary: "The direction could not be formed. Credits for a failed request are returned.",
  },
} as const satisfies Record<string, JobWaitProfile>;

export type JobWaitProfileId = keyof typeof jobWaitProfiles;
