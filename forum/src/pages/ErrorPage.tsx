import { useNavigate } from "react-router-dom";

interface Props {
  error?: Error;
  onReset?: () => void;
}

export default function ErrorPage({ error, onReset }: Props) {
  const navigate = useNavigate();

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1 className="auth-title">Something went wrong</h1>
        <p className="auth-subtitle">
          An unexpected error occurred. Try going back or refreshing the page.
        </p>
        {error && (
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.5rem", fontFamily: "monospace" }}>
            {error.message}
          </p>
        )}
        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", marginTop: "1.5rem" }}>
          <button className="btn btn-secondary" onClick={() => navigate(-1)}>
            Go Back
          </button>
          {onReset ? (
            <button className="btn btn-primary" onClick={onReset}>
              Try Again
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => window.location.reload()}>
              Refresh
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
