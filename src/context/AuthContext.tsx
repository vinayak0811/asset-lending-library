"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { SessionUser } from "@/types";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, role?: string) => Promise<boolean>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  switchUser: (role: "LIBRARIAN_DEMO" | "MEMBER_DEMO") => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (email: string, password = "password123"): Promise<boolean> => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const signup = async (
    name: string,
    email: string,
    password: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, confirmPassword: password }),
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error || "Failed to create account." };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Failed to create account." };
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/login");
    } catch (e) {
      console.error(e);
    }
  };

  const switchUser = async (
    targetRole: "LIBRARIAN_DEMO" | "MEMBER_DEMO"
  ): Promise<boolean> => {
    // "LIBRARIAN_DEMO" = restricted demo librarian: sees everything but
    //   member names are blurred and item-approval actions are blocked.
    // "MEMBER_DEMO" = restricted demo member: can browse/view everything
    //   but cannot submit loan requests or take any write action.
    //
    // The two demo accounts can switch between each other instantly —
    // no sign-in step. This only ever works for these two restricted
    // accounts; the full-access Librarian / Member accounts are never
    // reachable this way (they require the real /login form — see
    // README.md for their credentials).
    try {
      const res = await fetch("/api/auth/demo-switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: targetRole }),
      });

      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        router.push("/dashboard");
        return true;
      }
      return false;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, signup, logout, switchUser, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
