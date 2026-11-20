import { useEffect, useState, type FormEvent } from "react";
import { useTheme } from "./contexts/ThemeContext";
import { useLanguage } from "./contexts/LanguageContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface User {
  id: number;
  email: string;
}

interface SiteSettings {
  store_name_en: string;
  store_name_zh: string;
  hero_title_en: string;
  hero_title_zh: string;
  hero_subtitle_en: string;
  hero_subtitle_zh: string;
  about_text_en: string;
  about_text_zh: string;
  address_en: string;
  address_zh: string;
  phone: string;
  email: string;
  opening_hours_en: string;
  opening_hours_zh: string;
}

interface Promotion {
  id: number;
  title_en: string;
  title_zh: string;
  badge_en: string;
  badge_zh: string;
  discount_code: string;
  image_url: string;
}

interface Category {
  id: number;
  name_en: string;
  name_zh: string;
  icon: string;
  sort_order: number;
}

interface ProdDetail {
  full_synopsis_en: string;
  full_synopsis_zh: string;
  publisher_en: string;
  publisher_zh: string;
  isbn: string;
  publication_year: number;
  page_count: number;
  format_en: string;
  format_zh: string;
}

interface Product {
  id: number;
  category_id: number;
  title_en: string;
  title_zh: string;
  author_en: string;
  author_zh: string;
  short_desc_en: string;
  short_desc_zh: string;
  price: number;
  image_url: string;
  is_recommended: boolean;
  detail?: ProdDetail;
}

interface LoginLog {
  id: number;
  user_id: number;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  login_time: string;
}

interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

interface ErrorLog {
  id: number;
  error_type: string;
  error_message: string;
  stack_trace: string | null;
  endpoint: string | null;
  http_method: string | null;
  user_id: number | null;
  ip_address: string | null;
  created_at: string;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t, localize } = useLanguage();

  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);

  // Authentication states
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // Data from PostgreSQL
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);

  // Interactive user states
  const [cart, setCart] = useState<{ [productId: number]: number }>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Product | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // System Activity Monitor Modal
  const [logsOpen, setLogsOpen] = useState(false);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [logsTab, setLogsTab] = useState<"activities" | "logins" | "errors">("activities");

  // Chatbox states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "bot" | "user"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Track system activity helper
  function trackActivity(action: string, entity_type?: string, entity_id?: number, details?: string) {
    fetch(`${API_URL}/api/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action, entity_type, entity_id, details }),
    }).catch(() => {});
  }

  // Initialize chat greeting based on language
  useEffect(() => {
    setChatMessages([
      {
        sender: "bot",
        text: t("chat_welcome"),
      },
    ]);
  }, [lang]);

  // Check login status
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: User) => setUser(data))
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      });
  }, [token]);

  // Fetch initial bookstore content from DB
  useEffect(() => {
    fetch(`${API_URL}/api/settings`).then((r) => r.ok && r.json()).then(setSettings);
    fetch(`${API_URL}/api/promotions`).then((r) => r.ok && r.json()).then(setPromotions);
    fetch(`${API_URL}/api/categories`).then((r) => r.ok && r.json()).then(setCategories);
    fetch(`${API_URL}/api/products/recommended`).then((r) => r.ok && r.json()).then(setRecommended);
  }, []);

  // Filter products by selected category
  useEffect(() => {
    const url = selectedCat
      ? `${API_URL}/api/products?category_id=${selectedCat}`
      : `${API_URL}/api/products`;
    fetch(url).then((r) => r.ok && r.json()).then(setProducts);
  }, [selectedCat]);

  // Fetch logs when monitor modal opens
  function loadSystemLogs() {
    fetch(`${API_URL}/api/system/logins`)
      .then((r) => r.ok && r.json())
      .then(setLoginLogs);
    fetch(`${API_URL}/api/system/activities`)
      .then((r) => r.ok && r.json())
      .then(setActivityLogs);
    fetch(`${API_URL}/api/system/errors`)
      .then((r) => r.ok && r.json())
      .then(setErrorLogs);
    setLogsOpen(true);
  }

  function triggerTestError() {
    fetch(`${API_URL}/api/system/test-error`)
      .finally(() => {
        setTimeout(loadSystemLogs, 400);
      });
  }

  // Auth Handler
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
        localStorage.setItem("token", data.access_token);
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

  function handleLogout() {
    trackActivity("USER_LOGOUT", "SESSION", user?.id, "User clicked sign out");
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setCart({});
  }

  function addToCart(id: number) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    trackActivity("ADD_TO_BAG", "BOOK", id, "Added book to shopping bag");
  }

  function updateCartQty(id: number, delta: number) {
    setCart((prev) => {
      const current = prev[id] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  }

  const allKnownBooks = [...products, ...recommended].reduce<{ [id: number]: Product }>((acc, b) => {
    acc[b.id] = b;
    return acc;
  }, {});

  const cartItems = Object.entries(cart)
    .map(([idStr, qty]) => {
      const bId = Number(idStr);
      return {
        book: allKnownBooks[bId],
        quantity: qty,
      };
    })
    .filter((item) => item.book);

  const cartTotal = cartItems.reduce((sum, item) => sum + item.book.price * item.quantity, 0);
  const totalCartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // Place order into C00_orders
  async function handleCheckout() {
    if (!token || cartItems.length === 0) return;
    try {
      const payload = {
        items: cartItems.map((ci) => ({ product_id: ci.book.id, quantity: ci.quantity })),
      };
      const res = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const orderData = await res.json();
        setCart({});
        setCartOpen(false);
        const msg =
          lang === "zh-TW"
            ? `訂單 #${orderData.id} 建立成功！結帳總額：$${orderData.total_amount.toFixed(2)}`
            : `Order #${orderData.id} placed successfully! Total: $${orderData.total_amount.toFixed(2)}`;
        setOrderSuccess(msg);
        setTimeout(() => setOrderSuccess(null), 6000);
      }
    } catch {
      alert(lang === "zh-TW" ? "訂單送出失敗，請重試。" : "Failed to place order.");
    }
  }

  function copyPromo(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    trackActivity("COPY_COUPON", "PROMOTION", undefined, `Copied promo code ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  }

  async function handleSendChat(e: FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    const userMsg = { sender: "user" as const, text: msg };
    setChatInput("");
    setChatMessages((prev) => [...prev, userMsg]);

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
        // Rate limit burst/daily quota hit
        const rateLimitMsg = `⚠️ ${data.detail || "Rate limit reached. Please wait before asking again."}`;
        setChatMessages((prev) => [...prev, { sender: "bot", text: rateLimitMsg }]);
      } else if (res.status === 401) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text:
              lang === "zh-TW"
                ? "登入狀態已過期，請重新登入後再進行提問。"
                : "Your session has expired. Please sign in again.",
          },
        ]);
      } else if (!res.ok) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text:
              lang === "zh-TW"
                ? "抱歉，目前客服系統忙碌中，請稍後再試。"
                : "Sorry, our assistant is temporarily busy. Please try again shortly.",
          },
        ]);
      } else {
        setChatMessages((prev) => [...prev, { sender: "bot", text: data.reply }]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text:
            lang === "zh-TW"
              ? "無法連線至書店伺服器，請確認後端運行中。"
              : "Unable to reach bookstore server. Please verify backend is running.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  // --- REUSABLE HEADER CONTROLS ---
  const ControlButtons = (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      {/* Activity Log Monitor Button */}
      <button
        onClick={loadSystemLogs}
        title="View System & Activity Logs"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 20,
          border: "1px solid var(--border-color)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <span>📊</span> {lang === "zh-TW" ? "系統日誌" : "System Logs"}
      </button>

      {/* Language Switcher */}
      <button
        onClick={toggleLang}
        title={t("lang_label")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 20,
          border: "1px solid var(--border-color)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <span>🌐</span> {lang === "en" ? "繁體中文" : "English"}
      </button>

      {/* Theme Switcher */}
      <button
        onClick={toggleTheme}
        title={t("theme_toggle_label")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 20,
          border: "1px solid var(--border-color)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <span>{theme === "light" ? "🌙" : "☀️"}</span>
        <span>{theme === "light" ? t("theme_dark") : t("theme_light")}</span>
      </button>
    </div>
  );

  // --- VIEW 1: SIGN IN / REGISTER SCREEN (WHEN NOT LOGGED IN) ---
  if (!user) {
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
        {/* Top-Right Theme & Language Controls on Login Page */}
        <div style={{ position: "absolute", top: 24, right: 24 }}>
          {ControlButtons}
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
              {authMode === "login" ? t("auth_sub_login") : t("auth_sub_register")}
            </p>
          </div>

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
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                {t("auth_pass_label")}
              </label>
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

          <div style={{ marginTop: 22, textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError("");
                setAuthMessage("");
              }}
              style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              {authMode === "login" ? t("auth_toggle_to_reg") : t("auth_toggle_to_log")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- VIEW 2: LOGGED IN BOOKSTORE HOMEPAGE ---
  return (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }}>
      {/* Toast Notification */}
      {orderSuccess && (
        <div style={{ position: "fixed", top: 20, right: 20, background: "#16a34a", color: "white", padding: "14px 22px", borderRadius: 10, boxShadow: "var(--shadow-lg)", zIndex: 120, fontWeight: 600 }}>
          🎉 {orderSuccess}
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg-navbar)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--border-color)",
          zIndex: 60,
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 22, color: "var(--accent)" }}>
          <span>📚</span> {localize(settings, "store_name")}
        </div>

        {/* Navigation links */}
        <nav style={{ display: "flex", gap: 24, fontSize: 15, fontWeight: 600 }}>
          <a href="#hero" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>{t("nav_introduce")}</a>
          <a href="#promotions" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>{t("nav_promotions")}</a>
          <a href="#recommended" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>{t("nav_recommended")}</a>
          <a href="#catalog" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>{t("nav_catalog")}</a>
          <a href="#about" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>{t("nav_about")}</a>
          <a href="#contact" style={{ textDecoration: "none", color: "var(--text-secondary)" }}>{t("nav_contact")}</a>
        </nav>

        {/* Right Action Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {ControlButtons}

          {/* Book Bag / Cart Button */}
          <button
            onClick={() => setCartOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--accent-light)",
              border: "1px solid var(--border-accent)",
              padding: "7px 16px",
              borderRadius: 20,
              cursor: "pointer",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            <span>🛍️</span> {t("nav_cart")} ({totalCartCount})
          </button>

          <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>👤 {user.email}</span>
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t("nav_logout")}
          </button>
        </div>
      </header>

      {/* 1. INTRODUCE / HERO SECTION */}
      <section
        id="hero"
        style={{
          background: "var(--bg-hero)",
          padding: "90px 24px 70px 24px",
          textAlign: "center",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <span
            style={{
              display: "inline-block",
              background: "var(--bg-card)",
              color: "var(--accent)",
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 16,
              boxShadow: "var(--shadow-sm)",
              border: "1px solid var(--border-color)",
            }}
          >
            ✨ {t("hero_badge")}
          </span>

          <h1
            style={{
              fontSize: 46,
              fontWeight: 900,
              color: "var(--text-hero-title)",
              margin: "0 0 16px 0",
              letterSpacing: "-0.5px",
              lineHeight: 1.25,
            }}
          >
            {localize(settings, "hero_title")}
          </h1>

          <p
            style={{
              fontSize: 18,
              color: "var(--text-hero-sub)",
              lineHeight: 1.6,
              maxWidth: 680,
              margin: "0 auto 32px auto",
            }}
          >
            {localize(settings, "hero_subtitle")}
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <a
              href="#catalog"
              style={{
                background: "var(--accent)",
                color: "white",
                padding: "14px 32px",
                borderRadius: 30,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 16,
                boxShadow: "var(--shadow-md)",
              }}
            >
              {t("hero_btn_explore")}
            </a>
            <a
              href="#about"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                padding: "14px 28px",
                borderRadius: 30,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 16,
                border: "1px solid var(--border-color)",
              }}
            >
              {t("hero_btn_story")}
            </a>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 36,
              marginTop: 50,
              color: "var(--text-hero-sub)",
              fontSize: 14,
              fontWeight: 600,
              flexWrap: "wrap",
            }}
          >
            <div>{t("hero_tag1")}</div>
            <div>{t("hero_tag2")}</div>
            <div>{t("hero_tag3")}</div>
          </div>
        </div>
      </section>

      {/* 2. PROMOTIONS SECTION */}
      <section id="promotions" style={{ padding: "70px 24px", maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 6px 0", color: "var(--text-primary)" }}>
            🎁 {t("promos_title")}
          </h2>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("promos_subtitle")}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {promotions.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                border: "1px solid var(--border-accent)",
                borderRadius: 16,
                overflow: "hidden",
                background: "var(--bg-card)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <img src={p.image_url} alt={localize(p, "title")} style={{ width: 140, objectFit: "cover" }} />
              <div style={{ padding: 18, display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
                <span
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    width: "fit-content",
                    marginBottom: 8,
                  }}
                >
                  {localize(p, "badge")}
                </span>
                <h3 style={{ margin: "0 0 8px 0", fontSize: 16, color: "var(--text-primary)" }}>
                  {localize(p, "title")}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>{t("promos_code_label")}:</span>
                  <button
                    onClick={() => copyPromo(p.discount_code)}
                    style={{
                      background: "var(--accent-light)",
                      border: "1px dashed var(--accent)",
                      color: "var(--accent)",
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {copiedCode === p.discount_code ? t("promos_copied") : p.discount_code}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. RECOMMENDED BOOKS SECTION */}
      <section
        id="recommended"
        style={{
          padding: "70px 24px",
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-color)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text-primary)" }}>
              ⭐ {t("recom_title")}
            </h2>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("recom_subtitle")}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
            {recommended.map((book) => (
              <div
                key={book.id}
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 16,
                  overflow: "hidden",
                  border: "1px solid var(--border-color)",
                  boxShadow: "var(--shadow-sm)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ position: "relative" }}>
                  <img src={book.image_url} alt={localize(book, "title")} style={{ width: "100%", height: 210, objectFit: "cover" }} />
                  <span
                    style={{
                      position: "absolute",
                      top: 10,
                      left: 10,
                      background: "var(--accent)",
                      color: "white",
                      padding: "4px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  >
                    {t("recom_badge")}
                  </span>
                </div>

                <div style={{ padding: 18, display: "flex", flexDirection: "column", flex: 1 }}>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
                    {localize(book, "title")}
                  </h3>
                  <p style={{ fontSize: 13, color: "var(--accent)", margin: "0 0 10px 0", fontWeight: 600 }}>
                    {t("by_author")} {localize(book, "author")}
                  </p>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px 0", flex: 1, lineHeight: 1.5 }}>
                    {localize(book, "short_desc")}
                  </p>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
                    <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
                      ${book.price.toFixed(2)}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => {
                          setSelectedBook(book);
                          trackActivity("VIEW_BOOK_DETAIL", "BOOK", book.id, book.title_en);
                        }}
                        style={{
                          padding: "7px 12px",
                          background: "var(--bg-subtle)",
                          color: "var(--text-primary)",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontSize: 13,
                          fontWeight: 600,
                        }}
                      >
                        {t("btn_details")}
                      </button>
                      <button
                        onClick={() => addToCart(book.id)}
                        style={{
                          padding: "7px 14px",
                          background: "var(--accent)",
                          color: "white",
                          border: "none",
                          borderRadius: 8,
                          cursor: "pointer",
                          fontWeight: 700,
                          fontSize: 13,
                        }}
                      >
                        {t("btn_add_cart")}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. BOOK CATALOG SECTION */}
      <section id="catalog" style={{ padding: "70px 24px", maxWidth: 1180, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text-primary)" }}>
            📖 {t("catalog_title")}
          </h2>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("catalog_subtitle")}</p>
        </div>

        {/* Dynamic Category Buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 36 }}>
          <button
            onClick={() => {
              setSelectedCat(null);
              trackActivity("FILTER_GENRE", "CATEGORY", undefined, "Viewed all genres");
            }}
            style={{
              padding: "9px 20px",
              borderRadius: 30,
              border: "1px solid var(--border-color)",
              background: selectedCat === null ? "var(--accent)" : "var(--bg-card)",
              color: selectedCat === null ? "white" : "var(--text-primary)",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {t("catalog_all")} ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCat(c.id);
                trackActivity("FILTER_GENRE", "CATEGORY", c.id, `Selected genre ${c.name_en}`);
              }}
              style={{
                padding: "9px 20px",
                borderRadius: 30,
                border: "1px solid var(--border-color)",
                background: selectedCat === c.id ? "var(--accent)" : "var(--bg-card)",
                color: selectedCat === c.id ? "white" : "var(--text-primary)",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {c.icon} {localize(c, "name")}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
          {products.map((book) => (
            <div
              key={book.id}
              style={{
                background: "var(--bg-card)",
                borderRadius: 16,
                overflow: "hidden",
                border: "1px solid var(--border-color)",
                boxShadow: "var(--shadow-sm)",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <img src={book.image_url} alt={localize(book, "title")} style={{ width: "100%", height: 210, objectFit: "cover" }} />
              <div style={{ padding: 18, display: "flex", flexDirection: "column", flex: 1 }}>
                <h3 style={{ margin: "0 0 4px 0", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
                  {localize(book, "title")}
                </h3>
                <p style={{ fontSize: 13, color: "var(--accent)", margin: "0 0 10px 0", fontWeight: 600 }}>
                  {t("by_author")} {localize(book, "author")}
                </p>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px 0", flex: 1, lineHeight: 1.5 }}>
                  {localize(book, "short_desc")}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
                  <span style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary)" }}>
                    ${book.price.toFixed(2)}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        setSelectedBook(book);
                        trackActivity("VIEW_BOOK_DETAIL", "BOOK", book.id, book.title_en);
                      }}
                      style={{
                        padding: "7px 12px",
                        background: "var(--bg-subtle)",
                        color: "var(--text-primary)",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 600,
                      }}
                    >
                      {t("btn_details")}
                    </button>
                    <button
                      onClick={() => addToCart(book.id)}
                      style={{
                        padding: "7px 14px",
                        background: "var(--accent)",
                        color: "white",
                        border: "none",
                        borderRadius: 8,
                        cursor: "pointer",
                        fontWeight: 700,
                        fontSize: 13,
                      }}
                    >
                      {t("btn_add_cart")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. ABOUT US SECTION */}
      <section
        id="about"
        style={{
          padding: "80px 24px",
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-color)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
          <span style={{ fontSize: 34 }}>🌿</span>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: "12px 0 16px 0", color: "var(--text-primary)" }}>
            {t("about_title")}
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.8, color: "var(--text-secondary)", margin: "0 auto 28px auto" }}>
            {localize(settings, "about_text")}
          </p>

          <div
            style={{
              display: "inline-flex",
              gap: 28,
              background: "var(--bg-card)",
              padding: "16px 36px",
              borderRadius: 16,
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-sm)",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <div>
              <strong>{t("about_stat1_title")}</strong>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("about_stat1_desc")}</div>
            </div>
            <div>
              <strong>{t("about_stat2_title")}</strong>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("about_stat2_desc")}</div>
            </div>
            <div>
              <strong>{t("about_stat3_title")}</strong>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("about_stat3_desc")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CONTACT US SECTION */}
      <section id="contact" style={{ padding: "80px 24px", maxWidth: 1040, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text-primary)" }}>
            📍 {t("contact_title")}
          </h2>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("contact_subtitle")}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          <div style={{ padding: 28, background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border-color)", textAlign: "center" }}>
            <span style={{ fontSize: 32 }}>📍</span>
            <h3 style={{ margin: "12px 0 6px 0", color: "var(--text-primary)" }}>{t("contact_location_title")}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>{localize(settings, "address")}</p>
          </div>
          <div style={{ padding: 28, background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border-color)", textAlign: "center" }}>
            <span style={{ fontSize: 32 }}>📞</span>
            <h3 style={{ margin: "12px 0 6px 0", color: "var(--text-primary)" }}>{t("contact_support_title")}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 4px 0" }}>{settings?.phone}</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>{settings?.email}</p>
          </div>
          <div style={{ padding: 28, background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border-color)", textAlign: "center" }}>
            <span style={{ fontSize: 32 }}>⏰</span>
            <h3 style={{ margin: "12px 0 6px 0", color: "var(--text-primary)" }}>{t("contact_hours_title")}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>{localize(settings, "opening_hours")}</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-color)",
          color: "var(--text-muted)",
          padding: "30px 24px",
          textAlign: "center",
          fontSize: 14,
        }}
      >
        © 2026 {localize(settings, "store_name")}. {t("footer_rights")}
      </footer>

      {/* MODAL: BOOK DETAIL POPUP */}
      {selectedBook && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            backdropFilter: "blur(5px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 110,
            padding: 20,
          }}
        >
          <div
            style={{
              background: "var(--bg-modal)",
              color: "var(--text-primary)",
              padding: 28,
              borderRadius: 20,
              maxWidth: 540,
              width: "100%",
              position: "relative",
              boxShadow: "var(--shadow-modal)",
              border: "1px solid var(--border-color)",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <button
              onClick={() => setSelectedBook(null)}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "var(--bg-subtle)",
                color: "var(--text-primary)",
                border: "none",
                borderRadius: "50%",
                width: 32,
                height: 32,
                cursor: "pointer",
                fontSize: 16,
                fontWeight: "bold",
              }}
            >
              ✕
            </button>

            <img
              src={selectedBook.image_url}
              alt={localize(selectedBook, "title")}
              style={{ width: "100%", height: 230, objectFit: "cover", borderRadius: 12, marginBottom: 18 }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>{localize(selectedBook, "title")}</h2>
              <span style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>
                ${selectedBook.price.toFixed(2)}
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--accent)", margin: "0 0 16px 0", fontWeight: 600 }}>
              {t("by_author")} {localize(selectedBook, "author")}
            </p>

            <h4 style={{ margin: "0 0 6px 0", fontSize: 14, color: "var(--text-secondary)" }}>{t("modal_synopsis")}</h4>
            <p style={{ color: "var(--text-primary)", lineHeight: 1.6, fontSize: 14, marginBottom: 18 }}>
              {localize(selectedBook.detail, "full_synopsis") || localize(selectedBook, "short_desc")}
            </p>

            <div
              style={{
                background: "var(--bg-secondary)",
                padding: 14,
                borderRadius: 12,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                fontSize: 13,
                marginBottom: 20,
                border: "1px solid var(--border-color)",
              }}
            >
              <div>🏛️ <strong>{t("modal_publisher")}:</strong> {localize(selectedBook.detail, "publisher")}</div>
              <div>📅 <strong>{t("modal_year")}:</strong> {selectedBook.detail?.publication_year}</div>
              <div>📖 <strong>{t("modal_pages")}:</strong> {selectedBook.detail?.page_count}</div>
              <div>📦 <strong>{t("modal_format")}:</strong> {localize(selectedBook.detail, "format")}</div>
              <div style={{ gridColumn: "1 / -1" }}>🔢 <strong>{t("modal_isbn")}:</strong> {selectedBook.detail?.isbn}</div>
            </div>

            <button
              onClick={() => {
                addToCart(selectedBook.id);
                setSelectedBook(null);
              }}
              style={{
                width: "100%",
                padding: 14,
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              {t("modal_add_btn")} • ${selectedBook.price.toFixed(2)}
            </button>
          </div>
        </div>
      )}

      {/* SLIDE-OUT BOOK BAG (CART) DRAWER */}
      {cartOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              width: "100%",
              maxWidth: 380,
              background: "var(--bg-modal)",
              color: "var(--text-primary)",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              padding: 24,
              boxShadow: "var(--shadow-modal)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>🛍️ {t("cart_title")} ({totalCartCount})</h2>
              <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              {cartItems.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-secondary)", marginTop: 80 }}>
                  <span style={{ fontSize: 48 }}>📚</span>
                  <p>{t("cart_empty")}</p>
                </div>
              ) : (
                cartItems.map(({ book, quantity }) => (
                  <div key={book.id} style={{ display: "flex", gap: 12, alignItems: "center", paddingBottom: 12, borderBottom: "1px solid var(--border-color)" }}>
                    <img src={book.image_url} alt={localize(book, "title")} style={{ width: 50, height: 65, borderRadius: 6, objectFit: "cover" }} />
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: "0 0 4px 0", fontSize: 14 }}>{localize(book, "title")}</h4>
                      <span style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13 }}>
                        ${(book.price * quantity).toFixed(2)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <button onClick={() => updateCartQty(book.id, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>-</button>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{quantity}</span>
                      <button onClick={() => updateCartQty(book.id, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 18, fontWeight: 800 }}>
                  <span>{t("cart_total")}:</span>
                  <span style={{ color: "var(--accent)" }}>${cartTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={handleCheckout}
                  style={{
                    width: "100%",
                    padding: 14,
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: 16,
                    cursor: "pointer",
                  }}
                >
                  {t("cart_checkout_btn")}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: SYSTEM ACTIVITY MONITOR (S00_ LOGS) */}
      {logsOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 115, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-modal)", color: "var(--text-primary)", width: "100%", maxWidth: 760, maxHeight: "85vh", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-modal)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>📊</span>
                <h3 style={{ margin: 0, fontSize: 18 }}>System Monitor (PostgreSQL S00_ Logs)</h3>
              </div>
              <button onClick={() => setLogsOpen(false)} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Log Tabs & Test Error Button */}
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
                onClick={triggerTestError}
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

            {/* Log Content List */}
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
                          <div style={{ color: "var(--text-secondary)", marginTop: 4, wordBreak: "break-all" }}>
                            Details: {log.details}
                          </div>
                        )}
                        <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>
                          IP: {log.ip_address}
                        </div>
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
                        <div style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 4, wordBreak: "break-all" }}>
                          Agent: {log.user_agent}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                errorLogs.length === 0 ? (
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
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* FLOATING SUPPORT CHATBOX (BOTTOM-RIGHT) */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 90 }}>
        {chatOpen ? (
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
            <div
              style={{
                padding: "14px 18px",
                background: "var(--accent)",
                color: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: "bold",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>📖</span> {t("chat_title")}
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}>✕</button>
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
              setChatOpen(true);
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
    </div>
  );
}
