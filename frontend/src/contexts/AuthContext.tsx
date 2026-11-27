import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { API_URL, trackActivityApi } from "../services/api";
import type { User } from "../types";

interface AuthContextValue {
  token: string | null;
  user: User | null;
  isManager: boolean;
  setToken: (token: string | null) => void;
  setUser: (user: User | null) => void;
  loginWithToken: (tok: string, usr?: User) => void;
  logout: () => void;
  trackActivity: (action: string, entity_type?: string, entity_id?: number, details?: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);

  const isManager =
    user?.role === "manager" ||
    user?.role === "superadmin" ||
    user?.email === "react@mail" ||
    user?.email === "react@mail.com";

  function setToken(tok: string | null) {
    if (tok) {
      localStorage.setItem("token", tok);
    } else {
      localStorage.removeItem("token");
    }
    setTokenState(tok);
  }

  function loginWithToken(tok: string, usr?: User) {
    setToken(tok);
    if (usr) setUser(usr);
  }

  function trackActivity(action: string, entity_type?: string, entity_id?: number, details?: string) {
    trackActivityApi(token, action, entity_type, entity_id, details);
  }

  function logout() {
    trackActivity("USER_LOGOUT", "SESSION", user?.id, "User clicked sign out");
    setToken(null);
    setUser(null);
  }

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    fetch(`${API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: User) => setUser(data))
      .catch(() => {
        setToken(null);
        setUser(null);
      });
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        isManager,
        setToken,
        setUser,
        loginWithToken,
        logout,
        trackActivity,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
