import JSZip from "jszip";
import type { WatchlistEntry, WatchedEntry, UserList } from "../types";

function escape(v: unknown): string {
  const s = String(v ?? "");
  return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildCSVString(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
}

export function downloadCSV(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return;
  triggerDownload(buildCSVString(rows), filename, "text/csv");
}

export async function downloadAllAsZip(
  watchlist: WatchlistEntry[],
  watchedList: WatchedEntry[],
  lists: UserList[],
): Promise<void> {
  const zip = new JSZip();

  zip.file(
    "watchlist.csv",
    buildCSVString(
      watchlist.map((i) => ({ tmdb_id: i.id, title: i.title, type: i.type, vote_average: i.voteAverage, added_at: i.addedAt }))
    ),
  );

  zip.file(
    "watched.csv",
    buildCSVString(
      watchedList.map((i) => ({ tmdb_id: i.id, title: i.title, type: i.type, vote_average: i.voteAverage, watched_at: i.watchedAt }))
    ),
  );

  const listsFolder = zip.folder("lists")!;
  for (const list of lists) {
    if (list.items.length === 0) continue;
    const safeName = list.name.replace(/[/\\?%*:|"<>]/g, "_");
    listsFolder.file(
      `${safeName}.csv`,
      buildCSVString(
        list.items.map((i) => ({ tmdb_id: i.id, title: i.title, type: i.type, vote_average: i.voteAverage, added_at: i.addedAt }))
      ),
    );
  }

  const blob = await zip.generateAsync({ type: "blob" });
  const date = new Date().toISOString().slice(0, 10);
  triggerDownload(blob, `cinedb-backup-${date}.zip`, "application/zip");
}

export function downloadJSON(data: unknown, filename: string): void {
  triggerDownload(JSON.stringify(data, null, 2), filename, "application/json");
}

function triggerDownload(content: string | Blob, filename: string, type: string): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
