import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { UserProvider } from "./contexts/UserContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import PostDetailPage from "./pages/PostDetailPage";
import NewPostPage from "./pages/NewPostPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ResetCallback from "./pages/ResetCallback";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import NotificationsPage from "./pages/NotificationsPage";
import MessagesPage from "./pages/MessagesPage";
import ConversationPage from "./pages/ConversationPage";
import AuthCallback from "./pages/AuthCallback";
import ProtectedRoute from "./components/ProtectedRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import ErrorPage from "./pages/ErrorPage";
import { Analytics } from "@vercel/analytics/react";
import "./App.css";

function AppRoutes() {
  const location = useLocation();
  return (
    <ErrorBoundary
      resetKey={location.pathname}
      fallback={(error, reset) => <ErrorPage error={error} onReset={reset} />}
    >
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/post/:id" element={<PostDetailPage />} />
        <Route
          path="/new-post"
          element={
            <ProtectedRoute>
              <NewPostPage />
            </ProtectedRoute>
          }
        />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/reset-callback" element={<ResetCallback />} />
        <Route path="/user/:username" element={<UserProfilePage />} />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <ProtectedRoute>
              <MessagesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/messages/:id"
          element={
            <ProtectedRoute>
              <ConversationPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <UserProvider>
          <NotificationProvider>
          <Router>
            <div className="app-container">
              <Navbar />
              <main className="main-content">
                <AppRoutes />
              </main>
            </div>
            <Analytics />
          </Router>
          </NotificationProvider>
        </UserProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
