import { ConvexClientProvider } from "@/app/ConvexClientProvider";
import { ReactNode } from "react";

export default function ShowcaseLayout({ children }: { children: ReactNode }) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
