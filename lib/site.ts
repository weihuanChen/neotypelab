export function getSiteUrl(request?: Request) {
  const configured = firstConfiguredValue(
    import.meta.env.VITE_SITE_URL,
    process.env.SITE_URL,
    process.env.CF_PAGES_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
  );
  const requestOrigin = request ? new URL(request.url).origin : undefined;
  const localUrl = `http://localhost:${process.env.PORT ?? "3000"}`;

  return new URL(normalizeSiteUrl(configured ?? requestOrigin ?? localUrl));
}

export function absoluteUrl(path: string) {
  return new URL(path, getSiteUrl()).toString();
}

function normalizeSiteUrl(value: string) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function firstConfiguredValue(...values: Array<string | undefined>) {
  return values.find((value) => value && value.trim().length > 0);
}
