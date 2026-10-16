import type { MediaType } from "../types";

export interface ParsedEntry {
  mediaId: number;
  title: string;
  /** Set only when the file has a type/media_type column with a valid value. */
  type?: MediaType;
  posterPath?: string | null;
  voteAverage?: number;
  /** From a `watched_at` column (the Watched page's export), when readable and not in the future. */
  watchedAt?: string;
  /** From a `watched_tz` column; the server stores an unknown zone as blank. */
  watchedTz?: string;
  /** From a `runtime_minutes` column (Watched export): a non-negative whole number. */
  runtimeMinutes?: number;
  /** From a `platform` column (Watched export), trimmed. */
  platform?: string;
}

/** One row of a CINE DB backup CSV (watchlist, watched, ratings or a list). */
export interface BackupRow {
  mediaId: number;
  title: string;
  type: MediaType;
  voteAverage: number;
  posterPath: string | null;
  addedAt?: string;
  watchedAt?: string;
  watchedTz?: string;
  runtimeMinutes?: number | null;
  platform?: string | null;
  userRating?: number;
  review?: string;
  ratedAt?: string;
}

const DELIMITERS = [",", ";", "\t"] as const;

/**
 * Undo export.ts's formula neutralization: one leading `'` before a formula
 * character (or before another `'`) is removed. Files exported before it
 * existed never have that pair (barring a title that literally starts `'=`),
 * so a real leading apostrophe like `'Salem's Lot` is kept.
 */
const NEUTRALIZED = /^'[=+\-@\t\r']/;

function unneutralize(field: string): string {
  return NEUTRALIZED.test(field) ? field.slice(1) : field;
}

/** Most frequent of `,` `;` tab in the header line, counted outside quotes. */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && ch in counts) counts[ch]! += 1;
  }
  return DELIMITERS.reduce((best, d) => (counts[d]! > counts[best]! ? d : best), ",");
}

/**
 * RFC 4180 parser: quoted fields with "" escapes, delimiters and line breaks
 * inside quotes, CRLF or LF, a leading UTF-8 BOM, and `,` / `;` / tab
 * delimiters (detected from the header). Blank lines are skipped. Fields are
 * returned with export.ts's formula-neutralizing `'` removed, and
 * untrimmed; callers trim what should be trimmed.
 */
export function parseCSV(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const endRow = () => {
    row.push(unneutralize(field));
    if (row.some((f) => f.trim() !== "")) rows.push(row);
    row = [];
    field = "";
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(unneutralize(field));
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      endRow();
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) endRow();
  return rows;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Rows keyed by normalized header name, with each value trimmed; blank cells
 *  are left out. For simple backup files that aren't title rows. */
export function parseCSVRecords(text: string): Record<string, string>[] {
  const [header, ...lines] = parseCSV(text);
  if (!header) return [];
  const headers = header.map(normalizeHeader);
  return lines.map((cols) => {
    const record: Record<string, string> = {};
    headers.forEach((h, i) => {
      const v = (cols[i] ?? "").trim();
      if (v !== "") record[h] = v;
    });
    return record;
  });
}

function parseMediaType(raw: string | undefined): MediaType | undefined {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "movie" || v === "tv" ? v : undefined;
}

function parsePositiveInt(raw: string | undefined): number | null {
  const n = parseInt((raw ?? "").trim(), 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
}

// The bulk endpoints' bounds (backend/userdata/serializers.py, Bulk*EntrySerializer).
// A value outside them would fail the whole batch, so each parser below drops
// it (or, for a title, shortens it) for that row only.
const MAX_RUNTIME = 2_147_483_647;
const MAX_PLATFORM_LENGTH = 100;
const MAX_POSTER_PATH_LENGTH = 500;
const MAX_TITLE_LENGTH = 500;
const MAX_TZ_LENGTH = 64;
const MAX_REVIEW_LENGTH = 5000;

// The server's max_length counts code points, so an emoji is one character;
// JS `.length` counts UTF-16 units (an emoji is two). Every bound below goes
// through these, and a cut never leaves half an emoji, which the database
// refuses (failing the whole chunk).
function charLength(s: string): number {
  return Array.from(s).length;
}

function cutChars(s: string, max: number): string {
  const chars = Array.from(s);
  return chars.length <= max ? s : chars.slice(0, max).join("");
}

/** A title the server accepts: trimmed, cut to its first 500 characters. */
function parseTitle(raw: string | undefined): string {
  return cutChars((raw ?? "").trim(), MAX_TITLE_LENGTH);
}

/** A runtime in minutes: a whole number from 0 up, else undefined. */
function parseRuntime(raw: string | undefined): number | undefined {
  const s = (raw ?? "").trim();
  return /^\d+$/.test(s) && Number(s) <= MAX_RUNTIME ? Number(s) : undefined;
}

/** Trimmed text, undefined when blank or longer than `max`. */
function parseBoundedText(raw: string | undefined, max: number): string | undefined {
  const s = (raw ?? "").trim();
  return s && charLength(s) <= max ? s : undefined;
}

/** A personal rating: 0.5–10 on a half step, else undefined. */
function parseUserRating(raw: string | undefined): number | undefined {
  const s = (raw ?? "").trim();
  const n = s === "" ? NaN : Number(s);
  return Number.isFinite(n) && n >= 0.5 && n <= 10 && Number.isInteger(n * 2) ? n : undefined;
}

/** A TMDB poster path the server accepts, else undefined (that row only). */
function parsePosterPath(raw: string | undefined): string | undefined {
  const poster = (raw ?? "").trim();
  return poster.startsWith("/") && charLength(poster) <= MAX_POSTER_PATH_LENGTH ? poster : undefined;
}

/** A TMDB score (0–10), else undefined; `Number("")` would read 0. */
function parseScore(raw: string | undefined): number | undefined {
  const s = (raw ?? "").trim();
  const n = s === "" ? NaN : Number(s);
  return Number.isFinite(n) && n >= 0 && n <= 10 ? n : undefined;
}

/** The bulk endpoints reject timestamps before 1900 (serializers.py). */
const EARLIEST_WATCHED = Date.UTC(1900, 0, 1);
/** How far past this device's clock a time may be: the server's own leeway
 *  (BULK_TIMESTAMP_SKEW), so a backup from a clock slightly ahead keeps its times. */
const FUTURE_LEEWAY_MS = 5 * 60_000;

// What the bulk endpoints accept (DRF: ISO 8601 only). Date.parse reads far
// more ("05/01/2024", "May 1, 2024"), and one such row failed its whole chunk.
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:?\d{2})$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A CSV watched time the server will accept, or undefined (the row then gets
 * the import time). An ISO date-time needs an offset or Z; a date alone is
 * kept as noon UTC, which falls on that calendar day from UTC-12 to UTC+11
 * (midnight UTC showed as the day before in every western zone).
 */
export function normalizeWatchedAt(raw: string): string | undefined {
  const value = raw.trim();
  const iso = ISO_DATE_TIME.test(value) ? value : ISO_DATE.test(value) ? `${value}T12:00:00Z` : undefined;
  if (!iso) return undefined;
  const when = Date.parse(iso);
  return when >= EARLIEST_WATCHED && when <= Date.now() + FUTURE_LEEWAY_MS ? iso : undefined;
}

export function parseCSVForImport(text: string): { rows: ParsedEntry[]; error: string | null } {
  const [header, ...lines] = parseCSV(text);
  if (!header || lines.length === 0) {
    return { rows: [], error: "CSV must have a header row and at least one data row." };
  }

  const headers = header.map(normalizeHeader);
  const idCol = headers.findIndex(
    (h) => h === "id" || h === "movie_id" || h === "tmdb_id" || h === "tv_id" || h === "show_id",
  );
  const titleCol = headers.findIndex(
    (h) => h === "title" || h === "name" || h === "original_title" || h === "movie_name",
  );
  const typeCol = headers.findIndex((h) => h === "type" || h === "media_type");
  const watchedAtCol = headers.indexOf("watched_at");
  const watchedTzCol = headers.indexOf("watched_tz");
  const runtimeCol = headers.indexOf("runtime_minutes");
  const platformCol = headers.indexOf("platform");
  const posterCol = headers.indexOf("poster_path");
  const voteCol = headers.indexOf("vote_average");

  if (idCol === -1) {
    return {
      rows: [],
      error: 'Could not find an ID column (expected "id", "movie_id", "tmdb_id", "tv_id", or "show_id").',
    };
  }
  if (titleCol === -1) {
    return {
      rows: [],
      error: 'Could not find a title column (expected "title", "name", "original_title", or "movie_name").',
    };
  }

  const rows: ParsedEntry[] = [];
  for (const cols of lines) {
    const mediaId = parsePositiveInt(cols[idCol]);
    if (mediaId === null) continue;
    const row: ParsedEntry = { mediaId, title: parseTitle(cols[titleCol]) };
    const type = typeCol === -1 ? undefined : parseMediaType(cols[typeCol]);
    if (type) row.type = type;
    // A bad, non-ISO, future or pre-1900 time is dropped for this row only
    // (the server would reject the whole batch for it); the row then gets the
    // import time.
    const watchedAt = watchedAtCol === -1 ? undefined : normalizeWatchedAt(cols[watchedAtCol] ?? "");
    if (watchedAt) row.watchedAt = watchedAt;
    // Like the time, a bad value is dropped for this row only, never sent:
    // one out-of-range value would fail the whole batch.
    const watchedTz = watchedTzCol === -1 ? undefined : parseBoundedText(cols[watchedTzCol], MAX_TZ_LENGTH);
    if (watchedTz) row.watchedTz = watchedTz;
    const runtime = runtimeCol === -1 ? undefined : parseRuntime(cols[runtimeCol]);
    if (runtime !== undefined) row.runtimeMinutes = runtime;
    const platform = platformCol === -1 ? undefined : parseBoundedText(cols[platformCol], MAX_PLATFORM_LENGTH);
    if (platform) row.platform = platform;
    const poster = posterCol === -1 ? undefined : parsePosterPath(cols[posterCol]);
    if (poster) row.posterPath = poster;
    // The export's score: with a poster too, the row needs no TMDB lookup.
    const vote = voteCol === -1 ? undefined : parseScore(cols[voteCol]);
    if (vote !== undefined) row.voteAverage = vote;
    rows.push(row);
  }

  if (rows.length === 0) {
    return { rows: [], error: "No valid entries found. Each row needs a numeric TMDB ID." };
  }
  return { rows, error: null };
}

/**
 * Parse a backup CSV. Reads both the v1 layout (tmdb_id,title,type,
 * vote_average,added_at|watched_at,poster_path) and v2's extra columns;
 * any column that's absent just leaves its field unset.
 */
export function parseBackupCSV(text: string): BackupRow[] {
  const [header, ...lines] = parseCSV(text);
  if (!header) return [];
  const headers = header.map(normalizeHeader);
  const col = (name: string) => headers.indexOf(name);
  const idCol = col("tmdb_id");
  const titleCol = col("title");
  if (idCol === -1 || titleCol === -1) return [];

  const optional = (cols: string[], name: string): string | undefined => {
    const i = col(name);
    if (i === -1) return undefined;
    const v = (cols[i] ?? "").trim();
    return v === "" ? undefined : v;
  };

  const rows: BackupRow[] = [];
  for (const cols of lines) {
    const mediaId = parsePositiveInt(cols[idCol]);
    if (mediaId === null) continue;
    const row: BackupRow = {
      mediaId,
      title: parseTitle(cols[titleCol]),
      type: parseMediaType(optional(cols, "type")) ?? "movie",
      // A value the server would reject is dropped for this row only (it
      // would fail the whole chunk); a dropped poster is looked up. The
      // score is taken as given: blank or bad is 0, never looked up.
      voteAverage: parseScore(optional(cols, "vote_average")) ?? 0,
      posterPath: parsePosterPath(optional(cols, "poster_path")) ?? null,
    };
    // A dropped time leaves the row to get the restore time.
    const addedAt = normalizeWatchedAt(optional(cols, "added_at") ?? "");
    if (addedAt) row.addedAt = addedAt;
    const watchedAt = normalizeWatchedAt(optional(cols, "watched_at") ?? "");
    if (watchedAt) row.watchedAt = watchedAt;
    const watchedTz = parseBoundedText(optional(cols, "watched_tz"), MAX_TZ_LENGTH);
    if (watchedTz) row.watchedTz = watchedTz;
    const runtime = parseRuntime(optional(cols, "runtime_minutes"));
    if (runtime !== undefined) row.runtimeMinutes = runtime;
    const platform = parseBoundedText(optional(cols, "platform"), MAX_PLATFORM_LENGTH);
    if (platform) row.platform = platform;
    // A rating row without a valid rating isn't restored (the import skips it).
    const rating = parseUserRating(optional(cols, "user_rating"));
    if (rating !== undefined) row.userRating = rating;
    // Reviews keep their whitespace and line breaks; only the column lookup is
    // trimmed. One too long for the server is dropped, not cut mid-sentence.
    const reviewCol = col("review");
    const review = reviewCol === -1 ? undefined : cols[reviewCol] ?? "";
    if (review !== undefined && charLength(review) <= MAX_REVIEW_LENGTH) row.review = review;
    const ratedAt = normalizeWatchedAt(optional(cols, "rated_at") ?? "");
    if (ratedAt) row.ratedAt = ratedAt;
    rows.push(row);
  }
  return rows;
}
