import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { BLOCK_THRESHOLD } from "../lib/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return null;
    }
    // email is intentionally not selectable by clients — use user.email instead
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, report_count, role, created_at")
      .eq("id", userId)
      .maybeSingle();
    if (error) console.error("Error fetching profile:", error);
    setProfile(data || null);
    return data;
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      loadProfile(session?.user?.id).finally(() => setLoading(false));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      // defer to avoid calling Supabase inside the auth callback
      setTimeout(() => loadProfile(session?.user?.id), 0);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const signUp = async (email, password, name) => {
    // The profile row is created by a database trigger (handle_new_user)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return { data, error };
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    return { error };
  };

  const reportCount = profile?.report_count || 0;

  const value = {
    user,
    session,
    profile,
    loading,
    userReportCount: reportCount,
    isBlocked: reportCount >= BLOCK_THRESHOLD,
    isAdmin: profile?.role === "admin",
    blockThreshold: BLOCK_THRESHOLD,
    signUp,
    signIn,
    signOut,
    refreshProfile: () => loadProfile(user?.id),
    // kept for older components
    refreshReportCount: () => loadProfile(user?.id),
    getUserProfile: async () => profile || loadProfile(user?.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
