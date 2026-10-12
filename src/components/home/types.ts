import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";

export type HomeData = FunctionReturnType<typeof api.homeFeature.getHome>;
export type HomeHero = NonNullable<HomeData["hero"]>;
export type HomeHeroPaint = HomeHero["paints"][number];
export type HomeWork = HomeData["works"][number];

export type HomeSnapshot =
  | { status: "ok"; data: HomeData; customKit: boolean }
  | { status: "missing-env" | "error"; data: null; message: string };
