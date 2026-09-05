/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as adminAccess from "../adminAccess.js";
import type * as adminUsers from "../adminUsers.js";
import type * as archiveNumbers from "../archiveNumbers.js";
import type * as assetModel from "../assetModel.js";
import type * as assetNode from "../assetNode.js";
import type * as assets from "../assets.js";
import type * as baseModelHierarchy from "../baseModelHierarchy.js";
import type * as catalog from "../catalog.js";
import type * as catalogHierarchy from "../catalogHierarchy.js";
import type * as catalogMigrations from "../catalogMigrations.js";
import type * as concepts from "../concepts.js";
import type * as creditCampaigns from "../creditCampaigns.js";
import type * as credits from "../credits.js";
import type * as crons from "../crons.js";
import type * as domain from "../domain.js";
import type * as engagement from "../engagement.js";
import type * as entitlementPolicy from "../entitlementPolicy.js";
import type * as entitlements from "../entitlements.js";
import type * as feasibility from "../feasibility.js";
import type * as feedback from "../feedback.js";
import type * as functions from "../functions.js";
import type * as generation from "../generation.js";
import type * as generationNode from "../generationNode.js";
import type * as imageRenditions from "../imageRenditions.js";
import type * as init from "../init.js";
import type * as modelCatalogAdmin from "../modelCatalogAdmin.js";
import type * as modelCatalogStatus from "../modelCatalogStatus.js";
import type * as modelPromptContext from "../modelPromptContext.js";
import type * as orders from "../orders.js";
import type * as packEngagement from "../packEngagement.js";
import type * as paintBench from "../paintBench.js";
import type * as paintMappingEngine from "../paintMappingEngine.js";
import type * as paintMappingPlans from "../paintMappingPlans.js";
import type * as pipelineSettings from "../pipelineSettings.js";
import type * as promptCompiler from "../promptCompiler.js";
import type * as promptEngine from "../promptEngine.js";
import type * as promptTemplateVariables from "../promptTemplateVariables.js";
import type * as prototypeTools from "../prototypeTools.js";
import type * as prototypes from "../prototypes.js";
import type * as publicationNode from "../publicationNode.js";
import type * as publications from "../publications.js";
import type * as r2Config from "../r2Config.js";
import type * as r2Storage from "../r2Storage.js";
import type * as recommendationFeedback from "../recommendationFeedback.js";
import type * as recommendations from "../recommendations.js";
import type * as renderHistory from "../renderHistory.js";
import type * as renderSpecification from "../renderSpecification.js";
import type * as shopping from "../shopping.js";
import type * as showcase from "../showcase.js";
import type * as specAdmin from "../specAdmin.js";
import type * as sprayPlans from "../sprayPlans.js";
import type * as storageAccounting from "../storageAccounting.js";
import type * as storageLifecycle from "../storageLifecycle.js";
import type * as storageLifecycleNode from "../storageLifecycleNode.js";
import type * as types from "../types.js";
import type * as users from "../users.js";
import type * as utils from "../utils.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  adminAccess: typeof adminAccess;
  adminUsers: typeof adminUsers;
  archiveNumbers: typeof archiveNumbers;
  assetModel: typeof assetModel;
  assetNode: typeof assetNode;
  assets: typeof assets;
  baseModelHierarchy: typeof baseModelHierarchy;
  catalog: typeof catalog;
  catalogHierarchy: typeof catalogHierarchy;
  catalogMigrations: typeof catalogMigrations;
  concepts: typeof concepts;
  creditCampaigns: typeof creditCampaigns;
  credits: typeof credits;
  crons: typeof crons;
  domain: typeof domain;
  engagement: typeof engagement;
  entitlementPolicy: typeof entitlementPolicy;
  entitlements: typeof entitlements;
  feasibility: typeof feasibility;
  feedback: typeof feedback;
  functions: typeof functions;
  generation: typeof generation;
  generationNode: typeof generationNode;
  imageRenditions: typeof imageRenditions;
  init: typeof init;
  modelCatalogAdmin: typeof modelCatalogAdmin;
  modelCatalogStatus: typeof modelCatalogStatus;
  modelPromptContext: typeof modelPromptContext;
  orders: typeof orders;
  packEngagement: typeof packEngagement;
  paintBench: typeof paintBench;
  paintMappingEngine: typeof paintMappingEngine;
  paintMappingPlans: typeof paintMappingPlans;
  pipelineSettings: typeof pipelineSettings;
  promptCompiler: typeof promptCompiler;
  promptEngine: typeof promptEngine;
  promptTemplateVariables: typeof promptTemplateVariables;
  prototypeTools: typeof prototypeTools;
  prototypes: typeof prototypes;
  publicationNode: typeof publicationNode;
  publications: typeof publications;
  r2Config: typeof r2Config;
  r2Storage: typeof r2Storage;
  recommendationFeedback: typeof recommendationFeedback;
  recommendations: typeof recommendations;
  renderHistory: typeof renderHistory;
  renderSpecification: typeof renderSpecification;
  shopping: typeof shopping;
  showcase: typeof showcase;
  specAdmin: typeof specAdmin;
  sprayPlans: typeof sprayPlans;
  storageAccounting: typeof storageAccounting;
  storageLifecycle: typeof storageLifecycle;
  storageLifecycleNode: typeof storageLifecycleNode;
  types: typeof types;
  users: typeof users;
  utils: typeof utils;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
