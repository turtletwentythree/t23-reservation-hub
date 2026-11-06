/** Replaces {{variable}} placeholders. Unknown variables render as empty strings. */
export function renderTemplate(template: string, vars: Record<string, string | number | null | undefined>): string {
  return template
    .replace(/\\n/g, "\n")
    .replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, key: string) => {
      const v = vars[key];
      return v === null || v === undefined ? "" : String(v);
    });
}

export function retryDelayMinutes(attempt: number) {
  // 1st retry after 5 min, then 30 min, then 2 h
  return [5, 30, 120][Math.min(attempt - 1, 2)] ?? 120;
}
