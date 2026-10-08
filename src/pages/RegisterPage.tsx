import { useRef, useState } from "react";
import { Form, Input, Button, Typography, Card, App } from "antd";
import { useNavigate, Link } from "react-router-dom";
import { isAxiosError } from "axios";
import { useAuth } from "../context/AuthContext";
import { getApiError } from "../utils/apiError";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  // The ref closes the gap before the disabled state renders (a fast double
  // Enter): a second POST would report "username exists" over a good signup.
  const submitting = useRef(false);

  const onFinish = async (values: { username: string; email: string; password: string; confirmPassword: string }) => {
    if (submitting.current) return;
    submitting.current = true;
    setLoading(true);
    try {
      await register(values.username, values.email, values.password);
      navigate("/movies", { replace: true });
    } catch (err: unknown) {
      const detail = isAxiosError(err) ? err.response?.data : undefined;
      const msg =
        detail && typeof detail === "object"
          ? Object.values(detail).flat().join(" ")
          : getApiError(err, "Registration failed.");
      message.error(msg);
    } finally {
      submitting.current = false;
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh", padding: "0 16px" }}>
      <Card style={{ width: "100%", maxWidth: 360 }}>
        <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 24 }}>
          Create Account
        </Typography.Title>
        <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item name="username" label="Username" rules={[{ required: true, message: "Enter a username" }]}>
            <Input size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: "email", message: "Enter a valid email" }]}>
            <Input size="large" autoComplete="email" />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, min: 8, message: "At least 8 characters" }]}
          >
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading} disabled={loading}>
              Register
            </Button>
          </Form.Item>
        </Form>
        <Typography.Text type="secondary" style={{ display: "block", textAlign: "center" }}>
          Already have an account?{" "}
          <Link to="/login">Sign In</Link>
        </Typography.Text>
      </Card>
    </div>
  );
}
