export function formatDateDMY(dateStr: string): string {
  const [yyyy, mm, dd] = (dateStr.split("T")[0] ?? "").split("-");
  if (yyyy && mm && dd) return `${dd}-${mm}-${yyyy}`;
  const date = new Date(dateStr);
  return `${String(date.getDate()).padStart(2, "0")}-${String(date.getMonth() + 1).padStart(2, "0")}-${date.getFullYear()}`;
}

/** This device's IANA time zone (sent to the API as X-Timezone), or "" if unavailable. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  } catch {
    return "";
  }
}

/** `yyyy-mm-dd` for the device's local day, never the UTC day `toISOString()` gives. */
export function localISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Fixed locale: dates are formatted the same everywhere (see formatDateDMY).
function partsIn(date: Date, timeZone: string | undefined, extra: Intl.DateTimeFormatOptions = {}) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", ...extra,
  }).formatToParts(date);
  return (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
}

/** A usable zone name, or undefined (= the device's own zone). */
function zoneOrDevice(tz?: string | null): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

/** `dd-mm-yyyy` of an instant in `tz` (blank/invalid → the device's zone). */
export function formatDateInTz(iso: string, tz?: string | null): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return formatDateDMY(iso);
  const get = partsIn(date, zoneOrDevice(tz));
  return `${get("day")}-${get("month")}-${get("year")}`;
}

/** Minutes east of UTC that `tz` (undefined = device) is at `date`. */
function offsetMinutes(date: Date, tz: string | undefined): number {
  const get = partsIn(date, tz, { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const asUTC = Date.UTC(+get("year"), +get("month") - 1, +get("day"), +get("hour"), +get("minute"), +get("second"));
  return Math.round((asUTC - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Short label (e.g. "EDT", "GMT+5:30") for the zone a watch was logged in, but
 * only when its offset at that instant differs from this device's — aliases
 * and same-offset zones read as the same day, so they get no label.
 */
export function tzLabelIfDifferent(iso: string, tz?: string | null): string {
  const zone = zoneOrDevice(tz);
  const date = new Date(iso);
  if (!zone || Number.isNaN(date.getTime())) return "";
  if (offsetMinutes(date, zone) === offsetMinutes(date, undefined)) return "";
  return partsIn(date, zone, { timeZoneName: "short" })("timeZoneName");
}

/** A watch's day in the zone it was logged in, plus " · <zone>" when that differs from this device's. */
export function formatWatchedDate(iso: string, tz?: string | null): string {
  const label = tzLabelIfDifferent(iso, tz);
  return label ? `${formatDateInTz(iso, tz)} · ${label}` : formatDateInTz(iso, tz);
}
