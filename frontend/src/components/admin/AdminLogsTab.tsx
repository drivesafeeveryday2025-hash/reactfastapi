import { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import type { ActivityLog, ErrorLog, LoginLog } from "../../types";

interface AdminLogsTabProps {
  activityLogs: ActivityLog[];
  loginLogs: LoginLog[];
  errorLogs: ErrorLog[];
  loadingLogs: boolean;
  onLoadLogs: (tab: "activity" | "login" | "error") => void;
}

export default function AdminLogsTab({
  activityLogs,
  loginLogs,
  errorLogs,
  loadingLogs,
  onLoadLogs,
}: AdminLogsTabProps) {
  const { lang } = useLanguage();
  const [logSubTab, setLogSubTab] = useState<"activity" | "login" | "error">("activity");

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 800 }}>
          🛡️ {lang === "zh-TW" ? "系統安全稽核與作業日誌" : "System Audit & Security Logs"}
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
          {lang === "zh-TW"
            ? "記錄所有會員登入歷程、前台顧客操作行為與後端未攔截異常錯誤堆疊。"
            : "Tracks user logins, storefront activities, and unhandled system exception stack traces."}
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {[
          { id: "activity", icon: "📋", label: lang === "zh-TW" ? "操作行為日誌" : "Activity Logs" },
          { id: "login", icon: "🔑", label: lang === "zh-TW" ? "登入驗證紀錄" : "Login Logs" },
          { id: "error", icon: "⚠️", label: lang === "zh-TW" ? "錯誤異常追蹤" : "Error Logs" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              const t = tab.id as "activity" | "login" | "error";
              setLogSubTab(t);
              onLoadLogs(t);
            }}
            style={{
              padding: "7px 16px",
              borderRadius: 6,
              border: "none",
              background: logSubTab === tab.id ? "var(--accent)" : "var(--bg-card)",
              color: logSubTab === tab.id ? "white" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden", background: "var(--bg-card)" }}>
        {loadingLogs && (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}>
            ⏳ {lang === "zh-TW" ? "正在載入日誌紀錄..." : "Loading system logs..."}
          </div>
        )}
        <div style={{ overflowX: "auto" }}>
          {logSubTab === "activity" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                  <th style={{ padding: 10, width: 60 }}>#ID</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "動作類型" : "Action"}</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "目標實體" : "Entity"}</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "詳細內容" : "Details"}</th>
                  <th style={{ padding: 10 }}>IP</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "時間" : "Time"}</th>
                </tr>
              </thead>
              <tbody>
                {activityLogs.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: 10, color: "var(--text-secondary)" }}>#{l.id}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{ background: "var(--accent-light)", color: "var(--accent)", padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                        {l.action}
                      </span>
                    </td>
                    <td style={{ padding: 10 }}>{l.entity_type || "-"}</td>
                    <td style={{ padding: 10, maxWidth: 380, wordBreak: "break-all" }}>{l.details || "-"}</td>
                    <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{l.ip_address || "127.0.0.1"}</td>
                    <td style={{ padding: 10, color: "var(--text-secondary)", fontSize: 12 }}>{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {logSubTab === "login" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                  <th style={{ padding: 10, width: 60 }}>#ID</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "用戶 ID" : "User ID"}</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "驗證狀態" : "Status"}</th>
                  <th style={{ padding: 10 }}>IP</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "瀏覽器裝置" : "User Agent"}</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "登入時間" : "Login Time"}</th>
                </tr>
              </thead>
              <tbody>
                {loginLogs.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: 10, color: "var(--text-secondary)" }}>#{l.id}</td>
                    <td style={{ padding: 10, fontWeight: 700 }}>User #{l.user_id}</td>
                    <td style={{ padding: 10 }}>
                      <span style={{ background: l.status === "SUCCESS" ? "#ecfdf5" : "#fef2f2", color: l.status === "SUCCESS" ? "#065f46" : "#991b1b", padding: "2px 8px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                        {l.status}
                      </span>
                    </td>
                    <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{l.ip_address || "127.0.0.1"}</td>
                    <td style={{ padding: 10, fontSize: 11, maxWidth: 260, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      {l.user_agent || "Browser"}
                    </td>
                    <td style={{ padding: 10, color: "var(--text-secondary)", fontSize: 12 }}>{new Date(l.login_time).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {logSubTab === "error" && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                  <th style={{ padding: 10, width: 60 }}>#ID</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "錯誤類型" : "Error Type"}</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "錯誤訊息" : "Message"}</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "端點" : "Endpoint"}</th>
                  <th style={{ padding: 10 }}>{lang === "zh-TW" ? "時間" : "Time"}</th>
                </tr>
              </thead>
              <tbody>
                {errorLogs.map((l) => (
                  <tr key={l.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: 10, color: "var(--text-secondary)" }}>#{l.id}</td>
                    <td style={{ padding: 10, color: "#991b1b", fontWeight: 700 }}>{l.error_type}</td>
                    <td style={{ padding: 10, maxWidth: 360, wordBreak: "break-all" }}>{l.error_message}</td>
                    <td style={{ padding: 10, fontFamily: "monospace", fontSize: 12 }}>{l.endpoint} ({l.http_method})</td>
                    <td style={{ padding: 10, color: "var(--text-secondary)", fontSize: 12 }}>{new Date(l.created_at).toLocaleString()}</td>
                  </tr>
                ))}
                {errorLogs.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                      ✅ {lang === "zh-TW" ? "目前系統運行完全健康，無任何未處理錯誤！" : "System is healthy with 0 unhandled errors!"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
