import { readFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

interface ZipEntryLocation {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localOffset: number;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const signature = 0x06054b50;
  const minimum = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimum; offset -= 1) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }
  throw new Error("Unsupported or corrupt ZIP: end-of-central-directory record not found.");
}

export class ZipArchive {
  readonly #buffer: Buffer;
  readonly #entries: Map<string, ZipEntryLocation>;

  private constructor(buffer: Buffer) {
    this.#buffer = buffer;
    this.#entries = this.#parseDirectory();
  }

  static async open(path: string): Promise<ZipArchive> {
    return new ZipArchive(await readFile(path));
  }

  names(): string[] {
    return [...this.#entries.keys()].sort((a, b) => a.localeCompare(b, "en"));
  }

  has(name: string): boolean {
    return this.#entries.has(name);
  }

  read(name: string): Buffer {
    const entry = this.#entries.get(name);
    if (!entry) throw new Error(`ZIP entry not found: ${name}`);
    const offset = entry.localOffset;
    if (this.#buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error(`Corrupt ZIP local header: ${name}`);
    const fileNameLength = this.#buffer.readUInt16LE(offset + 26);
    const extraLength = this.#buffer.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + fileNameLength + extraLength;
    const compressed = this.#buffer.subarray(dataStart, dataStart + entry.compressedSize);
    let data: Buffer;
    if (entry.method === 0) data = Buffer.from(compressed);
    else if (entry.method === 8) data = inflateRawSync(compressed);
    else throw new Error(`Unsupported ZIP compression method ${entry.method} for ${name}`);
    if (data.length !== entry.uncompressedSize) throw new Error(`ZIP size mismatch for ${name}`);
    return data;
  }

  text(name: string): string {
    return this.read(name).toString("utf8");
  }

  #parseDirectory(): Map<string, ZipEntryLocation> {
    const eocd = findEndOfCentralDirectory(this.#buffer);
    const diskNumber = this.#buffer.readUInt16LE(eocd + 4);
    const centralDisk = this.#buffer.readUInt16LE(eocd + 6);
    if (diskNumber !== 0 || centralDisk !== 0) throw new Error("Multi-disk ZIP archives are unsupported.");
    const count = this.#buffer.readUInt16LE(eocd + 10);
    const centralOffset = this.#buffer.readUInt32LE(eocd + 16);
    const entries = new Map<string, ZipEntryLocation>();
    let cursor = centralOffset;
    for (let index = 0; index < count; index += 1) {
      if (this.#buffer.readUInt32LE(cursor) !== 0x02014b50) throw new Error(`Corrupt ZIP central directory at entry ${index}.`);
      const method = this.#buffer.readUInt16LE(cursor + 10);
      const compressedSize = this.#buffer.readUInt32LE(cursor + 20);
      const uncompressedSize = this.#buffer.readUInt32LE(cursor + 24);
      const nameLength = this.#buffer.readUInt16LE(cursor + 28);
      const extraLength = this.#buffer.readUInt16LE(cursor + 30);
      const commentLength = this.#buffer.readUInt16LE(cursor + 32);
      const localOffset = this.#buffer.readUInt32LE(cursor + 42);
      const name = this.#buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8").replace(/\\/g, "/");
      if (name.startsWith("/") || name.split("/").includes("..")) throw new Error(`Unsafe ZIP path: ${name}`);
      entries.set(name, { name, method, compressedSize, uncompressedSize, localOffset });
      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
  }
}
