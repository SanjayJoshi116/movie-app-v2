import React, { useState } from "react";
import { Form, Input, Button, Typography, Card, App } from "antd";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../api/userApi";

export default function ForgotPasswordPage() {
  const { message } = App.useApp();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string }) => {
    setLoading(true);
    try {
      await requestPasswordReset(values.email.trim());
      setSent(true);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: unknown; status?: number } })?.response;
      if (!response) {
        message.error("Cannot reach the server. Make sure the backend is running.");
      } else {
        message.error("Something went wrong. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <Card style={{ width: 360 }}>
        {sent ? (
          <>
            <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 8 }}>
              Check Your Inbox
            </Typography.Title>
            <Typography.Paragraph style={{ textAlign: "center", marginTop: 16 }}>
              If that email is registered, a reset link has been sent. Check your inbox and follow the link.
            </Typography.Paragraph>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <Link to="/login">Back to Sign In</Link>
            </div>
          </>
        ) : (
          <>
            <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 8 }}>
              Forgot Password
            </Typography.Title>
            <Typography.Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
              Enter your account email to receive a password reset link.
            </Typography.Text>
            <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: "Enter your email" },
                  { type: "email", message: "Enter a valid email" },
                ]}
              >
                <Input size="large" autoComplete="email" placeholder="you@example.com" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                  Send Reset Link
                </Button>
              </Form.Item>
            </Form>
            <Typography.Text type="secondary" style={{ display: "block", textAlign: "center" }}>
              <Link to="/login">Back to Sign In</Link>
            </Typography.Text>
          </>
        )}
      </Card>
    </div>
  );
}
