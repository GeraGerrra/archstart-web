import { realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";

const SAFE_PUBLIC_ROOT_FILES = new Set([
  "content-manifest.json",
  "course-index.json",
  "m01-dataset.json",
  "route-language-map.json",
]);
const SAFE_PUBLIC_QUIZ_PATTERN = /^quizzes\/M(?:0[1-8])_L(?:0[1-5])\.json$/u;
const SAFE_REPORT_FILES = new Set([
  "alias-resolution.json",
  "ignored-files.json",
  "quiz-security-report.json",
  "sanitization-report.json",
]);

const CONTENT_TYPES = Object.freeze({
  ".csv": "text/csv; charset=utf-8",
  ".json": "application/json; charset=utf-8",
});

export class InspectorDataPolicyError extends Error {
  constructor(statusCode, message = statusCode === 403 ? "Forbidden" : "Not found") {
    super(message);
    this.name = "InspectorDataPolicyError";
    this.statusCode = statusCode;
  }
}

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    throw new InspectorDataPolicyError(404);
  }
}

function hasUnsafeSegments(value) {
  if (!value || value.includes("\0") || value.includes("\\")) return true;
  const segments = value.split("/");
  return segments.some((segment) => segment === "" || segment === "." || segment === "..");
}

function isInside(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}

async function resolveExistingFile(allowedRoot, relativeFile) {
  const lexicalRoot = resolve(allowedRoot);
  const lexicalFile = resolve(lexicalRoot, relativeFile);
  if (!isInside(lexicalRoot, lexicalFile)) throw new InspectorDataPolicyError(403);

  let canonicalRoot;
  let canonicalFile;
  try {
    [canonicalRoot, canonicalFile] = await Promise.all([realpath(lexicalRoot), realpath(lexicalFile)]);
  } catch {
    throw new InspectorDataPolicyError(404);
  }
  if (!isInside(canonicalRoot, canonicalFile)) throw new InspectorDataPolicyError(403);
  if (!(await stat(canonicalFile)).isFile()) throw new InspectorDataPolicyError(404);
  return canonicalFile;
}

/**
 * Maps a development-inspector request to one explicitly client-safe file.
 * The policy is default-deny. generated/server is not an allowed root and
 * cannot be reached through aliases, traversal, encoded separators, or symlinks.
 */
export async function resolveInspectorDataRequest(pathname, repositoryRoot) {
  const decoded = decodePathname(pathname);
  if (!decoded.startsWith("/data/")) throw new InspectorDataPolicyError(404);
  const requestPath = decoded.slice("/data/".length);
  if (hasUnsafeSegments(requestPath)) throw new InspectorDataPolicyError(404);

  if (requestPath === "server" || requestPath.startsWith("server/")) {
    throw new InspectorDataPolicyError(403);
  }

  let allowedRoot;
  let relativeFile;
  if (requestPath.startsWith("public/")) {
    allowedRoot = resolve(repositoryRoot, "generated/public");
    relativeFile = requestPath.slice("public/".length);
    if (hasUnsafeSegments(relativeFile)) throw new InspectorDataPolicyError(404);
    const explicitlyAllowed = SAFE_PUBLIC_ROOT_FILES.has(relativeFile) || SAFE_PUBLIC_QUIZ_PATTERN.test(relativeFile);
    if (!explicitlyAllowed) throw new InspectorDataPolicyError(404);
  } else if (requestPath.startsWith("reports/")) {
    allowedRoot = resolve(repositoryRoot, "generated/reports");
    relativeFile = requestPath.slice("reports/".length);
    if (hasUnsafeSegments(relativeFile) || !SAFE_REPORT_FILES.has(relativeFile)) {
      throw new InspectorDataPolicyError(404);
    }
  } else {
    throw new InspectorDataPolicyError(404);
  }

  const filePath = await resolveExistingFile(allowedRoot, relativeFile);
  return {
    filePath,
    contentType: CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
  };
}

export const INSPECTOR_SAFE_PUBLIC_ROOT_FILES = Object.freeze([...SAFE_PUBLIC_ROOT_FILES].sort());
export const INSPECTOR_SAFE_REPORT_FILES = Object.freeze([...SAFE_REPORT_FILES].sort());
