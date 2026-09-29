import { useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/convex/_generated/api";

export function useWaffoReadiness() {
  const [returnOrigin, setReturnOrigin] = useState<string | null>(null);
  useEffect(() => setReturnOrigin(window.location.origin), []);
  return useQuery(api.waffoReadiness.forOrigin, returnOrigin ? { returnOrigin } : "skip");
}
