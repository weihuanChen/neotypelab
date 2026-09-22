import type { AppPath } from "@/src/lib/appPaths";
import { appPaths } from "@/src/lib/appPaths";

export type LegalDocumentId = "terms" | "privacy";

export type LegalDocument = {
  id: LegalDocumentId;
  number: string;
  title: string;
  summary: string;
  updatedLabel: string;
  href: AppPath;
};

/** Catalog for /legal. Add Cookie / Copyright / Acceptable Use here later. */
export const legalDocuments: readonly LegalDocument[] = [
  {
    id: "terms",
    number: "01",
    title: "Terms of Service",
    summary: "Rules governing use of NeotypeLab.",
    updatedLabel: "Updated Sep 22, 2026",
    href: appPaths.legalTerms,
  },
  {
    id: "privacy",
    number: "02",
    title: "Privacy Policy",
    summary: "How account and usage data are handled.",
    updatedLabel: "Updated Sep 22, 2026",
    href: appPaths.legalPrivacy,
  },
];

export function getLegalDocument(id: LegalDocumentId) {
  const document = legalDocuments.find((entry) => entry.id === id);
  if (!document) {
    throw new Error(`Unknown legal document: ${id}`);
  }
  return document;
}
