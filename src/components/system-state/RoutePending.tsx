import { AppShell } from "@/src/components/app-shell/AppShell";
import { SystemState } from "./SystemState";
import type { SystemStateDefinition } from "./systemStateTypes";

export function RoutePending({
  description,
  state,
  title,
}: {
  description: string;
  state: SystemStateDefinition;
  title: string;
}) {
  return (
    <AppShell description={description} title={title}>
      <SystemState {...state} />
    </AppShell>
  );
}
