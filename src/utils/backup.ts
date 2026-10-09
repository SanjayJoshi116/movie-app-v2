import JSZip from "jszip";
import type { RatingEntry, UserList, WatchedEntry, WatchlistEntry } from "../types";
import { buildCSVString } from "./export";
import { parseBackupCSV, type BackupRow } from "./csvParse";

export const BACKUP_FORMAT = "cinedb-backup";
export const BACKUP_VERSION = 2;

export interface BackupManifest {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  /** Every list, empty ones included, with its original name. */
  lists: { file: string; name: string; description: string }[];
}

export interface BackupContents {
  /** 1 for a backup without a manifest. */
  version: number;
  watchlist: BackupRow[];
  watched: BackupRow[];
  ratings: BackupRow[];
  lists: { name: string; description: string; entries: BackupRow[] }[];
}

const LIST_COLUMNS = ["tmdb_id", "title", "type", "vote_average", "added_at", "poster_path"];

/** A file name for each list, unique case-insensitively (Windows/macOS unzip). */
function listFileNames(lists: UserList[]): string[] {
  const used = new Set<string>();
  return lists.map((list) => {
    const base = list.name.replace(/[/\\?%*:|"<>]/g, "_").trim() || "list";
    let name = base;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${base} (${n})`;
    used.add(name.toLowerCase());
    return `lists/${name}.csv`;
  });
}

function csvOrHeader(rows: Record<string, unknown>[], columns: string[]): string {
  return rows.length > 0 ? buildCSVString(rows) : columns.join(",");
}

export function buildBackupZip(
  watchlist: WatchlistEntry[],
  watched: WatchedEntry[],
  ratings: RatingEntry[],
  lists: UserList[],
  exportedAt = new Date().toISOString(),
): JSZip {
  const zip = new JSZip();

  zip.file(
    "watchlist.csv",
    csvOrHeader(
      watchlist.map((i) => ({ tmdb_id: i.id, title: i.title, type: i.type, vote_average: i.voteAverage, added_at: i.addedAt, poster_path: i.posterPath ?? "" })),
      LIST_COLUMNS,
    ),
  );

  // v2 appends runtime_minutes/platform after the v1 columns, so v1 readers still work;
  // watched_tz (the zone each watch was logged in) is appended last for the same reason.
  zip.file(
    "watched.csv",
    csvOrHeader(
      watched.map((i) => ({
        tmdb_id: i.id, title: i.title, type: i.type, vote_average: i.voteAverage, watched_at: i.watchedAt,
        poster_path: i.posterPath ?? "", runtime_minutes: i.runtimeMinutes ?? "", platform: i.platform ?? "",
        watched_tz: i.watchedTz ?? "",
      })),
      ["tmdb_id", "title", "type", "vote_average", "watched_at", "poster_path", "runtime_minutes", "platform", "watched_tz"],
    ),
  );

  zip.file(
    "ratings.csv",
    csvOrHeader(
      ratings.map((r) => ({ tmdb_id: r.id, title: r.title, type: r.type, user_rating: r.userRating, review: r.review, rated_at: r.ratedAt })),
      ["tmdb_id", "title", "type", "user_rating", "review", "rated_at"],
    ),
  );

  const files = listFileNames(lists);
  lists.forEach((list, idx) => {
    zip.file(
      files[idx]!,
      csvOrHeader(
        list.items.map((i) => ({ tmdb_id: i.id, title: i.title, type: i.type, vote_average: i.voteAverage, added_at: i.addedAt, poster_path: i.posterPath ?? "" })),
        LIST_COLUMNS,
      ),
    );
  });

  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    lists: lists.map((l, idx) => ({ file: files[idx]!, name: l.name, description: l.description })),
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  return zip;
}

// A real backup is a few MB at most. These caps stop a crafted ZIP (a "zip
// bomb") from being decompressed into memory and freezing the tab.
export const MAX_BACKUP_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BACKUP_ENTRY_BYTES = 50 * 1024 * 1024;
export const MAX_BACKUP_TOTAL_BYTES = 200 * 1024 * 1024;
export const BACKUP_TOO_LARGE = "This file is too large to be a CINE DB backup.";

export class BackupTooLargeError extends Error {
  constructor() {
    super(BACKUP_TOO_LARGE);
    this.name = "BackupTooLargeError";
  }
}

/**
 * An entry's uncompressed size as declared in the ZIP's central directory,
 * read without decompressing. JSZip keeps it on an internal field that its
 * types don't declare; a missing value counts as 0 (the file-size cap still holds).
 */
export function declaredUncompressedSize(entry: JSZip.JSZipObject): number {
  const size = (entry as unknown as { _data?: { uncompressedSize?: unknown } })._data?.uncompressedSize;
  return typeof size === "number" && Number.isFinite(size) && size > 0 ? size : 0;
}

/** Throws BackupTooLargeError before anything is read from an oversized file. */
export function checkBackupFileSize(bytes: number): void {
  if (bytes > MAX_BACKUP_FILE_BYTES) throw new BackupTooLargeError();
}

/** Throws BackupTooLargeError if any entry, or all of them together, would expand past the caps. */
export function checkBackupZipSize(zip: JSZip): void {
  let total = 0;
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const size = declaredUncompressedSize(entry);
    total += size;
    if (size > MAX_BACKUP_ENTRY_BYTES || total > MAX_BACKUP_TOTAL_BYTES) throw new BackupTooLargeError();
  }
}

function listCSVFiles(zip: JSZip): string[] {
  return Object.keys(zip.files).filter(
    (name) => name.startsWith("lists/") && name.endsWith(".csv") && !zip.files[name]!.dir,
  );
}

async function readCSV(zip: JSZip, path: string): Promise<BackupRow[]> {
  const file = zip.file(path);
  return file ? parseBackupCSV(await file.async("string")) : [];
}

/** Throws if the ZIP has nothing a backup would contain. */
export async function readBackupZip(zip: JSZip): Promise<BackupContents> {
  let manifest: BackupManifest | null = null;
  const manifestFile = zip.file("manifest.json");
  if (manifestFile) {
    try {
      const parsed = JSON.parse(await manifestFile.async("string"));
      if (parsed?.format === BACKUP_FORMAT && Array.isArray(parsed.lists)) manifest = parsed;
    } catch {
      // Unreadable manifest: fall back to the v1 rules below.
    }
  }

  const csvFiles = listCSVFiles(zip);
  const hasData = ["watchlist.csv", "watched.csv", "ratings.csv"].some((f) => zip.file(f)) || csvFiles.length > 0;
  if (!hasData && !manifest) {
    throw new Error("No recognizable CSV files found. Expected watchlist.csv, watched.csv, or lists/*.csv.");
  }

  const lists: BackupContents["lists"] = [];
  const seen = new Set<string>();
  for (const entry of manifest?.lists ?? []) {
    if (typeof entry?.name !== "string" || !entry.name.trim()) continue;
    seen.add(entry.file);
    lists.push({
      name: entry.name,
      description: typeof entry.description === "string" ? entry.description : "",
      entries: typeof entry.file === "string" ? await readCSV(zip, entry.file) : [],
    });
  }
  // v1 backups (and CSVs a hand-edited manifest doesn't mention): name from the file.
  for (const path of csvFiles) {
    if (seen.has(path)) continue;
    const entries = await readCSV(zip, path);
    if (entries.length === 0) continue;
    lists.push({ name: path.replace(/^lists\//, "").replace(/\.csv$/, ""), description: "", entries });
  }

  return {
    version: manifest ? Number(manifest.version) || BACKUP_VERSION : 1,
    watchlist: await readCSV(zip, "watchlist.csv"),
    watched: await readCSV(zip, "watched.csv"),
    ratings: await readCSV(zip, "ratings.csv"),
    lists,
  };
}
