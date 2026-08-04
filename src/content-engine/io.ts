import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";

export function normalizeNewlines(value: string): string {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export async function readUtf8(path: string): Promise<string> {
  const text = await readFile(path, "utf8");
  return normalizeNewlines(text.replace(/^\uFEFF/, ""));
}

export async function sha256File(path: string): Promise<string> {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export function sha1Text(value: string): string {
  return createHash("sha1").update(value).digest("hex");
}

export function toPosixRelative(root: string, path: string): string {
  const rel = relative(resolve(root), resolve(path));
  if (!rel || rel.startsWith("..") || rel.includes(`${sep}..${sep}`)) {
    throw new Error(`Source path escapes immutable root: ${path}`);
  }
  return rel.split(sep).join("/");
}

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function writeJson(path: string, value: unknown): Promise<void> {
  await ensureDir(dirname(path));
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function csvEscape(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function writeCsv(path: string, rows: Array<Record<string, unknown>>, fieldnames?: string[]): Promise<void> {
  const fields = fieldnames ?? [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const lines = [fields.map(csvEscape).join(",")];
  for (const row of rows) lines.push(fields.map((field) => csvEscape(row[field])).join(","));
  await ensureDir(dirname(path));
  await writeFile(path, `${lines.join("\n")}\n`, "utf8");
}

export async function fileSize(path: string): Promise<number> {
  return (await stat(path)).size;
}

export async function atomicReplaceDirectory(tempDir: string, targetDir: string): Promise<void> {
  const backup = `${targetDir}.backup-${process.pid}-${Date.now()}`;
  let targetMoved = false;
  try {
    try {
      await rename(targetDir, backup);
      targetMoved = true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await rename(tempDir, targetDir);
    if (targetMoved) await rm(backup, { recursive: true, force: true });
  } catch (error) {
    await rm(targetDir, { recursive: true, force: true });
    if (targetMoved) await rename(backup, targetDir);
    throw error;
  }
}
