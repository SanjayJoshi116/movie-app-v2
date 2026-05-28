export interface ParsedEntry {
  mediaId: number;
  title: string;
  posterPath?: string | null;
  voteAverage?: number;
}

export interface CombinedExportRow {
  source: "Watchlist" | "Watched" | "Lists";
  listName: string;
  title: string;
  type: "movie" | "tv";
  mediaId: number;
  voteAverage: number;
}

export function parseRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseCSVForImport(text: string): { rows: ParsedEntry[]; error: string | null } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], error: "CSV must have a header row and at least one data row." };
  }

  const headers = parseRow(lines[0] ?? "").map((h) => (h ?? "").toLowerCase().replace(/\s+/g, "_"));

  const idCol = headers.findIndex(
    (h) => h === "id" || h === "movie_id" || h === "tmdb_id" || h === "tv_id" || h === "show_id",
  );
  const titleCol = headers.findIndex(
    (h) => h === "title" || h === "name" || h === "original_title" || h === "movie_name",
  );

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
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i] ?? "");
    const rawId = cols[idCol] ?? "";
    const title = cols[titleCol] ?? "";
    const mediaId = parseInt(rawId, 10);
    if (!isNaN(mediaId) && mediaId > 0) {
      rows.push({ mediaId, title });
    }
  }

  if (rows.length === 0) {
    return { rows: [], error: "No valid entries found. Each row needs a numeric TMDB ID." };
  }

  return { rows, error: null };
}

export function parseCombinedExport(text: string): { rows: CombinedExportRow[]; error: string | null } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], error: "CSV must have a header row and at least one data row." };
  }

  const headers = parseRow(lines[0] ?? "").map((h) => (h ?? "").toLowerCase().replace(/\s+/g, "_"));

  const sourceCol = headers.indexOf("source");
  const listNameCol = headers.indexOf("list_name");
  const titleCol = headers.indexOf("title");
  const typeCol = headers.indexOf("type");
  const idCol = headers.indexOf("tmdb_id");
  const voteCol = headers.indexOf("vote_average");

  if (sourceCol === -1 || idCol === -1 || titleCol === -1 || typeCol === -1) {
    return {
      rows: [],
      error: 'Expected columns: source, list_name, title, type, tmdb_id, vote_average, added_at. Is this a CINE DB Export All file?',
    };
  }

  const rows: CombinedExportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i] ?? "");
    const source = cols[sourceCol]?.trim() as CombinedExportRow["source"];
    const listName = listNameCol >= 0 ? (cols[listNameCol]?.trim() ?? "") : "";
    const title = cols[titleCol]?.trim() ?? "";
    const rawType = cols[typeCol]?.trim().toLowerCase();
    const type = rawType === "tv" ? "tv" : "movie";
    const mediaId = parseInt(cols[idCol] ?? "", 10);
    const voteAverage = parseFloat(cols[voteCol] ?? "0") || 0;

    if (!isNaN(mediaId) && mediaId > 0 && (source === "Watchlist" || source === "Watched" || source === "Lists")) {
      rows.push({ source, listName, title, type, mediaId, voteAverage });
    }
  }

  if (rows.length === 0) {
    return { rows: [], error: "No valid entries found in this file." };
  }

  return { rows, error: null };
}
