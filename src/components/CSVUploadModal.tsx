import React, { useState, useRef } from "react";
import { Modal, Button, Table, Typography, Alert, Radio, Space } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { bulkMarkWatched } from "../api/userApi";
import { fetchMoviePoster, fetchTVPoster } from "../api/tmdb";
import { useToast } from "../hooks/useToast";

const { Text } = Typography;

interface ParsedRow {
  mediaId: number;
  title: string;
  posterPath?: string | null;
  voteAverage?: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

function parseCSV(text: string): { rows: ParsedRow[]; error: string | null } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) {
    return { rows: [], error: "CSV must have a header row and at least one data row." };
  }

  // Parse header — handle quoted fields
  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0] ?? "").map((h) => (h ?? "").toLowerCase().replace(/\s+/g, "_"));

  // Locate required columns
  const idCol = headers.findIndex((h) => h === "id" || h === "movie_id" || h === "tmdb_id" || h === "tv_id" || h === "show_id");
  const titleCol = headers.findIndex(
    (h) => h === "title" || h === "name" || h === "original_title" || h === "movie_name"
  );

  if (idCol === -1) {
    return { rows: [], error: 'Could not find an ID column (expected "id", "movie_id", "tmdb_id", "tv_id", or "show_id").' };
  }
  if (titleCol === -1) {
    return {
      rows: [],
      error: 'Could not find a title column (expected "title", "name", "original_title", or "movie_name").',
    };
  }

  const rows: ParsedRow[] = [];
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
    return { rows: [], error: "No valid movie entries found in the CSV." };
  }

  return { rows, error: null };
}

function downloadTemplate(type: "movie" | "tv") {
  const rows =
    type === "movie"
      ? [
          "id,title,original_title,language,runtime,release_year",
          "550,Fight Club,Fight Club,en,139,1999",
          "13,Forrest Gump,Forrest Gump,en,142,1994",
        ]
      : [
          "id,title,original_title,language,runtime,first_air_year",
          "1396,Breaking Bad,Breaking Bad,en,47,2008",
          "66732,Stranger Things,Stranger Things,en,51,2016",
        ];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = type === "movie" ? "movies_template.csv" : "tvshows_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const CSVUploadModal = ({ open, onClose }: Props) => {
  const { showSuccess, showError } = useToast();
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [parsed, setParsed] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParsed([]);
    setParseError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, error } = parseCSV(text);
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
    setLoading(true);
    try {
      // Batch-fetch TMDB poster data (20 concurrent) to enrich entries before saving
      const enriched = [...parsed];
      const BATCH = 20;
      for (let i = 0; i < enriched.length; i += BATCH) {
        await Promise.allSettled(
          enriched.slice(i, i + BATCH).map(async (row, offset) => {
            const idx = i + offset;
            try {
              const { data } = await (mediaType === "tv" ? fetchTVPoster(row.mediaId) : fetchMoviePoster(row.mediaId));
              enriched[idx] = { mediaId: row.mediaId, title: row.title, posterPath: data.poster_path, voteAverage: data.vote_average };
            } catch {
              // leave without poster data on failure
            }
          })
        );
      }

      const { data } = await bulkMarkWatched(enriched, mediaType);
      showSuccess(`Import complete: ${data.added} added, ${data.skipped} already watched.`);
      handleClose();
    } catch {
      showError("Failed to import watched movies. Please try again.");
    } finally {
      setLoading(false);
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
      onCancel={handleClose}
      footer={null}
      destroyOnClose
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          Upload a CSV with columns <code>id</code> (TMDB ID) and <code>title</code>. Extra columns are ignored.
        </Text>
      </div>

      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div>
          <Text style={{ marginRight: 12 }}>Type:</Text>
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
        onChange={handleFileChange}
        style={{ marginBottom: fileName ? 8 : 16 }}
      />
      {fileName && (
        <Text type="secondary" style={{ display: "block", fontSize: 12, marginBottom: 12 }}>
          {fileName}
        </Text>
      )}

      {parseError && (
        <Alert type="error" message={parseError} style={{ marginBottom: 16 }} showIcon />
      )}

      {parsed.length > 0 && (
        <>
          <Text style={{ display: "block", marginBottom: 8 }}>
            {parsed.length} {mediaType === "tv" ? "TV show" : "movie"}{parsed.length !== 1 ? "s" : ""} found
            {parsed.length > 10 ? ` — showing first 10` : ""}:
          </Text>
          <Table
            size="small"
            pagination={false}
            dataSource={preview.map((r) => ({ ...r, key: r.mediaId }))}
            columns={[
              { title: "TMDB ID", dataIndex: "mediaId", width: 100 },
              { title: "Title", dataIndex: "title", ellipsis: true },
            ]}
            style={{ marginBottom: 16 }}
          />
          <Button type="primary" block loading={loading} onClick={handleSubmit}>
            Import {parsed.length} {mediaType === "tv" ? "TV Show" : "Movie"}{parsed.length !== 1 ? "s" : ""}
          </Button>
        </>
      )}
    </Modal>
  );
};

export default CSVUploadModal;
