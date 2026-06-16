import { useState } from "react";

export type ShoppingListExportData = {
  baseModelName: string;
  bundles: {
    backup: Array<ShoppingListExportItem>;
    core: Array<ShoppingListExportItem>;
    support: Array<ShoppingListExportItem>;
  };
  conceptTitle: string;
  materialPresetName: string;
  notes: string[];
  stylePresetName: string;
};

type ShoppingListExportItem = {
  brand: string;
  code: string;
  colorName: string;
};

export function ShoppingListActions({
  className,
  data,
}: {
  className?: string;
  data: ShoppingListExportData;
}) {
  const [message, setMessage] = useState<string | null>(null);

  async function copyShoppingList() {
    try {
      await navigator.clipboard.writeText(serializeShoppingList(data));
      setMessage("Shopping list copied");
      window.setTimeout(() => setMessage(null), 1800);
    } catch {
      setMessage("Copy failed");
      window.setTimeout(() => setMessage(null), 1800);
    }
  }

  return (
    <div className={className ?? "prototype-action-row"}>
      <button
        className="showcase-button is-accent"
        type="button"
        onClick={() => {
          void copyShoppingList();
        }}
      >
        Copy Shopping List
      </button>
      {message ? <span className="prototype-action-message">{message}</span> : null}
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
    ...data.bundles.core.map(formatShoppingListItem),
    "",
    "Support Bundle:",
    ...data.bundles.support.map(formatShoppingListItem),
    "",
    "Backup Bundle:",
    ...data.bundles.backup.map(formatShoppingListItem),
    "",
    "Notes:",
    ...data.notes.map((note) => `- ${note}`),
  ].join("\n");
}

function formatShoppingListItem(item: ShoppingListExportItem) {
  return `- ${item.brand} ${item.code} / ${item.colorName}`;
}
