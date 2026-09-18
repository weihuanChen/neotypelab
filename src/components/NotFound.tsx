import { SystemState, SystemStateLink, systemStates } from "@/src/components/system-state";

export function NotFound() {
  return (
    <SystemState
      {...systemStates.notFound}
      layout="page"
      primary={<SystemStateLink to="/">Return home ←</SystemStateLink>}
      secondary={<SystemStateLink to="/showcase">Explore public cases ↗</SystemStateLink>}
    />
  );
}
