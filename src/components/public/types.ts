import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";
import type {
  buildCreatorHubStructuredData,
  buildCreatorPackStructuredData,
  buildLandingPageStructuredData,
} from "@/lib/structuredData";

export type SeoLandingData = NonNullable<
  FunctionReturnType<typeof api.showcase.getSeoLandingPage>
>;

export type CreatorPackData = NonNullable<
  FunctionReturnType<typeof api.showcase.getCreatorPackBySlug>
>;

export type CreatorHubData = NonNullable<
  FunctionReturnType<typeof api.showcase.getPublicProfile>
>;

export type PublicRouteMeta = {
  title: string;
  description: string;
  canonicalPath: string;
  imageUrl?: string;
};

export type SeoLandingStructuredData = ReturnType<
  typeof buildLandingPageStructuredData
>;

export type CreatorPackStructuredData = ReturnType<
  typeof buildCreatorPackStructuredData
>;

export type CreatorHubStructuredData = ReturnType<
  typeof buildCreatorHubStructuredData
>;

export type SeoLandingSnapshot =
  | {
      status: "ok";
      landing: SeoLandingData;
      generatedAt: string;
      meta: PublicRouteMeta;
      structuredData: SeoLandingStructuredData;
    }
  | {
      status: "missing-env" | "not-found" | "error";
      landing: null;
      message: string;
      meta: PublicRouteMeta;
      structuredData: null;
    };

export type CreatorPackSnapshot =
  | {
      status: "ok";
      pack: CreatorPackData;
      generatedAt: string;
      meta: PublicRouteMeta;
      structuredData: CreatorPackStructuredData;
    }
  | {
      status: "missing-env" | "not-found" | "error";
      pack: null;
      message: string;
      meta: PublicRouteMeta;
      structuredData: null;
    };

export type CreatorHubSnapshot =
  | {
      status: "ok";
      profile: CreatorHubData;
      generatedAt: string;
      meta: PublicRouteMeta;
      structuredData: CreatorHubStructuredData;
    }
  | {
      status: "missing-env" | "not-found" | "error";
      profile: null;
      message: string;
      meta: PublicRouteMeta;
      structuredData: null;
    };
