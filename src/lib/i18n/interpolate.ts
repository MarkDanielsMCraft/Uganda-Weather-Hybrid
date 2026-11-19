/**
 * Safely replace template tokens like `{temp}` or `{count}` in localized strings.
 * Never throws on missing keys or non-string inputs.
 */
export function interpolate(
  template: string,
  params?: Record<string, string | number>,
): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value !== undefined ? String(value) : match;
  });
}
