
export type AssetCategory =
  | "repository text content"
  | "optimized web image"
  | "large public download"
  | "private generated certificate"
  | "external YouTube media"
  | "internal ignored evidence";

export type StorageAsset = Readonly<{
  id: string;
  category: AssetCategory;
  canonicalFileName: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
}>;

export interface StorageProvider {
  readonly providerId: string;
  put(asset: StorageAsset, source: AsyncIterable<Uint8Array>): Promise<void>;
  getPublicUrl(assetId: string): Promise<URL | null>;
  delete(assetId: string): Promise<void>;
}

export class LocalWorkbenchStorageProvider implements StorageProvider {
  readonly providerId = "local-workbench-development-only";
  async put(): Promise<void> { throw new Error("Workbench provider is a non-production contract stub; wire an explicit local root before use."); }
  async getPublicUrl(): Promise<URL | null> { return null; }
  async delete(): Promise<void> { throw new Error("Workbench provider is not production storage."); }
}
