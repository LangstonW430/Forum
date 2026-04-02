import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const type = params.get("type");

    if (!code) {
      navigate("/");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError("Verification failed. The link may have expired.");
      } else if (type === "recovery") {
        navigate("/reset-password");
      } else {
        navigate("/");
      }
    });
  }, [navigate]);

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Verification Failed</h1>
          <p className="auth-subtitle">{error}</p>
        </div>
      </div>
    );
  }

  return <div className="loading">Verifying your account...</div>;
}
