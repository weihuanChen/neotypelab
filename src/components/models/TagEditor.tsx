"use client";

import { Cross2Icon, PlusIcon } from "@radix-ui/react-icons";
import { KeyboardEvent, useState } from "react";
import { cn } from "@/lib/utils";

export function TagEditor({
  danger = false,
  label,
  onChange,
  placeholder = "Type a value and press Enter",
  values,
}: {
  danger?: boolean;
  label: string;
  onChange: (values: string[]) => void;
  placeholder?: string;
  values: string[];
}) {
  const [input, setInput] = useState("");

  const addValues = (rawValue: string) => {
    const additions = rawValue
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (additions.length === 0) return;
    onChange(Array.from(new Set([...values, ...additions])));
    setInput("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addValues(input);
    } else if (event.key === "Backspace" && input === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-ink-muted">
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-ink-muted">
          {values.length}
        </span>
      </div>
      <div
        className={cn(
          "flex min-h-[84px] flex-wrap content-start gap-2 border bg-surface p-3 transition-colors focus-within:border-ink-primary",
          danger ? "border-accent-red/45" : "border-line-secondary"
        )}
      >
        {values.map((value) => (
          <span
            className={cn(
              "inline-flex h-7 items-center gap-1.5 border px-2 font-mono text-[11px]",
              danger
                ? "border-accent-red/45 bg-accent-red/5 text-accent-red"
                : "border-line-secondary bg-main text-ink-secondary"
            )}
            key={value}
          >
            {value}
            <button
              aria-label={`Remove ${value}`}
              className="text-ink-muted transition-colors hover:text-ink-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-orange"
              onClick={() => onChange(values.filter((item) => item !== value))}
              type="button"
            >
              <Cross2Icon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex min-w-[180px] flex-1 items-center gap-2">
          <PlusIcon className="h-3.5 w-3.5 shrink-0 text-ink-muted" />
          <input
            className="h-7 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-ink-primary outline-none placeholder:text-ink-muted"
            onBlur={() => addValues(input)}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={(event) => {
              const pasted = event.clipboardData.getData("text");
              if (pasted.includes(",") || pasted.includes("\n")) {
                event.preventDefault();
                addValues(pasted);
              }
            }}
            placeholder={values.length === 0 ? placeholder : "Add another…"}
            value={input}
          />
        </div>
      </div>
    </div>
  );
}
