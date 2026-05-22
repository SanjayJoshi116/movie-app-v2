import React, { useState } from "react";
import { Form, Input, Button, Typography, Card, App } from "antd";
import { Link, useNavigate } from "react-router-dom";
import { requestPasswordReset, resetPasswordByUsername } from "../api/userApi";

type Step = "identifier" | "set-password" | "email-sent";

export default function ForgotPasswordPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("identifier");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  const onIdentifierSubmit = async (values: { identifier: string }) => {
    const id = values.identifier.trim();
    if (id.includes("@")) {
      // Email path — send reset link
      setLoading(true);
      try {
        await requestPasswordReset(id);
        setStep("email-sent");
      } catch (err: unknown) {
        console.error("[reset-request]", err);
        const response = (err as { response?: { data?: unknown; status?: number } })?.response;
        if (!response) {
          message.error("Cannot reach the server. Make sure the backend is running.");
        } else {
          message.error("Something went wrong. Please try again.");
        }
      } finally {
        setLoading(false);
      }
    } else {
      // Username path — go straight to set-password step
      setUsername(id);
      setStep("set-password");
    }
  };

  const onSetPasswordSubmit = async (values: { new_password: string }) => {
    setLoading(true);
    try {
      await resetPasswordByUsername(username, values.new_password);
      message.success("Password reset successfully. You can now sign in.");
      navigate("/login", { replace: true });
    } catch (err: unknown) {
      console.error("[reset-password]", err);
      const response = (err as { response?: { data?: unknown; status?: number } })?.response;
      if (!response) {
        message.error("Cannot reach the server. Make sure the backend is running.");
        return;
      }
      const data = response.data;
      const detail =
        typeof data === "object" && data !== null && "detail" in data
          ? String((data as { detail: unknown }).detail)
          : typeof data === "object" && data !== null && "error" in data
            ? String((data as { error: unknown }).error)
            : `Server error (${response.status}).`;
      message.error(detail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <Card style={{ width: 360 }}>

        {/* Step 1: Enter username or email */}
        {step === "identifier" && (
          <>
            <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 8 }}>
              Forgot Password
            </Typography.Title>
            <Typography.Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
              Enter your username to reset directly, or your email to receive a reset link.
            </Typography.Text>
            <Form layout="vertical" onFinish={onIdentifierSubmit} requiredMark={false}>
              <Form.Item
                name="identifier"
                label="Username or Email"
                rules={[{ required: true, message: "Enter your username or email" }]}
              >
                <Input size="large" autoComplete="username" placeholder="e.g. john or john@email.com" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                  Continue
                </Button>
              </Form.Item>
            </Form>
            <Typography.Text type="secondary" style={{ display: "block", textAlign: "center" }}>
              <Link to="/login">Back to Sign In</Link>
            </Typography.Text>
          </>
        )}

        {/* Step 2 (username path): Set new password */}
        {step === "set-password" && (
          <>
            <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 4 }}>
              Set New Password
            </Typography.Title>
            <Typography.Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 24 }}>
              Resetting password for <strong>{username}</strong>
            </Typography.Text>
            <Form layout="vertical" onFinish={onSetPasswordSubmit} requiredMark={false}>
              <Form.Item
                name="new_password"
                label="New Password"
                rules={[
                  { required: true, message: "Enter a new password" },
                  { min: 6, message: "Password must be at least 6 characters" },
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
            <Typography.Text type="secondary" style={{ display: "block", textAlign: "center" }}>
              <span
                style={{ cursor: "pointer", color: "inherit", textDecoration: "underline" }}
                onClick={() => setStep("identifier")}
              >
                Go back
              </span>
            </Typography.Text>
          </>
        )}

        {/* Email sent confirmation */}
        {step === "email-sent" && (
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
        )}

      </Card>
    </div>
  );
}
