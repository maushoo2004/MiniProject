import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { supabase } from "./lib/supabase";
import Home from "./components/Home";
import BlogPost from "./components/BlogPost";
import CreateBlogPost from "./components/CreateBlogPost";
import Analytics from "./components/Analytics";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./components/Auth";
import Toast from "./components/Toast";
import "./App.css";
import Logo from "./assets/logo.png";

function AppContent() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const { user, signOut, getUserProfile } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const showToast = React.useCallback(
    (message, type = "info", duration = 4000) => {
      setToast({ message, type, duration });
      // Don't set timeout here - let the Toast component handle it via onClose
    },
    []
  );

  const fetchPosts = React.useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("posts")
        .select(
          `
          *,
          profiles:author_id (
            id,
            name,
            email
          )
        `
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform data to match expected format
      const transformedPosts = data.map((post) => ({
        id: post.id,
        title: post.title,
        content: post.content,
        excerpt: post.excerpt || post.content.substring(0, 150) + "...",
        author: post.profiles?.name || "Unknown",
        authorId: post.author_id,
        date: post.created_at.split("T")[0],
        created_at: post.created_at,
      }));

      setBlogs(transformedPosts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      showToast("Error loading posts", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Fetch posts from Supabase
  useEffect(() => {
    fetchPosts();

    // Subscribe to post changes
    const channel = supabase
      .channel("posts_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  React.useEffect(() => {
    if (user) {
      getUserProfile().then((profile) => setUserProfile(profile));
    } else {
      setUserProfile(null);
    }
  }, [user, getUserProfile]);

  const handleAddPost = () => {
    // Refresh posts after adding
    fetchPosts();
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      showToast("Error signing out. Please try again.", "error");
    } else {
      showToast("Signed out successfully", "success");
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div className="container">
          <div className="header-content-wrapper">
            <div className="logo-section">
              <h1 className="logo-title">
                <span className="logo-icon">
                  <img
                    src={Logo}
                    alt="BlogX Logo"
                    style={{
                      transform: "scale(1.5)",
                      transformOrigin: "center center",
                    }}
                  />
                </span>
              </h1>
              <p>Share your thoughts with the world</p>
            </div>
            <div className="auth-buttons">
              {user ? (
                <div className="user-info">
                  <span className="user-name">
                    {userProfile?.name || user.email}
                  </span>
                  <button
                    className="analytics-button"
                    onClick={() => navigate("/analytics")}
                    title="View your analytics dashboard"
                  >
                    📊 Analytics
                  </button>
                  <button className="logout-button" onClick={handleSignOut}>
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  className="login-button"
                  onClick={() => setShowAuth(true)}
                >
                  Login / Sign Up
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              <Home
                blogs={blogs}
                loading={loading}
                showToast={showToast}
                user={user}
                onAuthClick={() => setShowAuth(true)}
              />
            }
          />
          <Route
            path="/create"
            element={
              <ProtectedRoute>
                <CreateBlogPost
                  onAddPost={handleAddPost}
                  showToast={showToast}
                  user={user}
                  userProfile={userProfile}
                />
              </ProtectedRoute>
            }
          />
          <Route
            path="/post/:id"
            element={<BlogPost showToast={showToast} user={user} />}
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics user={user} showToast={showToast} />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
      {showAuth && <Auth onClose={() => setShowAuth(false)} />}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
