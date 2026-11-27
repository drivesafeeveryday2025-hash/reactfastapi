import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_URL } from "../services/api";
import type {
  ActivityLog,
  DeadStockItem,
  ErrorLog,
  FinancialAnalyticsData,
  FulfillmentOrder,
  InventoryItem,
  LoginLog,
  LowStockAlert,
  Order,
  OverviewData,
  PurchaseOrder,
  Supplier,
  WarehouseAdjustment,
  WarehouseFacility,
  WarehouseLocation,
  WarehouseOverview,
} from "../types";
import AdminImportTab from "./admin/AdminImportTab";
import AdminLogsTab from "./admin/AdminLogsTab";
import AdminOrdersTab from "./admin/AdminOrdersTab";
import AdminOverviewTab from "./admin/AdminOverviewTab";
import AdminProductsTab from "./admin/AdminProductsTab";
import AdminWarehouseTab from "./admin/AdminWarehouseTab";
import BarcodeScannerModal from "./admin/BarcodeScannerModal";

interface AdminPortalProps {
  user: { id: number; email: string; role?: string } | null;
  token: string | null;
  onLogout: () => void;
  lang: "en" | "zh-TW";
  toggleLang: () => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
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
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "warehouse" | "products" | "import" | "logs">(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "warehouse" || tab === "orders" || tab === "products" || tab === "import" || tab === "logs") {
      return tab;
    }
    return "overview";
  });

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [financialAnalytics, setFinancialAnalytics] = useState<FinancialAnalyticsData | null>(null);
  const [deadStockItems, setDeadStockItems] = useState<DeadStockItem[]>([]);
  const [loadingFinancial, setLoadingFinancial] = useState(false);

  const [scannerModalOpen, setScannerModalOpen] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);

  const [products, setProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [warehouseOverview, setWarehouseOverview] = useState<WarehouseOverview | null>(null);
  const [warehouseFacilities, setWarehouseFacilities] = useState<WarehouseFacility[]>([]);
  const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocation[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [adjustmentsList, setAdjustmentsList] = useState<WarehouseAdjustment[]>([]);
  const [fulfillmentOrders, setFulfillmentOrders] = useState<FulfillmentOrder[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [purchaseOrdersList, setPurchaseOrdersList] = useState<PurchaseOrder[]>([]);
  const [loadingWarehouse, setLoadingWarehouse] = useState(false);

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
    loadWarehouseData();
    loadLogs("activity");
  }, [token, isManager]);

  function loadOverview() {
    setLoadingOverview(true);
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`${API_URL}/api/admin/overview`, { headers: authHeaders })
      .then((r) => r.ok && r.json())
      .then(setOverview)
      .finally(() => setLoadingOverview(false));

    setLoadingFinancial(true);
    fetch(`${API_URL}/api/admin/analytics/financial`, { headers: authHeaders })
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (data) setFinancialAnalytics(data);
      });

    fetch(`${API_URL}/api/admin/analytics/dead-stock`, { headers: authHeaders })
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) setDeadStockItems(data);
      })
      .finally(() => setLoadingFinancial(false));
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
      tab === "activity" ? "/api/system/activities" : tab === "login" ? "/api/system/logins" : "/api/system/errors";

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

  async function loadWarehouseData() {
    setLoadingWarehouse(true);
    const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    try {
      const [overviewRes, facRes, locRes, invRes, adjRes, fulRes, alertRes, supRes, poRes] = await Promise.all([
        fetch(`${API_URL}/api/warehouse/overview`, { headers: authHeaders }),
        fetch(`${API_URL}/api/warehouse/facilities`, { headers: authHeaders }),
        fetch(`${API_URL}/api/warehouse/locations`, { headers: authHeaders }),
        fetch(`${API_URL}/api/warehouse/inventory`, { headers: authHeaders }),
        fetch(`${API_URL}/api/warehouse/adjustments`, { headers: authHeaders }),
        fetch(`${API_URL}/api/warehouse/fulfillment/orders`, { headers: authHeaders }),
        fetch(`${API_URL}/api/warehouse/procurement/low-stock-alerts`, { headers: authHeaders }),
        fetch(`${API_URL}/api/warehouse/procurement/suppliers`, { headers: authHeaders }),
        fetch(`${API_URL}/api/warehouse/procurement/purchase-orders`, { headers: authHeaders }),
      ]);
      if (overviewRes.ok) setWarehouseOverview(await overviewRes.json());
      if (facRes.ok) setWarehouseFacilities(await facRes.json());
      if (locRes.ok) setWarehouseLocations(await locRes.json());
      if (invRes.ok) setInventoryList(await invRes.json());
      if (adjRes.ok) setAdjustmentsList(await adjRes.json());
      if (fulRes.ok) setFulfillmentOrders(await fulRes.json());
      if (alertRes.ok) setLowStockAlerts(await alertRes.json());
      if (supRes.ok) setSuppliersList(await supRes.json());
      if (poRes.ok) setPurchaseOrdersList(await poRes.json());
    } catch (err) {
      console.error("Error loading warehouse data:", err);
    } finally {
      setLoadingWarehouse(false);
    }
  }

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
            <Link to="/" style={{ display: "inline-block", padding: "10px 20px", borderRadius: 8, background: "var(--bg-secondary)", color: "var(--text-primary)", textDecoration: "none", fontWeight: 700, border: "1px solid var(--border-color)" }}>
              ← {lang === "zh-TW" ? "返回書店前台" : "Back to Storefront"}
            </Link>
            <Link to="/admin/login" style={{ display: "inline-block", padding: "10px 20px", borderRadius: 8, background: "var(--accent)", color: "white", textDecoration: "none", fontWeight: 700 }}>
              {lang === "zh-TW" ? "管理員登入" : "Manager Login"}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100svh", display: "flex", flexDirection: "column", background: "var(--bg-primary)" }}>
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
            <div style={{ fontWeight: 900, fontSize: 18, color: "var(--accent)", letterSpacing: -0.3 }}>Apex Book Haven</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 700, textTransform: "uppercase" }}>
              {lang === "zh-TW" ? "門市管理後台系統" : "Store Management Portal"}
            </div>
          </div>
          <span style={{ marginLeft: 8, background: "#059669", color: "white", padding: "2px 8px", borderRadius: 12, fontSize: 11, fontWeight: 800 }}>
            {user.role?.toUpperCase() || "MANAGER"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={toggleLang} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            🌐 {lang === "zh-TW" ? "English" : "繁體中文"}
          </button>
          <button onClick={toggleTheme} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 20, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {theme === "light" ? "🌙 Dark" : "☀️ Light"}
          </button>
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
            🏪 {lang === "zh-TW" ? "前往顧客前台" : "Storefront"}
          </Link>
          <button onClick={onLogout} style={{ padding: "6px 12px", borderRadius: 20, border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {lang === "zh-TW" ? "登出" : "Sign Out"}
          </button>
        </div>
      </header>

      <div style={{ flex: 1, padding: "28px 24px", maxWidth: 1260, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
        <div style={{ display: "flex", gap: 10, borderBottom: "1px solid var(--border-color)", paddingBottom: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {[
            { id: "overview", icon: "📊", label: lang === "zh-TW" ? "營運總覽" : "Overview Dashboard" },
            { id: "orders", icon: "📦", label: `${lang === "zh-TW" ? "訂單配送管理" : "Orders & Fulfillment"} (${orders.length})`, onClickExtra: loadOrders },
            { id: "warehouse", icon: "🏬", label: `${lang === "zh-TW" ? "倉儲與庫存管理" : "Warehouse & Inventory"}${warehouseOverview ? ` (${warehouseOverview.total_units_on_hand})` : ""}`, onClickExtra: loadWarehouseData },
            { id: "products", icon: "📚", label: `${lang === "zh-TW" ? "書籍目錄管理" : "Book Catalog"} (${products.length})` },
            { id: "import", icon: "📥", label: lang === "zh-TW" ? "批次匯入 (Excel / Word)" : "Bulk Import (Excel / Word)" },
            { id: "logs", icon: "🛡️", label: lang === "zh-TW" ? "系統日誌與稽核" : "System Logs & Audit" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                if (tab.onClickExtra) tab.onClickExtra();
              }}
              style={{
                padding: "9px 20px",
                borderRadius: 8,
                border: "none",
                background: activeTab === tab.id ? "var(--accent)" : "var(--bg-secondary)",
                color: activeTab === tab.id ? "white" : "var(--text-primary)",
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "overview" && (
          <AdminOverviewTab
            userEmail={user.email}
            overview={overview}
            loadingOverview={loadingOverview}
            financialAnalytics={financialAnalytics}
            deadStockItems={deadStockItems}
            loadingFinancial={loadingFinancial}
            onSelectTab={setActiveTab}
            onRefreshOrders={loadOrders}
          />
        )}

        {activeTab === "orders" && (
          <AdminOrdersTab
            orders={orders}
            loadingOrders={loadingOrders}
            updatingOrderId={updatingOrderId}
            onRefreshOrders={loadOrders}
            onUpdateStatus={handleUpdateOrderStatus}
          />
        )}

        {activeTab === "warehouse" && (
          <AdminWarehouseTab
            products={products}
            warehouseOverview={warehouseOverview}
            warehouseFacilities={warehouseFacilities}
            warehouseLocations={warehouseLocations}
            inventoryList={inventoryList}
            adjustmentsList={adjustmentsList}
            fulfillmentOrders={fulfillmentOrders}
            lowStockAlerts={lowStockAlerts}
            suppliersList={suppliersList}
            purchaseOrdersList={purchaseOrdersList}
            loadingWarehouse={loadingWarehouse}
            onRefreshWarehouse={loadWarehouseData}
            onRefreshOrders={loadOrders}
            onOpenScanner={() => setScannerModalOpen(true)}
          />
        )}

        {activeTab === "products" && (
          <AdminProductsTab
            products={products}
            loadingProducts={loadingProducts}
            onGoToImport={() => setActiveTab("import")}
          />
        )}

        {activeTab === "import" && (
          <AdminImportTab
            onImportSuccess={() => {
              loadOverview();
              loadProducts();
            }}
          />
        )}

        {activeTab === "logs" && (
          <AdminLogsTab
            activityLogs={activityLogs}
            loginLogs={loginLogs}
            errorLogs={errorLogs}
            loadingLogs={loadingLogs}
            onLoadLogs={loadLogs}
          />
        )}

        <BarcodeScannerModal open={scannerModalOpen} onClose={() => setScannerModalOpen(false)} />
      </div>
    </div>
  );
}
