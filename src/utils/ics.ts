import { localISODate } from "./formatDate";

/** The minimum an iCalendar export needs per release. */
export interface IcsGroup {
  date: string; // yyyy-mm-dd, the release's calendar day
  items: { id: number; type: "movie" | "tv"; title: string }[];
}

/** RFC 5545 TEXT escaping: backslash first, then `;` `,` and line breaks. */
export function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** UTF-8 length of one code point (no TextEncoder: jsdom lacks it). */
function utf8Octets(ch: string): number {
  const cp = ch.codePointAt(0)!;
  return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
}

/**
 * Folds a content line at 75 octets (RFC 5545 3.1): continuation lines start
 * with a space, which counts toward their 75. Splits only between characters,
 * never inside a UTF-8 sequence or a surrogate pair.
 */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = "";
  let octets = 0;
  for (const ch of line) {
    const size = utf8Octets(ch);
    const limit = parts.length === 0 ? 75 : 74; // continuation lines lose one to the leading space
    if (octets + size > limit) {
      parts.push(current);
      current = "";
      octets = 0;
    }
    current += ch;
    octets += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

/** `20260108T093000Z` */
function utcStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** The calendar file for `groups`, with every event stamped at `now`. */
export function buildIcs(groups: IcsGroup[], now: Date = new Date()): string {
  const stamp = utcStamp(now);
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CINE DB//Release Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];
  for (const group of groups) {
    const d = group.date.replace(/-/g, "");
    const nextDay = new Date(group.date + "T12:00:00");
    nextDay.setDate(nextDay.getDate() + 1);
    const dEnd = localISODate(nextDay).replace(/-/g, "");
    for (const item of group.items) {
      const kind = item.type === "movie" ? "Movie" : "TV Show";
      lines.push(
        "BEGIN:VEVENT",
        `UID:cinedb-${item.type}-${item.id}@cinedb`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${d}`,
        `DTEND;VALUE=DATE:${dEnd}`,
        `SUMMARY:${icsText(`${item.title} (${kind})`)}`,
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
