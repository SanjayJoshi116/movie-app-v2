import { useRef, useState, useEffect } from "react";
import { Modal, Form, Input, Button, Divider, Tag, Space, Popconfirm, Tabs, Avatar, theme } from "antd";
import {
  CheckCircleOutlined,
  DownloadOutlined,
  UploadOutlined,
  DeleteOutlined,
  UserOutlined,
  LockOutlined,
  DatabaseOutlined,
} from "@ant-design/icons";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast";
import { useAppContext } from "../context/useAppContext";
import { useListsContext } from "../context/useListsContext";
import CSVUploadModal from "./CSVUploadModal";
import CSVImportAllModal from "./lists/CSVImportAllModal";
import PasswordStrengthMeter from "./PasswordStrengthMeter";
import { InfoTooltip } from "./InfoTooltip";
import { downloadAllAsZip } from "../utils/export";
import { getTMDBAuthStatus, getTMDBRequestToken, disconnectTMDB, uploadAvatar, removeAvatar } from "../api/userApi";
import userApi from "../api/userApi";
import { getApiError } from "../utils/apiError";
import { FONT_SIZE } from "../constants/typography";
import { resolveAvatarUrl } from "../constants/media";

interface Props {
  open: boolean;
  onClose: () => void;
}

const ALLOWED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const ProfileModal = ({ open, onClose }: Props) => {
  const { user, updateProfile, setUserData, logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const { watchlist, watchedList, allRatings } = useAppContext();
  const { lists } = useListsContext();
  const { token } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [importAllOpen, setImportAllOpen] = useState(false);
  const [tmdbConnected, setTmdbConnected] = useState(false);
  const [tmdbLoading, setTmdbLoading] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      getTMDBAuthStatus().then((res) => setTmdbConnected(res.data.connected)).catch(() => {});
    } else {
      // This component stays mounted (only the modal body is destroyed), so
      // password state would otherwise reappear on the next open.
      setDeletePassword("");
      setNewPassword("");
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
    // The backend requires the current password to change the email too (it's
    // where reset links go); the form always resubmits the email, so compare.
    const emailChanged =
      (payload.email ?? "").trim().toLowerCase() !== (user?.email ?? "").toLowerCase();
    if (!payload.new_password) {
      delete payload.new_password;
      if (!emailChanged) delete payload.current_password;
    }
    setLoading(true);
    try {
      await updateProfile(payload);
      showSuccess("Profile updated successfully.");
      onClose();
    } catch (err) {
      showError(getApiError(err, "Failed to update profile."));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await userApi.delete("/auth/delete-account/", { data: { password: deletePassword } });
      showSuccess("Account deleted.");
      onClose();
      logout();
    } catch (err) {
      showError(getApiError(err, "Failed to delete account. Try again."));
      setDeletePassword("");
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

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
      showError("Unsupported image type. Use JPEG, PNG, or WebP.");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      showError("Image must be smaller than 5MB.");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    handleAvatarUpload(file);
  };

  const handleAvatarUpload = async (file: File) => {
    setAvatarLoading(true);
    try {
      const { data } = await uploadAvatar(file);
      setUserData(data);
      showSuccess("Profile photo updated.");
    } catch (err) {
      showError(getApiError(err, "Failed to upload photo."));
    } finally {
      setAvatarLoading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleAvatarRemove = async () => {
    setAvatarLoading(true);
    try {
      const { data } = await removeAvatar();
      setUserData(data);
      showSuccess("Profile photo removed.");
    } catch (err) {
      showError(getApiError(err, "Failed to remove photo."));
    } finally {
      setAvatarLoading(false);
    }
  };

  const sectionHeader = (icon: React.ReactNode, label: string) => (
    <Divider orientation="left" orientationMargin={0} style={{ margin: "0 0 14px" }}>
      <span style={{ fontSize: FONT_SIZE.emphasis, color: token.colorTextSecondary }}>
        {icon} {label}
      </span>
    </Divider>
  );

  const avatarUrl = resolveAvatarUrl(user?.avatar_url);

  const accountTab = (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <Avatar size={72} src={avatarUrl} style={{ backgroundColor: avatarUrl ? undefined : token.colorPrimary, fontSize: FONT_SIZE.display, flexShrink: 0 }}>
          {!avatarUrl && (user?.username?.slice(0, 2).toUpperCase() ?? "")}
        </Avatar>
        <Space direction="vertical" size={4}>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAvatarPick}
            style={{ display: "none" }}
          />
          <Space size={8}>
            <Button size="small" icon={<UploadOutlined />} loading={avatarLoading} onClick={() => avatarInputRef.current?.click()}>
              Upload Photo
            </Button>
            {avatarUrl && (
              <Button size="small" danger icon={<DeleteOutlined />} loading={avatarLoading} onClick={handleAvatarRemove}>
                Remove
              </Button>
            )}
          </Space>
        </Space>
      </div>

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
        {sectionHeader(<UserOutlined />, "Account Info")}

        <div style={{ display: "flex", gap: 10 }}>
          <Form.Item label="First Name" name="first_name" style={{ marginBottom: 12, flex: 1 }}>
            <Input placeholder="First name" />
          </Form.Item>
          <Form.Item label="Last Name" name="last_name" style={{ marginBottom: 12, flex: 1 }}>
            <Input placeholder="Last name" />
          </Form.Item>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <Form.Item
            label="Username"
            name="username"
            rules={[{ required: true, message: "Required." }]}
            style={{ marginBottom: 12, flex: 1 }}
          >
            <Input />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[{ type: "email", message: "Invalid email." }]}
            style={{ marginBottom: 12, flex: 1 }}
          >
            <Input />
          </Form.Item>
        </div>

        {sectionHeader(<LockOutlined />, "Change Password")}

        <Form.Item
          label="Current Password"
          name="current_password"
          extra="Required to change email or password"
          style={{ marginBottom: 12 }}
        >
          <Input.Password placeholder="Leave blank to keep current" />
        </Form.Item>

        <div style={{ display: "flex", gap: 10 }}>
          <Form.Item
            label={
              <span>
                New Password
                <InfoTooltip title="Use at least 8 characters, mixing upper/lowercase, numbers, and symbols for a stronger password." />
              </span>
            }
            name="new_password"
            rules={[
              {
                validator(_, value) {
                  if (!value || value.length >= 8) return Promise.resolve();
                  return Promise.reject(new Error("Min 8 characters."));
                },
              },
            ]}
            style={{ marginBottom: 4, flex: 1 }}
          >
            <Input.Password placeholder="New password" onChange={(e) => setNewPassword(e.target.value)} />
          </Form.Item>
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
            style={{ marginBottom: 4, flex: 1 }}
          >
            <Input.Password placeholder="Confirm" />
          </Form.Item>
        </div>
        <PasswordStrengthMeter password={newPassword} />

        <Form.Item style={{ marginBottom: 0, marginTop: 12 }}>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Save Changes
          </Button>
        </Form.Item>
      </Form>
    </>
  );

  const dataTab = (
    <>
      {sectionHeader(<DatabaseOutlined />, "Data")}
      <Space direction="vertical" style={{ width: "100%" }}>
        <Button block icon={<UploadOutlined />} onClick={() => setCsvOpen(true)}>
          Import Watched from CSV
        </Button>
        <Button block icon={<DownloadOutlined />} onClick={() => downloadAllAsZip(watchlist, watchedList, Object.values(allRatings), lists)}>
          Export All Data (ZIP)
        </Button>
        <Button block icon={<UploadOutlined />} onClick={() => setImportAllOpen(true)}>
          Import All from Backup
        </Button>
      </Space>

      <Divider style={{ margin: "20px 0 12px" }}>TMDB Account</Divider>
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
    </>
  );

  const dangerTab = (
    <>
      <Input.Password
        placeholder="Enter password to confirm"
        value={deletePassword}
        onChange={(e) => setDeletePassword(e.target.value)}
        style={{ marginBottom: 8 }}
      />
      <Popconfirm
        title="Delete your account?"
        description="This permanently deletes your account and all data. This cannot be undone."
        onConfirm={handleDeleteAccount}
        okText="Delete My Account"
        okType="danger"
        cancelText="Cancel"
        disabled={!deletePassword}
      >
        <Button block danger icon={<DeleteOutlined />} loading={deleteLoading} disabled={!deletePassword}>
          Delete Account
        </Button>
      </Popconfirm>
    </>
  );

  return (
    <Modal title="Edit Profile" open={open} onCancel={onClose} footer={null} destroyOnHidden>
      <Tabs
        defaultActiveKey="account"
        items={[
          { key: "account", label: "Account", children: accountTab },
          { key: "data", label: "Data & TMDB", children: dataTab },
          { key: "danger", label: <span style={{ color: token.colorError }}>Danger Zone</span>, children: dangerTab },
        ]}
      />

      <CSVUploadModal open={csvOpen} onClose={() => setCsvOpen(false)} />
      <CSVImportAllModal open={importAllOpen} onClose={() => setImportAllOpen(false)} />
    </Modal>
  );
};

export default ProfileModal;
