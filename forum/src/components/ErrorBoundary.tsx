import React from "react";

type FallbackRender = (error: Error, reset: () => void) => React.ReactNode;

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode | FallbackRender;
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught:", error, errorInfo);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null });
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        return (fallback as FallbackRender)(this.state.error, this.reset);
      }
      if (fallback) {
        return fallback;
      }
      return (
        <div className="empty-state">
          <h3>Something went wrong</h3>
          <p>Please refresh the page.</p>
          <button className="btn btn-primary" onClick={this.reset}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
