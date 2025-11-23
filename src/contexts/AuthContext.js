import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userReportCount, setUserReportCount] = useState(0);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserReportCount(session.user.id);
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserReportCount(session.user.id);
      } else {
        setUserReportCount(0);
        setIsBlocked(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserReportCount = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("report_count")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("Error fetching report count:", error);
        return;
      }

      const count = data?.report_count || 0;
      setUserReportCount(count);
      setIsBlocked(count > 3);
    } catch (error) {
      console.error("Error fetching report count:", error);
    }
  };

  const signUp = async (email, password, name) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: name,
          },
        },
      });

      if (error) throw error;

      // Update user profile with name
      if (data.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert([
            {
              id: data.user.id,
              name: name,
              email: email,
              report_count: 0,
            },
          ])
          .select();

        if (profileError && profileError.code !== "23505") {
          // Ignore duplicate key errors (profile might already exist)
          console.error("Error creating profile:", profileError);
        }
      }

      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const getUserProfile = async () => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
  };

  const value = {
    user,
    session,
    loading,
    userReportCount,
    isBlocked,
    signUp,
    signIn,
    signOut,
    getUserProfile,
    refreshReportCount: () => user && fetchUserReportCount(user.id),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
