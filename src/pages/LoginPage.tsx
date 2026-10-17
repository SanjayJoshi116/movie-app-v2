import React from "react";
import { Form, Input, Button, Typography, App } from "antd";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { AxiosError } from "axios";
import { useAuth } from "../context/AuthContext";
import { postLoginPath } from "../utils/postLoginPath";
import { CONNECTION_ERROR } from "../utils/apiError";
import { usePageTitle } from "../hooks/usePageTitle";
import { AuthStage } from "../components/AuthStage";

export default function LoginPage() {
  usePageTitle("Sign In");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const from = postLoginPath(location.state);
  // Focus after the failed attempt's re-render has re-enabled the field: a
  // timeout could run before that commit, and a disabled input ignores focus().
  const refocusPassword = React.useRef(false);
  React.useEffect(() => {
    if (!loading && refocusPassword.current) {
      refocusPassword.current = false;
      form.getFieldInstance("password")?.focus();
    }
  }, [loading, form]);

  const onFinish = async (values: { username: string; password: string }) => {
    const username = values.username.trim();
    setLoading(true);
    try {
      await login(username, values.password);
      navigate(from, { replace: true });
    } catch (err) {
      const status = (err as AxiosError).response?.status;
      form.setFieldsValue({ username, password: "" });
      if (status === 429) {
        message.error("Too many login attempts. Please wait a moment and try again.");
      } else if (status === 400 || status === 401) {
        message.error("Invalid username or password.");
      } else {
        message.error(CONNECTION_ERROR);
      }
      refocusPassword.current = true;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthStage title="Sign In">
      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
        <Form.Item name="username" label="Username" rules={[{ required: true, message: "Enter your username" }]}>
          <Input size="large" autoComplete="username" autoFocus disabled={loading} />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, message: "Enter your password" }]}>
          <Input.Password size="large" autoComplete="current-password" disabled={loading} />
        </Form.Item>
        <Form.Item>
          {/* disabled as well as loading: login-page spec locks the button, and
              antd's loading state alone isn't exposed as disabled. */}
          <Button type="primary" htmlType="submit" block size="large" loading={loading} disabled={loading}>
            Sign In
          </Button>
        </Form.Item>
      </Form>
      <Typography.Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 8 }}>
        <Link to="/forgot-password">Forgot password?</Link>
      </Typography.Text>
      <Typography.Text type="secondary" style={{ display: "block", textAlign: "center" }}>
        No account?{" "}
        <Link to="/register">Register</Link>
      </Typography.Text>
    </AuthStage>
  );
}
