const LOCALHOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

export function assertInspectorAllowed(environment = process.env.NODE_ENV, host = "127.0.0.1") {
  if (environment === "production") {
    throw new Error("Development content inspector is disabled in production.");
  }
  if (!LOCALHOSTS.has(host)) {
    throw new Error("Inspector may bind only to localhost.");
  }
}
