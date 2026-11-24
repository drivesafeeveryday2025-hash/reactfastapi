import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface AdminLoginProps {
  onLoginSuccess: (token: string, user: { id: number; email: string; role?: string }) => void;
  lang: "en" | "zh-TW";
}

export default function AdminLogin({ onLoginSuccess, lang }: AdminLoginProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Invalid login credentials.");
        return;
      }

      // Fetch user profile to verify role
      const meRes = await fetch(`${API_URL}/api/me`, {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      const meData = await meRes.json();

      const isManager =
        meData.role === "manager" ||
        meData.role === "superadmin" ||
        meData.email === "react@mail" ||
        meData.email === "react@mail.com";

      if (!isManager) {
        setError(
          lang === "zh-TW"
            ? "權限不足：此帳號屬於一般顧客角色，無法進入管理後台。"
            : "Access Denied: This account has customer privileges only and cannot enter the management portal."
        );
        return;
      }

      onLoginSuccess(data.access_token, meData);
      navigate("/admin");
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "85vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ maxWidth: 440, width: "100%", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 36, boxShadow: "var(--shadow-md)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🛡️</div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>
            {lang === "zh-TW" ? "書店管理人員登入" : "Manager Portal Login"}
          </h2>
          <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
            {lang === "zh-TW" ? "登入以管理庫存、書籍批次匯入與系統日誌" : "Sign in to manage catalog inventory, bulk imports, and system audit logs"}
          </p>
        </div>

        {error && (
          <div style={{ marginBottom: 20, padding: 12, borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600 }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
              {lang === "zh-TW" ? "管理員信箱 (Email)" : "Manager Email"}
            </label>
            <input
              type="email"
              required
              placeholder="admin@apex.local or react@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
              {lang === "zh-TW" ? "密碼 (Password)" : "Password"}
            </label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 10,
              padding: "12px 20px",
              background: loading ? "var(--border-color)" : "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 15,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Verifying credentials..." : (lang === "zh-TW" ? "安全登入後台" : "Secure Sign In")}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: "center", borderTop: "1px solid var(--border-color)", paddingTop: 18 }}>
          <Link to="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            ← {lang === "zh-TW" ? "返回顧客書店前台" : "Return to Storefront"}
          </Link>
        </div>
      </div>
    </div>
  );
}
