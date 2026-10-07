import { useEffect, useRef, useState } from "react";
import { Modal, Form, InputNumber, Select, Input, Spin } from "antd";
import { fetchMovieDetails, fetchTVDetails, fetchMovieProviders, fetchTVWatchProviders } from "../api/tmdb";
import type { MediaType } from "../types";

const OTHER_VALUE = "__other__";

interface Props {
  open: boolean;
  mediaId: number;
  mediaType: MediaType;
  onCancel: () => void;
  onConfirm: (details: WatchDetails) => void;
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
  const [platform, setPlatform] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
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

    const fetchRuntime = mediaType === "movie"
      ? fetchMovieDetails(mediaId).then((res) => {
          metaRef.current = { originalLanguage: res.data.original_language || undefined, releaseYear: yearOf(res.data.release_date) };
          return res.data.runtime;
        })
      : fetchTVDetails(mediaId).then((res) => {
          metaRef.current = { originalLanguage: res.data.original_language || undefined, releaseYear: yearOf(res.data.first_air_date) };
          return res.data.episode_run_time?.[0];
        });
    const providersReq = mediaType === "movie" ? fetchMovieProviders(mediaId) : fetchTVWatchProviders(mediaId);

    Promise.all([fetchRuntime, providersReq])
      .then(([runtime, providersRes]) => {
        if (cancelled) return;
        form.setFieldsValue({ runtimeMinutes: runtime ?? undefined });

        const region = providersRes.data.results?.["US"];
        const names = region
          ? Array.from(new Set(
              [...(region.flatrate ?? []), ...(region.rent ?? []), ...(region.buy ?? [])].map((p) => p.provider_name),
            ))
          : [];
        setOptions(names.map((name) => ({ label: name, value: name })));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [open, mediaId, mediaType, form]);

  const handleOk = () => {
    form.validateFields().then((values) => {
      const resolvedPlatform = values.platform === OTHER_VALUE ? values.otherPlatform?.trim() : values.platform;
      onConfirm({
        runtimeMinutes: values.runtimeMinutes ?? undefined,
        platform: resolvedPlatform || undefined,
        ...metaRef.current,
      });
    });
  };

  return (
    <Modal
      title="Mark as Watched"
      open={open}
      onOk={handleOk}
      onCancel={onCancel}
      okText="Mark Watched"
      confirmLoading={loading}
      destroyOnHidden
    >
      <Spin spinning={loading}>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="runtimeMinutes" label="Runtime (minutes)">
            <InputNumber disabled style={{ width: "100%" }} placeholder={loading ? "Fetching…" : "Not available"} />
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
