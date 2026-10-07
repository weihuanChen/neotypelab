import { cn } from "@/lib/utils";

/**
 * NeotypeLab mark: a graphite "N" whose stems carry one panel-line gap each
 * (Gunpla part separation), closed by a navy baseline chip that reads as the
 * full stop in "N." and as a paint swatch. Ink follows `currentColor`; the
 * chip is the site's single signal colour. Concepts: docs/logo-concepts.html.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn("brand-mark", className)}
      focusable="false"
      viewBox="0 0 32 32"
    >
      <path
        d="M3 6h5v13H3zM3 20.5h5V26H3zM8 6h4.2L19 20v6h-4.2L8 12zM19 6h5v8.5h-5zM19 16h5v10h-5z"
        fill="currentColor"
      />
      <rect
        className="brand-mark__chip"
        height="3.5"
        width="3.5"
        x="25.5"
        y="22.5"
      />
    </svg>
  );
}
