export type R2BucketRole = "public" | "private";

type Environment = Record<string, string | undefined>;

export type R2ConnectionConfig = {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  buckets: Record<R2BucketRole, string>;
};

export function getR2ConnectionConfig(
  environment: Environment = process.env
): R2ConnectionConfig {
  return {
    endpoint: requireEnvironmentValue(environment, "R2_END_POINT"),
    accessKeyId: requireEnvironmentValue(environment, "R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnvironmentValue(environment, "R2_SECRET_ACCESS_KEY"),
    buckets: {
      public: requireEnvironmentValue(environment, "R2_BUCKET_PUBLIC"),
      private: requireEnvironmentValue(environment, "R2_BUCKET_PRIVATE"),
    },
  };
}

export function getR2ConfigurationStatus(environment: Environment = process.env) {
  const endpointConfigured = hasEnvironmentValue(environment, "R2_END_POINT");
  const credentialsConfigured =
    hasEnvironmentValue(environment, "R2_ACCESS_KEY_ID") &&
    hasEnvironmentValue(environment, "R2_SECRET_ACCESS_KEY");
  const publicBucket = normalizedEnvironmentValue(environment, "R2_BUCKET_PUBLIC");
  const privateBucket = normalizedEnvironmentValue(environment, "R2_BUCKET_PRIVATE");
  const publicBaseUrl = normalizedEnvironmentValue(environment, "R2_PUBLIC_BASE_URL");

  return {
    connectionConfigured:
      endpointConfigured && credentialsConfigured && Boolean(publicBucket && privateBucket),
    publicBucket: publicBucket ?? null,
    publicDeliveryConfigured: Boolean(publicBaseUrl),
    privateBucket: privateBucket ?? null,
    privateDeliveryConfigured:
      endpointConfigured && credentialsConfigured && Boolean(privateBucket),
  };
}

export function getPublicR2ObjectUrl(
  key: string,
  environment: Environment = process.env
) {
  const baseUrl = normalizedEnvironmentValue(environment, "R2_PUBLIC_BASE_URL");
  if (!baseUrl) {
    return undefined;
  }
  const encodedKey = key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${normalizeBaseUrl(baseUrl)}/${encodedKey}`;
}

function requireEnvironmentValue(environment: Environment, name: string) {
  const value = normalizedEnvironmentValue(environment, name);
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
}

function hasEnvironmentValue(environment: Environment, name: string) {
  return Boolean(normalizedEnvironmentValue(environment, name));
}

function normalizedEnvironmentValue(environment: Environment, name: string) {
  const value = environment[name]?.trim();
  return value || undefined;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}
