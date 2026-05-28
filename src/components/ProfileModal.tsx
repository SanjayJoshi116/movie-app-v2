import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, Divider, Tag, Space } from "antd";
import { CheckCircleOutlined, DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast";
import { useAppContext } from "../context/useAppContext";
import { useListsContext } from "../context/useListsContext";
import CSVUploadModal from "./CSVUploadModal";
import CSVImportAllModal from "./lists/CSVImportAllModal";
import { downloadAllAsZip } from "../utils/export";
import { getTMDBAuthStatus, getTMDBRequestToken, disconnectTMDB } from "../api/userApi";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ProfileModal = ({ open, onClose }: Props) => {
  const { user, updateProfile } = useAuth();
  const { showSuccess, showError } = useToast();
  const { watchlist, watchedList } = useAppContext();
  const { lists } = useListsContext();
  const [loading, setLoading] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [importAllOpen, setImportAllOpen] = useState(false);

  const handleExportAll = () => {
    downloadAllAsZip(watchlist, watchedList, lists);
  };
  const [tmdbConnected, setTmdbConnected] = useState(false);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      getTMDBAuthStatus().then((res) => setTmdbConnected(res.data.connected)).catch(() => {});
    }
  }, [open]);

  const handleSubmit = async (values: {
    first_name: string;
    last_name: string;
    username: string;
    email: string;
    current_password?: string;
    new_password?: string;
    confirm_password?: string;
  }) => {
    const { confirm_password, ...payload } = values;
    // Strip empty password fields
    if (!payload.new_password) {
      delete payload.current_password;
      delete payload.new_password;
    }
    setLoading(true);
    try {
      await updateProfile(payload);
      showSuccess("Profile updated successfully.");
      onClose();
    } catch (err: any) {
      const detail =
        err?.response?.data?.current_password?.[0] ||
        err?.response?.data?.username?.[0] ||
        err?.response?.data?.detail ||
        "Failed to update profile.";
      showError(detail);
    } finally {
      setLoading(false);
    }
  };

  const handleConnectTMDB = async () => {
    setTmdbLoading(true);
    try {
      const res = await getTMDBRequestToken(window.location.origin + "/tmdb-callback");
      window.location.href = res.data.redirect_url;
    } catch {
      showError("Could not connect to TMDB. Try again.");
      setTmdbLoading(false);
    }
  };

  const handleDisconnectTMDB = async () => {
    setTmdbLoading(true);
    try {
      await disconnectTMDB();
      setTmdbConnected(false);
      showSuccess("TMDB account disconnected.");
    } catch {
      showError("Failed to disconnect.");
    } finally {
      setTmdbLoading(false);
    }
  };

  return (
    <Modal
      title="Edit Profile"
      open={open}
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          first_name: user?.first_name ?? "",
          last_name: user?.last_name ?? "",
          username: user?.username ?? "",
          email: user?.email ?? "",
        }}
        onFinish={handleSubmit}
      >
        <div style={{ display: "flex", gap: 12 }}>
          <Form.Item label="First Name" name="first_name" style={{ flex: 1, marginBottom: 12 }}>
            <Input placeholder="First name" />
          </Form.Item>
          <Form.Item label="Last Name" name="last_name" style={{ flex: 1, marginBottom: 12 }}>
            <Input placeholder="Last name" />
          </Form.Item>
        </div>
        <Form.Item
          label="Username"
          name="username"
          rules={[{ required: true, message: "Username is required." }]}
          style={{ marginBottom: 12 }}
        >
          <Input />
        </Form.Item>
        <Form.Item
          label="Email"
          name="email"
          rules={[{ type: "email", message: "Enter a valid email." }]}
          style={{ marginBottom: 12 }}
        >
          <Input />
        </Form.Item>

        <Divider style={{ margin: "8px 0 16px" }}>Change Password</Divider>

        <Form.Item label="Current Password" name="current_password" style={{ marginBottom: 12 }}>
          <Input.Password placeholder="Leave blank to keep current" />
        </Form.Item>
        <Form.Item
          label="New Password"
          name="new_password"
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || value.length >= 6) return Promise.resolve();
                return Promise.reject(new Error("Password must be at least 6 characters."));
              },
            }),
          ]}
          style={{ marginBottom: 12 }}
        >
          <Input.Password placeholder="New password" />
        </Form.Item>
        <Form.Item
          label="Confirm New Password"
          name="confirm_password"
          dependencies={["new_password"]}
          rules={[
            ({ getFieldValue }) => ({
              validator(_, value) {
                const np = getFieldValue("new_password");
                if (!np || np === value) return Promise.resolve();
                return Promise.reject(new Error("Passwords do not match."));
              },
            }),
          ]}
          style={{ marginBottom: 20 }}
        >
          <Input.Password placeholder="Confirm new password" />
        </Form.Item>

        <Form.Item style={{ marginBottom: 0 }}>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Save Changes
          </Button>
        </Form.Item>
      </Form>

      <Divider style={{ margin: "16px 0 12px" }}>Data</Divider>
      <Space direction="vertical" style={{ width: "100%" }}>
        <Button block icon={<UploadOutlined />} onClick={() => setCsvOpen(true)}>
          Import Watched from CSV
        </Button>
        <Button block icon={<DownloadOutlined />} onClick={handleExportAll}>
          Export All Data (ZIP)
        </Button>
        <Button block icon={<UploadOutlined />} onClick={() => setImportAllOpen(true)}>
          Import All Data from Backup
        </Button>
      </Space>

      <Divider style={{ margin: "16px 0 12px" }}>TMDB Account</Divider>
      {tmdbConnected ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Tag icon={<CheckCircleOutlined />} color="success" style={{ margin: 0 }}>
            Connected
          </Tag>
          <Button size="small" danger loading={tmdbLoading} onClick={handleDisconnectTMDB}>
            Disconnect
          </Button>
        </div>
      ) : (
        <Button block loading={tmdbLoading} onClick={handleConnectTMDB}>
          Connect TMDB Account
        </Button>
      )}

      <CSVUploadModal open={csvOpen} onClose={() => setCsvOpen(false)} />
      <CSVImportAllModal open={importAllOpen} onClose={() => setImportAllOpen(false)} />
    </Modal>
  );
};

export default ProfileModal;
