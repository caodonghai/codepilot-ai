export function splitList(value?: string): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((item) => item.trim()).filter(Boolean)));
}

export function kebabName(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function quoteShellArg(value: string) {
  if (/^[A-Za-z0-9_./:@\\-]+$/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

export function timestampForFile(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}
