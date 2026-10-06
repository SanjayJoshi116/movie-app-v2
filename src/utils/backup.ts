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

  // v2 appends runtime_minutes/platform after the v1 columns, so v1 readers still work.
  zip.file(
    "watched.csv",
    csvOrHeader(
      watched.map((i) => ({
        tmdb_id: i.id, title: i.title, type: i.type, vote_average: i.voteAverage, watched_at: i.watchedAt,
        poster_path: i.posterPath ?? "", runtime_minutes: i.runtimeMinutes ?? "", platform: i.platform ?? "",
      })),
      ["tmdb_id", "title", "type", "vote_average", "watched_at", "poster_path", "runtime_minutes", "platform"],
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
