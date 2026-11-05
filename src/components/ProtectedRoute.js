import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { PageSkeleton } from "./Skeleton";

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, profile, loading } = useAuth();

  const waiting = loading || (adminOnly && user && !profile);
  if (waiting) {
    return <PageSkeleton />;
  }

  if (!user) return <Navigate to="/" replace />;
  if (adminOnly && profile?.role !== "admin") return <Navigate to="/" replace />;

  return children;
};

export default ProtectedRoute;
