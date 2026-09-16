"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState } from "react";

type ShoppingListExportData = {
  conceptTitle: string;
  baseModelName: string;
  stylePresetName: string;
  materialPresetName: string;
  bundles: {
    core: Array<{ brand: string; code: string; colorName: string }>;
    support: Array<{ brand: string; code: string; colorName: string }>;
    backup: Array<{ brand: string; code: string; colorName: string }>;
  };
  notes: string[];
};

export function ShoppingListActions({
  className,
  data,
}: {
  className?: string;
  data: ShoppingListExportData;
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function onCopyShoppingList() {
    try {
      await navigator.clipboard.writeText(serializeShoppingList(data));
      setMessage("Shopping list copied");
    } catch {
      setMessage("Copy failed");
    }
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <Button
        type="button"
        onClick={() => {
          void onCopyShoppingList();
        }}
        className="showcase-button h-10 px-4 text-sm"
      >
        Copy Shopping List
      </Button>
      {message ? <span className="text-xs uppercase tracking-[0.18em] text-ink-muted">{message}</span> : null}
    </div>
  );
}

function serializeShoppingList(data: ShoppingListExportData) {
  return [
    `Concept: ${data.conceptTitle}`,
    `Base Model: ${data.baseModelName}`,
    `Style DNA: ${data.stylePresetName}`,
    `Material Profile: ${data.materialPresetName}`,
    "",
    "Core Bundle:",
    ...data.bundles.core.map((item) => `- ${item.brand} ${item.code} · ${item.colorName}`),
    "",
    "Support Bundle:",
    ...data.bundles.support.map((item) => `- ${item.brand} ${item.code} · ${item.colorName}`),
    "",
    "Backup Bundle:",
    ...data.bundles.backup.map((item) => `- ${item.brand} ${item.code} · ${item.colorName}`),
    "",
    "Notes:",
    ...data.notes.map((note) => `- ${note}`),
  ].join("\n");
}
