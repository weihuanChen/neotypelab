import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { buildPrototypeStructuredData } from "@/lib/structuredData";

export type SharedPrototype = NonNullable<
  FunctionReturnType<typeof api.showcase.getSharedConcept>
>;

export type PublicPrototypeFeasibility = NonNullable<
  FunctionReturnType<typeof api.feasibility.getPublicConceptFeasibility>
>;

export type PublicPrototypeRecommendations = NonNullable<
  FunctionReturnType<typeof api.recommendations.getPublicConceptRecommendations>
>;

export type PublicPrototypeShoppingList = NonNullable<
  FunctionReturnType<typeof api.shopping.getPublicConceptShoppingList>
>;

export type PrototypeStructuredData = ReturnType<
  typeof buildPrototypeStructuredData
>;

export type PrototypeMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  imageUrl?: string;
};

export type PrototypeSnapshot =
  | {
      status: "ok";
      concept: SharedPrototype;
      generatedAt: string;
      meta: PrototypeMeta;
      structuredData: PrototypeStructuredData;
    }
  | {
      status: "missing-env" | "not-found" | "error";
      concept: null;
      message: string;
      meta: PrototypeMeta;
      structuredData: null;
    };

export type PrototypeMetaRowValue = ReactNode;
