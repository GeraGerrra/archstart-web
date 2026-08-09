import type { NextConfig } from "next";
import { externalAssetRedirects } from "./src/assets/asset-hosting.ts";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  async redirects() {
    return externalAssetRedirects();
  },
  outputFileTracingIncludes: {
    "/*": [
      "./generated/public/quizzes/**/*.json",
      "./generated/server/quiz-answer-keys.json",
      "./node_modules/@napi-rs/canvas/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**/*",
      "./node_modules/@napi-rs/canvas-linux-x64-musl/**/*",
      "./node_modules/pdfjs-dist/**/*",
    ],
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
