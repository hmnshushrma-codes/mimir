export function previewText(value: unknown, maxLen = 500): string {
  if (value === undefined || value === null) return "";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}
