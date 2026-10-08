import type { MediaType } from "../types";

export interface ParsedEntry {
  mediaId: number;
  title: string;
  /** Set only when the file has a type/media_type column with a valid value. */
  type?: MediaType;
  posterPath?: string | null;
  voteAverage?: number;
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

function parseMediaType(raw: string | undefined): MediaType | undefined {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "movie" || v === "tv" ? v : undefined;
}

function parsePositiveInt(raw: string | undefined): number | null {
  const n = parseInt((raw ?? "").trim(), 10);
  return Number.isNaN(n) || n <= 0 ? null : n;
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
    const row: ParsedEntry = { mediaId, title: (cols[titleCol] ?? "").trim() };
    const type = typeCol === -1 ? undefined : parseMediaType(cols[typeCol]);
    if (type) row.type = type;
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
      title: (cols[titleCol] ?? "").trim(),
      type: parseMediaType(optional(cols, "type")) ?? "movie",
      voteAverage: parseFloat(optional(cols, "vote_average") ?? "0") || 0,
      posterPath: optional(cols, "poster_path") ?? null,
    };
    const addedAt = optional(cols, "added_at");
    if (addedAt) row.addedAt = addedAt;
    const watchedAt = optional(cols, "watched_at");
    if (watchedAt) row.watchedAt = watchedAt;
    const watchedTz = optional(cols, "watched_tz");
    if (watchedTz) row.watchedTz = watchedTz;
    const runtime = optional(cols, "runtime_minutes");
    if (runtime !== undefined) {
      const n = parseInt(runtime, 10);
      row.runtimeMinutes = Number.isNaN(n) ? null : n;
    }
    const platform = optional(cols, "platform");
    if (platform !== undefined) row.platform = platform;
    const rating = optional(cols, "user_rating");
    if (rating !== undefined) {
      const n = parseFloat(rating);
      if (!Number.isNaN(n)) row.userRating = n;
    }
    // Reviews keep their whitespace and line breaks; only the column lookup is trimmed.
    const reviewCol = col("review");
    if (reviewCol !== -1) row.review = cols[reviewCol] ?? "";
    const ratedAt = optional(cols, "rated_at");
    if (ratedAt) row.ratedAt = ratedAt;
    rows.push(row);
  }
  return rows;
}
