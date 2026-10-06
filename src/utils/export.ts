import type { WatchlistEntry, WatchedEntry, RatingEntry, UserList } from "../types";
import { buildBackupZip } from "./backup";

function escape(v: unknown): string {
  const s = String(v ?? "");
  return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
  ratings: RatingEntry[],
  lists: UserList[],
): Promise<void> {
  const blob = await buildBackupZip(watchlist, watchedList, ratings, lists).generateAsync({ type: "blob" });
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
