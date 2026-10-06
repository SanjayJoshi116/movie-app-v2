import React, { useState, useRef, useEffect } from "react";
import { Modal, Button, Table, Typography, Alert, Radio, Space, Select } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { fetchMoviePoster, fetchTVPoster } from "../../api/tmdb";
import { useToast } from "../../hooks/useToast";
import { useListsContext } from "../../context/useListsContext";
import { parseCSVForImport } from "../../utils/csvParse";
import type { ParsedEntry } from "../../utils/csvParse";
import userApi from "../../api/userApi";
import { getApiError } from "../../utils/apiError";
import { FONT_SIZE } from "../../constants/typography";

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
  lockedListId?: number;
}

function downloadTemplate(type: "movie" | "tv") {
  const rows =
    type === "movie"
      ? ["id,title", "550,Fight Club", "13,Forrest Gump"]
      : ["id,title", "1396,Breaking Bad", "66732,Stranger Things"];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = type === "movie" ? "list_movies_template.csv" : "list_tv_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

const CSVListImportModal = ({ open, onClose, lockedListId }: Props) => {
  const { showSuccess, showError } = useToast();
  const { lists, reloadLists } = useListsContext();
  const [selectedListId, setSelectedListId] = useState<number | null>(lockedListId ?? null);

  useEffect(() => {
    if (lockedListId != null) setSelectedListId(lockedListId);
  }, [lockedListId, open]);
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
      const { rows, error } = parseCSVForImport(ev.target?.result as string);
      if (error) setParseError(error);
      else setParsed(rows);
    };
    reader.readAsText(file);
  };

  const handleSubmit = async () => {
    if (parsed.length === 0 || selectedListId === null) return;
    setLoading(true);
    try {
      const enriched = [...parsed];
      const BATCH = 20;
      for (let i = 0; i < enriched.length; i += BATCH) {
        await Promise.allSettled(
          enriched.slice(i, i + BATCH).map(async (row, offset) => {
            try {
              const { data } = await ((row.type ?? mediaType) === "tv"
                ? fetchTVPoster(row.mediaId)
                : fetchMoviePoster(row.mediaId));
              enriched[i + offset] = { ...row, posterPath: data.poster_path, voteAverage: data.vote_average };
            } catch {
              // leave without enrichment
            }
          })
        );
      }

      const allResults: PromiseSettledResult<{ status: number }>[] = [];
      for (let i = 0; i < enriched.length; i += BATCH) {
        const batch = await Promise.allSettled(
          enriched.slice(i, i + BATCH).map((row) =>
            userApi.post(`/lists/${selectedListId}/items/`, {
              mediaId: row.mediaId,
              mediaType: row.type ?? mediaType,
              title: row.title,
              posterPath: row.posterPath ?? null,
              voteAverage: row.voteAverage ?? 0,
            })
          )
        );
        allResults.push(...batch);
      }
      const added = allResults.filter((r) => r.status === "fulfilled" && r.value.status === 201).length;
      const skipped = allResults.filter((r) => r.status === "fulfilled" && r.value.status !== 201).length;
      const failed = allResults.filter((r) => r.status === "rejected").length;

      await reloadLists();
      const summary = `${added} added, ${skipped} already in list`;
      if (failed > 0) {
        showError(`Import finished: ${summary}, ${failed} failed.`);
      } else {
        showSuccess(`Import complete: ${summary}.`);
        handleClose();
      }
    } catch (err) {
      showError(getApiError(err, "Import failed. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setParsed([]);
    setParseError(null);
    setFileName(null);
    setSelectedListId(lockedListId ?? null);
    setMediaType("movie");
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const preview = parsed.slice(0, 10);

  return (
    <Modal title="Import CSV to List" open={open} onCancel={handleClose} footer={null} destroyOnHidden>
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.body }}>
          Upload a CSV with columns <code>id</code> (TMDB ID) and <code>title</code>. An optional <code>type</code> column
          (<code>movie</code>/<code>tv</code>) sets each row&apos;s type; the default type applies to rows without one.
        </Text>
      </div>

      <div style={{ marginBottom: 12 }}>
        <Text style={{ display: "block", marginBottom: 6 }}>Target list:</Text>
        <Select
          style={{ width: "100%" }}
          placeholder="Select a list"
          value={selectedListId}
          onChange={setSelectedListId}
          disabled={lockedListId != null}
          options={lists.map((l) => ({ label: `${l.name} (${l.items.length} items)`, value: l.id }))}
        />
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

      {parseError && <Alert type="error" message={parseError} style={{ marginBottom: 16 }} showIcon />}

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
          <Button
            type="primary"
            block
            loading={loading}
            disabled={selectedListId === null}
            onClick={handleSubmit}
          >
            Import {parsed.length} item{parsed.length !== 1 ? "s" : ""}
          </Button>
        </>
      )}
    </Modal>
  );
};

export default CSVListImportModal;
