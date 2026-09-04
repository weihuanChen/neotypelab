// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { createPrivateR2DownloadUrl } from "./r2Storage";

describe("private R2 delivery", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs the private bucket and caps download links at one hour", async () => {
    vi.stubEnv("R2_END_POINT", "https://account.r2.cloudflarestorage.com");
    vi.stubEnv("R2_ACCESS_KEY_ID", "access-key");
    vi.stubEnv("R2_SECRET_ACCESS_KEY", "secret-key");
    vi.stubEnv("R2_BUCKET_PUBLIC", "neotypelab-dev-showcase");
    vi.stubEnv("R2_BUCKET_PRIVATE", "neotypelab-dev-library");

    const signedUrl = new URL(
      await createPrivateR2DownloadUrl({
        key: "users/user-1/My original.png",
        expiresInSeconds: 24 * 60 * 60,
      })
    );

    expect(signedUrl.hostname).toBe("account.r2.cloudflarestorage.com");
    expect(decodeURIComponent(signedUrl.pathname)).toBe(
      "/neotypelab-dev-library/users/user-1/My original.png"
    );
    expect(signedUrl.searchParams.get("X-Amz-Expires")).toBe("3600");
    expect(signedUrl.searchParams.get("X-Amz-Credential")).toContain("access-key");
    expect(signedUrl.searchParams.get("X-Amz-Signature")).toBeTruthy();
  });
});
