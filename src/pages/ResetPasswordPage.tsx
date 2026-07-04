import { useState } from "react";
import { Form, Input, Button, Typography, Card, App } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { confirmPasswordReset } from "../api/userApi";

export default function ResetPasswordPage() {
  const { uid, token } = useParams<{ uid: string; token: string }>();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { new_password: string; confirm_password: string }) => {
    if (!uid || !token) {
      message.error("Invalid reset link.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(uid, token, values.new_password);
      message.success("Password reset successfully. You can now sign in.");
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      const data = (err as { response?: { data?: unknown } })?.response?.data;
      const detail =
        (typeof data === "object" && data !== null && "detail" in data)
          ? String((data as { detail: unknown }).detail)
          : "Invalid or expired reset link.";
      message.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 24 }}>
          Reset Password
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="new_password"
            label="New Password"
            rules={[
              { required: true, message: "Enter a new password" },
              { min: 8, message: "Password must be at least 8 characters" },
            ]}
          >
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm_password"
            label="Confirm Password"
            dependencies={["new_password"]}
            rules={[
              { required: true, message: "Confirm your password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("new_password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("Passwords do not match."));
                },
              }),
            ]}
          >
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Reset Password
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
