import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";
import { useTheme } from "./contexts/ThemeContext";
import { useLanguage } from "./contexts/LanguageContext";
import { useAuth } from "./contexts/AuthContext";
import { useCart } from "./contexts/CartContext";
import { API_URL } from "./services/api";
import type {
  ActivityLog,
  Category,
  ErrorLog,
  LoginLog,
  NavigationMenuItem,
  Order,
  Product,
  Promotion,
  SiteSettings,
} from "./types";

import AdminPortal from "./components/AdminPortal";
import AdminLogin from "./components/AdminLogin";
import ResetPassword from "./components/ResetPassword";
import SignInView from "./components/storefront/SignInView";
import Navbar from "./components/storefront/Navbar";
import BookCard from "./components/storefront/BookCard";
import BookDetailModal from "./components/storefront/BookDetailModal";
import CartDrawer from "./components/storefront/CartDrawer";
import CheckoutModal from "./components/storefront/CheckoutModal";
import OrderSuccessModal from "./components/storefront/OrderSuccessModal";
import ProfileModal from "./components/storefront/ProfileModal";
import LogsModal from "./components/storefront/LogsModal";
import BatchImportModal from "./components/storefront/BatchImportModal";
import ChatWidget from "./components/storefront/ChatWidget";

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t, localize } = useLanguage();
  const { token, user, isManager, loginWithToken, logout, trackActivity } = useAuth();
  const { registerBooks, setCartOpen, clearShoppingSession } = useCart();

  // Storefront data from PostgreSQL
  const [navMenus, setNavMenus] = useState<NavigationMenuItem[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);

  // Interactive UI states
  const [selectedBook, setSelectedBook] = useState<Product | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [orderSuccessToast, setOrderSuccessToast] = useState<string | null>(null);

  // Modals
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<Order | null>(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalTab, setUserModalTab] = useState<"orders" | "profile" | "bought_items" | "wishlist">("orders");
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);

  // Orders & Logs state
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);

  function reloadCatalog() {
    fetch(`${API_URL}/api/categories`).then((r) => r.ok && r.json()).then(setCategories);
    fetch(`${API_URL}/api/products/recommended`)
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRecommended(data);
          registerBooks(data);
        }
      });
    const url = selectedCat ? `${API_URL}/api/products?category_id=${selectedCat}` : `${API_URL}/api/products`;
    fetch(url)
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data);
          registerBooks(data);
        }
      });
  }

  useEffect(() => {
    fetch(`${API_URL}/api/settings`).then((r) => r.ok && r.json()).then(setSettings);
    fetch(`${API_URL}/api/promotions`).then((r) => r.ok && r.json()).then(setPromotions);
    fetch(`${API_URL}/api/categories`).then((r) => r.ok && r.json()).then(setCategories);
    fetch(`${API_URL}/api/products/recommended`)
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRecommended(data);
          registerBooks(data);
        }
      });
    fetch(`${API_URL}/api/navigation`)
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) setNavMenus(data);
      })
      .catch((e) => console.error("Failed to load navigation menus", e));
  }, []);

  useEffect(() => {
    const url = selectedCat ? `${API_URL}/api/products?category_id=${selectedCat}` : `${API_URL}/api/products`;
    fetch(url)
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setProducts(data);
          registerBooks(data);
        }
      });
  }, [selectedCat]);

  function loadMyOrders() {
    if (!token) return;
    setLoadingMyOrders(true);
    fetch(`${API_URL}/api/orders/my-orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) setMyOrders(data);
      })
      .finally(() => setLoadingMyOrders(false));
  }

  useEffect(() => {
    if (token) {
      loadMyOrders();
    } else {
      setMyOrders([]);
    }
  }, [token]);

  function loadSystemLogs() {
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_URL}/api/system/logins`, { headers: authHeaders }).then((r) => r.ok && r.json()).then(setLoginLogs);
    fetch(`${API_URL}/api/system/activities`, { headers: authHeaders }).then((r) => r.ok && r.json()).then(setActivityLogs);
    fetch(`${API_URL}/api/system/errors`, { headers: authHeaders }).then((r) => r.ok && r.json()).then(setErrorLogs);
    setLogsOpen(true);
  }

  function triggerTestError() {
    fetch(`${API_URL}/api/system/test-error`).finally(() => {
      setTimeout(loadSystemLogs, 400);
    });
  }

  function copyPromo(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    trackActivity("COPY_COUPON", "PROMOTION", undefined, `Copied promo code ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  }

  function handleOpenCheckout() {
    if (!token) {
      alert(lang === "zh-TW" ? "請先登入會員以進行結帳。" : "Please log in to proceed with checkout.");
      return;
    }
    setCartOpen(false);
    setCheckoutModalOpen(true);
  }

  const CustomerStorefrontView = (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }}>
      {orderSuccessToast && (
        <div style={{ position: "fixed", top: 20, right: 20, background: "#16a34a", color: "white", padding: "14px 22px", borderRadius: 10, boxShadow: "var(--shadow-lg)", zIndex: 120, fontWeight: 600 }}>
          🎉 {orderSuccessToast}
        </div>
      )}

      <Navbar
        settings={settings}
        navMenus={navMenus}
        ordersCount={myOrders.length}
        onOpenUserModal={(tab) => {
          if (tab === "orders") loadMyOrders();
          setUserModalTab(tab);
          setUserModalOpen(true);
        }}
        onOpenChat={() => setChatOpen(true)}
        onOpenLogs={loadSystemLogs}
        onOpenImport={() => setExcelModalOpen(true)}
      />

      {/* 1. HERO SECTION */}
      <section
        id="hero"
        style={{
          background: "var(--bg-hero)",
          padding: "90px 24px 70px 24px",
          textAlign: "center",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
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

          <h1 style={{ fontSize: 46, fontWeight: 900, color: "var(--text-hero-title)", margin: "0 0 16px 0", letterSpacing: "-0.5px", lineHeight: 1.25 }}>
            {localize(settings, "hero_title")}
          </h1>

          <p style={{ fontSize: 18, color: "var(--text-hero-sub)", lineHeight: 1.6, maxWidth: 820, margin: "0 auto 32px auto" }}>
            {localize(settings, "hero_subtitle")}
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <a href="#catalog" style={{ background: "var(--accent)", color: "white", padding: "14px 32px", borderRadius: 30, textDecoration: "none", fontWeight: 700, fontSize: 16, boxShadow: "var(--shadow-md)" }}>
              {t("hero_btn_explore")}
            </a>
            <a href="#about" style={{ background: "var(--bg-card)", color: "var(--text-primary)", padding: "14px 28px", borderRadius: 30, textDecoration: "none", fontWeight: 700, fontSize: 16, border: "1px solid var(--border-color)" }}>
              {t("hero_btn_story")}
            </a>
          </div>

          <div style={{ display: "flex", justifyContent: "center", gap: 36, marginTop: 50, color: "var(--text-hero-sub)", fontSize: 14, fontWeight: 600, flexWrap: "wrap" }}>
            <div>{t("hero_tag1")}</div>
            <div>{t("hero_tag2")}</div>
            <div>{t("hero_tag3")}</div>
          </div>
        </div>
      </section>

      {/* 2. PROMOTIONS SECTION */}
      <section id="promotions" style={{ padding: "70px 24px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 6px 0", color: "var(--text-primary)" }}>
            🎁 {t("promos_title")}
          </h2>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("promos_subtitle")}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {promotions.map((p) => (
            <div key={p.id} style={{ display: "flex", border: "1px solid var(--border-accent)", borderRadius: 16, overflow: "hidden", background: "var(--bg-card)", boxShadow: "var(--shadow-sm)" }}>
              <img src={p.image_url} alt={localize(p, "title")} style={{ width: 140, objectFit: "cover" }} />
              <div style={{ padding: 18, display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
                <span style={{ background: "var(--accent)", color: "white", padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800, width: "fit-content", marginBottom: 8 }}>
                  {localize(p, "badge")}
                </span>
                <h3 style={{ margin: "0 0 8px 0", fontSize: 16, color: "var(--text-primary)" }}>{localize(p, "title")}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>{t("promos_code_label")}:</span>
                  <button
                    onClick={() => copyPromo(p.discount_code)}
                    style={{ background: "var(--accent-light)", border: "1px dashed var(--accent)", color: "var(--accent)", padding: "3px 8px", borderRadius: 4, fontWeight: 700, cursor: "pointer", fontSize: 12 }}
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
      <section id="recommended" style={{ padding: "70px 24px", background: "var(--bg-secondary)", borderTop: "1px solid var(--border-color)", borderBottom: "1px solid var(--border-color)", width: "100%", boxSizing: "border-box" }}>
        <div style={{ width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text-primary)" }}>
              ⭐ {t("recom_title")}
            </h2>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("recom_subtitle")}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
            {recommended.map((book) => (
              <BookCard key={book.id} book={book} showRecommendedBadge onSelectBook={setSelectedBook} />
            ))}
          </div>
        </div>
      </section>

      {/* 4. BOOK CATALOG SECTION */}
      <section id="catalog" style={{ padding: "70px 24px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30, flexWrap: "wrap", gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text-primary)" }}>
              📖 {t("catalog_title")}
            </h2>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("catalog_subtitle")}</p>
          </div>
          {isManager && (
            <button
              onClick={() => setExcelModalOpen(true)}
              style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--accent-light)", border: "1px solid var(--border-accent)", padding: "9px 18px", borderRadius: 24, cursor: "pointer", fontWeight: 700, fontSize: 14, color: "var(--accent)" }}
            >
              <span>📊</span> {lang === "zh-TW" ? "批次匯入書籍 (.xlsx / .docx)" : "Batch Import (.xlsx / .docx)"}
            </button>
          )}
        </div>

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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
          {products.map((book) => (
            <BookCard key={book.id} book={book} onSelectBook={setSelectedBook} />
          ))}
        </div>
      </section>

      {/* 5. ABOUT US SECTION */}
      <section id="about" style={{ padding: "80px 32px", background: "var(--bg-secondary)", borderTop: "1px solid var(--border-color)", textAlign: "center" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <span style={{ fontSize: 34 }}>🌿</span>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: "12px 0 16px 0", color: "var(--text-primary)" }}>{t("about_title")}</h2>
          <p style={{ fontSize: 17, lineHeight: 1.8, color: "var(--text-secondary)", margin: "0 auto 28px auto" }}>{localize(settings, "about_text")}</p>
          <div style={{ display: "inline-flex", gap: 28, background: "var(--bg-card)", padding: "16px 36px", borderRadius: 16, border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)", flexWrap: "wrap", justifyContent: "center" }}>
            <div><strong>{t("about_stat1_title")}</strong><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("about_stat1_desc")}</div></div>
            <div><strong>{t("about_stat2_title")}</strong><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("about_stat2_desc")}</div></div>
            <div><strong>{t("about_stat3_title")}</strong><div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("about_stat3_desc")}</div></div>
          </div>
        </div>
      </section>

      {/* 6. CONTACT US SECTION */}
      <section id="contact" style={{ padding: "80px 24px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text-primary)" }}>📍 {t("contact_title")}</h2>
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

      <footer style={{ background: "var(--bg-secondary)", borderTop: "1px solid var(--border-color)", color: "var(--text-muted)", padding: "30px 24px", textAlign: "center", fontSize: 14 }}>
        © 2026 {localize(settings, "store_name")}. {t("footer_rights")}
      </footer>

      {/* Storefront Modals & Widgets */}
      <BookDetailModal book={selectedBook} onClose={() => setSelectedBook(null)} />
      <CartDrawer onCheckout={handleOpenCheckout} />
      <CheckoutModal
        open={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        onOrderSuccess={(orderData) => {
          setCheckoutSuccessOrder(orderData);
          const successMsg =
            lang === "zh-TW"
              ? `訂單 #${orderData.id} 建立成功！結帳總額：$${orderData.total_amount.toFixed(2)}`
              : `Order #${orderData.id} placed successfully! Total: $${orderData.total_amount.toFixed(2)}`;
          setOrderSuccessToast(successMsg);
          setTimeout(() => setOrderSuccessToast(null), 6000);
          loadMyOrders();
        }}
      />
      <OrderSuccessModal
        order={checkoutSuccessOrder}
        onClose={() => setCheckoutSuccessOrder(null)}
        onTrackLive={(orderId) => {
          setCheckoutSuccessOrder(null);
          setUserModalTab("orders");
          setActiveTrackingOrderId(orderId);
          loadMyOrders();
          setUserModalOpen(true);
        }}
      />
      <ProfileModal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        activeTab={userModalTab}
        setActiveTab={setUserModalTab}
        myOrders={myOrders}
        loadingMyOrders={loadingMyOrders}
        activeTrackingOrderId={activeTrackingOrderId}
      />
      <LogsModal
        open={logsOpen}
        onClose={() => setLogsOpen(false)}
        loginLogs={loginLogs}
        activityLogs={activityLogs}
        errorLogs={errorLogs}
        onTriggerTestError={triggerTestError}
      />
      <BatchImportModal open={excelModalOpen} onClose={() => setExcelModalOpen(false)} onImportComplete={reloadCatalog} />
      <ChatWidget open={chatOpen} setOpen={setChatOpen} />
    </div>
  );

  return (
    <Routes>
      <Route
        path="/admin/login"
        element={<AdminLogin onLoginSuccess={(tok, usr) => loginWithToken(tok, usr)} lang={lang} />}
      />
      <Route
        path="/admin"
        element={
          <AdminPortal
            user={user}
            token={token}
            onLogout={() => {
              clearShoppingSession();
              logout();
            }}
            lang={lang}
            toggleLang={toggleLang}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        }
      />
      <Route path="/reset-password" element={<ResetPassword lang={lang} />} />
      <Route path="*" element={!user ? <SignInView settings={settings} /> : CustomerStorefrontView} />
    </Routes>
  );
}
