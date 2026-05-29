import React from "react";
import { Form, Input, Button, Typography, Card, Tooltip } from "antd";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();
  const [loading, setLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname ?? "/movies";

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      await login(values.username, values.password);
      navigate(from, { replace: true });
    } catch {
      form.resetFields();
      setErrorMsg("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: "center", marginBottom: 24 }}>
          Sign In
        </Typography.Title>
        <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false} onValuesChange={() => setErrorMsg("")}>
          <Form.Item name="username" label="Username" rules={[{ required: true, message: "Enter your username" }]}>
            <Input size="large" autoComplete="username" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: "Enter your password" }]}>
            <Input.Password size="large" autoComplete="current-password" />
          </Form.Item>
          <Form.Item>
            <Tooltip title={errorMsg} open={!!errorMsg} color="red" placement="bottom">
              <Button type="primary" htmlType="submit" block size="large" loading={loading}>
                Sign In
              </Button>
            </Tooltip>
          </Form.Item>
        </Form>
        <Typography.Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 8 }}>
          <Link to="/forgot-password">Forgot password?</Link>
        </Typography.Text>
        <Typography.Text type="secondary" style={{ display: "block", textAlign: "center" }}>
          No account?{" "}
          <Link to="/register">Register</Link>
        </Typography.Text>
      </Card>
    </div>
  );
}
