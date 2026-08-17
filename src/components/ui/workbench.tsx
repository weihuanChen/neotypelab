import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="workbench-kicker">{children}</p>;
}

export function FieldHint({ children }: { children: ReactNode }) {
  return <p className="workbench-hint">{children}</p>;
}

export function StepHeader({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description?: string;
}) {
  return (
    <header className="workbench-step-head">
      <div className="workbench-step-head__title">
        <span>{step}</span>
        <h2>{title}</h2>
      </div>
      {description ? <FieldHint>{description}</FieldHint> : null}
    </header>
  );
}

export function TowerField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="tower-field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function ChoiceRow({
  active,
  title,
  description,
  meta,
  onClick,
}: {
  active?: boolean;
  title: string;
  description?: string;
  meta?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      className={active ? "choice-row is-active" : "choice-row"}
      onClick={onClick}
      type="button"
    >
      <p className="choice-row__title">{title}</p>
      {description ? <p className="choice-row__copy">{description}</p> : null}
      {meta ? <div className="choice-row__meta">{meta}</div> : null}
    </button>
  );
}

type ChoiceChipProps = {
  active?: boolean;
  children: ReactNode;
  compact?: boolean;
  disabled?: boolean;
  href?: string;
  loading?: boolean;
  onClick?: () => void;
  title?: string;
};

export function ChoiceChip({
  active,
  children,
  compact,
  disabled,
  href,
  loading,
  onClick,
  title,
}: ChoiceChipProps) {
  const className = cn(
    "choice-chip",
    compact && "is-compact",
    active && "is-active",
    disabled && "is-disabled",
    loading && "is-loading"
  );

  if (href) {
    return (
      <a aria-current={active ? "true" : undefined} className={className} href={href} title={title}>
        {children}
      </a>
    );
  }

  return (
    <button
      aria-pressed={active}
      className={className}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

type GhostButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  href?: string;
  loading?: boolean;
  compact?: boolean;
};

export function GhostButton({
  children,
  className,
  compact,
  disabled,
  href,
  loading,
  ...props
}: GhostButtonProps) {
  const classes = cn(
    "ghost-button",
    compact && "is-compact",
    loading && "is-loading",
    className
  );

  if (href) {
    const external = href.startsWith("http");
    return (
      <a
        className={classes}
        href={href}
        rel={external ? "noreferrer" : undefined}
        target={external ? "_blank" : undefined}
      >
        {children}
      </a>
    );
  }

  return (
    <button className={classes} disabled={disabled || loading} type="button" {...props}>
      {children}
    </button>
  );
}

export function MetaRow({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: ReactNode;
}) {
  return (
    <div className="meta-row">
      <span className="meta-row__label">{label}</span>
      <span className={mono ? "meta-row__value is-mono" : "meta-row__value"}>{value}</span>
    </div>
  );
}

export type StatusTone = "neutral" | "info" | "success" | "accent" | "danger";

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <span className={cn("status-pill", tone !== "neutral" && `is-${tone}`)}>{label}</span>;
}

export function FocusPanel({ children }: { children: ReactNode }) {
  return <section className="workbench-focus">{children}</section>;
}

export function WorkbenchNotice({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "danger";
}) {
  return (
    <div className={tone === "default" ? "workbench-notice" : `workbench-notice is-${tone}`}>
      {children}
    </div>
  );
}

export function mapStatusTone(status?: string): StatusTone {
  if (status === "queued" || status === "running" || status === "draft") {
    return "info";
  }
  if (status === "succeeded" || status === "generated") {
    return "success";
  }
  if (status === "archived") {
    return "accent";
  }
  if (status === "failed") {
    return "danger";
  }
  return "neutral";
}
