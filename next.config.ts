import type { NextConfig } from "next";
import { externalAssetRedirects } from "./src/assets/asset-hosting.ts";
import { productionRouteRedirects } from "./src/routing/production-routes.ts";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ["@napi-rs/canvas", "pdfjs-dist"],
  async redirects() {
    return [
      ...productionRouteRedirects(),
      ...externalAssetRedirects(),
    ];
  },
  outputFileTracingIncludes: {
    "/*": [
      "./generated/public/quizzes/**/*.json",
      "./generated/server/quiz-answer-keys.json",
    ],
    "/course/*/project": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
    "/review": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
    "/prototype/a/course/*/project": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    ],
    "/prototype/a/review": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
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
