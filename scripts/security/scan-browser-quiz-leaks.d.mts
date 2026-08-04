export interface BrowserQuizLeakScanOptions {
  staticRoot?: string;
  answerKeyPath?: string;
  reportPath?: string | null;
}
export interface BrowserQuizLeakScanReport {
  schemaVersion: string;
  result: "PASS" | "FAIL";
  staticRoot: string;
  filesScanned: number;
  serverFieldMarkersChecked: number;
  explanationFingerprintsChecked: number;
  matches: Array<{ file: string; kind: string; fingerprint: string }>;
}
export function scanBrowserQuizLeaks(options?: BrowserQuizLeakScanOptions): Promise<BrowserQuizLeakScanReport>;
