import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { api } from "@/convex/_generated/api";
import type { buildPilotProfileStructuredData } from "@/lib/structuredData";

export type PublicPilotProfile = NonNullable<
  FunctionReturnType<typeof api.showcase.getPublicProfile>
>;

export type PilotConceptCard = PublicPilotProfile["published"][number];
export type PilotCreatorPack = PublicPilotProfile["creatorPackCollection"][number];

export type PilotStructuredData = ReturnType<
  typeof buildPilotProfileStructuredData
>;

export type PilotMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  imageUrl?: string;
};

export type PilotSnapshot =
  | {
      status: "ok";
      profile: PublicPilotProfile;
      generatedAt: string;
      meta: PilotMeta;
      structuredData: PilotStructuredData;
    }
  | {
      status: "missing-env" | "not-found" | "error";
      profile: null;
      message: string;
      meta: PilotMeta;
      structuredData: null;
    };

export type PilotMetaRowValue = ReactNode;
