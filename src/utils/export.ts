import type { WatchlistEntry, WatchedEntry, RatingEntry, UserList } from "../types";
import { buildBackupZip, type BackupSocial } from "./backup";
import { localISODate } from "./formatDate";

/**
 * Cells a spreadsheet would run as a formula (`=` `+` `-` `@`, tab, CR) get a
 * leading `'`, which spreadsheets show as text. A value already starting with
 * `'` gets one too, so parseCSV's strip of exactly one `'` is reversible.
 */
const FORMULA_START = /^[=+\-@\t\r']/;

function escape(v: unknown): string {
  const raw = String(v ?? "");
  const s = FORMULA_START.test(raw) ? `'${raw}` : raw;
  return /[,"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * UTF-8 byte order mark. Excel on Windows reads a BOM-less CSV in the legacy
 * code page and garbles non-ASCII titles; parseCSV strips it back off.
 */
export const CSV_BOM = "﻿";

export function buildCSVString(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  return CSV_BOM + [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
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
  social: BackupSocial,
): Promise<void> {
  const blob = await buildBackupZip(watchlist, watchedList, ratings, lists, undefined, social)
    .generateAsync({ type: "blob" });
  const date = localISODate(new Date());
  triggerDownload(blob, `cinedb-backup-${date}.zip`, "application/zip");
}

export function downloadJSON(data: unknown, filename: string): void {
  triggerDownload(JSON.stringify(data, null, 2), filename, "application/json");
}

function triggerDownload(content: string | Blob, filename: string, type: string): void {
  downloadBlob(content instanceof Blob ? content : new Blob([content], { type }), filename);
}

/**
 * Save a file. Every download goes through here. The anchor is attached while
 * it's clicked, and the object URL is revoked a tick later: the browser reads
 * the URL after click() returns, and revoking it synchronously cancelled
 * downloads in some browsers (Safari, older Firefox).
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
