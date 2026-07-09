import { useEffect, useState } from "react";
import { Modal, Form, InputNumber, Select, Input, Spin } from "antd";
import { fetchMovieDetails, fetchTVDetails, fetchMovieProviders, fetchTVWatchProviders } from "../api/tmdb";
import type { MediaType } from "../types";

const OTHER_VALUE = "__other__";

interface Props {
  open: boolean;
  mediaId: number;
  mediaType: MediaType;
  onCancel: () => void;
  onConfirm: (details: { runtimeMinutes?: number; platform?: string }) => void;
}

export function MarkWatchedModal({ open, mediaId, mediaType, onCancel, onConfirm }: Props) {
  const [form] = Form.useForm();
  const [platform, setPlatform] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setPlatform(undefined);
    setOptions([]);
    form.resetFields();

    const fetchRuntime = mediaType === "movie"
      ? fetchMovieDetails(mediaId).then((res) => res.data.runtime)
      : fetchTVDetails(mediaId).then((res) => res.data.episode_run_time?.[0]);
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
