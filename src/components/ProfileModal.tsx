import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Button, Divider, Tag, Space, Popconfirm, Row, Col } from "antd";
import { CheckCircleOutlined, DownloadOutlined, UploadOutlined, DeleteOutlined, UserOutlined, LockOutlined, DatabaseOutlined } from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast";
import { useAppContext } from "../context/useAppContext";
import { useListsContext } from "../context/useListsContext";
import CSVUploadModal from "./CSVUploadModal";
import CSVImportAllModal from "./lists/CSVImportAllModal";
import { downloadAllAsZip } from "../utils/export";
import { getTMDBAuthStatus, getTMDBRequestToken, disconnectTMDB } from "../api/userApi";
import userApi from "../api/userApi";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ProfileModal = ({ open, onClose }: Props) => {
  const { user, updateProfile, logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const { watchlist, watchedList } = useAppContext();
  const { lists } = useListsContext();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [importAllOpen, setImportAllOpen] = useState(false);
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

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await userApi.delete("/auth/delete-account/");
      showSuccess("Account deleted.");
      onClose();
      logout();
    } catch {
      showError("Failed to delete account. Try again.");
    } finally {
      setDeleteLoading(false);
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
      width={760}
    >
      <Row gutter={24} align="top">
        {/* Left column — account form */}
        <Col xs={24} sm={14} style={{ borderRight: "1px solid #303030", paddingRight: 24 }}>
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
            <Divider orientation="left" orientationMargin={0} style={{ margin: "0 0 14px" }}>
              <span style={{ fontSize: 13, color: "#aaa" }}><UserOutlined /> Account Info</span>
            </Divider>

            <Row gutter={10}>
              <Col span={12}>
                <Form.Item label="First Name" name="first_name" style={{ marginBottom: 12 }}>
                  <Input placeholder="First name" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="Last Name" name="last_name" style={{ marginBottom: 12 }}>
                  <Input placeholder="Last name" />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={10}>
              <Col span={12}>
                <Form.Item
                  label="Username"
                  name="username"
                  rules={[{ required: true, message: "Required." }]}
                  style={{ marginBottom: 12 }}
                >
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Email"
                  name="email"
                  rules={[{ type: "email", message: "Invalid email." }]}
                  style={{ marginBottom: 12 }}
                >
                  <Input />
                </Form.Item>
              </Col>
            </Row>

            <Divider orientation="left" orientationMargin={0} style={{ margin: "4px 0 14px" }}>
              <span style={{ fontSize: 13, color: "#aaa" }}><LockOutlined /> Change Password</span>
            </Divider>

            <Form.Item label="Current Password" name="current_password" style={{ marginBottom: 12 }}>
              <Input.Password placeholder="Leave blank to keep current" />
            </Form.Item>

            <Row gutter={10}>
              <Col span={12}>
                <Form.Item
                  label="New Password"
                  name="new_password"
                  rules={[
                    ({ getFieldValue }) => ({
                      validator(_, value) {
                        if (!value || value.length >= 6) return Promise.resolve();
                        return Promise.reject(new Error("Min 6 characters."));
                      },
                    }),
                  ]}
                  style={{ marginBottom: 16 }}
                >
                  <Input.Password placeholder="New password" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="Confirm Password"
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
                  style={{ marginBottom: 16 }}
                >
                  <Input.Password placeholder="Confirm" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={loading} block>
                Save Changes
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ margin: "16px 0 12px" }}>Danger Zone</Divider>
          <Popconfirm
            title="Delete your account?"
            description="This permanently deletes your account and all data. This cannot be undone."
            onConfirm={handleDeleteAccount}
            okText="Delete My Account"
            okType="danger"
            cancelText="Cancel"
          >
            <Button block danger icon={<DeleteOutlined />} loading={deleteLoading}>
              Delete Account
            </Button>
          </Popconfirm>
        </Col>

        {/* Right column — data & TMDB */}
        <Col xs={24} sm={10}>
          <Divider orientation="left" orientationMargin={0} style={{ margin: "0 0 14px" }}>
            <span style={{ fontSize: 13, color: "#aaa" }}><DatabaseOutlined /> Data</span>
          </Divider>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Button block icon={<UploadOutlined />} onClick={() => setCsvOpen(true)}>
              Import Watched from CSV
            </Button>
            <Button block icon={<DownloadOutlined />} onClick={() => downloadAllAsZip(watchlist, watchedList, lists)}>
              Export All Data (ZIP)
            </Button>
            <Button block icon={<UploadOutlined />} onClick={() => setImportAllOpen(true)}>
              Import All from Backup
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
        </Col>
      </Row>

      <CSVUploadModal open={csvOpen} onClose={() => setCsvOpen(false)} />
      <CSVImportAllModal open={importAllOpen} onClose={() => setImportAllOpen(false)} />
    </Modal>
  );
};

export default ProfileModal;
