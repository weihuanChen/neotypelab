import * as React from "react";
import { cn } from "@/lib/utils";

export interface CommandButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  commandLabel?: string;
}

const CommandButton = React.forwardRef<HTMLButtonElement, CommandButtonProps>(
  ({ className, commandLabel = "COMMAND", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "relative flex h-12 flex-col items-start justify-center border-2 border-accent-orange bg-transparent px-4 text-accent-orange transition-colors hover:bg-accent-orange/10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-orange disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] leading-none opacity-80">
          {commandLabel}
        </span>
        <span className="mt-1 text-sm font-bold uppercase tracking-wider leading-none">
          {children}
        </span>
      </button>
    );
  }
);
CommandButton.displayName = "CommandButton";

export { CommandButton };
