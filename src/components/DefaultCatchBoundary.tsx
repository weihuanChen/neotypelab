"use client";

import type { ErrorComponentProps } from "@tanstack/react-router";
import { SystemState, SystemStateLink, systemStates } from "@/src/components/system-state";

export function DefaultCatchBoundary({ error, reset }: ErrorComponentProps) {
  return (
    <SystemState
      {...systemStates.serverError}
      details={error instanceof Error ? error.message : String(error)}
      layout="page"
      primary={
        <button className="system-state__button" onClick={reset} type="button">
          Try again
        </button>
      }
      secondary={<SystemStateLink to="/">Return home ←</SystemStateLink>}
    />
  );
}
