export class InspectorDataPolicyError extends Error {
  readonly statusCode: number;
  constructor(statusCode: number, message?: string);
}

export interface InspectorDataResolution {
  filePath: string;
  contentType: string;
}

export function resolveInspectorDataRequest(
  pathname: string,
  repositoryRoot: string,
): Promise<InspectorDataResolution>;

export const INSPECTOR_SAFE_PUBLIC_ROOT_FILES: readonly string[];
export const INSPECTOR_SAFE_REPORT_FILES: readonly string[];
