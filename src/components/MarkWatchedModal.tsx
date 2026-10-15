import { useEffect, useRef, useState } from "react";
import { Modal, Form, InputNumber, Select, Input, Spin } from "antd";
import { fetchMovieDetails, fetchTVDetails } from "../api/tmdb";
import type {
  MediaType, TMDBMovieDetailResponse, TMDBProvider, TMDBProviderRegion, TMDBTVDetailResponse, TMDBWatchProviderResponse,
} from "../types";
import { arrayOr, objectOr } from "../utils/appended";
import { prefillRuntime } from "../utils/watchRuntime";
import { pickRegion } from "../utils/region";
import { useRegion } from "../hooks/useRegion";

const OTHER_VALUE = "__other__";

interface Props {
  open: boolean;
  mediaId: number;
  mediaType: MediaType;
  onCancel: () => void;
  /** Saves; rejects on failure (after showing its own error), which keeps the
   *  dialog open with what was entered. The caller closes it on success. */
  onConfirm: (details: WatchDetails) => Promise<void>;
}

export interface WatchDetails {
  runtimeMinutes?: number;
  platform?: string;
  originalLanguage?: string;
  releaseYear?: number;
}

function yearOf(date: string | undefined): number | undefined {
  const y = Number(date?.slice(0, 4));
  return Number.isInteger(y) && y >= 1800 && y <= 3000 ? y : undefined;
}

export function MarkWatchedModal({ open, mediaId, mediaType, onCancel, onConfirm }: Props) {
  const [form] = Form.useForm();
  const userRegion = useRegion();
  const [platform, setPlatform] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  // A save in flight: the dialog can't close and a second confirm is ignored.
  const [saving, setSaving] = useState(false);
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  // Language/year ride along from the details request we already make for the
  // runtime, so Stats doesn't have to backfill them from TMDB later.
  const metaRef = useRef<Pick<WatchDetails, "originalLanguage" | "releaseYear">>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPlatform(undefined);
    setOptions([]);
    form.resetFields();
    metaRef.current = {};

    // One request: the same appended details call the detail page makes (so
    // usually a shared or cached hit), with `watch/providers` riding along.
    // A missing or malformed providers part only empties the platform list;
    // a failed request leaves the form usable with the "Other" choice.
    const request = mediaType === "movie" ? fetchMovieDetails(mediaId) : fetchTVDetails(mediaId);
    request
      .then(({ data }) => {
        if (cancelled) return;
        const date = mediaType === "movie"
          ? (data as TMDBMovieDetailResponse).release_date
          : (data as TMDBTVDetailResponse).first_air_date;
        metaRef.current = { originalLanguage: data.original_language || undefined, releaseYear: yearOf(date) };
        form.setFieldsValue({ runtimeMinutes: prefillRuntime(mediaType, data) });

        const providers = objectOr<TMDBWatchProviderResponse>(data["watch/providers"], { results: {} });
        // The user's region, else the US.
        const byRegion = objectOr<Record<string, unknown>>(providers.results, {});
        const region = objectOr<Partial<TMDBProviderRegion>>(pickRegion(byRegion, userRegion).data, {});
        const names = Array.from(new Set(
          [...arrayOr<TMDBProvider>(region.flatrate), ...arrayOr<TMDBProvider>(region.rent), ...arrayOr<TMDBProvider>(region.buy)]
            .map((p) => p?.provider_name)
            .filter((name): name is string => typeof name === "string" && name.length > 0),
        ));
        setOptions(names.map((name) => ({ label: name, value: name })));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, mediaId, mediaType, form, userRegion]);

  const handleOk = async () => {
    if (saving) return;
    const values = await form.validateFields().catch(() => null);
    if (!values) return;
    const resolvedPlatform = values.platform === OTHER_VALUE ? values.otherPlatform?.trim() : values.platform;
    setSaving(true);
    try {
      await onConfirm({
        runtimeMinutes: values.runtimeMinutes ?? undefined,
        platform: resolvedPlatform || undefined,
        ...metaRef.current,
      });
    } catch {
      // The caller showed the error; the dialog stays open as entered.
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Mark as Watched"
      open={open}
      onOk={handleOk}
      // While saving nothing closes it: the result (or the error, with the
      // input kept) has to land in front of the user.
      onCancel={saving ? undefined : onCancel}
      maskClosable={!saving}
      keyboard={!saving}
      closable={!saving}
      cancelButtonProps={{ disabled: saving }}
      okText="Mark Watched"
      confirmLoading={loading || saving}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="runtimeMinutes" label="Runtime (minutes)">
            {/* Editable: a whole-series prefill is an estimate, and TMDB often has none. */}
            <InputNumber min={0} max={2147483647} precision={0} style={{ width: "100%" }} placeholder={loading ? "Fetching…" : "Minutes (optional)"} />
          </Form.Item>
          <Form.Item name="platform" label="Watched on (optional)">
            <Select
              allowClear
              placeholder="Select a platform"
              options={[...options, { label: "Other", value: OTHER_VALUE }]}
              onChange={setPlatform}
            />
          </Form.Item>
          {platform === OTHER_VALUE && (
            <Form.Item name="otherPlatform" label="Platform name">
              <Input placeholder="e.g. Blu-ray, Theater" maxLength={100} />
            </Form.Item>
          )}
        </Form>
      </Spin>
    </Modal>
  );
}
