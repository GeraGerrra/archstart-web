import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import test from "node:test";
import { externalAssetRedirects, normalizeAssetBaseUrl } from "../../src/assets/asset-hosting.ts";
import { PASSWORD_POLICY_COPY_RU } from "../../src/auth/password-policy.ts";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

function files(directory: string): string[] {
  const output: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory() && !["node_modules", ".next"].includes(entry.name)) output.push(...files(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

test("external assets use one direct browser redirect with an unchanged public suffix", () => {
  assert.equal(normalizeAssetBaseUrl("https://assets.example.test/base/"), "https://assets.example.test/base");
  assert.deepEqual(externalAssetRedirects("https://assets.example.test/base/"), [{
    source: "/prototype-assets/:assetPath*",
    destination: "https://assets.example.test/base/prototype-assets/:assetPath*",
    permanent: false,
  }]);
  assert.deepEqual(externalAssetRedirects(""), []);
  assert.throws(() => normalizeAssetBaseUrl("ftp://assets.example.test"));
  assert.throws(() => normalizeAssetBaseUrl("https://assets.example.test/?token=forbidden"));
});

test("next/image preserves direct prototype asset URLs globally", () => {
  const nextConfig = read("next.config.ts");
  assert.match(nextConfig, /images:\s*\{\s*unoptimized:\s*true,?\s*\}/u);
  assert.match(nextConfig, /import \{ productionRouteRedirects \} from "\.\/src\/routing\/production-routes\.ts";/u);
  assert.match(nextConfig, /import \{ externalAssetRedirects \} from "\.\/src\/assets\/asset-hosting\.ts";/u);
  assert.match(nextConfig, /async redirects\(\)\s*\{[\s\S]*productionRouteRedirects\(\)[\s\S]*externalAssetRedirects\(\)[\s\S]*\}/u);
  assert.ok(nextConfig.indexOf("productionRouteRedirects()") < nextConfig.indexOf("externalAssetRedirects()"));
  assert.doesNotMatch(nextConfig, /loader\s*:/u);
  assert.doesNotMatch(nextConfig, /remotePatterns\s*:/u);
});

test("committed environment file contains placeholders only", () => {
  assert.equal(read(".env.example"), "NEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\nNEXT_PUBLIC_SITE_URL=\nNEXT_PUBLIC_ASSET_BASE_URL=\n");
});

test("approved update-password policy copy is imported instead of duplicated", () => {
  const page = read("app/auth/update-password/page.tsx");
  assert.match(page, /import \{ PASSWORD_POLICY_COPY_RU \}/u);
  assert.match(page, /description=\{PASSWORD_POLICY_COPY_RU\}/u);
  assert.doesNotMatch(page, /восьми символов/u);
  assert.equal(PASSWORD_POLICY_COPY_RU, "Не менее 12 символов: строчная и заглавная буквы, цифра и специальный символ.");
});

test("external asset inventory covers every accepted public byte and direct source reference", () => {
  const manifest = JSON.parse(read("deployment/asset-manifest.v1.json")) as {
    reconciliation: { duplicatePathCount: number; missingPathCount: number; unlistedPathCount: number };
    assets: Array<{ acceptedPublicPath: string; sizeBytes: number; sha256: string; pack: string }>;
  };
  assert.deepEqual(manifest.reconciliation, { duplicatePathCount: 0, missingPathCount: 0, unlistedPathCount: 0 });
  assert.equal(manifest.assets.length, 1562);
  assert.equal(manifest.assets.reduce((sum, asset) => sum + asset.sizeBytes, 0), 1012572350);
  assert.equal(new Set(manifest.assets.map((asset) => asset.acceptedPublicPath)).size, manifest.assets.length);
  assert.equal(new Set(manifest.assets.map((asset) => asset.sha256)).size > 0, true);
  assert.deepEqual(new Set(manifest.assets.map((asset) => asset.pack)), new Set([
    "ARCHSTART_ASSETS_CORE_V1", "ARCHSTART_ASSETS_M01_V1", "ARCHSTART_ASSETS_M02_V1",
    "ARCHSTART_ASSETS_M03_V1", "ARCHSTART_ASSETS_M04_V1", "ARCHSTART_ASSETS_M05_V1",
    "ARCHSTART_ASSETS_M06_V1", "ARCHSTART_ASSETS_M07_V1", "ARCHSTART_ASSETS_M08_V1",
  ]));

  const inventory = new Set(manifest.assets.map((asset) => `/${asset.acceptedPublicPath}`));
  const sourceRoots = ["app", "src", "content", "generated"];
  const direct = new Set<string>();
  for (const sourceRoot of sourceRoots) {
    for (const path of files(join(root, sourceRoot))) {
      if (!/\.(?:css|json|md|mjs|ts|tsx)$/u.test(path)) continue;
      for (const match of readFileSync(path, "utf8").matchAll(/\/prototype-assets\/[A-Za-z0-9._/-]+/gu)) {
        if (/\.(?:pdf|png|txt)$/u.test(match[0])) direct.add(match[0]);
      }
    }
  }
  for (const assetPath of direct) assert.equal(inventory.has(assetPath), true, assetPath);
});

test("clean project excludes heavyweight and local-only state", () => {
  const forbidden = [".git", ".next", "node_modules", "delivery", "docs"];
  const projectFiles = files(root).map((path) => relative(root, path).split("\\").join("/"));
  for (const path of projectFiles) {
    assert.equal(forbidden.some((name) => path === name || path.startsWith(`${name}/`)), false, path);
    assert.doesNotMatch(path, /(?:browser-profile|screenshots?|\.env$|\.zip$)/iu);
    assert.ok(statSync(join(root, path)).size < 50_000_000, path);
  }
});
