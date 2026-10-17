import { useState } from "react";
import { Form, Input, Button, Typography, App } from "antd";
import { Link } from "react-router-dom";
import { requestPasswordReset } from "../api/userApi";
import { getApiError } from "../utils/apiError";
import { usePageTitle } from "../hooks/usePageTitle";
import { AuthStage } from "../components/AuthStage";

export default function ForgotPasswordPage() {
  usePageTitle("Forgot Password");
  const { message } = App.useApp();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { email: string }) => {
    setLoading(true);
    try {
      await requestPasswordReset(values.email.trim());
      setSent(true);
    } catch (err: unknown) {
      message.error(getApiError(err, "Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthStage title={sent ? "Check Your Inbox" : "Forgot Password"}>
      {sent ? (
        <>
          <Typography.Paragraph>
            If that email is registered, a reset link has been sent. Check your inbox and follow the link.
          </Typography.Paragraph>
          <Typography.Text style={{ display: "block", textAlign: "center" }}>
            <Link to="/login">Back to Sign In</Link>
          </Typography.Text>
        </>
      ) : (
        <>
          <Typography.Paragraph type="secondary">
            Enter your account email to receive a password reset link.
          </Typography.Paragraph>
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
    </AuthStage>
  );
}
