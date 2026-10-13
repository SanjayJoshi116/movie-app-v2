/**
 * Order rows for import so they show as they appear in the file.
 *
 * Lists and list items read newest first (by time, then `-id`). A row with
 * a date (from a backup) is placed by that date. Rows without one all get
 * the import time and fall back to creation order: the last one created
 * shows first. Creating the undated rows in reverse makes them read top to
 * bottom like the file.
 */
export function orderForImport<T>(rows: T[], dateOf: (row: T) => string | undefined): T[] {
  const dated = rows.filter((r) => dateOf(r));
  const undated = rows.filter((r) => !dateOf(r));
  return [...dated, ...undated.reverse()];
}
