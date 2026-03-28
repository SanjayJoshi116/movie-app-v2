import React from "react";
import { Form, Input, Button, Typography, Card, App } from "antd";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();

  const onFinish = async (values: { username: string; email: string; password: string }) => {
    try {
      await register(values.username, values.email, values.password);
      navigate("/movies", { replace: true });
    } catch (err: any) {
      const detail = err?.response?.data;
      const msg =
        typeof detail === "object"
          ? Object.values(detail).flat().join(" ")
          : "Registration failed.";
      message.error(msg);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "80vh" }}>
      <Card style={{ width: 360 }}>
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
            rules={[{ required: true, min: 6, message: "At least 6 characters" }]}
          >
            <Input.Password size="large" autoComplete="new-password" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block size="large">
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
