/**
 * A third-party URL (e.g. a TMDB person's community-edited homepage), or null
 * unless it's an absolute http(s) URL. Anything else — `javascript:`, `data:`,
 * a relative path — must not become a link target.
 */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null; // not absolute, or not a URL at all
  }
}
