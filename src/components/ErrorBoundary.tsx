import React, { Component, ReactNode } from "react";
import { Result, Button, Typography } from "antd";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <DefaultErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}

function DefaultErrorFallback({ error }: { error: Error | null }) {
  const isDev = process.env.NODE_ENV === "development";
  return (
    <Result
      status="error"
      title="Something went wrong"
      subTitle="We could not load this section. Try refreshing the page."
      extra={
        <Button type="primary" onClick={() => window.location.reload()}>
          Refresh
        </Button>
      }
    >
      {isDev && error && (
        <Typography.Text code style={{ display: "block", marginTop: 12 }}>
          {error.message}
        </Typography.Text>
      )}
    </Result>
  );
}

export default ErrorBoundary;
