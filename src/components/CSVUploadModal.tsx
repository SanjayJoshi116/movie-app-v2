import React, { useState, useRef } from "react";
import { Modal, Button, Table, Typography, Alert, Radio, Space } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { bulkImport } from "../api/userApi";
import { fetchMoviePoster, fetchTVPoster } from "../api/tmdb";
import { useToast } from "../hooks/useToast";
import { useAppContext } from "../context/useAppContext";
import { parseCSVForImport, type ParsedEntry } from "../utils/csvParse";
import { getApiError } from "../utils/apiError";
import { FONT_SIZE } from "../constants/typography";

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
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
  const { reloadWatched } = useAppContext();
  const [mediaType, setMediaType] = useState<"movie" | "tv">("movie");
  const [parsed, setParsed] = useState<ParsedEntry[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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
              const rowType = row.type ?? mediaType;
              const { data } = await (rowType === "tv" ? fetchTVPoster(row.mediaId) : fetchMoviePoster(row.mediaId));
              enriched[idx] = { ...row, posterPath: data.poster_path, voteAverage: data.vote_average };
            } catch {
              // leave without poster data on failure
            }
          })
        );
      }

      const result = await bulkImport(
        "watched",
        enriched.map((row) => ({
          mediaId: row.mediaId,
          mediaType: row.type ?? mediaType,
          title: row.title,
          posterPath: row.posterPath ?? null,
          voteAverage: row.voteAverage,
        })),
      );
      await reloadWatched();
      const summary = `${result.added} added, ${result.skipped} already watched`;
      if (result.failed > 0) {
        showError(`Import finished: ${summary}, ${result.failed} failed.`);
      } else {
        showSuccess(`Import complete: ${summary}.`);
        handleClose();
      }
    } catch (err) {
      showError(getApiError(err, "Failed to import watched movies. Please try again."));
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
          <Button type="primary" block loading={loading} onClick={handleSubmit}>
            Import {parsed.length} entr{parsed.length !== 1 ? "ies" : "y"}
          </Button>
        </>
      )}
    </Modal>
  );
};

export default CSVUploadModal;
