import { useState } from "react";
import type { ActivityLog, ErrorLog, LoginLog } from "../../types";

interface LogsModalProps {
  open: boolean;
  onClose: () => void;
  loginLogs: LoginLog[];
  activityLogs: ActivityLog[];
  errorLogs: ErrorLog[];
  onTriggerTestError: () => void;
}

export default function LogsModal({
  open,
  onClose,
  loginLogs,
  activityLogs,
  errorLogs,
  onTriggerTestError,
}: LogsModalProps) {
  const [logsTab, setLogsTab] = useState<"activities" | "logins" | "errors">("activities");

  if (!open) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 115, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-modal)", color: "var(--text-primary)", width: "100%", maxWidth: 960, maxHeight: "85vh", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-modal)" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>📊</span>
            <h3 style={{ margin: 0, fontSize: 18 }}>System Monitor (PostgreSQL S00_ Logs)</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)", alignItems: "center" }}>
          <button
            onClick={() => setLogsTab("activities")}
            style={{
              flex: 1,
              padding: 12,
              background: logsTab === "activities" ? "var(--bg-modal)" : "transparent",
              color: logsTab === "activities" ? "var(--accent)" : "var(--text-secondary)",
              border: "none",
              borderBottom: logsTab === "activities" ? "2px solid var(--accent)" : "none",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            User Activities ({activityLogs.length})
          </button>
          <button
            onClick={() => setLogsTab("logins")}
            style={{
              flex: 1,
              padding: 12,
              background: logsTab === "logins" ? "var(--bg-modal)" : "transparent",
              color: logsTab === "logins" ? "var(--accent)" : "var(--text-secondary)",
              border: "none",
              borderBottom: logsTab === "logins" ? "2px solid var(--accent)" : "none",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Logins ({loginLogs.length})
          </button>
          <button
            onClick={() => setLogsTab("errors")}
            style={{
              flex: 1,
              padding: 12,
              background: logsTab === "errors" ? "var(--bg-modal)" : "transparent",
              color: logsTab === "errors" ? "#ef4444" : "var(--text-secondary)",
              border: "none",
              borderBottom: logsTab === "errors" ? "2px solid #ef4444" : "none",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            🚨 Error Logs ({errorLogs.length})
          </button>
          <button
            onClick={onTriggerTestError}
            title="Trigger a deliberate 1/0 error to verify backend error logging"
            style={{
              marginRight: 12,
              padding: "6px 12px",
              background: "#fee2e2",
              color: "#b91c1c",
              border: "1px solid #fecaca",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ⚡ Test Trigger Error
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, fontSize: 13, fontFamily: "monospace" }}>
          {logsTab === "activities" ? (
            activityLogs.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>No activity logs recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {activityLogs.map((log) => (
                  <div key={log.id} style={{ padding: 12, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontWeight: "bold" }}>
                      <span style={{ color: "var(--accent)" }}>[{log.action}]</span>
                      <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    <div style={{ color: "var(--text-primary)" }}>
                      User ID: {log.user_id ?? "Guest"} • Entity: {log.entity_type || "N/A"} #{log.entity_id ?? ""}
                    </div>
                    {log.details && (
                      <div style={{ color: "var(--text-secondary)", marginTop: 4, wordBreak: "break-all" }}>Details: {log.details}</div>
                    )}
                    <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>IP: {log.ip_address}</div>
                  </div>
                ))}
              </div>
            )
          ) : logsTab === "logins" ? (
            loginLogs.length === 0 ? (
              <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>No login logs recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {loginLogs.map((log) => (
                  <div key={log.id} style={{ padding: 12, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: "bold", color: log.status === "SUCCESS" ? "#16a34a" : "#dc2626" }}>
                        Status: {log.status}
                      </span>
                      <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{new Date(log.login_time).toLocaleString()}</span>
                    </div>
                    <div>User ID: {log.user_id} • IP: {log.ip_address}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 4, wordBreak: "break-all" }}>Agent: {log.user_agent}</div>
                  </div>
                ))}
              </div>
            )
          ) : errorLogs.length === 0 ? (
            <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>No error logs recorded. Everything is healthy!</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {errorLogs.map((err) => (
                <div key={err.id} style={{ padding: 14, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontWeight: "bold" }}>
                    <span style={{ background: "#dc2626", color: "white", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>
                      {err.error_type}
                    </span>
                    <span style={{ color: "#7f1d1d", fontSize: 11 }}>{new Date(err.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>{err.error_message}</div>
                  <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>
                    Endpoint: <strong>{err.http_method} {err.endpoint}</strong> • IP: {err.ip_address} • User ID: {err.user_id ?? "Guest"}
                  </div>
                  {err.stack_trace && (
                    <details style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #fecaca", fontSize: 11, color: "#374151", overflowX: "auto" }}>
                      <summary style={{ cursor: "pointer", fontWeight: 700, color: "#991b1b" }}>View Full Python Stack Trace</summary>
                      <pre style={{ margin: "8px 0 0 0", whiteSpace: "pre-wrap" }}>{err.stack_trace}</pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
