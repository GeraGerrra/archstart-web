export const EXTERNAL_PUBLIC_ASSET_PREFIX = "/prototype-assets";

export function normalizeAssetBaseUrl(rawValue = process.env.NEXT_PUBLIC_ASSET_BASE_URL): string | null {
  const value = rawValue?.trim();
  if (!value) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_ASSET_BASE_URL must use http or https.");
  }
  if (url.search || url.hash) {
    throw new Error("NEXT_PUBLIC_ASSET_BASE_URL must not include a query or fragment.");
  }
  return url.toString().replace(/\/$/u, "");
}

export function externalAssetRedirects(rawValue = process.env.NEXT_PUBLIC_ASSET_BASE_URL) {
  const assetBaseUrl = normalizeAssetBaseUrl(rawValue);
  if (!assetBaseUrl) return [];
  return [{
    source: `${EXTERNAL_PUBLIC_ASSET_PREFIX}/:assetPath*`,
    destination: `${assetBaseUrl}${EXTERNAL_PUBLIC_ASSET_PREFIX}/:assetPath*`,
    permanent: false,
  }];
}
