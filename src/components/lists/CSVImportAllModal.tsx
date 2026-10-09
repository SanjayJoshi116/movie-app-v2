import React, { useState, useRef } from "react";
import { Modal, Button, Typography, Alert, Tag, Space } from "antd";
import JSZip from "jszip";
import { useToast } from "../../hooks/useToast";
import { useAppContext } from "../../context/useAppContext";
import { useListsContext } from "../../context/useListsContext";
import userApi, { bulkImport, type BulkImportResult } from "../../api/userApi";
import { fetchMoviePoster, fetchTVPoster } from "../../api/tmdb";
import {
  readBackupZip,
  checkBackupFileSize,
  checkBackupZipSize,
  BackupTooLargeError,
  BACKUP_VERSION,
  type BackupContents,
} from "../../utils/backup";
import type { BackupRow } from "../../utils/csvParse";
import { fetchAllPages } from "../../utils/fetchAllPages";
import type { UserListDTO } from "../../types";
import { FONT_SIZE } from "../../constants/typography";

const { Text } = Typography;

/** Per-section outcome; `error` set means the whole section failed. */
interface SectionResult extends BulkImportResult {
  label: string;
  error?: boolean;
  note?: string;
}

/** Fill in posters the backup doesn't have (v1 or hand-made files), 10 at a time. */
async function enrichPosterPaths(rows: BackupRow[]): Promise<void> {
  const missing = rows.filter((r) => !r.posterPath);
  const BATCH = 10;
  for (let i = 0; i < missing.length; i += BATCH) {
    await Promise.allSettled(
      missing.slice(i, i + BATCH).map(async (r) => {
        try {
          const { data } = await (r.type === "tv" ? fetchTVPoster(r.mediaId) : fetchMoviePoster(r.mediaId));
          r.posterPath = data.poster_path ?? null;
        } catch {
          // leave it empty: a missing poster isn't worth failing the import over
        }
      }),
    );
  }
}

const mediaFields = (r: BackupRow) => ({
  mediaId: r.mediaId,
  mediaType: r.type,
  title: r.title,
  posterPath: r.posterPath,
  voteAverage: r.voteAverage,
});

function describeResult(r: SectionResult): string {
  if (r.error) return `${r.label}: failed`;
  const parts = [`${r.added} added`, `${r.skipped} skipped`];
  if (r.failed) parts.push(`${r.failed} failed`);
  return `${r.label}: ${parts.join(", ")}${r.note ? ` (${r.note})` : ""}`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const CSVImportAllModal = ({ open, onClose }: Props) => {
  const { showSuccess, showError } = useToast();
  const { reloadWatchlist, reloadWatched, reloadRatings } = useAppContext();
  const { createList, reloadLists } = useListsContext();
  const [contents, setContents] = useState<BackupContents | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SectionResult[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    // Reset so picking the same file again fires `change` again.
    input.value = "";
    if (!file) return;
    setFileName(file.name);
    setContents(null);
    setParseError(null);
    setResults(null);
    try {
      // Size checks come before anything is decompressed (loadAsync only reads the directory).
      checkBackupFileSize(file.size);
      const zip = await JSZip.loadAsync(file);
      checkBackupZipSize(zip);
      setContents(await readBackupZip(zip));
    } catch (err) {
      setParseError(
        err instanceof BackupTooLargeError || (err instanceof Error && err.message.startsWith("No recognizable"))
          ? err.message
          : "Could not read ZIP file. Make sure it's a valid CINE DB backup.",
      );
    }
  };

  const importLists = async (lists: BackupContents["lists"]): Promise<SectionResult> => {
    const result: SectionResult = { label: "Lists", added: 0, skipped: 0, failed: 0 };
    // A fresh read, not the context: it may be stale, and this has to be exact
    // for re-running an import to never create a second list with the same name.
    const existing = await fetchAllPages<UserListDTO>(userApi, "/lists/");
    const idByName = new Map(existing.map((l) => [l.name, l.id]));
    let created = 0;
    for (const list of lists) {
      let listId = idByName.get(list.name);
      if (listId === undefined) {
        try {
          const made = await createList(list.name, list.description);
          if (!made) throw new Error("not created");
          listId = made.id;
          idByName.set(list.name, listId);
          created += 1;
        } catch {
          result.failed += list.entries.length;
          continue;
        }
      }
      const BATCH = 20;
      for (let i = 0; i < list.entries.length; i += BATCH) {
        const settled = await Promise.allSettled(
          list.entries.slice(i, i + BATCH).map((r) => userApi.post(`/lists/${listId}/items/`, mediaFields(r))),
        );
        for (const s of settled) {
          if (s.status === "rejected") result.failed += 1;
          else if (s.value.status === 201) result.added += 1;
          else result.skipped += 1;
        }
      }
    }
    result.note = `${created} new list${created === 1 ? "" : "s"}`;
    return result;
  };

  const handleSubmit = async () => {
    if (!contents) return;
    setLoading(true);
    const sections: SectionResult[] = [];
    // Each section runs on its own: one failing never stops the others.
    const run = async (label: string, fn: () => Promise<BulkImportResult | SectionResult>, note?: string) => {
      try {
        const r = await fn();
        sections.push({ note, ...r, label });
      } catch {
        sections.push({ label, added: 0, skipped: 0, failed: 0, error: true });
      }
    };

    try {
      await enrichPosterPaths([...contents.watchlist, ...contents.watched, ...contents.lists.flatMap((l) => l.entries)]);

      if (contents.watchlist.length > 0) {
        await run("Watchlist", () =>
          bulkImport("watchlist", contents.watchlist.map((r) => ({ ...mediaFields(r), addedAt: r.addedAt }))),
        );
      }
      if (contents.watched.length > 0) {
        await run("Watched", () =>
          bulkImport(
            "watched",
            contents.watched.map((r) => ({
              ...mediaFields(r),
              watchedAt: r.watchedAt,
              watchedTz: r.watchedTz,
              runtimeMinutes: r.runtimeMinutes,
              platform: r.platform,
            })),
          ),
        );
      }
      const ratings = contents.ratings.filter((r) => r.userRating !== undefined);
      if (ratings.length > 0) {
        await run(
          "Ratings",
          () =>
            bulkImport(
              "ratings",
              ratings.map((r) => ({
                mediaId: r.mediaId,
                mediaType: r.type,
                title: r.title,
                userRating: r.userRating,
                review: r.review ?? "",
                ratedAt: r.ratedAt,
              })),
            ),
          "restored locally, not sent to TMDB",
        );
      }
      if (contents.lists.length > 0) {
        await run("Lists", () => importLists(contents.lists));
      }

      await Promise.allSettled([reloadWatchlist(), reloadWatched(), reloadRatings(), reloadLists()]);

      setResults(sections);
      const anyFailed = sections.some((s) => s.error || s.failed > 0);
      if (anyFailed) showError("Import finished with some failures. See the details.");
      else showSuccess("Import complete.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setContents(null);
    setParseError(null);
    setFileName(null);
    setResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const anyFailed = results?.some((s) => s.error || s.failed > 0);

  return (
    <Modal title="Import All Data from Backup" open={open} onCancel={handleClose} footer={null} destroyOnHidden>
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.body }}>
          Upload a CINE DB backup ZIP file. Existing entries are skipped, never overwritten.
        </Text>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        onChange={handleFileChange}
        style={{ marginBottom: fileName ? 8 : 16 }}
      />
      {fileName && (
        <Text type="secondary" style={{ display: "block", fontSize: FONT_SIZE.caption, marginBottom: 12 }}>
          {fileName}
        </Text>
      )}

      {parseError && <Alert type="error" message={parseError} style={{ marginBottom: 16 }} showIcon />}

      {results && (
        <Alert
          type={anyFailed ? "warning" : "success"}
          showIcon
          style={{ marginBottom: 16 }}
          message={anyFailed ? "Import finished with some failures" : "Import complete"}
          description={
            results.length === 0 ? "Nothing to import." : (
              <div>
                {results.map((r) => (
                  <div key={r.label}>{describeResult(r)}</div>
                ))}
              </div>
            )
          }
        />
      )}

      {contents && !results && (
        <>
          {contents.version > BACKUP_VERSION && (
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 12 }}
              message="This backup was made by a newer version of CINE DB. Anything this version doesn't recognize is skipped."
            />
          )}
          <div style={{ marginBottom: 16 }}>
            <Text style={{ display: "block", marginBottom: 8 }}>Contents:</Text>
            <Space wrap>
              <Tag color="blue">{contents.watchlist.length} watchlist items</Tag>
              <Tag color="green">{contents.watched.length} watched items</Tag>
              <Tag color="gold">{contents.ratings.length} ratings</Tag>
              {contents.lists.map((l) => (
                <Tag key={l.name} color="purple">
                  {l.name} ({l.entries.length})
                </Tag>
              ))}
            </Space>
          </div>
          <Button type="primary" block loading={loading} onClick={handleSubmit}>
            Import All
          </Button>
        </>
      )}

      {results && (
        <Button block onClick={handleClose}>
          Done
        </Button>
      )}
    </Modal>
  );
};

export default CSVImportAllModal;
