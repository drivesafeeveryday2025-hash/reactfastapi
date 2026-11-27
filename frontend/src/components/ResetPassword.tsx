import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { API_URL } from "../services/api";

interface ResetPasswordProps {
  lang: "en" | "zh-TW";
}

export default function ResetPassword({ lang }: ResetPasswordProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [verifying, setVerifying] = useState(true);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setVerifying(false);
      setTokenValid(false);
      setVerifyError(lang === "zh-TW" ? "缺少重設密碼權杖，請透過信件中的連結重試。" : "Missing reset security token. Please use the link provided in your email.");
      return;
    }

    setVerifying(true);
    fetch(`${API_URL}/api/auth/verify-reset-token?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setTokenValid(false);
          setVerifyError(data.detail || (lang === "zh-TW" ? "此重設連結已失效或過期。" : "This password reset link is invalid or expired."));
        } else {
          setTokenValid(true);
          setMaskedEmail(data.email || "");
        }
      })
      .catch((err) => {
        setTokenValid(false);
        setVerifyError(err.message || (lang === "zh-TW" ? "無法連線至伺服器驗證。" : "Network error verifying token."));
      })
      .finally(() => setVerifying(false));
  }, [token, lang]);

  async function handleResetSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError("");

    if (newPassword.length < 6) {
      setSubmitError(lang === "zh-TW" ? "新密碼長度至少需為 6 個字元。" : "New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setSubmitError(lang === "zh-TW" ? "兩次輸入的新密碼不相符，請再次確認。" : "Passwords do not match. Please re-enter.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.detail || (lang === "zh-TW" ? "密碼重設失敗，請重試。" : "Failed to reset password."));
      } else {
        setSubmitSuccess(true);
        setTimeout(() => {
          navigate("/");
        }, 3000);
      }
    } catch (err: any) {
      setSubmitError(err.message || (lang === "zh-TW" ? "網路連線異常，請稍後重試。" : "Network error occurred."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "85vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, background: "var(--bg-primary)" }}>
      <div style={{ maxWidth: 440, width: "100%", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 36, boxShadow: "var(--shadow-md)" }}>
        {verifying && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <h3 style={{ margin: "0 0 8px 0" }}>
              {lang === "zh-TW" ? "正在驗證重設連結安全權杖..." : "Verifying password reset token..."}
            </h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              {lang === "zh-TW" ? "正在向伺服器確認金鑰有效性與時效" : "Checking validity and expiration against security server"}
            </p>
          </div>
        )}

        {!verifying && tokenValid === false && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>⚠️</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px 0", color: "#b91c1c" }}>
              {lang === "zh-TW" ? "重設密碼連結無效或已過期" : "Invalid or Expired Reset Link"}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              {verifyError}
            </p>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <Link
                to="/"
                style={{
                  padding: "10px 20px",
                  borderRadius: 8,
                  background: "var(--accent)",
                  color: "white",
                  textDecoration: "none",
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                {lang === "zh-TW" ? "返回登入並重新發送信件" : "Request a New Reset Link"}
              </Link>
            </div>
          </div>
        )}

        {!verifying && tokenValid === true && !submitSuccess && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 42, marginBottom: 8 }}>🔐</div>
              <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 900, color: "var(--text-primary)" }}>
                {lang === "zh-TW" ? "設定您的新密碼" : "Set Your New Password"}
              </h2>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                {lang === "zh-TW" ? `帳號: ${maskedEmail}` : `Account: ${maskedEmail}`}
              </p>
            </div>

            {submitError && (
              <div style={{ marginBottom: 18, padding: 12, borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600 }}>
                ⚠️ {submitError}
              </div>
            )}

            <form onSubmit={handleResetSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
                  {lang === "zh-TW" ? "新密碼 (至少 6 碼)" : "New Password (min 6 chars)"}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "var(--text-primary)" }}>
                  {lang === "zh-TW" ? "確認新密碼" : "Confirm New Password"}
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    fontSize: 14,
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{
                  marginTop: 6,
                  padding: "12px 20px",
                  background: submitting ? "var(--border-color)" : "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                {submitting ? (lang === "zh-TW" ? "正在更新密碼..." : "Updating Password...") : (lang === "zh-TW" ? "確認並重設密碼" : "Confirm & Update Password")}
              </button>
            </form>
          </div>
        )}

        {submitSuccess && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: "#059669", margin: "0 0 10px 0" }}>
              {lang === "zh-TW" ? "密碼已成功更新！" : "Password Reset Successfully!"}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
              {lang === "zh-TW"
                ? "您的新密碼已立即生效，系統將在 3 秒後自動為您跳轉至登入頁面。"
                : "Your credentials have been securely updated. Redirecting you to sign in..."}
            </p>
            <Link
              to="/"
              style={{
                display: "inline-block",
                padding: "10px 24px",
                borderRadius: 8,
                background: "var(--accent)",
                color: "white",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              {lang === "zh-TW" ? "立即前往登入" : "Proceed to Sign In"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
