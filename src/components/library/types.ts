import type { FunctionReturnType } from "convex/server";
import { api } from "@/convex/_generated/api";

export type LibraryConcepts = FunctionReturnType<
  typeof api.concepts.listLibrary
>;
export type LibraryConcept = LibraryConcepts[number];

export type SavedPublicConcepts = FunctionReturnType<
  typeof api.concepts.listSavedPublicConcepts
>;
export type SavedPublicConcept = SavedPublicConcepts[number];

export type ViewerJobs = FunctionReturnType<typeof api.generation.listViewerJobs>;
export type ViewerJob = ViewerJobs[number];

export type ConceptVisibility = "private" | "public" | "unlisted";
