import { CustomCtx } from "convex-helpers/server/customFunctions";
import { mutation, query } from "./functions";

export type QueryCtx = CustomCtx<typeof query>;
export type MutationCtx = CustomCtx<typeof mutation>;
