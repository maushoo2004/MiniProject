import React, { useCallback, useEffect, useState } from "react";
import { BrowserRouter as Router, Routes, Route, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { supabase, isSupabaseConfigured, mapPost, POST_SELECT } from "./lib/supabase";
import Home from "./components/Home";
import BlogPost from "./components/BlogPost";
import CreateBlogPost from "./components/CreateBlogPost";
import Analytics from "./components/Analytics";
import Admin from "./components/Admin";
import ProtectedRoute from "./components/ProtectedRoute";
import Auth from "./components/Auth";
import Toast from "./components/Toast";
import SetupNotice from "./components/SetupNotice";
import Lab from "./components/Lab";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import NotFound from "./components/NotFound";
import "./App.css";

function AppContent() {
  const navigate = useNavigate();
  const [toast, setToast] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const { user, signOut } = useAuth();
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const showToast = useCallback((message, type = "info", duration = 4000) => {
    setToast({ message, type, duration, key: Date.now() });
  }, []);
  const closeToast = useCallback(() => setToast(null), []);

  const fetchPosts = useCallback(async () => {
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
      showToast("Error loading posts", "error");
    } else {
      setBlogs(data.map(mapPost));
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchPosts();
    const channel = supabase
      .channel("posts_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => fetchPosts())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPosts]);

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) showToast("Error signing out. Please try again.", "error");
    else {
      showToast("Signed out successfully", "success");
      navigate("/");
    }
  };

  return (
    <div className="App">
      <Navbar onAuthClick={() => setShowAuth(true)} onSignOut={handleSignOut} />

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
          <Route path="/lab" element={<Lab />} />
          <Route
            path="/create"
            element={
              <ProtectedRoute>
                <CreateBlogPost onAddPost={fetchPosts} showToast={showToast} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute>
                <CreateBlogPost onAddPost={fetchPosts} showToast={showToast} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/post/:id"
            element={
              <BlogPost
                showToast={showToast}
                user={user}
                onAuthClick={() => setShowAuth(true)}
                onPostDeleted={fetchPosts}
              />
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics user={user} showToast={showToast} />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <Admin showToast={showToast} />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />

      {showAuth &&<Auth onClose={() => setShowAuth(false)} />}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={closeToast}
        />
      )}
    </div>
  );
}

function App() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
