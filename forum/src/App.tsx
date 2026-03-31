import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import PostDetailPage from "./pages/PostDetailPage";
import NewPostPage from "./pages/NewPostPage";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProfilePage from "./pages/ProfilePage";
import UserProfilePage from "./pages/UserProfilePage";
import AuthCallback from "./pages/AuthCallback";
import ProtectedRoute from "./components/ProtectedRoute";
import { Analytics } from "@vercel/analytics/react";
import "./App.css";

function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="app-container">
          <Navbar />
          <main className="main-content">
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
              <Route path="/user/:username" element={<UserProfilePage />} />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfilePage />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </Router>
      <Analytics />
    </ThemeProvider>
  );
}

export default App;
