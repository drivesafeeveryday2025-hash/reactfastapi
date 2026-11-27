import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";

interface ChatWidgetProps {
  open: boolean;
  setOpen: (open: boolean) => void;
}

export default function ChatWidget({ open, setOpen }: ChatWidgetProps) {
  const { token, trackActivity } = useAuth();
  const { lang, t } = useLanguage();

  const [chatMessages, setChatMessages] = useState<Array<{ sender: "bot" | "user"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    setChatMessages([{ sender: "bot", text: t("chat_welcome") }]);
  }, [lang]);

  async function handleSendChat(e: FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    setChatInput("");
    setChatMessages((prev) => [...prev, { sender: "user", text: msg }]);
    trackActivity("CHAT_QUERY", "CHAT", undefined, msg);

    if (!token) {
      const loginNotice =
        lang === "zh-TW"
          ? "🔒 為了防範惡意網路爬蟲並保護服務品質，AI 客服助理僅開放給登入會員使用。請先登入您的帳號！"
          : "🔒 To prevent automated web-bot abuse, the AI assistant is reserved for signed-in members. Please sign in first!";
      setChatMessages((prev) => [...prev, { sender: "bot", text: loginNotice }]);
      return;
    }

    setChatLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Accept-Language": lang,
        },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();

      if (res.status === 429) {
        setChatMessages((prev) => [...prev, { sender: "bot", text: `⚠️ ${data.detail || "Rate limit reached."}` }]);
      } else if (res.status === 401) {
        setChatMessages((prev) => [
          ...prev,
          { sender: "bot", text: lang === "zh-TW" ? "登入狀態已過期，請重新登入後再進行提問。" : "Your session has expired. Please sign in again." },
        ]);
      } else if (!res.ok) {
        setChatMessages((prev) => [
          ...prev,
          { sender: "bot", text: lang === "zh-TW" ? "抱歉，目前客服系統忙碌中，請稍後再試。" : "Sorry, our assistant is temporarily busy. Please try again shortly." },
        ]);
      } else {
        setChatMessages((prev) => [...prev, { sender: "bot", text: data.reply }]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { sender: "bot", text: lang === "zh-TW" ? "無法連線至書店伺服器，請確認後端運行中。" : "Unable to reach bookstore server. Please verify backend is running." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 90 }}>
      {open ? (
        <div
          style={{
            width: 350,
            height: 440,
            background: "var(--bg-card)",
            borderRadius: 16,
            boxShadow: "var(--shadow-modal)",
            border: "1px solid var(--border-color)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "14px 18px", background: "var(--accent)", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: "bold" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span>📖</span> {t("chat_title")}
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}>
              ✕
            </button>
          </div>

          <div style={{ flex: 1, padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
            {chatMessages.map((m, idx) => (
              <div
                key={idx}
                style={{
                  alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                  background: m.sender === "user" ? "var(--accent)" : "var(--bg-secondary)",
                  color: m.sender === "user" ? "white" : "var(--text-primary)",
                  padding: "9px 13px",
                  borderRadius: 14,
                  fontSize: 13,
                  maxWidth: "82%",
                  lineHeight: 1.4,
                  whiteSpace: "pre-line",
                  border: m.sender === "user" ? "none" : "1px solid var(--border-color)",
                }}
              >
                {m.text}
              </div>
            ))}
            {chatLoading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "var(--bg-secondary)",
                  color: "var(--text-secondary)",
                  padding: "8px 12px",
                  borderRadius: 14,
                  fontSize: 13,
                  fontStyle: "italic",
                  border: "1px solid var(--border-color)",
                }}
              >
                {lang === "zh-TW" ? "📚 助理正在查詢書店資料庫..." : "📚 Assistant is checking catalog..."}
              </div>
            )}
          </div>

          <form onSubmit={handleSendChat} style={{ display: "flex", borderTop: "1px solid var(--border-color)", padding: 10, background: "var(--bg-secondary)" }}>
            <input
              type="text"
              placeholder={t("chat_placeholder")}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={chatLoading}
              style={{
                flex: 1,
                border: "1px solid var(--border-color)",
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 13,
                outline: "none",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
              }}
            />
            <button
              type="submit"
              disabled={chatLoading}
              style={{
                marginLeft: 8,
                padding: "8px 14px",
                background: chatLoading ? "var(--border-color)" : "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: chatLoading ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {t("chat_send")}
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => {
            setOpen(true);
            trackActivity("OPEN_CHATBOX", "CHAT", undefined, "User opened support chat");
          }}
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "white",
            border: "none",
            boxShadow: "0 6px 16px rgba(234, 88, 12, 0.45)",
            fontSize: 26,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title={t("chat_title")}
        >
          💬
        </button>
      )}
    </div>
  );
}
