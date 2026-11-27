import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "../services/api";

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

  // Forgot password state
  const [isForgotMode, setIsForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMessage, setForgotMessage] = useState("");
  const [devResetLink, setDevResetLink] = useState<string | null>(null);

  async function handleForgotSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setForgotMessage("");
    setDevResetLink(null);
    setForgotLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Failed to process request.");
      } else {
        setForgotMessage(
          lang === "zh-TW"
            ? "重設密碼連結已發送至管理員信箱！"
            : "Password reset instructions sent to manager email!"
        );
        if (data.dev_reset_link) {
          setDevResetLink(data.dev_reset_link);
        }
      }
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  }

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
        {isForgotMode ? (
          <div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>🔑</div>
              <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>
                {lang === "zh-TW" ? "管理員密碼重設" : "Manager Password Recovery"}
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                {lang === "zh-TW" ? "輸入管理員帳號信箱，系統將發送安全重設連結至您的信箱" : "Enter your manager email to receive password reset instructions"}
              </p>
            </div>

            {error && (
              <div style={{ marginBottom: 18, padding: 12, borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600 }}>
                ⚠️ {error}
              </div>
            )}

            {forgotMessage && (
              <div style={{ marginBottom: 18, padding: 14, borderRadius: 8, background: "#ecfdf5", color: "#065f46", border: "1px solid #a7f3d0", fontSize: 13 }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>✓ {forgotMessage}</div>
                {devResetLink && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px dashed #6ee7b7" }}>
                    <span style={{ fontSize: 11, color: "#047857", fontWeight: 700 }}>[DEV PREVIEW LINK]:</span><br />
                    <a
                      href={devResetLink}
                      style={{ color: "#0284c7", fontWeight: 700, fontSize: 12, wordBreak: "break-all" }}
                    >
                      🔗 {lang === "zh-TW" ? "直接點此開啟重設密碼頁面" : "Click here to open password reset directly"}
                    </a>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleForgotSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
                  {lang === "zh-TW" ? "管理員信箱 (Email)" : "Manager Email"}
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@apex.local or react@mail.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
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
                disabled={forgotLoading}
                style={{
                  marginTop: 6,
                  padding: "12px 20px",
                  background: forgotLoading ? "var(--border-color)" : "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: forgotLoading ? "not-allowed" : "pointer",
                }}
              >
                {forgotLoading
                  ? (lang === "zh-TW" ? "發送重設信件中..." : "Sending reset email...")
                  : (lang === "zh-TW" ? "發送重設密碼信件" : "Send Password Reset Link")}
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: "center" }}>
              <button
                type="button"
                onClick={() => {
                  setIsForgotMode(false);
                  setError("");
                  setForgotMessage("");
                  setDevResetLink(null);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontSize: 13,
                }}
              >
                ← {lang === "zh-TW" ? "返回管理員登入" : "Back to Sign In"}
              </button>
            </div>
          </div>
        ) : (
          <div>
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                    {lang === "zh-TW" ? "密碼 (Password)" : "Password"}
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsForgotMode(true);
                      setForgotEmail(email);
                      setError("");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    {lang === "zh-TW" ? "忘記密碼？" : "Forgot password?"}
                  </button>
                </div>
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
                  marginTop: 6,
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
          </div>
        )}

        <div style={{ marginTop: 24, textAlign: "center", borderTop: "1px solid var(--border-color)", paddingTop: 18 }}>
          <Link to="/" style={{ color: "var(--text-secondary)", textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            ← {lang === "zh-TW" ? "返回顧客書店前台" : "Return to Storefront"}
          </Link>
        </div>
      </div>
    </div>
  );
}
