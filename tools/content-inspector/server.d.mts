import type { Server } from "node:http";

export interface InspectorServerOptions {
  repositoryRoot?: string;
  staticRoot?: string;
  host?: string;
  port?: number;
  environment?: string;
  log?: boolean;
}

export interface RunningInspector {
  server: Server;
  url: string;
  close(): Promise<void>;
}

export const INSPECTOR_HOST: "127.0.0.1";
export const DEFAULT_INSPECTOR_PORT: number;
export function createInspectorServer(options?: InspectorServerOptions): Server;
export function startInspector(options?: InspectorServerOptions): Promise<RunningInspector>;
export function startInspectorServer(options?: InspectorServerOptions): Promise<Server>;
