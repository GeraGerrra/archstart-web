const BINARY_KIBIBYTE = 1024;
const BINARY_MEBIBYTE = BINARY_KIBIBYTE * 1024;

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits,
  }).format(value);
}

export function formatProjectFileSize(value: number): string {
  const bytes = Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
  if (bytes < BINARY_KIBIBYTE) return `${formatNumber(bytes, 0)} Б`;
  if (bytes < BINARY_MEBIBYTE) {
    return `${formatNumber(bytes / BINARY_KIBIBYTE, 1)} KiB`;
  }
  return `${formatNumber(bytes / BINARY_MEBIBYTE, 1)} MiB`;
}
