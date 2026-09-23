import workflow from "@convex-dev/workflow/convex.config.js";
import creem from "@mmailaender/convex-creem/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();

app.use(workflow);
app.use(creem);

export default app;
