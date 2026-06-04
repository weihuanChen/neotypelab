export function getSiteUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.SITE_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
  const localUrl = `http://localhost:${process.env.PORT ?? "3000"}`;

  return new URL(configured ?? localUrl);
}

export function absoluteUrl(path: string) {
  return new URL(path, getSiteUrl()).toString();
}
