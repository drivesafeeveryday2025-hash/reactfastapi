import { useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";
import type { SiteSettings } from "../../types";
import ControlButtons from "./ControlButtons";

export default function SignInView({ settings }: { settings: SiteSettings | null }) {
  const { setToken } = useAuth();
  const { lang, t, localize } = useLanguage();

  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot_password">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [devResetLink, setDevResetLink] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    const endpoint = authMode === "login" ? "/api/login" : "/api/register";

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || "Authentication failed");
        return;
      }
      if (authMode === "register") {
        setAuthMessage(
          lang === "zh-TW"
            ? "帳號註冊成功！請直接登入。"
            : "Account created successfully! Please sign in."
        );
        setAuthMode("login");
      } else {
        setToken(data.access_token);
      }
    } catch {
      setAuthError(
        lang === "zh-TW"
          ? "無法連線至後端伺服器，請確認 FastAPI 正在執行中。"
          : "Cannot connect to backend server. Please verify FastAPI is running."
      );
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    setDevResetLink(null);
    setForgotLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || "Failed to process password reset request");
      } else {
        setAuthMessage(
          lang === "zh-TW"
            ? "重設密碼連結已發送至您的電子信箱！請查收郵件。"
            : "Password reset instructions sent! Please check your email inbox."
        );
        if (data.dev_reset_link) {
          setDevResetLink(data.dev_reset_link);
        }
      }
    } catch {
      setAuthError(
        lang === "zh-TW"
          ? "無法連線至後端伺服器，請稍後再試。"
          : "Cannot connect to backend server. Please try again later."
      );
    } finally {
      setForgotLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-secondary)",
        padding: 20,
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: 24, right: 24 }}>
        <ControlButtons />
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 420,
          background: "var(--bg-card)",
          padding: 36,
          borderRadius: 16,
          boxShadow: "var(--shadow-lg)",
          border: "1px solid var(--border-color)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <span style={{ fontSize: 44 }}>📚</span>
          <h2 style={{ fontSize: 24, margin: "10px 0 4px 0", color: "var(--text-primary)" }}>
            {localize(settings, "store_name") || "Apex Book Haven"}
          </h2>
          <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
            {authMode === "forgot_password"
              ? lang === "zh-TW"
                ? "輸入您的電子郵件以重設密碼"
                : "Enter your email to receive a password reset link"
              : authMode === "login"
              ? t("auth_sub_login")
              : t("auth_sub_register")}
          </p>
        </div>

        {authMode === "forgot_password" ? (
          <form onSubmit={handleForgotPassword} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                {t("auth_email_label")}
              </label>
              <input
                type="email"
                placeholder="reader@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={forgotLoading}
              style={{
                padding: 12,
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 15,
                cursor: forgotLoading ? "not-allowed" : "pointer",
                opacity: forgotLoading ? 0.7 : 1,
                marginTop: 6,
              }}
            >
              {forgotLoading
                ? lang === "zh-TW"
                  ? "發送中..."
                  : "Sending..."
                : lang === "zh-TW"
                ? "發送重設密碼信件"
                : "Send Password Reset Link"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                {t("auth_email_label")}
              </label>
              <input
                type="email"
                placeholder="reader@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
                  {t("auth_pass_label")}
                </label>
                {authMode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("forgot_password");
                      setAuthError("");
                      setAuthMessage("");
                      setDevResetLink(null);
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--accent)",
                      fontSize: 12,
                      cursor: "pointer",
                      padding: 0,
                      textDecoration: "underline",
                    }}
                  >
                    {lang === "zh-TW" ? "忘記密碼？" : "Forgot password?"}
                  </button>
                )}
              </div>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                padding: 12,
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                marginTop: 6,
              }}
            >
              {authMode === "login" ? t("auth_btn_login") : t("auth_btn_register")}
            </button>
          </form>
        )}

        {authError && (
          <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, marginTop: 14, fontSize: 13, border: "1px solid #fecaca" }}>
            {authError}
          </div>
        )}
        {authMessage && (
          <div style={{ background: "#f0fdf4", color: "#15803d", padding: "10px 14px", borderRadius: 8, marginTop: 14, fontSize: 13, border: "1px solid #bbf7d0" }}>
            {authMessage}
          </div>
        )}

        {devResetLink && (
          <div
            style={{
              marginTop: 14,
              padding: "12px 14px",
              background: "#eff6ff",
              borderRadius: 8,
              border: "1px solid #bfdbfe",
              fontSize: 13,
            }}
          >
            <div style={{ fontWeight: 600, color: "#1e40af", marginBottom: 4 }}>
              🛠️ Dev Simulation Mode (No SMTP needed):
            </div>
            <a
              href={devResetLink}
              style={{
                color: "#2563eb",
                fontWeight: 600,
                textDecoration: "underline",
                wordBreak: "break-all",
              }}
            >
              🔗 Click here to open reset link directly
            </a>
          </div>
        )}

        <div style={{ marginTop: 22, textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
          {authMode === "forgot_password" ? (
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setAuthError("");
                setAuthMessage("");
                setDevResetLink(null);
              }}
              style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              ← {lang === "zh-TW" ? "返回登入" : "Back to Sign In"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError("");
                setAuthMessage("");
                setDevResetLink(null);
              }}
              style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              {authMode === "login" ? t("auth_toggle_to_reg") : t("auth_toggle_to_log")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
