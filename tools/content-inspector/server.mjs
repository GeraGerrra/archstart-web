import { createServer } from "node:http";
import { readFile, realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { InspectorDataPolicyError, resolveInspectorDataRequest } from "./data-policy.mjs";
import { assertInspectorAllowed } from "./guard.mjs";

export const INSPECTOR_HOST = "127.0.0.1";
export const DEFAULT_INSPECTOR_PORT = 4177;

const MIME_TYPES = Object.freeze({
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
});

const SECURITY_HEADERS = Object.freeze({
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "permissions-policy": "camera=(), microphone=(), geolocation=()",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
});

function isInside(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (
    pathFromRoot !== ".." &&
    !pathFromRoot.startsWith(`..${sep}`) &&
    !isAbsolute(pathFromRoot)
  );
}

function decodePathname(requestUrl) {
  let pathname;
  try {
    pathname = new URL(requestUrl ?? "/", `http://${INSPECTOR_HOST}`).pathname;
    pathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (pathname.includes("\0") || pathname.includes("\\")) return null;
  if (pathname.split("/").some((segment) => segment === "." || segment === "..")) return null;
  return pathname;
}

async function resolveStaticRequest(pathname, staticRoot) {
  const relativeFile = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (!relativeFile || relativeFile.includes("\0") || relativeFile.includes("\\")) return null;
  if (relativeFile.split("/").some((segment) => segment === "" || segment === "." || segment === "..")) return null;

  const lexicalRoot = resolve(staticRoot);
  const lexicalFile = resolve(lexicalRoot, relativeFile);
  if (!isInside(lexicalRoot, lexicalFile)) return null;

  try {
    const [canonicalRoot, canonicalFile] = await Promise.all([realpath(lexicalRoot), realpath(lexicalFile)]);
    if (!isInside(canonicalRoot, canonicalFile)) return null;
    if (!(await stat(canonicalFile)).isFile()) return null;
    return canonicalFile;
  } catch {
    return null;
  }
}

function writeResponse(response, statusCode, body = "", contentType = "text/plain; charset=utf-8", method = "GET") {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  response.writeHead(statusCode, {
    ...SECURITY_HEADERS,
    "content-type": contentType,
    "content-length": String(payload.byteLength),
  });
  if (method === "HEAD") response.end();
  else response.end(payload);
}

export function createInspectorServer({
  repositoryRoot = resolve(fileURLToPath(new URL("../../", import.meta.url))),
  staticRoot = resolve(fileURLToPath(new URL("./static", import.meta.url))),
  environment = process.env.NODE_ENV,
  host = INSPECTOR_HOST,
} = {}) {
  assertInspectorAllowed(environment, host);
  const normalizedRepositoryRoot = resolve(repositoryRoot);
  const normalizedStaticRoot = resolve(staticRoot);

  return createServer(async (request, response) => {
    const method = request.method ?? "GET";
    if (method !== "GET" && method !== "HEAD") {
      writeResponse(response, 405, "Method not allowed", "text/plain; charset=utf-8", method);
      return;
    }

    const pathname = decodePathname(request.url);
    if (pathname === null) {
      writeResponse(response, 404, "Not found", "text/plain; charset=utf-8", method);
      return;
    }

    if (pathname.startsWith("/data/")) {
      try {
        const resolution = await resolveInspectorDataRequest(pathname, normalizedRepositoryRoot);
        const body = await readFile(resolution.filePath);
        writeResponse(response, 200, body, resolution.contentType, method);
      } catch (error) {
        const statusCode = error instanceof InspectorDataPolicyError ? error.statusCode : 404;
        writeResponse(response, statusCode, statusCode === 403 ? "Forbidden" : "Not found", "text/plain; charset=utf-8", method);
      }
      return;
    }

    const filePath = await resolveStaticRequest(pathname, normalizedStaticRoot);
    if (!filePath) {
      writeResponse(response, 404, "Not found", "text/plain; charset=utf-8", method);
      return;
    }

    try {
      const body = await readFile(filePath);
      writeResponse(response, 200, body, MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream", method);
    } catch {
      writeResponse(response, 404, "Not found", "text/plain; charset=utf-8", method);
    }
  });
}

export async function startInspector({
  repositoryRoot,
  staticRoot,
  environment = process.env.NODE_ENV,
  host = INSPECTOR_HOST,
  port = Number(process.env.ARCHSTART_INSPECTOR_PORT ?? DEFAULT_INSPECTOR_PORT),
  log = true,
} = {}) {
  const server = createInspectorServer({ repositoryRoot, staticRoot, environment, host });
  await new Promise((resolveListen, rejectListen) => {
    const onError = (error) => {
      server.off("listening", onListening);
      rejectListen(error);
    };
    const onListening = () => {
      server.off("error", onError);
      resolveListen();
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, host);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Inspector failed to bind to a TCP port.");
  }
  const url = `http://${host}:${address.port}`;
  if (log) console.log(`ARCH.START inspector: ${url}`);
  return {
    server,
    url,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close((error) => error ? rejectClose(error) : resolveClose());
    }),
  };
}

/** Backward-compatible name for development scripts. */
export async function startInspectorServer(options = {}) {
  const inspector = await startInspector(options);
  return inspector.server;
}

const isDirectExecution = process.argv[1]
  ? pathToFileURL(resolve(process.argv[1])).href === import.meta.url
  : false;

if (isDirectExecution) {
  startInspector().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
