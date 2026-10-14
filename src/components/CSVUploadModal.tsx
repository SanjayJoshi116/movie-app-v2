import React, { useState, useRef } from "react";
import { Modal, Button, Table, Typography, Alert, Radio, Space } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { bulkImport, sessionGuard, SessionEndedError } from "../api/userApi";
import { lookupImportPosters, missingPostersNote } from "../utils/importPosters";
import { ImportProgress } from "./ImportProgress";
import { useToast } from "../hooks/useToast";
import { useAppContext } from "../context/useAppContext";
import { parseCSVForImport, type ParsedEntry } from "../utils/csvParse";
import { getApiError, IMPORT_REFRESH_ERROR } from "../utils/apiError";
import { downloadCSV } from "../utils/export";
import { FONT_SIZE } from "../constants/typography";

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Template rows: only the columns parseCSVForImport reads (id, title and the optional type). */
export function templateRows(type: "movie" | "tv") {
  return type === "movie"
    ? [
        { id: 550, title: "Fight Club", type: "movie" },
        { id: 13, title: "Forrest Gump", type: "movie" },
      ]
    : [
        { id: 1396, title: "Breaking Bad", type: "tv" },
        { id: 66732, title: "Stranger Things", type: "tv" },
      ];
}

function downloadTemplate(type: "movie" | "tv") {
  downloadCSV(templateRows(type), type === "movie" ? "movies_template.csv" : "tvshows_template.csv");
}

const CSVUploadModal = ({ open, onClose }: Props) => {
  const { showSuccess, showError, showInfo } = useToast();
  const { reloadWatched } = useAppContext();
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [parsed, setParsed] = useState<ParsedEntry[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so picking the same file again (e.g. after an error) fires `change` again.
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setParsed([]);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, error } = parseCSVForImport(text);
      if (error) {
        setParseError(error);
      } else {
        setParsed(rows);
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (parsed.length === 0) return;
    // Checked before every write: after a sign-out, and a sign-in as someone
    // else in this tab, the rest of the import must not land in that account.
    const guard = sessionGuard();
    setLoading(true);
    try {
      // Posters and scores, paced to the TMDB proxy's rate limit.
      const { found, missing } = await lookupImportPosters(
        parsed.map((row) => ({ mediaId: row.mediaId, type: row.type ?? mediaType })),
        (done, total) => setProgress({ done, total }),
        () => !guard.isCurrent(),
      );
      setProgress(null);

      const result = await bulkImport(
        "watched",
        parsed.map((row, i) => ({
          mediaId: row.mediaId,
          mediaType: row.type ?? mediaType,
          title: row.title,
          posterPath: found[i]?.posterPath ?? null,
          voteAverage: found[i]?.voteAverage,
          // The Watched page's own export carries these; keep them on re-import.
          ...(row.watchedAt ? { watchedAt: row.watchedAt } : {}),
          ...(row.watchedTz ? { watchedTz: row.watchedTz } : {}),
        })),
        { guard },
      );
      guard.check();
      // The entries are saved even if this fails; only what's on screen is stale.
      const refreshed = await reloadWatched().then(() => true, () => false);
      const summary = `${result.added} added, ${result.skipped} already watched`;
      if (result.failed > 0) {
        showError(`Import finished: ${summary}, ${result.failed} failed.${missingPostersNote(missing)}`);
      } else if (missing > 0) {
        showInfo(`Import complete: ${summary}.${missingPostersNote(missing)}`);
        handleClose();
      } else {
        showSuccess(`Import complete: ${summary}.`);
        handleClose();
      }
      if (!refreshed && result.added > 0) showError(IMPORT_REFRESH_ERROR);
    } catch (err) {
      // Signed out mid-import: drop it. Nothing more is written, and nothing
      // is shown or reloaded for whoever signs in next.
      if (err instanceof SessionEndedError) return;
      showError(getApiError(err, "Failed to import watched movies. Please try again."));
    } finally {
      if (guard.isCurrent()) {
        setProgress(null);
        setLoading(false);
      }
    }
  };

  const handleClose = () => {
    setParsed([]);
    setParseError(null);
    setFileName(null);
    setMediaType("movie");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const preview = parsed.slice(0, 10);

  return (
    <Modal
      title="Import Watched from CSV"
      open={open}
      // A running import can't be closed, so it can't be started twice at once.
      onCancel={loading ? undefined : handleClose}
      maskClosable={!loading}
      keyboard={!loading}
      closable={!loading}
      footer={null}
      destroyOnHidden
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.body }}>
          Upload a CSV with columns <code>id</code> (TMDB ID) and <code>title</code>. An optional <code>type</code> column
          (<code>movie</code>/<code>tv</code>) sets each row&apos;s type; the default type applies to rows without one.
        </Text>
      </div>

      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <Text style={{ marginRight: 12 }}>Default type:</Text>
          <Radio.Group value={mediaType} onChange={(e) => setMediaType(e.target.value)}>
            <Radio.Button value="movie">Movies</Radio.Button>
            <Radio.Button value="tv">TV Shows</Radio.Button>
          </Radio.Group>
        </div>
        <Space size={8}>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadTemplate("movie")}>
            Movie Template
          </Button>
          <Button size="small" icon={<DownloadOutlined />} onClick={() => downloadTemplate("tv")}>
            TV Template
          </Button>
        </Space>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        aria-label="CSV file to import"
        onChange={handleFileChange}
        style={{ marginBottom: fileName ? 8 : 16 }}
      />
      {fileName && (
        <Text type="secondary" style={{ display: "block", fontSize: FONT_SIZE.caption, marginBottom: 12 }}>
          {fileName}
        </Text>
      )}

      {parseError && (
        <Alert type="error" message={parseError} style={{ marginBottom: 16 }} showIcon />
      )}

      {parsed.length > 0 && (
        <>
          <Text style={{ display: "block", marginBottom: 8 }}>
            {parsed.length} entr{parsed.length !== 1 ? "ies" : "y"} found
            {parsed.length > 10 ? ` — showing first 10` : ""}:
          </Text>
          <Table
            size="small"
            pagination={false}
            dataSource={preview.map((r, i) => ({ ...r, type: r.type ?? mediaType, key: `${i}-${r.mediaId}` }))}
            columns={[
              { title: "TMDB ID", dataIndex: "mediaId", width: 100 },
              { title: "Type", dataIndex: "type", width: 70 },
              { title: "Title", dataIndex: "title", ellipsis: true },
            ]}
            style={{ marginBottom: 16 }}
          />
          <ImportProgress progress={progress} />
          <Button type="primary" block loading={loading} onClick={handleSubmit}>
            Import {parsed.length} entr{parsed.length !== 1 ? "ies" : "y"}
          </Button>
        </>
      )}
    </Modal>
  );
};

export default CSVUploadModal;
