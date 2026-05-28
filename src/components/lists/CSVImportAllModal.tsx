import React, { useState, useRef } from "react";
import { Modal, Button, Typography, Alert, Tag, Space } from "antd";
import JSZip from "jszip";
import { useToast } from "../../hooks/useToast";
import { useAppContext } from "../../context/useAppContext";
import { useListsContext } from "../../context/useListsContext";
import { bulkMarkWatched } from "../../api/userApi";
import userApi from "../../api/userApi";
import { parseRow } from "../../utils/csvParse";

const { Text } = Typography;

interface ZipSummary {
  watchlistCount: number;
  watchedCount: number;
  listFiles: string[];
}

interface ParsedCSVEntry {
  mediaId: number;
  title: string;
  type: "movie" | "tv";
  voteAverage: number;
}

function parseExportCSV(text: string): ParsedCSVEntry[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = parseRow(lines[0] ?? "").map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const idCol = headers.indexOf("tmdb_id");
  const titleCol = headers.indexOf("title");
  const typeCol = headers.indexOf("type");
  const voteCol = headers.indexOf("vote_average");
  if (idCol === -1 || titleCol === -1) return [];
  const rows: ParsedCSVEntry[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseRow(lines[i] ?? "");
    const mediaId = parseInt(cols[idCol] ?? "", 10);
    if (isNaN(mediaId) || mediaId <= 0) continue;
    const rawType = (cols[typeCol] ?? "").toLowerCase();
    rows.push({
      mediaId,
      title: cols[titleCol]?.trim() ?? "",
      type: rawType === "tv" ? "tv" : "movie",
      voteAverage: parseFloat(cols[voteCol] ?? "0") || 0,
    });
  }
  return rows;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const CSVImportAllModal = ({ open, onClose }: Props) => {
  const { showSuccess, showError } = useToast();
  const { addToWatchlist, reloadWatched } = useAppContext();
  const { lists, createList, reloadLists } = useListsContext();
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ZipSummary | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setZipFile(file);
    setSummary(null);
    setParseError(null);
    try {
      const zip = await JSZip.loadAsync(file);
      const watchlistFile = zip.file("watchlist.csv");
      const watchedFile = zip.file("watched.csv");
      const listFiles = Object.keys(zip.files).filter(
        (name) => name.startsWith("lists/") && name.endsWith(".csv") && !zip.files[name]!.dir
      );
      if (!watchlistFile && !watchedFile && listFiles.length === 0) {
        setParseError("No recognizable CSV files found. Expected watchlist.csv, watched.csv, or lists/*.csv.");
        return;
      }
      const wlCount = watchlistFile ? parseExportCSV(await watchlistFile.async("string")).length : 0;
      const wdCount = watchedFile ? parseExportCSV(await watchedFile.async("string")).length : 0;
      setSummary({ watchlistCount: wlCount, watchedCount: wdCount, listFiles });
    } catch {
      setParseError("Could not read ZIP file. Make sure it's a valid CINE DB backup.");
    }
  };

  const handleSubmit = async () => {
    if (!zipFile || !summary) return;
    setLoading(true);
    try {
      const zip = await JSZip.loadAsync(zipFile);

      // Watchlist
      const wlFile = zip.file("watchlist.csv");
      if (wlFile) {
        const entries = parseExportCSV(await wlFile.async("string"));
        for (const e of entries) {
          addToWatchlist({ id: e.mediaId, type: e.type, title: e.title, posterPath: null, voteAverage: e.voteAverage });
        }
      }

      // Watched — split by type, bulk import
      const wdFile = zip.file("watched.csv");
      if (wdFile) {
        const entries = parseExportCSV(await wdFile.async("string"));
        const movies = entries.filter((e) => e.type === "movie").map((e) => ({ mediaId: e.mediaId, title: e.title, voteAverage: e.voteAverage }));
        const tv = entries.filter((e) => e.type === "tv").map((e) => ({ mediaId: e.mediaId, title: e.title, voteAverage: e.voteAverage }));
        if (movies.length > 0) await bulkMarkWatched(movies, "movie");
        if (tv.length > 0) await bulkMarkWatched(tv, "tv");
        if (entries.length > 0) await reloadWatched();
      }

      // Lists
      for (const filePath of summary.listFiles) {
        const csvFile = zip.file(filePath);
        if (!csvFile) continue;
        const entries = parseExportCSV(await csvFile.async("string"));
        if (entries.length === 0) continue;
        const listName = filePath.replace(/^lists\//, "").replace(/\.csv$/, "");
        let list = lists.find((l) => l.name === listName);
        if (!list) {
          await createList(listName, "");
          await reloadLists();
          const res = await userApi.get("/lists/");
          list = res.data.find((l: any) => l.name === listName);
        }
        if (!list) continue;
        const BATCH = 20;
        for (let i = 0; i < entries.length; i += BATCH) {
          await Promise.allSettled(
            entries.slice(i, i + BATCH).map((e) =>
              userApi.post(`/lists/${list!.id}/items/`, {
                mediaId: e.mediaId,
                mediaType: e.type,
                title: e.title,
                posterPath: null,
                voteAverage: e.voteAverage,
              })
            )
          );
        }
      }
      if (summary.listFiles.length > 0) await reloadLists();

      showSuccess(
        `Import complete: ${summary.watchlistCount} watchlist, ${summary.watchedCount} watched, ${summary.listFiles.length} list(s).`
      );
      handleClose();
    } catch {
      showError("Import failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setZipFile(null);
    setSummary(null);
    setParseError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  return (
    <Modal title="Import All Data from Backup" open={open} onCancel={handleClose} footer={null} destroyOnClose>
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Upload a CINE DB backup ZIP file. Existing entries are skipped — no duplicates.
        </Text>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileChange}
        style={{ marginBottom: zipFile ? 8 : 16 }}
      />
      {zipFile && (
        <Text type="secondary" style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
          {zipFile.name}
        </Text>
      )}

      {parseError && <Alert type="error" message={parseError} style={{ marginBottom: 16 }} showIcon />}

      {summary && (
        <>
          <div style={{ marginBottom: 16 }}>
            <Text style={{ display: "block", marginBottom: 8 }}>Contents:</Text>
            <Space wrap>
              <Tag color="blue">{summary.watchlistCount} watchlist items</Tag>
              <Tag color="green">{summary.watchedCount} watched items</Tag>
              {summary.listFiles.map((f) => (
                <Tag key={f} color="purple">
                  {f.replace(/^lists\//, "").replace(/\.csv$/, "")}
                </Tag>
              ))}
            </Space>
          </div>
          <Button type="primary" block loading={loading} onClick={handleSubmit}>
            Import All
          </Button>
        </>
      )}
    </Modal>
  );
};

export default CSVImportAllModal;
