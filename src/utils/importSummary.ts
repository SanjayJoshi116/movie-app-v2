import type { BulkImportResult } from "../api/userApi";
import { missingPostersNote } from "./importPosters";

// How an import result says a collection reached its library limit.
const FULL = {
  watched: "watched history is full",
  watchlist: "watchlist is full",
  ratings: "ratings are full",
  list: "list is full",
} as const;

/** A collection with a library limit (`library_limits.LIMITS` on the server). */
export type LimitedCollection = keyof typeof FULL;

/**
 * Result-message parts for entries an import sent but the server neither added
 * nor found already present: rows without a TMDB id, and rows past
 * `collection`'s library limit. Empty when there are none.
 */
export function notAddedParts(
  { ignored, overLimit }: Pick<BulkImportResult, "ignored" | "overLimit">,
  collection?: LimitedCollection,
): string[] {
  const parts: string[] = [];
  if (ignored > 0) parts.push(`${ignored} without a TMDB id`);
  if (overLimit > 0 && collection) parts.push(`${overLimit} not added: ${FULL[collection]}`);
  return parts;
}

/**
 * The toast ending a one-collection CSV import: an error (the dialog stays
 * open) when rows failed or hit the limit, info when some titles ended up
 * without a poster, else success. `already` names the skipped rows ("already
 * watched").
 */
export function importResultToast(
  result: BulkImportResult,
  { already, collection, missing }: { already: string; collection: LimitedCollection; missing: number },
): { kind: "error" | "info" | "success"; text: string } {
  const summary = [`${result.added} added`, `${result.skipped} ${already}`, ...notAddedParts(result, collection)].join(", ");
  const kind = result.failed > 0 || result.overLimit > 0 ? "error" : missing > 0 ? "info" : "success";
  const failed = result.failed > 0 ? `, ${result.failed} failed` : "";
  const lead = kind === "error" ? "Import finished" : "Import complete";
  return { kind, text: `${lead}: ${summary}${failed}.${missingPostersNote(missing)}` };
}
