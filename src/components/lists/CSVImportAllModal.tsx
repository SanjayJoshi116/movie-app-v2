import React, { useContext, useState, useRef } from "react";
import { Modal, Button, Typography, Alert, Tag, Space } from "antd";
import JSZip from "jszip";
import { useToast } from "../../hooks/useToast";
import { IMPORT_REFRESH_ERROR } from "../../utils/apiError";
import { useAppContext } from "../../context/useAppContext";
import { useListsContext } from "../../context/useListsContext";
import userApi, {
  bulkAddListItems, bulkImport, bulkImportEpisodeProgress, bulkImportFollowed, sessionGuard, SessionEndedError,
  type BulkImportResult, type SessionGuard,
} from "../../api/userApi";
import { FollowedPeopleContext } from "../../context/FollowedPeopleContext";
import { lookupImportPosters } from "../../utils/importPosters";
import { ImportProgress } from "../ImportProgress";
import {
  readBackupZip,
  checkBackupFileSize,
  checkBackupZipSize,
  BackupTooLargeError,
  BACKUP_VERSION,
  type BackupContents,
} from "../../utils/backup";
import type { BackupRow } from "../../utils/csvParse";
import { orderForImport } from "../../utils/listImport";
import { fetchAllPages } from "../../utils/fetchAllPages";
import type { UserListDTO } from "../../types";
import { FONT_SIZE } from "../../constants/typography";

const { Text } = Typography;

/** Per-section outcome; `error` set means the whole section failed. */
interface SectionResult extends BulkImportResult {
  label: string;
  error?: boolean;
  note?: string;
  /** Lists that couldn't be created: a failure even when the list was empty. */
  failedLists?: number;
}

const sectionFailed = (s: SectionResult) => !!s.error || s.failed > 0 || (s.failedLists ?? 0) > 0;

/** Fill in posters the backup doesn't have (v1 or hand-made files), paced to
 *  the TMDB proxy's rate limit. Returns how many titles are still missing one. */
async function enrichPosterPaths(
  rows: BackupRow[],
  onProgress: (done: number, total: number) => void,
  guard: SessionGuard,
): Promise<number> {
  // parseBackupCSV reads a blank or bad score as 0, and a row with a poster
  // is never looked up for its score (item 44). A row looked up for its
  // poster anyway keeps TMDB's score when the backup's is 0 (item 45): the
  // call is already paid for.
  const { found, missing } = await lookupImportPosters(
    rows.map((r) => ({ ...r, voteAverage: !r.posterPath && r.voteAverage === 0 ? undefined : r.voteAverage })),
    onProgress,
    () => !guard.isCurrent(),
  );
  rows.forEach((r, i) => {
    r.posterPath = found[i]!.posterPath;
    r.voteAverage = found[i]!.voteAverage ?? 0;
  });
  return missing;
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
  if (r.failedLists) parts.push(`${r.failedLists} list${r.failedLists === 1 ? "" : "s"} couldn't be created`);
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
  // Straight from the context: useFollowedPeople() would start the provider's
  // lazy fetch, so every Profile open (this dialog is always rendered there)
  // fetched /followed-people/.
  const reloadFollowed = useContext(FollowedPeopleContext)?.reload;
  const [contents, setContents] = useState<BackupContents | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SectionResult[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [postersMissing, setPostersMissing] = useState(0);
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
    setPostersMissing(0);
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

  const importLists = async (lists: BackupContents["lists"], guard: SessionGuard): Promise<SectionResult> => {
    const result: SectionResult = { label: "Lists", added: 0, skipped: 0, failed: 0 };
    guard.check();
    // A fresh read, not the context: it may be stale, and this has to be exact
    // for re-running an import to never create a second list with the same name.
    const existing = await fetchAllPages<UserListDTO>(userApi, "/lists/");
    // Only lists that existed before this import, each matched at most once:
    // two backup lists that share a name stay two lists. A restored list keeps
    // its creation time, so importing the same backup again finds each one's
    // own copy by that time; otherwise the oldest unmatched one is used.
    const unmatchedByName = new Map<string, UserListDTO[]>();
    for (const l of [...existing].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id - b.id)) {
      unmatchedByName.set(l.name, [...(unmatchedByName.get(l.name) ?? []), l]);
    }
    const takeExisting = (name: string, createdAt?: string): number | undefined => {
      const candidates = unmatchedByName.get(name);
      if (!candidates?.length) return undefined;
      const sameTime = createdAt ? candidates.findIndex((l) => Date.parse(l.createdAt) === Date.parse(createdAt)) : -1;
      return candidates.splice(sameTime === -1 ? 0 : sameTime, 1)[0]?.id;
    };
    let created = 0;
    // Lists without a createdAt (older backups) are created in reverse, so they
    // keep the backup's order.
    for (const list of orderForImport(lists, (l) => l.createdAt)) {
      let listId = takeExisting(list.name, list.createdAt);
      if (listId === undefined) {
        guard.check(); // outside the try: an ended session isn't one failed list
        try {
          const made = await createList(list.name, list.description, list.createdAt);
          if (!made) throw new Error("not created");
          listId = made.id;
          created += 1;
        } catch {
          result.failed += list.entries.length;
          result.failedLists = (result.failedLists ?? 0) + 1;
          continue;
        }
      }
      // 500 per request, each item's added date kept, so the restored list
      // keeps its order (one POST per item scrambled it and ate the throttle).
      const r = await bulkAddListItems(
        listId,
        orderForImport(
          list.entries.map((e) => ({ ...mediaFields(e), ...(e.addedAt ? { addedAt: e.addedAt } : {}) })),
          (e) => e.addedAt,
        ),
        { guard },
      );
      result.added += r.added;
      result.skipped += r.skipped;
      result.failed += r.failed;
    }
    result.note = `${created} new list${created === 1 ? "" : "s"}`;
    return result;
  };

  const handleSubmit = async () => {
    if (!contents) return;
    // Every write checks this: after a sign-out (and a sign-in as someone else
    // in this tab), the rest of the restore must not land in that account.
    const guard = sessionGuard();
    setLoading(true);
    const sections: SectionResult[] = [];
    // Each section runs on its own: one failing never stops the others. An
    // ended session isn't a failed section; it ends the whole restore.
    const run = async (label: string, fn: () => Promise<BulkImportResult | SectionResult>, note?: string) => {
      try {
        const r = await fn();
        sections.push({ note, ...r, label });
      } catch (err) {
        if (err instanceof SessionEndedError) throw err;
        sections.push({ label, added: 0, skipped: 0, failed: 0, error: true });
      }
    };

    try {
      const postersMissing = await enrichPosterPaths(
        [...contents.watchlist, ...contents.watched, ...contents.lists.flatMap((l) => l.entries)],
        (done, total) => setProgress({ done, total }),
        guard,
      );
      guard.check();
      setProgress(null);
      setPostersMissing(postersMissing);

      if (contents.watchlist.length > 0) {
        await run("Watchlist", () =>
          bulkImport("watchlist", contents.watchlist.map((r) => ({ ...mediaFields(r), addedAt: r.addedAt })), { guard }),
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
            { guard },
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
              { guard },
            ),
          "restored locally, not sent to TMDB",
        );
      }
      if (contents.lists.length > 0) {
        await run("Lists", () => importLists(contents.lists, guard));
      }
      if (contents.followed.length > 0) {
        await run("Following", () =>
          bulkImportFollowed(
            contents.followed.map((p) => ({
              personId: p.personId, name: p.name, profilePath: p.profilePath,
              ...(p.followedAt ? { followedAt: p.followedAt } : {}),
            })),
            { guard },
          ),
        );
      }
      if (contents.episodeProgress.length > 0) {
        await run("Episode progress", () => bulkImportEpisodeProgress(contents.episodeProgress, { guard }));
      }

      guard.check();
      const reloads = await Promise.allSettled([reloadWatchlist(), reloadWatched(), reloadRatings(), reloadLists()]);
      // Refetches only if something on screen already uses follows; either
      // way it counts as a follow change, so the notifications refresh.
      if (contents.followed.length > 0) reloadFollowed?.();

      setResults(sections);
      const anyFailed = sections.some(sectionFailed);
      if (anyFailed) showError("Import finished with some failures. See the details.");
      else showSuccess("Import complete.");
      // The entries are saved; only what's on screen is stale.
      const anyAdded = sections.some((s) => s.added > 0);
      if (anyAdded && reloads.some((r) => r.status === "rejected")) showError(IMPORT_REFRESH_ERROR);
    } catch (err) {
      // Signed out mid-restore: drop it silently. What already went out
      // landed in the account that sent it; nothing more is written.
      if (!(err instanceof SessionEndedError)) throw err;
    } finally {
      if (guard.isCurrent()) {
        setProgress(null);
        setLoading(false);
      }
    }
  };

  const handleClose = () => {
    setContents(null);
    setParseError(null);
    setFileName(null);
    setResults(null);
    setPostersMissing(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  };

  const anyFailed = results?.some(sectionFailed);

  return (
    <Modal
      title="Import All Data from Backup"
      open={open}
      // A running restore can't be closed: closing and re-running it alongside
      // the first created every list twice.
      onCancel={loading ? undefined : handleClose}
      maskClosable={!loading}
      keyboard={!loading}
      closable={!loading}
      footer={null}
      destroyOnHidden
    >
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: FONT_SIZE.body }}>
          Upload a CINE DB backup ZIP file. Existing entries are skipped, never overwritten.
        </Text>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".zip"
        aria-label="Backup ZIP file to import"
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
                {postersMissing > 0 && (
                  <div>{postersMissing} saved without a poster (TMDB had none, or the lookup kept failing).</div>
                )}
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
              {contents.followed.length > 0 && <Tag color="cyan">{contents.followed.length} followed people</Tag>}
              {contents.episodeProgress.length > 0 && (
                <Tag color="geekblue">{contents.episodeProgress.length} shows in progress</Tag>
              )}
              {contents.lists.map((l, i) => (
                // Index key: two lists in one backup can share a name.
                <Tag key={i} color="purple">
                  {l.name} ({l.entries.length})
                </Tag>
              ))}
            </Space>
          </div>
          <ImportProgress progress={progress} />
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
