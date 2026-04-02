import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      navigate("/forgot-password");
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError("Reset link is invalid or has expired.");
      } else {
        navigate("/reset-password");
      }
    });
  }, [navigate]);

  if (error) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 className="auth-title">Link Expired</h1>
          <p className="auth-subtitle">{error}</p>
        </div>
      </div>
    );
  }

  return <div className="loading">Verifying reset link...</div>;
}
