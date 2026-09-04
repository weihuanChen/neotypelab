"use client";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction } from "convex/react";
import { useEffect, useState } from "react";

const REFRESH_MARGIN_MS = 60_000;
const MIN_REFRESH_DELAY_MS = 30_000;

export function usePrivateAssetUrl(
  storageObjectId?: Id<"storageObjects"> | null
) {
  const createPrivateDownloadUrl = useAction(api.assetNode.createPrivateDownloadUrl);
  const [signedAsset, setSignedAsset] = useState<{
    storageObjectId: Id<"storageObjects">;
    url: string;
  } | null>(null);

  useEffect(() => {
    if (!storageObjectId) {
      setSignedAsset(null);
      return;
    }
    let cancelled = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;

    const refresh = async () => {
      try {
        const result = await createPrivateDownloadUrl({ storageObjectId });
        if (cancelled) return;
        setSignedAsset({ storageObjectId, url: result.url });
        refreshTimer = setTimeout(
          () => void refresh(),
          Math.max(MIN_REFRESH_DELAY_MS, result.expiresAt - Date.now() - REFRESH_MARGIN_MS)
        );
      } catch {
        if (!cancelled) setSignedAsset(null);
      }
    };

    void refresh();
    return () => {
      cancelled = true;
      if (refreshTimer) clearTimeout(refreshTimer);
    };
  }, [createPrivateDownloadUrl, storageObjectId]);

  return signedAsset && signedAsset.storageObjectId === storageObjectId
    ? signedAsset.url
    : null;
}
