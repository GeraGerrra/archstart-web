export function verifyCompleteLockfile(options?: { lockfilePath?: string; packagePath?: string }): Promise<{
  schemaVersion: string;
  result: "PASS" | "FAIL";
  packageManager: string;
  directDependencyCount: number;
  packagesPopulated: boolean;
  snapshotsPopulated: boolean;
  issues: string[];
}>;
