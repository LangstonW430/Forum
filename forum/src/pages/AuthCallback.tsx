import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");

    if (!code) {
      navigate("/");
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        subscription.unsubscribe();
        navigate("/reset-password");
      } else if (event === "SIGNED_IN") {
        subscription.unsubscribe();
        navigate("/");
      }
    });

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        subscription.unsubscribe();
        setError("Verification failed. The link may have expired.");
      }
    });

    return () => subscription.unsubscribe();
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
