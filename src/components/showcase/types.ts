import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";

export type ShowcaseConcepts = FunctionReturnType<
  typeof api.showcase.listPublicConcepts
>;
export type ShowcaseConcept = ShowcaseConcepts[number];

export type ShowcaseCreatorPacks = FunctionReturnType<
  typeof api.showcase.listPublicCreatorPacks
>;
export type ShowcaseCreatorPack = ShowcaseCreatorPacks[number];

export type RankedPublicCreators = FunctionReturnType<
  typeof api.showcase.listRankedPublicCreators
>;
export type RankedPublicCreator = RankedPublicCreators[number];

export type ShowcaseSort =
  | "trending"
  | "recent"
  | "most-remixed"
  | "most-saved";

export type ShowcaseSearch = {
  sort?: ShowcaseSort;
  view?: "trending";
  baseModel?: string;
  style?: string;
  material?: string;
  weathering?: string;
  category?: string;
  creator?: string;
  q?: string;
};

export type ShowcaseData = {
  concepts: ShowcaseConcepts;
  creatorPacks: ShowcaseCreatorPacks;
  rankedCreators: RankedPublicCreators;
};

export type ShowcaseSnapshot =
  | ({
      status: "ok";
      generatedAt: string;
    } & ShowcaseData)
  | ({
      status: "missing-env" | "error";
      message: string;
    } & ShowcaseData);

export type MetaRowValue = ReactNode;
