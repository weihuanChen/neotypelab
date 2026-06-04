import { ConvexClientProvider } from "@/app/ConvexClientProvider";
import { ReactNode } from "react";

export default function PilotLayout({ children }: { children: ReactNode }) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
