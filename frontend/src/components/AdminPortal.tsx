import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface AdminPortalProps {
  user: { id: number; email: string; role?: string } | null;
  token: string | null;
  onLogout: () => void;
  lang: "en" | "zh-TW";
  toggleLang: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
}

interface OverviewData {
  manager_email: string;
  role: string;
  total_books: number;
  total_categories: number;
  total_users: number;
  total_orders: number;
}

interface AdminOrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product_title_en?: string;
  product_title_zh?: string;
  product_image_url?: string;
}

interface AdminOrder {
  id: number;
  user_id: number;
  total_amount: number;
  shipping_fee: number;
  status: string;
  delivery_method: string;
  payment_method: string;
  recipient_name?: string;
  recipient_phone?: string;
  shipping_address?: string;
  delivery_notes?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  created_at: string;
  items: AdminOrderItem[];
}

export default function AdminPortal({
  user,
  token,
  onLogout,
  lang,
  toggleLang,
  theme,
  toggleTheme,
}: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "products" | "import" | "logs">("overview");

  // Overview KPIs
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // Orders Management
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  // Products
  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Logs
  const [logSubTab, setLogSubTab] = useState<"activity" | "login" | "error">("activity");
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Import State
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState("");

  const isManager =
    user?.role === "manager" ||
    user?.role === "superadmin" ||
    user?.email === "react@mail" ||
    user?.email === "react@mail.com";

  useEffect(() => {
    if (!token || !isManager) return;
    loadOverview();
    loadOrders();
    loadProducts();
    loadLogs("activity");
  }, [token, isManager]);

  function loadOverview() {
    setLoadingOverview(true);
    fetch(`${API_URL}/api/admin/overview`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok && r.json())
      .then(setOverview)
      .finally(() => setLoadingOverview(false));
  }

  function loadOrders() {
    setLoadingOrders(true);
    fetch(`${API_URL}/api/admin/orders`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) setOrders(data);
      })
      .finally(() => setLoadingOrders(false));
  }

  async function handleUpdateOrderStatus(orderId: number, newStatus: string) {
    setUpdatingOrderId(orderId);
    try {
      const res = await fetch(`${API_URL}/api/admin/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setOrders((prev) => prev.map((o) => (o.id === orderId ? updated : o)));
      }
    } catch (err) {
      console.error("Failed to update order status", err);
    } finally {
      setUpdatingOrderId(null);
    }
  }

  function loadProducts() {
    setLoadingProducts(true);
    fetch(`${API_URL}/api/products`)
      .then((r) => r.ok && r.json())
      .then((data) => setProducts(Array.isArray(data) ? data : []))
      .finally(() => setLoadingProducts(false));
  }

  function loadLogs(tab: "activity" | "login" | "error") {
    setLoadingLogs(true);
    const endpoint =
      tab === "activity"
        ? "/api/system/activities"
        : tab === "login"
        ? "/api/system/logins"
        : "/api/system/errors";

    fetch(`${API_URL}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          if (tab === "activity") setActivityLogs(data);
          else if (tab === "login") setLoginLogs(data);
          else setErrorLogs(data);
        }
      })
      .finally(() => setLoadingLogs(false));
  }

  async function handleDownloadExcelTemplate() {
    try {
      const res = await fetch(`${API_URL}/api/products/excel-template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.detail || "Access denied.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "apex_books_template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Download error: " + err.message);
    }
  }

  async function handleDownloadWordTemplate() {
    try {
      const res = await fetch(`${API_URL}/api/products/word-template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.detail || "Access denied.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "apex_books_template.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Download error: " + err.message);
    }
  }

  async function handleImportSubmit(e: FormEvent) {
    e.preventDefault();
    if (!importFile) {
      setImportError(lang === "zh-TW" ? "請先選擇欲匯入的檔案 (.xlsx, .xls 或 .docx)" : "Please select an Excel (.xlsx/.xls) or Word (.docx) file first");
      return;
    }
    const isWord = importFile.name.toLowerCase().endsWith(".docx");
    const isExcel = importFile.name.toLowerCase().endsWith(".xlsx") || importFile.name.toLowerCase().endsWith(".xls");

    if (!isWord && !isExcel) {
      setImportError(lang === "zh-TW" ? "不支援的檔案格式，請上傳 .xlsx, .xls 或 .docx 檔案" : "Unsupported file format. Please upload .xlsx, .xls or .docx");
      return;
    }

    setImportLoading(true);
    setImportError("");
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", importFile);

    const endpoint = isWord ? `${API_URL}/api/products/import-word` : `${API_URL}/api/products/import-excel`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.detail || "Import failed");
      } else {
        setImportResult(data);
        loadOverview();
        loadProducts();
      }
    } catch (err: any) {
      setImportError(err.message || "Network error during upload");
    } finally {
      setImportLoading(false);
    }
  }

  // Security Gate
  if (!user || !isManager) {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <div style={{ maxWidth: 500, width: "100%", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 16, padding: 32, textAlign: "center", boxShadow: "var(--shadow-md)" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ margin: "0 0 10px 0", fontSize: 24, fontWeight: 800 }}>
            {lang === "zh-TW" ? "管理後台權限管制" : "Manager Portal Access Restricted"}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            {lang === "zh-TW"
              ? "此區域僅開放書店管理團隊 (manager / react@mail) 存取。一般顧客帳號無法存取管理控制台。"
              : "This administrative workspace is reserved for authorized bookstore management personnel. Customers cannot access this portal."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <Link
              to="/"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                borderRadius: 8,
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                textDecoration: "none",
                fontWeight: 700,
                border: "1px solid var(--border-color)",
              }}
            >
              ← {lang === "zh-TW" ? "返回書店前台" : "Back to Storefront"}
            </Link>
            <Link
              to="/admin/login"
              style={{
                display: "inline-block",
                padding: "10px 20px",
                borderRadius: 8,
                background: "var(--accent)",
                color: "white",
                textDecoration: "none",
                fontWeight: 700,
              }}
            >
              {lang === "zh-TW" ? "管理員登入" : "Manager Login"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const filteredProducts = products.filter((p) => {
    const q = searchTerm.toLowerCase();
    return (
      p.title_en?.toLowerCase().includes(q) ||
      p.title_zh?.toLowerCase().includes(q) ||
      p.author_en?.toLowerCase().includes(q) ||
      p.detail?.isbn?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
      {/* Top Manager Navigation Bar */}
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg-navbar)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--border-color)",
          zIndex: 60,
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 22 }}>⚙️</span>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: "var(--accent)", letterSpacing: -0.3 }}>
              Apex Book Haven
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>
              {lang === "zh-TW" ? "門市管理後台系統" : "Store Management Portal"}
            </div>
          </div>
          <span
            style={{
              marginLeft: 8,
              background: "#059669",
              color: "white",
              padding: "2px 8px",
              borderRadius: 12,
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            {user.role?.toUpperCase() || "MANAGER"}
          </span>
        </div>

        {/* Manager Control Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={toggleLang}
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
            }}
          >
            🌐 {lang === "zh-TW" ? "English" : "繁體中文"}
          </button>

          <button
            onClick={toggleTheme}
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
            }}
          >
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>

          <Link
            to="/"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            🏪 {lang === "zh-TW" ? "前往顧客前台" : "Storefront"}
          </Link>

          <button
            onClick={onLogout}
            style={{
              padding: "6px 12px",
              borderRadius: 20,
              border: "1px solid #fecaca",
              background: "#fef2f2",
              color: "#991b1b",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {lang === "zh-TW" ? "登出" : "Sign Out"}
          </button>
        </div>
      </header>

      {/* Main Manager Body with Tabs */}
      <div style={{ flex: 1, padding: "28px 24px", maxWidth: 1260, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: 10, borderBottom: "1px solid var(--border-color)", paddingBottom: 12, marginBottom: 24, flexWrap: "wrap" }}>
          <button
            onClick={() => setActiveTab("overview")}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: activeTab === "overview" ? "var(--accent)" : "var(--bg-secondary)",
              color: activeTab === "overview" ? "white" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>📊</span> {lang === "zh-TW" ? "營運總覽" : "Overview Dashboard"}
          </button>

          <button
            onClick={() => {
              setActiveTab("orders");
              loadOrders();
            }}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: activeTab === "orders" ? "var(--accent)" : "var(--bg-secondary)",
              color: activeTab === "orders" ? "white" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>📦</span> {lang === "zh-TW" ? "訂單配送管理" : "Orders & Fulfillment"} ({orders.length})
          </button>

          <button
            onClick={() => setActiveTab("products")}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: activeTab === "products" ? "var(--accent)" : "var(--bg-secondary)",
              color: activeTab === "products" ? "white" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>📚</span> {lang === "zh-TW" ? "書籍目錄管理" : "Book Catalog"} ({products.length})
          </button>

          <button
            onClick={() => setActiveTab("import")}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: activeTab === "import" ? "var(--accent)" : "var(--bg-secondary)",
              color: activeTab === "import" ? "white" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>📥</span> {lang === "zh-TW" ? "批次匯入 (Excel / Word)" : "Bulk Import (Excel / Word)"}
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: activeTab === "logs" ? "var(--accent)" : "var(--bg-secondary)",
              color: activeTab === "logs" ? "white" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>🛡️</span> {lang === "zh-TW" ? "系統日誌與稽核" : "System Logs & Audit"}
          </button>
        </div>

        {/* TAB 1: OVERVIEW DASHBOARD */}
        {activeTab === "overview" && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 800 }}>
                {lang === "zh-TW" ? "門市營運總覽" : "Store Operations Overview"}
              </h2>
              <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
                {lang === "zh-TW" ? `目前登入管理員：${user.email}` : `Logged in as manager: ${user.email}`}
              </p>
            </div>

            {/* KPI Cards Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 30 }}>
              <div style={{ padding: 22, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
                  📚 {lang === "zh-TW" ? "已上架書籍總數" : "Total Books in Catalog"}
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "var(--accent)" }}>
                  {loadingOverview ? "..." : (overview?.total_books ?? "...")}
                </div>
              </div>

              <div style={{ padding: 22, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
                  🏷️ {lang === "zh-TW" ? "書籍分類類別" : "Active Categories"}
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#2563eb" }}>
                  {overview?.total_categories ?? "..."}
                </div>
              </div>

              <div style={{ padding: 22, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
                  👥 {lang === "zh-TW" ? "註冊會員帳號" : "Registered Users"}
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#059669" }}>
                  {overview?.total_users ?? "..."}
                </div>
              </div>

              <div style={{ padding: 22, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
                  📦 {lang === "zh-TW" ? "顧客訂單筆數" : "Processed Orders"}
                </div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#d97706" }}>
                  {overview?.total_orders ?? "..."}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ padding: 24, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
              <h3 style={{ margin: "0 0 14px 0", fontSize: 18, fontWeight: 800 }}>
                ⚡ {lang === "zh-TW" ? "管理員快速作業" : "Quick Operations"}
              </h3>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setActiveTab("orders");
                    loadOrders();
                  }}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  📦 {lang === "zh-TW" ? "管理顧客訂單與出貨" : "Manage Customer Orders"}
                </button>
                <button
                  onClick={() => setActiveTab("import")}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-color)",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  📥 {lang === "zh-TW" ? "執行 Excel / Word 批次匯入" : "Bulk Import Books"}
                </button>
                <button
                  onClick={() => setActiveTab("products")}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-color)",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  📖 {lang === "zh-TW" ? "檢視庫存書單" : "Browse Inventory Table"}
                </button>
                <button
                  onClick={() => setActiveTab("logs")}
                  style={{
                    padding: "10px 18px",
                    borderRadius: 8,
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-color)",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  🛡️ {lang === "zh-TW" ? "稽核登入與系統操作" : "Audit Security Logs"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ORDERS & FULFILLMENT MANAGEMENT */}
        {activeTab === "orders" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 800 }}>
                  📦 {lang === "zh-TW" ? "顧客訂單與物流出貨管理" : "Customer Orders & Fulfillment Management"}
                </h2>
                <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
                  {lang === "zh-TW"
                    ? "審查顧客訂單、配送方式、付款方式並即時更新配送物流進度"
                    : "Review store orders, delivery & payment options, and update live shipment tracking."}
                </p>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button
                  onClick={loadOrders}
                  disabled={loadingOrders}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "var(--bg-secondary)",
                    color: "var(--text-primary)",
                    border: "1px solid var(--border-color)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  🔄 {loadingOrders ? (lang === "zh-TW" ? "重新整理中..." : "Refreshing...") : (lang === "zh-TW" ? "重新整理" : "Refresh Orders")}
                </button>
              </div>
            </div>

            {/* Filter Pills & Search */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[
                  { key: "all", label: lang === "zh-TW" ? "全部訂單" : "All Orders", count: orders.length },
                  { key: "Processing", label: lang === "zh-TW" ? "處理中" : "Processing", count: orders.filter((o) => o.status === "Processing").length },
                  { key: "Confirmed", label: lang === "zh-TW" ? "已確認" : "Confirmed", count: orders.filter((o) => o.status === "Confirmed").length },
                  { key: "Shipped", label: lang === "zh-TW" ? "已出貨" : "Shipped", count: orders.filter((o) => o.status === "Shipped").length },
                  { key: "Out for Delivery", label: lang === "zh-TW" ? "配送中" : "Out for Delivery", count: orders.filter((o) => o.status === "Out for Delivery").length },
                  { key: "Delivered", label: lang === "zh-TW" ? "已送達" : "Delivered", count: orders.filter((o) => o.status === "Delivered").length },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setOrderStatusFilter(f.key)}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 20,
                      border: "1px solid",
                      borderColor: orderStatusFilter === f.key ? "var(--accent)" : "var(--border-color)",
                      background: orderStatusFilter === f.key ? "var(--accent-light)" : "var(--bg-card)",
                      color: orderStatusFilter === f.key ? "var(--accent)" : "var(--text-secondary)",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {f.label} ({f.count})
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={orderSearchTerm}
                onChange={(e) => setOrderSearchTerm(e.target.value)}
                placeholder={lang === "zh-TW" ? "🔍 搜尋訂單號、收件人、電話或追蹤號..." : "🔍 Search by Order #, Recipient, Phone, Tracking..."}
                style={{
                  padding: "9px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  fontSize: 13,
                  width: 320,
                  maxWidth: "100%",
                }}
              />
            </div>

            {/* Orders Cards List */}
            {loadingOrders && orders.length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
                <span style={{ fontSize: 36 }}>⏳</span>
                <p>{lang === "zh-TW" ? "正在載入訂單資料..." : "Loading store orders..."}</p>
              </div>
            ) : orders.filter((o) => {
                const matchStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
                const q = orderSearchTerm.toLowerCase();
                const matchSearch =
                  !q ||
                  o.id.toString().includes(q) ||
                  o.tracking_number?.toLowerCase().includes(q) ||
                  o.recipient_name?.toLowerCase().includes(q) ||
                  o.recipient_phone?.toLowerCase().includes(q) ||
                  o.shipping_address?.toLowerCase().includes(q);
                return matchStatus && matchSearch;
              }).length === 0 ? (
              <div style={{ textAlign: "center", padding: 60, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border-color)" }}>
                <span style={{ fontSize: 48 }}>📦</span>
                <h3 style={{ margin: "10px 0 6px 0" }}>{lang === "zh-TW" ? "查無符合條件的訂單" : "No Matching Orders Found"}</h3>
                <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
                  {lang === "zh-TW" ? "目前無符合搜尋條件或狀態的訂單記錄。" : "No orders match the current filter or search criteria."}
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {orders
                  .filter((o) => {
                    const matchStatus = orderStatusFilter === "all" || o.status === orderStatusFilter;
                    const q = orderSearchTerm.toLowerCase();
                    const matchSearch =
                      !q ||
                      o.id.toString().includes(q) ||
                      o.tracking_number?.toLowerCase().includes(q) ||
                      o.recipient_name?.toLowerCase().includes(q) ||
                      o.recipient_phone?.toLowerCase().includes(q) ||
                      o.shipping_address?.toLowerCase().includes(q);
                    return matchStatus && matchSearch;
                  })
                  .map((order) => {
                    const statusColors: Record<string, { bg: string; text: string; border: string }> = {
                      Processing: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
                      Confirmed: { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
                      Shipped: { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" },
                      "Out for Delivery": { bg: "#ffedd5", text: "#9a3412", border: "#fed7aa" },
                      Delivered: { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
                    };
                    const color = statusColors[order.status] || { bg: "#f3f4f6", text: "#374151", border: "#e5e7eb" };

                    return (
                      <div
                        key={order.id}
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-color)",
                          borderRadius: 14,
                          padding: 20,
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        {/* Order Header */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-color)", paddingBottom: 14, marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 17, fontWeight: 900 }}>
                                #{order.id}
                              </span>
                              {order.tracking_number && (
                                <span
                                  style={{
                                    fontFamily: "monospace",
                                    fontSize: 12,
                                    background: "var(--bg-secondary)",
                                    border: "1px solid var(--border-color)",
                                    padding: "2px 8px",
                                    borderRadius: 6,
                                    fontWeight: 700,
                                    color: "var(--text-secondary)",
                                  }}
                                >
                                  🚚 {order.tracking_number}
                                </span>
                              )}
                              <span
                                style={{
                                  background: color.bg,
                                  color: color.text,
                                  border: `1px solid ${color.border}`,
                                  padding: "3px 10px",
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: 800,
                                }}
                              >
                                {order.status}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                              {lang === "zh-TW" ? "下單時間：" : "Placed on: "}
                              {new Date(order.created_at).toLocaleString()}
                            </div>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--accent)" }}>
                              ${order.total_amount.toFixed(2)}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                              {lang === "zh-TW" ? `運費 $${order.shipping_fee.toFixed(2)}` : `Shipping: $${order.shipping_fee.toFixed(2)}`}
                            </div>
                          </div>
                        </div>

                        {/* Order Details Grid */}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
                          {/* Recipient Details */}
                          <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 10, fontSize: 13 }}>
                            <div style={{ fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>
                              👤 {lang === "zh-TW" ? "收件人資訊" : "Recipient Details"}
                            </div>
                            <div><strong>{order.recipient_name || "N/A"}</strong></div>
                            <div style={{ color: "var(--text-secondary)" }}>📞 {order.recipient_phone || "N/A"}</div>
                            <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>📍 {order.shipping_address || "N/A"}</div>
                            {order.delivery_notes && (
                              <div style={{ color: "#d97706", fontSize: 12, marginTop: 4 }}>
                                📝 {lang === "zh-TW" ? "備註：" : "Notes: "} {order.delivery_notes}
                              </div>
                            )}
                          </div>

                          {/* Shipping & Payment Method */}
                          <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 10, fontSize: 13 }}>
                            <div style={{ fontWeight: 800, marginBottom: 6, color: "var(--text-primary)" }}>
                              🚚 {lang === "zh-TW" ? "配送與付款方式" : "Delivery & Payment"}
                            </div>
                            <div style={{ marginBottom: 4 }}>
                              <strong>{lang === "zh-TW" ? "配送：" : "Method: "}</strong>
                              {order.delivery_method === "express" ? (
                                <span style={{ color: "#7c3aed", fontWeight: 700 }}>⚡ {lang === "zh-TW" ? "快捷快遞 (隔日達)" : "Express Courier (Next Day)"}</span>
                              ) : order.delivery_method === "pickup" ? (
                                <span style={{ color: "#059669", fontWeight: 700 }}>🏬 {lang === "zh-TW" ? "門市自取 (免運費)" : "Store Pickup (Free)"}</span>
                              ) : (
                                <span style={{ fontWeight: 700 }}>🚚 {lang === "zh-TW" ? "標準宅配 (3-5個工作天)" : "Standard Delivery (3-5 Days)"}</span>
                              )}
                            </div>
                            <div style={{ marginBottom: 4 }}>
                              <strong>{lang === "zh-TW" ? "付款：" : "Payment: "}</strong>
                              {order.payment_method === "apple_pay" ? "📱 Apple / Google Pay" :
                               order.payment_method === "cod" ? "💵 Cash on Delivery (貨到付款)" :
                               order.payment_method === "bank_transfer" ? "🏦 Bank Transfer (銀行轉帳)" :
                               "💳 Credit / Debit Card (信用卡)"}
                            </div>
                            {order.estimated_delivery && (
                              <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                                ⏱️ {order.estimated_delivery}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Items Purchased List */}
                        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 12, marginBottom: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                            📚 {lang === "zh-TW" ? "購買書籍項目" : "Items in this order"} ({order.items.length})
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {order.items.map((item) => (
                              <div
                                key={item.id}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  fontSize: 13,
                                  background: "var(--bg-card)",
                                  padding: "6px 10px",
                                  borderRadius: 8,
                                  border: "1px solid var(--border-color)",
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  {item.product_image_url ? (
                                    <img
                                      src={item.product_image_url}
                                      alt="Book cover"
                                      style={{ width: 32, height: 44, objectFit: "cover", borderRadius: 4 }}
                                    />
                                  ) : (
                                    <span style={{ fontSize: 20 }}>📖</span>
                                  )}
                                  <div>
                                    <div style={{ fontWeight: 700 }}>
                                      {lang === "zh-TW" ? item.product_title_zh || item.product_title_en : item.product_title_en}
                                    </div>
                                    <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                                      ${item.unit_price.toFixed(2)} × {item.quantity}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ fontWeight: 800, color: "var(--accent)" }}>
                                  ${(item.unit_price * item.quantity).toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Manager Fulfillment Status Controls */}
                        <div
                          style={{
                            background: "var(--bg-secondary)",
                            padding: 12,
                            borderRadius: 10,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                            gap: 10,
                          }}
                        >
                          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                            ⚙️ {lang === "zh-TW" ? "更新物流狀態：" : "Update Fulfillment Status:"}
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {[
                              { s: "Processing", label: lang === "zh-TW" ? "處理中" : "Processing" },
                              { s: "Confirmed", label: lang === "zh-TW" ? "確認訂單" : "Confirm" },
                              { s: "Shipped", label: lang === "zh-TW" ? "標記已出貨" : "Mark Shipped" },
                              { s: "Out for Delivery", label: lang === "zh-TW" ? "配送中" : "Out for Delivery" },
                              { s: "Delivered", label: lang === "zh-TW" ? "標記已送達" : "Mark Delivered" },
                            ].map((btn) => (
                              <button
                                key={btn.s}
                                disabled={updatingOrderId === order.id || order.status === btn.s}
                                onClick={() => handleUpdateOrderStatus(order.id, btn.s)}
                                style={{
                                  padding: "5px 12px",
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  border: "1px solid var(--border-color)",
                                  background: order.status === btn.s ? "var(--accent)" : "var(--bg-card)",
                                  color: order.status === btn.s ? "white" : "var(--text-primary)",
                                  cursor: order.status === btn.s ? "default" : "pointer",
                                  opacity: updatingOrderId === order.id ? 0.6 : 1,
                                }}
                              >
                                {btn.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BOOK CATALOG INVENTORY */}
        {activeTab === "products" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 800 }}>
                  📚 {lang === "zh-TW" ? "書籍庫存清單" : "Book Inventory Table"}
                </h2>
                <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
                  {lang === "zh-TW" ? "檢視書店所有上架商品、價格與 ISBN 識別碼" : "View and search active books, prices, and ISBN records."}
                </p>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <input
                  type="text"
                  placeholder={lang === "zh-TW" ? "搜尋書名、作者或 ISBN..." : "Search title, author or ISBN..."}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    minWidth: 260,
                  }}
                />
                <button
                  onClick={() => setActiveTab("import")}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  📥 {lang === "zh-TW" ? "匯入新書" : "Bulk Import"}
                </button>
              </div>
            </div>

            {/* Inventory Table */}
            <div style={{ border: "1px solid var(--border-color)", borderRadius: 12, overflow: "hidden", background: "var(--bg-card)" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                      <th style={{ padding: 12, width: 60 }}>#ID</th>
                      <th style={{ padding: 12, width: 70 }}>{lang === "zh-TW" ? "封面" : "Cover"}</th>
                      <th style={{ padding: 12 }}>{lang === "zh-TW" ? "書名 (中 / 英)" : "Title (ZH / EN)"}</th>
                      <th style={{ padding: 12 }}>{lang === "zh-TW" ? "作者" : "Author"}</th>
                      <th style={{ padding: 12 }}>ISBN</th>
                      <th style={{ padding: 12 }}>{lang === "zh-TW" ? "定價" : "Price"}</th>
                      <th style={{ padding: 12 }}>{lang === "zh-TW" ? "店長推薦" : "Recommended"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.map((b) => (
                      <tr key={b.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                        <td style={{ padding: 12, fontWeight: 700, color: "var(--text-secondary)" }}>#{b.id}</td>
                        <td style={{ padding: 8 }}>
                          <img src={b.image_url} alt={b.title_en} style={{ width: 44, height: 58, objectFit: "cover", borderRadius: 4 }} />
                        </td>
                        <td style={{ padding: 12 }}>
                          <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{b.title_zh || b.title_en}</div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{b.title_en}</div>
                        </td>
                        <td style={{ padding: 12, color: "var(--text-secondary)" }}>{b.author_zh || b.author_en}</td>
                        <td style={{ padding: 12, fontFamily: "monospace", fontSize: 12 }}>{b.detail?.isbn || "-"}</td>
                        <td style={{ padding: 12, fontWeight: 800, color: "var(--accent)" }}>${b.price.toFixed(2)}</td>
                        <td style={{ padding: 12 }}>
                          {b.is_recommended ? (
                            <span style={{ color: "#d97706", fontWeight: 700 }}>⭐ {lang === "zh-TW" ? "推薦" : "Pick"}</span>
                          ) : (
                            <span style={{ color: "var(--text-secondary)" }}>-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {filteredProducts.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--text-secondary)" }}>
                          {loadingProducts ? "Loading catalog..." : "No books match your search."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: BULK IMPORTER (EXCEL & WORD) */}
        {activeTab === "import" && (
          <div style={{ maxWidth: 900, margin: "0 auto" }}>
            <div style={{ marginBottom: 24, textAlign: "center" }}>
              <h2 style={{ margin: "0 0 6px 0", fontSize: 26, fontWeight: 800 }}>
                📥 {lang === "zh-TW" ? "Excel 與 Word 書籍批次匯入" : "Bulk Product Importer (Excel & Word)"}
              </h2>
              <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
                {lang === "zh-TW"
                  ? "直接使用試算表 (.xlsx/.xls) 或 Word 文件 (.docx) 快速新增、批次比對與更新書籍資料庫。"
                  : "Batch import and upsert books via Microsoft Excel spreadsheet (.xlsx) or Word document (.docx)."}
              </p>
            </div>

            {/* Step 1: Download Templates */}
            <div style={{ padding: 20, borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border-color)", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                    Step 1: {lang === "zh-TW" ? "下載官方標準匯入範本" : "Download Official Standard Templates"}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {lang === "zh-TW"
                      ? "包含規範、範例書籍資料與防呆格式。支援試算表或 Word 表格格式。"
                      : "Pre-formatted templates with validation rules and sample book rows."}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={handleDownloadExcelTemplate}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "var(--accent)",
                      color: "white",
                      border: "none",
                      padding: "9px 16px",
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <span>📊</span> {lang === "zh-TW" ? "Excel 範本 (.xlsx)" : "Excel (.xlsx)"}
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadWordTemplate}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      padding: "9px 16px",
                      borderRadius: 8,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 13,
                    }}
                  >
                    <span>📄</span> {lang === "zh-TW" ? "Word 範本 (.docx)" : "Word (.docx)"}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Upload File */}
            <form onSubmit={handleImportSubmit} style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
              <div style={{ padding: 20, borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>
                  Step 2: {lang === "zh-TW" ? "上傳填寫完畢的檔案" : "Upload Your Filled File"}
                </div>

                <div
                  style={{
                    border: "2px dashed var(--border-color)",
                    borderRadius: 12,
                    padding: "36px 20px",
                    textAlign: "center",
                    background: "var(--bg-secondary)",
                    cursor: "pointer",
                  }}
                  onClick={() => document.getElementById("admin-portal-file")?.click()}
                >
                  <input
                    id="admin-portal-file"
                    type="file"
                    accept=".xlsx,.xls,.docx"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setImportFile(e.target.files[0]);
                        setImportError("");
                        setImportResult(null);
                      }
                    }}
                  />
                  <div style={{ fontSize: 44, marginBottom: 10 }}>
                    {importFile
                      ? importFile.name.toLowerCase().endsWith(".docx")
                        ? "📄"
                        : "📊"
                      : "📥"}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>
                    {importFile
                      ? importFile.name
                      : lang === "zh-TW"
                      ? "點擊此處選擇 .xlsx, .xls 或 .docx 檔案"
                      : "Click to select .xlsx, .xls or .docx file"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                    {importFile
                      ? `${(importFile.size / 1024).toFixed(1)} KB`
                      : lang === "zh-TW"
                      ? "自動智慧辨識欄位並執行比對更新 (Upsert)"
                      : "Supports Microsoft Excel (.xlsx/.xls) and Microsoft Word (.docx)"}
                  </div>
                </div>

                {importError && (
                  <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600 }}>
                    ⚠️ {importError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={!importFile || importLoading}
                  style={{
                    marginTop: 18,
                    width: "100%",
                    padding: "13px 20px",
                    background: !importFile || importLoading ? "var(--border-color)" : "var(--accent)",
                    color: "white",
                    border: "none",
                    borderRadius: 8,
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: !importFile || importLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {importLoading ? (
                    <>⏳ {lang === "zh-TW" ? "正在剖析並寫入 PostgreSQL 資料庫..." : "Processing & Upserting..."}</>
                  ) : (
                    <>🚀 {lang === "zh-TW" ? "開始執行批次匯入" : "Start Bulk Import"}</>
                  )}
                </button>
              </div>
            </form>

            {/* Step 3: Result Breakdown */}
            {importResult && (
              <div style={{ padding: 22, borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <span style={{ fontSize: 24 }}>{importResult.success ? "✅" : "⚠️"}</span>
                  <strong style={{ fontSize: 18 }}>
                    {importResult.success
                      ? lang === "zh-TW"
                        ? "匯入作業圓滿完成！"
                        : "Bulk Import Completed Successfully!"
                      : lang === "zh-TW"
                      ? "匯入完成 (部分列有異常)"
                      : "Import finished with notices"}
                  </strong>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18, textAlign: "center" }}>
                  <div style={{ padding: 12, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "總處理筆數" : "Total Rows"}</div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{importResult.total_rows}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
                    <div style={{ fontSize: 11 }}>{lang === "zh-TW" ? "全新新增" : "Inserted"}</div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{importResult.inserted}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" }}>
                    <div style={{ fontSize: 11 }}>{lang === "zh-TW" ? "比對更新" : "Updated"}</div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{importResult.updated}</div>
                  </div>
                  <div style={{ padding: 12, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
                    <div style={{ fontSize: 11 }}>{lang === "zh-TW" ? "失敗跳過" : "Failed"}</div>
                    <div style={{ fontSize: 22, fontWeight: 900 }}>{importResult.failed}</div>
                  </div>
                </div>

                {importResult.imported_books && importResult.imported_books.length > 0 && (
                  <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 8 }}>
                      {lang === "zh-TW" ? "已寫入資料庫書籍：" : "Database Records Processed:"}
                    </div>
                    {importResult.imported_books.map((b: any) => (
                      <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 4px", borderBottom: "1px solid var(--border-color)" }}>
                        <span>
                          <strong style={{ color: b.action === "INSERTED" ? "#059669" : "#2563eb", marginRight: 8 }}>
                            [{b.action}]
                          </strong>
                          #{b.id} {lang === "zh-TW" ? b.title_zh : b.title_en}
                        </span>
                        <span style={{ fontWeight: 800 }}>${Number(b.price).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: SYSTEM LOGS & AUDIT */}
        {activeTab === "logs" && (
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

            {/* Sub Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <button
                onClick={() => {
                  setLogSubTab("activity");
                  loadLogs("activity");
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: logSubTab === "activity" ? "var(--accent)" : "var(--bg-card)",
                  color: logSubTab === "activity" ? "white" : "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                📋 {lang === "zh-TW" ? "操作行為日誌" : "Activity Logs"}
              </button>

              <button
                onClick={() => {
                  setLogSubTab("login");
                  loadLogs("login");
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: logSubTab === "login" ? "var(--accent)" : "var(--bg-card)",
                  color: logSubTab === "login" ? "white" : "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                🔑 {lang === "zh-TW" ? "登入驗證紀錄" : "Login Logs"}
              </button>

              <button
                onClick={() => {
                  setLogSubTab("error");
                  loadLogs("error");
                }}
                style={{
                  padding: "7px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: logSubTab === "error" ? "var(--accent)" : "var(--bg-card)",
                  color: logSubTab === "error" ? "white" : "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                ⚠️ {lang === "zh-TW" ? "錯誤異常追蹤" : "Error Logs"}
              </button>
            </div>

            {/* Table Display */}
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
        )}
      </div>
    </div>
  );
}
