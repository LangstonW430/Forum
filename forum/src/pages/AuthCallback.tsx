import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const code = searchParams.get("code");
    const type = searchParams.get("type") || hashParams.get("type");

    if (code) {
      // PKCE flow
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          setError("Verification failed. The link may have expired.");
        } else if (type === "recovery") {
          navigate("/reset-password");
        } else {
          navigate("/");
        }
      });
    } else if (hashParams.get("access_token")) {
      // Implicit flow — Supabase picks up the session from the hash automatically
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
        subscription.unsubscribe();
        if (event === "PASSWORD_RECOVERY" || type === "recovery") {
          navigate("/reset-password");
        } else {
          navigate("/");
        }
      });
      return () => subscription.unsubscribe();
    } else {
      navigate("/");
    }
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
