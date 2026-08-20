import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PromptRunStatus } from "./promptLabTypes";
import { statusLabel } from "./promptLabUtils";

export function LabSectionLabel({
  count,
  description,
  title,
}: {
  count?: string | number;
  description?: string;
  title: string;
}) {
  return (
    <div className="prompt-lab-section-label">
      <div>
        <h3>{title}</h3>
        {description ? <p>{description}</p> : null}
      </div>
      {count !== undefined ? <span>{count}</span> : null}
    </div>
  );
}

export function LabField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="prompt-lab-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function LabEmpty({ children }: { children: ReactNode }) {
  return <div className="prompt-lab-empty">{children}</div>;
}

export function LabActionButton({
  busy,
  children,
  disabled,
  onClick,
  tone = "default",
}: {
  busy?: boolean;
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  tone?: "default" | "danger" | "quiet";
}) {
  return (
    <Button
      className={cn("prompt-lab-action", `is-${tone}`)}
      disabled={disabled || busy}
      onClick={onClick}
      type="button"
    >
      {busy ? "Processing" : children}
    </Button>
  );
}

export function RunStatusMark({ status }: { status: PromptRunStatus }) {
  return (
    <span className={cn("prompt-run-status", `is-${status}`)}>
      <i aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

export function AccessState({
  danger,
  eyebrow,
  title,
}: {
  danger?: boolean;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className={cn("prompt-lab-access", danger && "is-danger")}>
      <p>{eyebrow}</p>
      <h2>{title}</h2>
    </section>
  );
}
