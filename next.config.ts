import type { NextConfig } from "next";
import { externalAssetRedirects } from "./src/assets/asset-hosting.ts";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  async redirects() {
    return externalAssetRedirects();
  },
  outputFileTracingExcludes: {
    "/*": [
      "./tools/content-inspector/**/*",
      "./workbench/**/*",
      "./docs/**/*",
    ],
  },
};

export default nextConfig;
