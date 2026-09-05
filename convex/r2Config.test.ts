// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  getPublicR2ObjectUrl,
  getR2ConfigurationStatus,
  getR2ConnectionConfig,
} from "./r2Config";

const configuredEnvironment = {
  R2_END_POINT: "https://account.r2.cloudflarestorage.com",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET_PUBLIC: "neotypelab-dev-showcase",
  R2_BUCKET_PRIVATE: "neotypelab-dev-library",
  R2_PUBLIC_BASE_URL: "https://assets.example.test/",
  CLOUDFLARE_CACHE_PURGE_ZONE_ID: "zone-id",
  CLOUDFLARE_CACHE_PURGE_TOKEN: "purge-token",
};

describe("R2 configuration", () => {
  it("resolves role-based buckets and public URLs", () => {
    expect(getR2ConnectionConfig(configuredEnvironment)).toMatchObject({
      buckets: {
        public: "neotypelab-dev-showcase",
        private: "neotypelab-dev-library",
      },
    });
    expect(
      getPublicR2ObjectUrl("showcase/My image.webp", configuredEnvironment)
    ).toBe("https://assets.example.test/showcase/My%20image.webp");
  });

  it("reports public delivery independently from private signed delivery", () => {
    expect(getR2ConfigurationStatus(configuredEnvironment)).toEqual({
      connectionConfigured: true,
      publicBucket: "neotypelab-dev-showcase",
      publicDeliveryConfigured: true,
      publicCachePurgeConfigured: true,
      privateBucket: "neotypelab-dev-library",
      privateDeliveryConfigured: true,
    });
    expect(
      getR2ConfigurationStatus({
        ...configuredEnvironment,
        R2_PUBLIC_BASE_URL: "",
      }).publicDeliveryConfigured
    ).toBe(false);
  });

  it("rejects the legacy single-bucket configuration", () => {
    expect(() =>
      getR2ConnectionConfig({
        R2_END_POINT: configuredEnvironment.R2_END_POINT,
        R2_ACCESS_KEY_ID: configuredEnvironment.R2_ACCESS_KEY_ID,
        R2_SECRET_ACCESS_KEY: configuredEnvironment.R2_SECRET_ACCESS_KEY,
        R2_BUCKET: "legacy",
      })
    ).toThrow("R2_BUCKET_PUBLIC is not configured");
  });
});
