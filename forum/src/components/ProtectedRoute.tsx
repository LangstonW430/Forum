import { Navigate } from "react-router-dom";
import { useCurrentUser } from "../contexts/UserContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useCurrentUser();

  if (loading) return <div>Loading...</div>;

  return user ? <>{children}</> : <Navigate to="/login" />;
}
