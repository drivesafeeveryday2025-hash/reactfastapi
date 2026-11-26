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

interface WarehouseOverview {
  total_units_on_hand: number;
  total_units_reserved: number;
  total_distinct_skus: number;
  condition_counts: {
    brand_new: number;
    minor_wear: number;
    damaged: number;
  };
  total_locations: number;
  total_warehouses: number;
  recent_adjustments_count: number;
}

interface WarehouseFacility {
  id: number;
  code: string;
  name_en: string;
  name_zh: string;
  address_en?: string;
  address_zh?: string;
  is_active: boolean;
}

interface WarehouseLocation {
  id: number;
  warehouse_id: number;
  warehouse_code?: string;
  warehouse_name_en?: string;
  warehouse_name_zh?: string;
  zone: string;
  zone_name_en: string;
  zone_name_zh: string;
  aisle: string;
  shelf: string;
  bin: string;
  location_code: string;
  category_hint?: string;
  is_active: boolean;
}

interface InventoryItem {
  id: number;
  product_id: number;
  location_id: number;
  condition: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  last_counted_at?: string;
  updated_at: string;
  product_title_en: string;
  product_title_zh: string;
  product_author_en: string;
  isbn?: string;
  price: number;
  category_id: number;
  category_name_en: string;
  category_name_zh: string;
  image_url?: string;
  location_code: string;
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name_en: string;
  warehouse_name_zh: string;
  zone: string;
  zone_name_en: string;
  zone_name_zh: string;
  aisle: string;
  shelf: string;
  bin: string;
}

interface WarehouseAdjustment {
  id: number;
  voucher_no: string;
  product_id: number;
  product_title_en: string;
  product_title_zh: string;
  isbn?: string;
  from_location_id?: number;
  from_location_code?: string;
  to_location_id?: number;
  to_location_code?: string;
  from_condition?: string;
  to_condition?: string;
  change_qty: number;
  reason_code: string;
  notes?: string;
  created_by_name: string;
  status: string;
  created_at: string;
}

interface FulfillmentOrderItem {
  id: number;
  product_id: number;
  title_en: string;
  title_zh: string;
  isbn: string;
  quantity: number;
  unit_price: number;
  location_code: string;
  zone: string;
  aisle: string;
  shelf: string;
  bin: string;
  available_at_location: number;
}

interface FulfillmentOrder {
  id: number;
  customer_id: number;
  customer_email: string;
  recipient_name: string;
  recipient_phone: string;
  shipping_address: string;
  delivery_method: string;
  payment_method: string;
  status: string;
  tracking_number: string;
  total_amount: number;
  shipping_fee: number;
  created_at: string;
  items: FulfillmentOrderItem[];
  total_items_count: number;
}

interface PickListItem {
  product_id: number;
  title_en: string;
  title_zh: string;
  isbn: string;
  location_code: string;
  zone: string;
  aisle: string;
  shelf: string;
  bin: string;
  quantity_to_pick: number;
  order_ids: number[];
}

interface PickListResponse {
  generated_at: string;
  total_orders_count: number;
  total_items_to_pick: number;
  pick_items: PickListItem[];
}

interface LowStockAlert {
  product_id: number;
  title_en: string;
  title_zh: string;
  isbn: string;
  category_name: string;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  safety_stock: number;
  reorder_quantity: number;
  cost_price: number;
  retail_price: number;
  urgency: "CRITICAL" | "LOW" | "NORMAL";
}

interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_time_days: number;
  is_active: boolean;
  created_at: string;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  status: "ORDERED" | "RECEIVED" | "CANCELLED";
  total_cost: number;
  notes: string | null;
  created_by_name: string;
  ordered_at: string;
  received_at: string | null;
  created_at: string;
  items: {
    id: number;
    product_id: number;
    product_title_en: string;
    product_title_zh: string;
    isbn: string;
    quantity_ordered: number;
    quantity_received: number;
    unit_cost: number;
  }[];
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
      return tab as any;
    }
    return "overview";
  });

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

  // Warehouse & Inventory State
  const [warehouseSubTab, setWarehouseSubTab] = useState<"inventory" | "fulfillment" | "procurement" | "adjustment" | "stocktake">("inventory");
  const [warehouseOverview, setWarehouseOverview] = useState<WarehouseOverview | null>(null);
  const [warehouseFacilities, setWarehouseFacilities] = useState<WarehouseFacility[]>([]);
  const [warehouseLocations, setWarehouseLocations] = useState<WarehouseLocation[]>([]);
  const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
  const [adjustmentsList, setAdjustmentsList] = useState<WarehouseAdjustment[]>([]);
  const [loadingWarehouse, setLoadingWarehouse] = useState(false);

  // Fulfillment State (Option A)
  const [fulfillmentOrders, setFulfillmentOrders] = useState<FulfillmentOrder[]>([]);
  const [pickListResult, setPickListResult] = useState<PickListResponse | null>(null);
  const [advancingOrderId, setAdvancingOrderId] = useState<number | null>(null);
  const [pickListChecked, setPickListChecked] = useState<Record<number, boolean>>({});

  // Procurement State (Option B)
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [suppliersList, setSuppliersList] = useState<Supplier[]>([]);
  const [purchaseOrdersList, setPurchaseOrdersList] = useState<PurchaseOrder[]>([]);
  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [newPoSupplierId, setNewPoSupplierId] = useState<number | "">("");
  const [newPoBookId, setNewPoBookId] = useState<number | "">("");
  const [newPoQuantity, setNewPoQuantity] = useState<number>(50);
  const [newPoUnitCost, setNewPoUnitCost] = useState<number>(0);
  const [newPoNotes, setNewPoNotes] = useState<string>("");
  const [creatingPo, setCreatingPo] = useState(false);

  // Goods Receiving State
  const [isReceivePoModalOpen, setIsReceivePoModalOpen] = useState(false);
  const [poToReceive, setPoToReceive] = useState<PurchaseOrder | null>(null);
  const [receiveLocationId, setReceiveLocationId] = useState<number | "">("");
  const [receiveCondition, setReceiveCondition] = useState<string>("brand_new");
  const [receiveNotes, setReceiveNotes] = useState<string>("");
  const [receivingPo, setReceivingPo] = useState(false);

  // Filters for Live Inventory
  const [invWarehouseFilter, setInvWarehouseFilter] = useState<string>("all");
  const [invZoneFilter, setInvZoneFilter] = useState<string>("all");
  const [invConditionFilter, setInvConditionFilter] = useState<string>("all");
  const [invSearchQuery, setInvSearchQuery] = useState<string>("");

  // Adjustment Form State
  const [adjProductId, setAdjProductId] = useState<number | "">("");
  const [adjType, setAdjType] = useState<"qty" | "relocate" | "condition">("qty");
  const [adjFromLocId, setAdjFromLocId] = useState<number | "">("");
  const [adjToLocId, setAdjToLocId] = useState<number | "">("");
  const [adjFromCond, setAdjFromCond] = useState<string>("brand_new");
  const [adjToCond, setAdjToCond] = useState<string>("brand_new");
  const [adjChangeQty, setAdjChangeQty] = useState<number>(1);
  const [adjReasonCode, setAdjReasonCode] = useState<string>("RESTOCK_RECEIVING");
  const [adjNotes, setAdjNotes] = useState<string>("");
  const [adjSubmitting, setAdjSubmitting] = useState(false);
  const [adjSuccessVoucher, setAdjSuccessVoucher] = useState<WarehouseAdjustment | null>(null);
  const [adjError, setAdjError] = useState("");

  // Stocktake Planner & Excel Export State
  const [stkWarehouseFilter, setStkWarehouseFilter] = useState<string>("all");
  const [stkZoneFilter, setStkZoneFilter] = useState<string>("all");
  const [stkConditionFilter, setStkConditionFilter] = useState<string>("all");
  const [stkSelectedProductIds, setStkSelectedProductIds] = useState<number[]>([]);
  const [stkExporting, setStkExporting] = useState(false);

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

  // Warehouse API & Handlers
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

  async function handleAdvanceFulfillment(orderId: number, nextStatus: string, trackingNum?: string) {
    setAdvancingOrderId(orderId);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/fulfillment/orders/${orderId}/advance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ status: nextStatus, tracking_number: trackingNum }),
      });
      if (res.ok) {
        await loadWarehouseData();
        await loadOrders();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to update fulfillment status");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setAdvancingOrderId(null);
    }
  }

  async function handleGeneratePickList(targetOrderIds?: number[]) {
    try {
      const res = await fetch(`${API_URL}/api/warehouse/fulfillment/generate-picklist`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(targetOrderIds && targetOrderIds.length > 0 ? targetOrderIds : null),
      });
      if (res.ok) {
        const data = await res.json();
        setPickListResult(data);
        setPickListChecked({});
      } else {
        alert("Failed to generate pick list");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    }
  }

  async function handleCreatePurchaseOrder(e: FormEvent) {
    e.preventDefault();
    if (!newPoSupplierId || !newPoBookId || newPoQuantity <= 0) {
      alert("Please fill all required PO fields");
      return;
    }
    setCreatingPo(true);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/procurement/purchase-orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          supplier_id: Number(newPoSupplierId),
          notes: newPoNotes,
          items: [
            {
              product_id: Number(newPoBookId),
              quantity: Number(newPoQuantity),
              unit_cost: newPoUnitCost > 0 ? Number(newPoUnitCost) : undefined,
            },
          ],
        }),
      });
      if (res.ok) {
        alert(lang === "zh-TW" ? "採購單已成功建立！" : "Purchase Order created successfully!");
        setIsCreatePoModalOpen(false);
        setNewPoNotes("");
        await loadWarehouseData();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to create PO");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setCreatingPo(false);
    }
  }

  async function handleReceivePurchaseOrder(e: FormEvent) {
    e.preventDefault();
    if (!poToReceive || !receiveLocationId) {
      alert("Please select a target put-away location");
      return;
    }
    setReceivingPo(true);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/procurement/purchase-orders/${poToReceive.id}/receive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          target_location_id: Number(receiveLocationId),
          condition: receiveCondition,
          notes: receiveNotes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(data.message || (lang === "zh-TW" ? "進貨已成功入庫！" : "Shipment received successfully!"));
        setIsReceivePoModalOpen(false);
        setPoToReceive(null);
        await loadWarehouseData();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to receive PO");
      }
    } catch (err: any) {
      alert(err.message || "Network error");
    } finally {
      setReceivingPo(false);
    }
  }

  function toggleStocktakeProduct(productId: number) {
    setStkSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }

  function clearStocktakeProducts() {
    setStkSelectedProductIds([]);
  }

  function quickAdjust(item: InventoryItem) {
    setWarehouseSubTab("adjustment");
    setAdjProductId(item.product_id);
    setAdjFromLocId(item.location_id);
    setAdjToLocId(item.location_id);
    setAdjFromCond(item.condition);
    setAdjToCond(item.condition);
    setAdjType("qty");
    setAdjChangeQty(1);
    setAdjSuccessVoucher(null);
    setAdjError("");
  }

  async function handleIssueAdjustment(e: FormEvent) {
    e.preventDefault();
    if (!adjProductId) {
      setAdjError(lang === "zh-TW" ? "請選擇欲調整之書籍商品" : "Please select a product");
      return;
    }
    setAdjSubmitting(true);
    setAdjError("");
    setAdjSuccessVoucher(null);

    const payload: any = {
      product_id: Number(adjProductId),
      reason_code: adjReasonCode,
      notes: adjNotes,
      change_qty: Number(adjChangeQty),
      created_by_name: user?.email || "Warehouse Manager",
    };

    if (adjType === "qty") {
      payload.to_location_id = adjToLocId ? Number(adjToLocId) : undefined;
      payload.to_condition = adjToCond;
    } else if (adjType === "relocate") {
      payload.from_location_id = Number(adjFromLocId);
      payload.to_location_id = Number(adjToLocId);
      payload.from_condition = adjFromCond;
      payload.to_condition = adjFromCond;
    } else if (adjType === "condition") {
      payload.from_location_id = Number(adjFromLocId);
      payload.to_location_id = Number(adjToLocId || adjFromLocId);
      payload.from_condition = adjFromCond;
      payload.to_condition = adjToCond;
    }

    try {
      const res = await fetch(`${API_URL}/api/warehouse/adjustments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setAdjError(data.detail || "Failed to issue adjustment voucher");
      } else {
        setAdjSuccessVoucher(data);
        setAdjNotes("");
        loadWarehouseData();
      }
    } catch (err: any) {
      setAdjError(err.message || "Network error while submitting adjustment");
    } finally {
      setAdjSubmitting(false);
    }
  }

  async function handleExportStocktakeExcel() {
    setStkExporting(true);
    try {
      const payload: any = {};
      if (stkWarehouseFilter !== "all") payload.warehouse_id = Number(stkWarehouseFilter);
      if (stkZoneFilter !== "all") payload.zone = stkZoneFilter;
      if (stkConditionFilter !== "all") payload.condition = stkConditionFilter;
      if (stkSelectedProductIds.length > 0) payload.product_ids = stkSelectedProductIds;

      const res = await fetch(`${API_URL}/api/warehouse/stocktake/export-excel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.detail || "Export failed.");
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const zoneTag = stkZoneFilter !== "all" ? `_${stkZoneFilter.replace(/\s+/g, "_")}` : "";
      a.download = `apex_stocktake_checklist${zoneTag}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Export error: " + err.message);
    } finally {
      setStkExporting(false);
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
            onClick={() => {
              setActiveTab("warehouse");
              loadWarehouseData();
            }}
            style={{
              padding: "9px 20px",
              borderRadius: 8,
              border: "none",
              background: activeTab === "warehouse" ? "var(--accent)" : "var(--bg-secondary)",
              color: activeTab === "warehouse" ? "white" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span>🏬</span> {lang === "zh-TW" ? "倉儲與庫存管理" : "Warehouse & Inventory"}
            {warehouseOverview ? ` (${warehouseOverview.total_units_on_hand})` : ""}
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

                          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <div style={{ fontSize: 20, fontWeight: 900, color: "var(--accent)" }}>
                              ${order.total_amount.toFixed(2)}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                              {lang === "zh-TW" ? `運費 $${order.shipping_fee.toFixed(2)}` : `Shipping: $${order.shipping_fee.toFixed(2)}`}
                            </div>
                            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                              <button
                                type="button"
                                onClick={() => window.open(`${API_URL}/api/warehouse/fulfillment/orders/${order.id}/packing-slip-html?autoprint=true`, '_blank')}
                                title={lang === "zh-TW" ? "開啟/列印倉儲裝箱單" : "Open/Print Warehouse Packing Slip"}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  border: "1px solid #0284c7",
                                  background: "#f0f9ff",
                                  color: "#0284c7",
                                  cursor: "pointer",
                                }}
                              >
                                📦 {lang === "zh-TW" ? "裝箱單" : "Packing Slip"}
                              </button>
                              <button
                                type="button"
                                onClick={() => window.open(`${API_URL}/api/orders/${order.id}/invoice-html?autoprint=true`, '_blank')}
                                title={lang === "zh-TW" ? "開啟/列印電子發票" : "Open/Print Customer Tax Invoice"}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 700,
                                  border: "1px solid var(--border-color)",
                                  background: "var(--bg-card)",
                                  color: "var(--text-primary)",
                                  cursor: "pointer",
                                }}
                              >
                                📄 {lang === "zh-TW" ? "發票" : "Invoice"}
                              </button>
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

        {/* TAB: WAREHOUSE & INVENTORY MANAGEMENT SYSTEM */}
        {activeTab === "warehouse" && (
          <div>
            {/* Warehouse Header Banner */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div>
                <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 800 }}>
                  🏬 {lang === "zh-TW" ? "專業倉儲與實體庫存管理系統 (WMS)" : "Warehouse & Inventory Management System (WMS)"}
                </h2>
                <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
                  {lang === "zh-TW"
                    ? "倉儲儲位管理、分區品類歸納、庫存狀況 (全新/微損/瑕疵) 追蹤、調撥簽核單與盤點報表匯出。"
                    : "Manage bin storage locations, category zone zoning, book condition grading, stock adjustment forms, and stocktake checklists."}
                </p>
              </div>
              <button
                onClick={loadWarehouseData}
                disabled={loadingWarehouse}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: loadingWarehouse ? "not-allowed" : "pointer",
                }}
              >
                🔄 {loadingWarehouse ? (lang === "zh-TW" ? "更新中..." : "Refreshing...") : (lang === "zh-TW" ? "重新整理數據" : "Refresh Data")}
              </button>
            </div>

            {/* Warehouse Overview KPI Cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                  📦 {lang === "zh-TW" ? "總在庫實體庫存 (On-Hand)" : "Total Units On-Hand"}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "var(--accent)" }}>
                  {warehouseOverview?.total_units_on_hand.toLocaleString() || 0}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {lang === "zh-TW" ? "已保留: " : "Reserved: "}
                  <b style={{ color: "#d97706" }}>{warehouseOverview?.total_units_reserved || 0}</b> | {lang === "zh-TW" ? "可銷售: " : "Available: "}
                  <b style={{ color: "#059669" }}>{(warehouseOverview?.total_units_on_hand || 0) - (warehouseOverview?.total_units_reserved || 0)}</b>
                </div>
              </div>

              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                  📚 {lang === "zh-TW" ? "在庫商品品類種數 (SKUs)" : "Distinct Product SKUs"}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)" }}>
                  {warehouseOverview?.total_distinct_skus || 0}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {lang === "zh-TW" ? "涵蓋所有已建檔上架之書目" : "Active catalog items stored in bins"}
                </div>
              </div>

              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 8 }}>
                  🏷️ {lang === "zh-TW" ? "商品外觀品相狀況" : "Stock Condition Grading"}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", fontSize: 12 }}>
                  <span style={{ background: "#ecfdf5", color: "#065f46", padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>
                    🟢 {lang === "zh-TW" ? "全新: " : "New: "} {warehouseOverview?.condition_counts.brand_new || 0}
                  </span>
                  <span style={{ background: "#fef3c7", color: "#92400e", padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>
                    🟡 {lang === "zh-TW" ? "微損/展品: " : "Minor Wear: "} {warehouseOverview?.condition_counts.minor_wear || 0}
                  </span>
                  <span style={{ background: "#fee2e2", color: "#991b1b", padding: "4px 8px", borderRadius: 6, fontWeight: 700 }}>
                    🔴 {lang === "zh-TW" ? "瑕疵/隔離: " : "Damaged: "} {warehouseOverview?.condition_counts.damaged || 0}
                  </span>
                </div>
              </div>

              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
                  📍 {lang === "zh-TW" ? "倉儲據點與儲位" : "Facilities & Storage Bins"}
                </div>
                <div style={{ fontSize: 28, fontWeight: 900, color: "var(--text-primary)" }}>
                  {warehouseOverview?.total_warehouses || 0} <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "倉" : "Facilities"} / {warehouseOverview?.total_locations || 0} {lang === "zh-TW" ? "儲位" : "Bins"}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                  {lang === "zh-TW" ? "同品類書籍依分區集中存放" : "Categorized by dedicated zones"}
                </div>
              </div>
            </div>

            {/* Warehouse Sub-Tab Buttons */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid var(--border-color)", paddingBottom: 12, flexWrap: "wrap" }}>
              <button
                onClick={() => setWarehouseSubTab("inventory")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: "none",
                  background: warehouseSubTab === "inventory" ? "var(--accent)" : "var(--bg-secondary)",
                  color: warehouseSubTab === "inventory" ? "white" : "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>📋</span> {lang === "zh-TW" ? "即時儲位庫存表" : "Live Inventory & Locations"} ({inventoryList.length})
              </button>

              <button
                onClick={() => setWarehouseSubTab("fulfillment")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: "none",
                  background: warehouseSubTab === "fulfillment" ? "var(--accent)" : "var(--bg-secondary)",
                  color: warehouseSubTab === "fulfillment" ? "white" : "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>🚚</span> {lang === "zh-TW" ? "揀貨與出貨履約" : "Fulfillment & Pick Lists"} ({fulfillmentOrders.filter((o) => ["Processing", "Confirmed", "Picking", "Packed"].includes(o.status)).length})
              </button>

              <button
                onClick={() => setWarehouseSubTab("procurement")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: "none",
                  background: warehouseSubTab === "procurement" ? "var(--accent)" : "var(--bg-secondary)",
                  color: warehouseSubTab === "procurement" ? "white" : "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>🚨</span> {lang === "zh-TW" ? "庫存預警與採購進貨" : "Low Stock & POs"} ({lowStockAlerts.filter((a) => a.urgency !== "NORMAL").length})
              </button>

              <button
                onClick={() => setWarehouseSubTab("adjustment")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: "none",
                  background: warehouseSubTab === "adjustment" ? "var(--accent)" : "var(--bg-secondary)",
                  color: warehouseSubTab === "adjustment" ? "white" : "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>⚖️</span> {lang === "zh-TW" ? "庫存與儲位調整單" : "Stock Adjustment & Vouchers"} ({adjustmentsList.length})
              </button>

              <button
                onClick={() => setWarehouseSubTab("stocktake")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 20,
                  border: "none",
                  background: warehouseSubTab === "stocktake" ? "var(--accent)" : "var(--bg-secondary)",
                  color: warehouseSubTab === "stocktake" ? "white" : "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>📊</span> {lang === "zh-TW" ? "盤點規劃與 Excel 匯出" : "Stocktake Planner & Excel Export"}
              </button>
            </div>

            {/* SUB-PANEL 1: LIVE INVENTORY & LOCATIONS */}
            {warehouseSubTab === "inventory" && (
              <div>
                {/* Zone Strategy Banner */}
                <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontSize: 24 }}>💡</span>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
                    <b>{lang === "zh-TW" ? "智慧分區儲放策略 (Category Zoning)：" : "Smart Category Zoning Strategy: "}</b>
                    {lang === "zh-TW"
                      ? "同類別書籍集中存放於鄰近儲區。Zone A 為科技資訊專區、Zone B 為世界文學與小說、Zone C 為個人成長與藝術、Zone D 為待驗隔離與微損品專區、Zone S 為旗艦門市前場展示。"
                      : "Similar categories are clustered in proximity: Zone A (Tech & Programming), Zone B (World Literature & Fiction), Zone C (Personal Growth & Arts), Zone D (Quarantine & Inspection), Zone S (Retail Sales Floor & Buffer Stock)."}
                  </div>
                </div>

                {/* Filter Toolbar */}
                <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
                  <select
                    value={invWarehouseFilter}
                    onChange={(e) => setInvWarehouseFilter(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
                  >
                    <option value="all">{lang === "zh-TW" ? "🏢 全部倉庫據點 (All Facilities)" : "🏢 All Warehouses"}</option>
                    {warehouseFacilities.map((f) => (
                      <option key={f.id} value={f.id.toString()}>
                        {f.code} - {lang === "zh-TW" ? f.name_zh : f.name_en}
                      </option>
                    ))}
                  </select>

                  <select
                    value={invZoneFilter}
                    onChange={(e) => setInvZoneFilter(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
                  >
                    <option value="all">{lang === "zh-TW" ? "📍 全部儲位分區 (All Zones)" : "📍 All Storage Zones"}</option>
                    <option value="Zone A">{lang === "zh-TW" ? "Zone A: 科技與資訊 (Tech)" : "Zone A: Tech & Programming"}</option>
                    <option value="Zone B">{lang === "zh-TW" ? "Zone B: 文學與小說 (Literature)" : "Zone B: Literature & Fiction"}</option>
                    <option value="Zone C">{lang === "zh-TW" ? "Zone C: 成長與藝術 (Growth & Arts)" : "Zone C: Growth & Arts"}</option>
                    <option value="Zone D">{lang === "zh-TW" ? "Zone D: 隔離與待驗 (Quarantine)" : "Zone D: Quarantine & Inspection"}</option>
                    <option value="Zone S-FRONT">{lang === "zh-TW" ? "Zone S-FRONT: 門市展架 (Store Front)" : "Zone S-FRONT: Storefront Display"}</option>
                    <option value="Zone S-BACK">{lang === "zh-TW" ? "Zone S-BACK: 門市備貨區 (Store Back)" : "Zone S-BACK: Store Backroom"}</option>
                  </select>

                  <select
                    value={invConditionFilter}
                    onChange={(e) => setInvConditionFilter(e.target.value)}
                    style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
                  >
                    <option value="all">{lang === "zh-TW" ? "🏷️ 全部商品狀況 (All Conditions)" : "🏷️ All Conditions"}</option>
                    <option value="brand_new">{lang === "zh-TW" ? "🟢 全新 (Brand New)" : "🟢 Brand New"}</option>
                    <option value="minor_wear">{lang === "zh-TW" ? "🟡 微損/展示本 (Minor Wear)" : "🟡 Minor Wear"}</option>
                    <option value="damaged">{lang === "zh-TW" ? "🔴 瑕疵/隔離品 (Damaged / Quarantined)" : "🔴 Damaged"}</option>
                  </select>

                  <input
                    type="text"
                    placeholder={lang === "zh-TW" ? "🔍 搜尋書名、ISBN、作者或儲位碼..." : "🔍 Search title, ISBN, author, or location..."}
                    value={invSearchQuery}
                    onChange={(e) => setInvSearchQuery(e.target.value)}
                    style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13, minWidth: 260 }}
                  />

                  <div style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-secondary)", fontWeight: 600 }}>
                    {lang === "zh-TW" ? "符合篩選條件項目: " : "Matching Records: "}
                    <b style={{ color: "var(--accent)" }}>
                      {inventoryList.filter((item) => {
                        const matchWh = invWarehouseFilter === "all" || item.warehouse_id.toString() === invWarehouseFilter;
                        const matchZone = invZoneFilter === "all" || item.zone === invZoneFilter;
                        const matchCond = invConditionFilter === "all" || item.condition === invConditionFilter;
                        const q = invSearchQuery.toLowerCase();
                        const matchQ =
                          !q ||
                          item.product_title_en.toLowerCase().includes(q) ||
                          item.product_title_zh.toLowerCase().includes(q) ||
                          item.product_author_en.toLowerCase().includes(q) ||
                          item.isbn?.toLowerCase().includes(q) ||
                          item.location_code.toLowerCase().includes(q);
                        return matchWh && matchZone && matchCond && matchQ;
                      }).length}
                    </b>
                  </div>
                </div>

                {/* Inventory Table */}
                <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-color)", overflowX: "auto", boxShadow: "var(--shadow-sm)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                        <th style={{ padding: 12 }}>{lang === "zh-TW" ? "書籍商品 (Product)" : "Product Title & Category"}</th>
                        <th style={{ padding: 12 }}>{lang === "zh-TW" ? "ISBN / 條碼" : "ISBN / SKU"}</th>
                        <th style={{ padding: 12 }}>{lang === "zh-TW" ? "倉儲據點" : "Warehouse Facility"}</th>
                        <th style={{ padding: 12 }}>{lang === "zh-TW" ? "分區與品類規劃" : "Storage Zone & Hint"}</th>
                        <th style={{ padding: 12 }}>{lang === "zh-TW" ? "架位 (Aisle/Shelf/Bin)" : "Shelf Bin Location"}</th>
                        <th style={{ padding: 12 }}>{lang === "zh-TW" ? "商品品相狀況" : "Condition"}</th>
                        <th style={{ padding: 12, textAlign: "right" }}>{lang === "zh-TW" ? "在庫數量" : "On-Hand"}</th>
                        <th style={{ padding: 12, textAlign: "right" }}>{lang === "zh-TW" ? "保留/可用" : "Avail / Res"}</th>
                        <th style={{ padding: 12, textAlign: "center" }}>{lang === "zh-TW" ? "操作" : "Action"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryList
                        .filter((item) => {
                          const matchWh = invWarehouseFilter === "all" || item.warehouse_id.toString() === invWarehouseFilter;
                          const matchZone = invZoneFilter === "all" || item.zone === invZoneFilter;
                          const matchCond = invConditionFilter === "all" || item.condition === invConditionFilter;
                          const q = invSearchQuery.toLowerCase();
                          const matchQ =
                            !q ||
                            item.product_title_en.toLowerCase().includes(q) ||
                            item.product_title_zh.toLowerCase().includes(q) ||
                            item.product_author_en.toLowerCase().includes(q) ||
                            item.isbn?.toLowerCase().includes(q) ||
                            item.location_code.toLowerCase().includes(q);
                          return matchWh && matchZone && matchCond && matchQ;
                        })
                        .map((item) => {
                          const condBadge =
                            item.condition === "brand_new"
                              ? { bg: "#ecfdf5", color: "#065f46", text: lang === "zh-TW" ? "全新 (Brand New)" : "Brand New" }
                              : item.condition === "minor_wear"
                              ? { bg: "#fef3c7", color: "#92400e", text: lang === "zh-TW" ? "微損/展品 (Minor Wear)" : "Minor Wear" }
                              : { bg: "#fee2e2", color: "#991b1b", text: lang === "zh-TW" ? "瑕疵/隔離 (Damaged)" : "Damaged / Defect" };

                          return (
                            <tr key={item.id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                              <td style={{ padding: 12 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  {item.image_url && (
                                    <img
                                      src={item.image_url}
                                      alt=""
                                      style={{ width: 34, height: 48, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border-color)", flexShrink: 0 }}
                                    />
                                  )}
                                  <div>
                                    <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>
                                      {lang === "zh-TW" ? item.product_title_zh : item.product_title_en}
                                    </div>
                                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                      {item.product_author_en} • <span style={{ background: "var(--bg-secondary)", padding: "1px 6px", borderRadius: 4 }}>{lang === "zh-TW" ? item.category_name_zh : item.category_name_en}</span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              <td style={{ padding: 12, fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>
                                {item.isbn || `SKU-${item.product_id}`}
                              </td>

                              <td style={{ padding: 12 }}>
                                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                                  {item.warehouse_code}
                                </span>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                  {lang === "zh-TW" ? item.warehouse_name_zh : item.warehouse_name_en}
                                </div>
                              </td>

                              <td style={{ padding: 12 }}>
                                <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                                  {item.zone}
                                </span>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                  {lang === "zh-TW" ? item.zone_name_zh : item.zone_name_en}
                                </div>
                              </td>

                              <td style={{ padding: 12 }}>
                                <span style={{ fontFamily: "monospace", fontWeight: 700, background: "var(--bg-secondary)", padding: "3px 8px", borderRadius: 6, fontSize: 12 }}>
                                  {item.aisle}-{item.shelf}-{item.bin}
                                </span>
                              </td>

                              <td style={{ padding: 12 }}>
                                <span style={{ background: condBadge.bg, color: condBadge.color, padding: "3px 8px", borderRadius: 6, fontWeight: 700, fontSize: 11 }}>
                                  {condBadge.text}
                                </span>
                              </td>

                              <td style={{ padding: 12, textAlign: "right", fontWeight: 900, fontSize: 14 }}>
                                {item.quantity}
                              </td>

                              <td style={{ padding: 12, textAlign: "right", fontSize: 12 }}>
                                <span style={{ color: "#059669", fontWeight: 700 }}>{item.available_quantity}</span>
                                <span style={{ color: "var(--text-secondary)" }}> / </span>
                                <span style={{ color: "#d97706", fontWeight: 600 }}>{item.reserved_quantity}</span>
                              </td>

                              <td style={{ padding: 12, textAlign: "center" }}>
                                <button
                                  onClick={() => quickAdjust(item)}
                                  title={lang === "zh-TW" ? "以此儲位與商品開立調整單" : "Issue adjustment voucher for this item"}
                                  style={{
                                    padding: "4px 10px",
                                    borderRadius: 6,
                                    border: "1px solid var(--border-color)",
                                    background: "var(--bg-secondary)",
                                    color: "var(--text-primary)",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  ⚡ {lang === "zh-TW" ? "調整單" : "Adjust"}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SUB-PANEL 2: STOCK ADJUSTMENT & LOCATION VOUCHERS */}
            {warehouseSubTab === "adjustment" && (
              <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 460px) 1fr", gap: 24, alignItems: "start" }}>
                {/* Form Column */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 22, boxShadow: "var(--shadow-sm)" }}>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 800 }}>
                    📝 {lang === "zh-TW" ? "開立庫存與儲位調整單" : "Issue Stock Adjustment Voucher"}
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px 0", lineHeight: 1.5 }}>
                    {lang === "zh-TW"
                      ? "當盤點發現落差、發現書籍破損瑕疵、或移倉至其他儲位時，由倉儲主管開立正式調整憑證紀錄。"
                      : "Official auditable form for inventory variances, defect discoveries, shelf transfers, or condition reclassifications."}
                  </p>

                  {adjSuccessVoucher && (
                    <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: 12, marginBottom: 16, color: "#065f46", fontSize: 13 }}>
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>
                        ✅ {lang === "zh-TW" ? "調整單開立成功！" : "Adjustment Voucher Approved & Executed!"}
                      </div>
                      <div>
                        {lang === "zh-TW" ? "憑證號碼: " : "Voucher Ref: "}
                        <b>{adjSuccessVoucher.voucher_no}</b>
                      </div>
                    </div>
                  )}

                  {adjError && (
                    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 16, color: "#991b1b", fontSize: 13 }}>
                      ⚠️ {adjError}
                    </div>
                  )}

                  <form onSubmit={handleIssueAdjustment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {/* Operation Type Switcher */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-secondary)" }}>
                        {lang === "zh-TW" ? "調整作業類型 (Operation Type)" : "Operation Type"}
                      </label>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                        <button
                          type="button"
                          onClick={() => setAdjType("qty")}
                          style={{
                            padding: "8px 6px",
                            borderRadius: 6,
                            border: adjType === "qty" ? "2px solid var(--accent)" : "1px solid var(--border-color)",
                            background: adjType === "qty" ? "var(--bg-secondary)" : "var(--bg-card)",
                            color: "var(--text-primary)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          📦 {lang === "zh-TW" ? "數量增減" : "Qty Change"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjType("relocate")}
                          style={{
                            padding: "8px 6px",
                            borderRadius: 6,
                            border: adjType === "relocate" ? "2px solid var(--accent)" : "1px solid var(--border-color)",
                            background: adjType === "relocate" ? "var(--bg-secondary)" : "var(--bg-card)",
                            color: "var(--text-primary)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          🔄 {lang === "zh-TW" ? "儲位移轉" : "Relocate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setAdjType("condition")}
                          style={{
                            padding: "8px 6px",
                            borderRadius: 6,
                            border: adjType === "condition" ? "2px solid var(--accent)" : "1px solid var(--border-color)",
                            background: adjType === "condition" ? "var(--bg-secondary)" : "var(--bg-card)",
                            color: "var(--text-primary)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          🏷️ {lang === "zh-TW" ? "品相變更" : "Condition"}
                        </button>
                      </div>
                    </div>

                    {/* Product Selection */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                        {lang === "zh-TW" ? "選擇書籍商品 (Target Product) *" : "Target Book Product *"}
                      </label>
                      <select
                        value={adjProductId}
                        onChange={(e) => {
                          const pid = e.target.value ? Number(e.target.value) : "";
                          setAdjProductId(pid);
                          const prodInv = inventoryList.find((i) => i.product_id === pid);
                          if (prodInv) {
                            setAdjFromLocId(prodInv.location_id);
                            setAdjToLocId(prodInv.location_id);
                            setAdjFromCond(prodInv.condition);
                          }
                        }}
                        required
                        style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
                      >
                        <option value="">{lang === "zh-TW" ? "-- 請選擇欲調整的書籍 --" : "-- Select a product --"}</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            #{p.id} {p.title_en} ({p.detail?.isbn || "No ISBN"})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Locations & Conditions depending on adjType */}
                    {adjType === "qty" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                            {lang === "zh-TW" ? "調整儲位 (Location)" : "Location"}
                          </label>
                          <select
                            value={adjToLocId}
                            onChange={(e) => setAdjToLocId(e.target.value ? Number(e.target.value) : "")}
                            required
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
                          >
                            <option value="">{lang === "zh-TW" ? "-- 選擇儲位 --" : "-- Select Location --"}</option>
                            {warehouseLocations.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.location_code} ({l.zone})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                            {lang === "zh-TW" ? "商品品相 (Condition)" : "Condition"}
                          </label>
                          <select
                            value={adjToCond}
                            onChange={(e) => setAdjToCond(e.target.value)}
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
                          >
                            <option value="brand_new">🟢 全新 (Brand New)</option>
                            <option value="minor_wear">🟡 微損/展品 (Minor Wear)</option>
                            <option value="damaged">🔴 瑕疵/隔離 (Damaged)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {adjType === "relocate" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                              {lang === "zh-TW" ? "原儲位 (From Location)" : "From Location"}
                            </label>
                            <select
                              value={adjFromLocId}
                              onChange={(e) => setAdjFromLocId(e.target.value ? Number(e.target.value) : "")}
                              required
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
                            >
                              <option value="">{lang === "zh-TW" ? "-- 原儲位 --" : "-- From Location --"}</option>
                              {warehouseLocations.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.location_code}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                              {lang === "zh-TW" ? "目標新儲位 (To Location)" : "To Location"}
                            </label>
                            <select
                              value={adjToLocId}
                              onChange={(e) => setAdjToLocId(e.target.value ? Number(e.target.value) : "")}
                              required
                              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
                            >
                              <option value="">{lang === "zh-TW" ? "-- 目標儲位 --" : "-- To Location --"}</option>
                              {warehouseLocations.map((l) => (
                                <option key={l.id} value={l.id}>
                                  {l.location_code}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {adjType === "condition" && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                            {lang === "zh-TW" ? "原品相 (From Condition)" : "From Condition"}
                          </label>
                          <select
                            value={adjFromCond}
                            onChange={(e) => setAdjFromCond(e.target.value)}
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
                          >
                            <option value="brand_new">🟢 全新 (Brand New)</option>
                            <option value="minor_wear">🟡 微損/展品 (Minor Wear)</option>
                            <option value="damaged">🔴 瑕疵/隔離 (Damaged)</option>
                          </select>
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                            {lang === "zh-TW" ? "調整為新品相 (To Condition)" : "To Condition"}
                          </label>
                          <select
                            value={adjToCond}
                            onChange={(e) => setAdjToCond(e.target.value)}
                            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
                          >
                            <option value="brand_new">🟢 全新 (Brand New)</option>
                            <option value="minor_wear">🟡 微損/展品 (Minor Wear)</option>
                            <option value="damaged">🔴 瑕疵/隔離 (Damaged)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* Change Quantity & Reason */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 10 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                          {lang === "zh-TW" ? "數量 (+/- Qty) *" : "Quantity Change *"}
                        </label>
                        <input
                          type="number"
                          value={adjChangeQty}
                          onChange={(e) => setAdjChangeQty(Number(e.target.value))}
                          required
                          style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                          {lang === "zh-TW" ? "調整原因碼 (Reason) *" : "Reason Code *"}
                        </label>
                        <select
                          value={adjReasonCode}
                          onChange={(e) => setAdjReasonCode(e.target.value)}
                          required
                          style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}
                        >
                          <option value="RESTOCK_RECEIVING">📥 {lang === "zh-TW" ? "進貨入庫 (Restock Receiving)" : "Restock Receiving"}</option>
                          <option value="DAMAGE_FOUND">⚠️ {lang === "zh-TW" ? "損壞瑕疵發現 (Damage Found)" : "Damage Identified"}</option>
                          <option value="COUNT_DISCREPANCY">🔍 {lang === "zh-TW" ? "實盤落差調整 (Count Discrepancy)" : "Count Discrepancy"}</option>
                          <option value="RELOCATION">🚚 {lang === "zh-TW" ? "移倉儲位搬遷 (Relocation)" : "Shelf Relocation"}</option>
                          <option value="CONDITION_RECLASSIFY">🏷️ {lang === "zh-TW" ? "品相變更重新判定 (Reclassify)" : "Condition Reclassify"}</option>
                          <option value="EXPIRED_SCRAP">🗑️ {lang === "zh-TW" ? "泡水破損報廢 (Scrap / Decommission)" : "Scrap / Decommission"}</option>
                        </select>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                        {lang === "zh-TW" ? "調整事由說明 (Audit Notes)" : "Audit Notes & Specifics"}
                      </label>
                      <textarea
                        value={adjNotes}
                        onChange={(e) => setAdjNotes(e.target.value)}
                        rows={2}
                        placeholder={lang === "zh-TW" ? "請詳細填寫調整原因或單號備查..." : "Provide context or invoice/RMA reference..."}
                        style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={adjSubmitting}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--accent)",
                        color: "white",
                        fontWeight: 700,
                        fontSize: 14,
                        cursor: adjSubmitting ? "not-allowed" : "pointer",
                        marginTop: 4,
                      }}
                    >
                      {adjSubmitting ? (lang === "zh-TW" ? "憑證簽核開立中..." : "Submitting Voucher...") : (lang === "zh-TW" ? "📝 簽核開立調整單" : "📝 Approve & Submit Adjustment")}
                    </button>
                  </form>
                </div>

                {/* Audit Vouchers Feed Column */}
                <div>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 800 }}>
                    📜 {lang === "zh-TW" ? "庫存異動與調整單紀錄 (Audit Trail)" : "Adjustment Voucher Audit Trail"}
                  </h3>
                  <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px 0" }}>
                    {lang === "zh-TW" ? "所有經主管核可的庫存增減、儲位搬遷與瑕疵隔離單據" : "Permanent immutable record of stock vouchers and approvals."}
                  </p>

                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {adjustmentsList.map((a) => (
                      <div
                        key={a.id}
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-color)",
                          borderRadius: 10,
                          padding: 16,
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontFamily: "monospace", fontWeight: 800, background: "var(--bg-secondary)", padding: "2px 8px", borderRadius: 6, fontSize: 12, color: "var(--accent)" }}>
                              {a.voucher_no}
                            </span>
                            <span style={{ background: "#ecfdf5", color: "#065f46", fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
                              {a.status}
                            </span>
                          </div>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {new Date(a.created_at).toLocaleString()}
                          </span>
                        </div>

                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>
                          {lang === "zh-TW" ? a.product_title_zh : a.product_title_en}
                        </div>

                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span>
                            {lang === "zh-TW" ? "異動量: " : "Change: "}
                            <b style={{ color: a.change_qty >= 0 ? "#059669" : "#dc2626" }}>
                              {a.change_qty > 0 ? `+${a.change_qty}` : a.change_qty}
                            </b>
                          </span>
                          <span>•</span>
                          <span>
                            {lang === "zh-TW" ? "原因: " : "Reason: "}
                            <b style={{ color: "var(--text-primary)" }}>{a.reason_code}</b>
                          </span>
                          {a.from_location_code && a.to_location_code && (
                            <>
                              <span>•</span>
                              <span>
                                {a.from_location_code} ➔ {a.to_location_code}
                              </span>
                            </>
                          )}
                        </div>

                        {a.notes && (
                          <div style={{ fontSize: 12, background: "var(--bg-secondary)", padding: "8px 10px", borderRadius: 6, color: "var(--text-primary)", fontStyle: "italic", marginBottom: 6 }}>
                            "{a.notes}"
                          </div>
                        )}

                        <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "right" }}>
                          {lang === "zh-TW" ? "簽核人員: " : "Authorized by: "} <b>{a.created_by_name}</b>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* SUB-PANEL 3: STOCKTAKE CHECKLIST PLANNER & EXCEL EXPORT */}
            {warehouseSubTab === "stocktake" && (
              <div>
                {/* Intro Card */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 22, marginBottom: 20, boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <h3 style={{ margin: "0 0 6px 0", fontSize: 20, fontWeight: 800 }}>
                        📊 {lang === "zh-TW" ? "實體盤點作業規劃與 Excel 盤點表匯出" : "Stocktake Count Planner & Excel Checklist Export"}
                      </h3>
                      <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14, maxWidth: 760, lineHeight: 1.5 }}>
                        {lang === "zh-TW"
                          ? "支援「按區域分區 (Zone)」或「指定特定書籍」組織實體盤點作業。系統將產出格式完整且包含書名、ISBN、儲位、系統帳面數、實盤手填框、差異欄與盤點人簽核欄位的專業 Excel (.xlsx) 檔案，方便列印下發倉管人員盤查。"
                          : "Organize physical inventory audits by warehouse zone or specific products. Export a print-ready Excel (.xlsx) checklist with book details, shelf coordinates, system expected quantities, blank physical count entry boxes, and supervisor sign-off lines."}
                      </p>
                    </div>

                    <button
                      onClick={handleExportStocktakeExcel}
                      disabled={stkExporting}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "12px 24px",
                        borderRadius: 10,
                        border: "none",
                        background: "#059669",
                        color: "white",
                        fontWeight: 800,
                        fontSize: 14,
                        cursor: stkExporting ? "not-allowed" : "pointer",
                        boxShadow: "0 2px 8px rgba(5, 150, 105, 0.3)",
                      }}
                    >
                      <span>📥</span>
                      {stkExporting
                        ? (lang === "zh-TW" ? "正在產生 Excel 盤點表..." : "Generating Excel Checklist...")
                        : (lang === "zh-TW" ? "匯出列印盤點表 (.xlsx)" : "Export Stocktake Checklist (.xlsx)")}
                    </button>
                  </div>

                  <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "18px 0" }} />

                  {/* Stocktake Filter Controls */}
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                        {lang === "zh-TW" ? "盤點倉庫據點" : "Audit Facility"}
                      </label>
                      <select
                        value={stkWarehouseFilter}
                        onChange={(e) => setStkWarehouseFilter(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
                      >
                        <option value="all">{lang === "zh-TW" ? "全部倉庫 (All Warehouses)" : "All Facilities"}</option>
                        {warehouseFacilities.map((f) => (
                          <option key={f.id} value={f.id.toString()}>
                            {f.code} - {lang === "zh-TW" ? f.name_zh : f.name_en}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                        {lang === "zh-TW" ? "盤點分區 (Area / Zone)" : "Target Area / Zone"}
                      </label>
                      <select
                        value={stkZoneFilter}
                        onChange={(e) => setStkZoneFilter(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
                      >
                        <option value="all">{lang === "zh-TW" ? "全部區域 (All Zones)" : "All Zones"}</option>
                        <option value="Zone A">{lang === "zh-TW" ? "Zone A: 科技與電腦資訊 (Tech)" : "Zone A: Tech & Programming"}</option>
                        <option value="Zone B">{lang === "zh-TW" ? "Zone B: 世界文學與小說 (Literature)" : "Zone B: Literature & Fiction"}</option>
                        <option value="Zone C">{lang === "zh-TW" ? "Zone C: 成長與藝術 (Growth & Arts)" : "Zone C: Growth & Arts"}</option>
                        <option value="Zone D">{lang === "zh-TW" ? "Zone D: 隔離待驗區 (Quarantine)" : "Zone D: Quarantine & Defect"}</option>
                        <option value="Zone S-FRONT">{lang === "zh-TW" ? "Zone S-FRONT: 門市展架 (Store Front)" : "Zone S-FRONT: Store Front Display"}</option>
                        <option value="Zone S-BACK">{lang === "zh-TW" ? "Zone S-BACK: 門市後台備貨 (Store Back)" : "Zone S-BACK: Store Backroom"}</option>
                      </select>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>
                        {lang === "zh-TW" ? "品相過濾" : "Condition Filter"}
                      </label>
                      <select
                        value={stkConditionFilter}
                        onChange={(e) => setStkConditionFilter(e.target.value)}
                        style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}
                      >
                        <option value="all">{lang === "zh-TW" ? "全部品相 (All Conditions)" : "All Conditions"}</option>
                        <option value="brand_new">🟢 全新 (Brand New)</option>
                        <option value="minor_wear">🟡 微損/展示 (Minor Wear)</option>
                        <option value="damaged">🔴 瑕疵/隔離 (Damaged)</option>
                      </select>
                    </div>

                    <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {lang === "zh-TW" ? "預估盤點項目: " : "Audited Scope: "}
                        <b style={{ color: "var(--accent)", fontSize: 16 }}>
                          {inventoryList.filter((item) => {
                            const matchWh = stkWarehouseFilter === "all" || item.warehouse_id.toString() === stkWarehouseFilter;
                            const matchZone = stkZoneFilter === "all" || item.zone === stkZoneFilter;
                            const matchCond = stkConditionFilter === "all" || item.condition === stkConditionFilter;
                            const matchProd = stkSelectedProductIds.length === 0 || stkSelectedProductIds.includes(item.product_id);
                            return matchWh && matchZone && matchCond && matchProd;
                          }).length}
                        </b> {lang === "zh-TW" ? "項品項" : "SKUs"}
                      </span>
                    </div>
                  </div>

                  {/* Specific Product Selection Pills */}
                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--border-color)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                        🎯 {lang === "zh-TW" ? "指定特定書籍進行重點盤點 (點擊選擇/取消):" : "Filter by Specific Products (Click to toggle):"}
                      </span>
                      {stkSelectedProductIds.length > 0 && (
                        <button
                          type="button"
                          onClick={clearStocktakeProducts}
                          style={{
                            padding: "2px 8px",
                            borderRadius: 4,
                            border: "1px solid var(--border-color)",
                            background: "var(--bg-card)",
                            color: "var(--text-secondary)",
                            fontSize: 11,
                            cursor: "pointer",
                          }}
                        >
                          ✕ {lang === "zh-TW" ? "清除選擇 (盤點全區)" : "Clear Selection (Audit All)"}
                        </button>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", maxHeight: 96, overflowY: "auto" }}>
                      {products.map((p) => {
                        const isSelected = stkSelectedProductIds.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => toggleStocktakeProduct(p.id)}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 14,
                              border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border-color)",
                              background: isSelected ? "var(--accent)" : "var(--bg-secondary)",
                              color: isSelected ? "white" : "var(--text-primary)",
                              fontSize: 11,
                              fontWeight: isSelected ? 700 : 500,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span>{isSelected ? "✓" : "+"}</span>
                            <span>{p.title_en}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Checklist Live Print Preview */}
                <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-color)", padding: 20, boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>
                      📑 {lang === "zh-TW" ? "盤點清單預覽 (Checklist Print Preview)" : "Stocktake Checklist Print Preview"}
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {lang === "zh-TW" ? "黃色欄位為倉管實體盤點填寫格" : "Yellow columns are for physical count handwritten entry"}
                    </span>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr style={{ background: "#1e293b", color: "white", textAlign: "left" }}>
                          <th style={{ padding: 10, width: 40, textAlign: "center" }}>#</th>
                          <th style={{ padding: 10 }}>ISBN / SKU</th>
                          <th style={{ padding: 10 }}>{lang === "zh-TW" ? "書籍品名 (書名 / 英文)" : "Book Title"}</th>
                          <th style={{ padding: 10 }}>{lang === "zh-TW" ? "倉庫與分區" : "Warehouse & Zone"}</th>
                          <th style={{ padding: 10 }}>{lang === "zh-TW" ? "儲位 (Aisle/Shelf/Bin)" : "Location"}</th>
                          <th style={{ padding: 10 }}>{lang === "zh-TW" ? "品相" : "Condition"}</th>
                          <th style={{ padding: 10, textAlign: "right", width: 120 }}>{lang === "zh-TW" ? "系統帳面數" : "System Qty"}</th>
                          <th style={{ padding: 10, textAlign: "center", width: 120, background: "#0284c7" }}>
                            ✍️ {lang === "zh-TW" ? "實盤數 (Count)" : "Physical Count"}
                          </th>
                          <th style={{ padding: 10, textAlign: "center", width: 90, background: "#0284c7" }}>
                            {lang === "zh-TW" ? "差異 (+/-)" : "Variance"}
                          </th>
                          <th style={{ padding: 10 }}>{lang === "zh-TW" ? "盤點人員備註 / 品相檢視" : "Auditor Notes"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inventoryList
                          .filter((item) => {
                            const matchWh = stkWarehouseFilter === "all" || item.warehouse_id.toString() === stkWarehouseFilter;
                            const matchZone = stkZoneFilter === "all" || item.zone === stkZoneFilter;
                            const matchCond = stkConditionFilter === "all" || item.condition === stkConditionFilter;
                            const matchProd = stkSelectedProductIds.length === 0 || stkSelectedProductIds.includes(item.product_id);
                            return matchWh && matchZone && matchCond && matchProd;
                          })
                          .map((item, idx) => (
                            <tr key={item.id} style={{ borderBottom: "1px solid var(--border-color)", background: idx % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                              <td style={{ padding: 10, textAlign: "center", color: "var(--text-secondary)" }}>{idx + 1}</td>
                              <td style={{ padding: 10, fontFamily: "monospace", color: "var(--text-secondary)" }}>{item.isbn || `SKU-${item.product_id}`}</td>
                              <td style={{ padding: 10 }}>
                                <div style={{ fontWeight: 700 }}>{lang === "zh-TW" ? item.product_title_zh : item.product_title_en}</div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.product_author_en}</div>
                              </td>
                              <td style={{ padding: 10 }}>
                                <span style={{ fontWeight: 600 }}>{item.warehouse_code}</span> - {item.zone}
                              </td>
                              <td style={{ padding: 10, fontFamily: "monospace" }}>
                                {item.aisle}-{item.shelf}-{item.bin}
                              </td>
                              <td style={{ padding: 10 }}>
                                <span style={{ fontSize: 11, fontWeight: 700 }}>
                                  {item.condition === "brand_new" ? "🟢 全新" : item.condition === "minor_wear" ? "🟡 微損" : "🔴 瑕疵"}
                                </span>
                              </td>
                              <td style={{ padding: 10, textAlign: "right", fontWeight: 800, fontSize: 13 }}>
                                {item.quantity}
                              </td>
                              {/* Blank Count Box */}
                              <td style={{ padding: 6, textAlign: "center", background: "rgba(254, 240, 138, 0.25)" }}>
                                <div style={{ width: 80, height: 26, margin: "0 auto", border: "1.5px dashed #ca8a04", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "#854d0e", fontSize: 11 }}>
                                  [ _____ ]
                                </div>
                              </td>
                              {/* Blank Variance Box */}
                              <td style={{ padding: 6, textAlign: "center" }}>
                                <div style={{ width: 60, height: 26, margin: "0 auto", border: "1px dashed var(--border-color)", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-secondary)", fontSize: 11 }}>
                                  [ +/- ]
                                </div>
                              </td>
                              {/* Blank Notes Box */}
                              <td style={{ padding: 10, color: "var(--text-secondary)", fontStyle: "italic" }}>
                                _______________________
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Auditor & Supervisor Signature Section */}
                  <div style={{ marginTop: 24, padding: "16px 20px", background: "var(--bg-secondary)", borderRadius: 8, display: "flex", justifyContent: "space-around", flexWrap: "wrap", gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                        {lang === "zh-TW" ? "實體盤點員簽名 (Auditor Signature):" : "Auditor Signature:"}
                      </div>
                      <div style={{ borderBottom: "1.5px solid var(--text-secondary)", width: 220, height: 24 }}></div>
                    </div>
                    <div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
                        {lang === "zh-TW" ? "倉儲主管覆核簽章 (Supervisor Approval):" : "Warehouse Supervisor Sign-off:"}
                      </div>
                      <div style={{ borderBottom: "1.5px solid var(--text-secondary)", width: 220, height: 24 }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* SUB-PANEL 4: FULFILLMENT & WAVE PICK LISTS (OPTION A) */}
            {warehouseSubTab === "fulfillment" && (
              <div>
                {/* Fulfillment Header Banner */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 20, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 800 }}>
                      🚚 {lang === "zh-TW" ? "訂單揀貨與波次出庫履約系統 (Order Fulfillment)" : "Order Fulfillment & Wave Pick Pipeline"}
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                      {lang === "zh-TW"
                        ? "線上訂單已自動鎖定全新實體儲位庫存。一鍵生成分區波次揀貨單 (Wave Pick List)，依走道與貨架動線快速揀選，並於出庫時自動扣減實體庫存。"
                        : "Orders automatically reserve brand-new bin stock on checkout. Generate consolidated wave pick lists sorted by Zone -> Aisle -> Shelf -> Bin, and deduct physical stock upon dispatch."}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button
                      onClick={() => handleGeneratePickList()}
                      style={{
                        padding: "10px 18px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--accent)",
                        color: "white",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        boxShadow: "var(--shadow-sm)",
                      }}
                    >
                      <span>📋</span> {lang === "zh-TW" ? "生成所有待出貨波次揀貨單" : "Generate Wave Pick List"}
                    </button>
                  </div>
                </div>

                {/* Wave Pick List Display Card */}
                {pickListResult && (
                  <div style={{ background: "var(--bg-card)", border: "2px solid var(--accent)", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "var(--shadow-md)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 14, marginBottom: 16 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 22 }}>📋</span>
                          <h4 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>
                            {lang === "zh-TW" ? "波次揀貨清單 (Wave Pick List)" : "Consolidated Wave Pick List"}
                          </h4>
                          <span style={{ background: "var(--accent-light)", color: "var(--accent)", padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                            {pickListResult.total_orders_count} {lang === "zh-TW" ? "筆訂單" : "Orders"} • {pickListResult.total_items_to_pick} {lang === "zh-TW" ? "本書" : "Books to pick"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                          {lang === "zh-TW" ? `生成時間：${pickListResult.generated_at}（依儲位 Zone ➔ Aisle ➔ Shelf ➔ Bin 最佳動線排序）` : `Generated: ${pickListResult.generated_at} (Optimized route by Zone ➔ Aisle ➔ Shelf ➔ Bin)`}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          onClick={() => window.print()}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "1px solid var(--border-color)",
                            background: "var(--bg-secondary)",
                            color: "var(--text-primary)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          🖨️ {lang === "zh-TW" ? "列印揀貨單" : "Print List"}
                        </button>
                        <button
                          onClick={() => setPickListResult(null)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "none",
                            background: "var(--bg-secondary)",
                            color: "var(--text-secondary)",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          ✕ {lang === "zh-TW" ? "關閉" : "Close"}
                        </button>
                      </div>
                    </div>

                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                            <th style={{ padding: 10, textAlign: "center", width: 40 }}>{lang === "zh-TW" ? "揀妥" : "Picked"}</th>
                            <th style={{ padding: 10, textAlign: "left", width: 220 }}>{lang === "zh-TW" ? "儲位代碼 (Location)" : "Bin Location"}</th>
                            <th style={{ padding: 10, textAlign: "left" }}>{lang === "zh-TW" ? "書名與 ISBN" : "Book & ISBN"}</th>
                            <th style={{ padding: 10, textAlign: "center", width: 90 }}>{lang === "zh-TW" ? "應揀數量" : "Pick Qty"}</th>
                            <th style={{ padding: 10, textAlign: "left", width: 140 }}>{lang === "zh-TW" ? "所屬訂單編號" : "Order IDs"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pickListResult.pick_items.map((it) => {
                            const isChecked = !!pickListChecked[it.product_id];
                            return (
                              <tr
                                key={it.product_id}
                                style={{
                                  borderBottom: "1px solid var(--border-color)",
                                  background: isChecked ? "rgba(16, 185, 129, 0.08)" : "transparent",
                                  transition: "all 0.2s",
                                }}
                              >
                                <td style={{ padding: 10, textAlign: "center" }}>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={(e) => setPickListChecked((prev) => ({ ...prev, [it.product_id]: e.target.checked }))}
                                    style={{ width: 18, height: 18, cursor: "pointer" }}
                                  />
                                </td>
                                <td style={{ padding: 10 }}>
                                  <span style={{ fontFamily: "monospace", fontWeight: 800, background: "var(--accent-light)", color: "var(--accent)", padding: "2px 8px", borderRadius: 4, fontSize: 12 }}>
                                    {it.location_code}
                                  </span>
                                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                                    Zone {it.zone} • Aisle {it.aisle} • Shelf {it.shelf} • Bin {it.bin}
                                  </div>
                                </td>
                                <td style={{ padding: 10 }}>
                                  <div style={{ fontWeight: 700, textDecoration: isChecked ? "line-through" : "none", color: isChecked ? "var(--text-secondary)" : "var(--text-primary)" }}>
                                    {lang === "zh-TW" ? it.title_zh || it.title_en : it.title_en}
                                  </div>
                                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>ISBN: {it.isbn || "N/A"}</div>
                                </td>
                                <td style={{ padding: 10, textAlign: "center", fontWeight: 900, fontSize: 15, color: "var(--accent)" }}>
                                  × {it.quantity_to_pick}
                                </td>
                                <td style={{ padding: 10 }}>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                    {it.order_ids.map((oid) => (
                                      <span key={oid} style={{ background: "var(--bg-secondary)", padding: "1px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700 }}>
                                        #{oid}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Fulfillment Orders List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {fulfillmentOrders.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 60, background: "var(--bg-card)", borderRadius: 14, border: "1px solid var(--border-color)" }}>
                      <span style={{ fontSize: 44 }}>🎉</span>
                      <h4 style={{ margin: "10px 0 4px 0" }}>{lang === "zh-TW" ? "目前無待出貨之訂單" : "No Pending Fulfillment Orders"}</h4>
                      <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>{lang === "zh-TW" ? "所有訂單均已完成出庫與履約。" : "All placed orders have been processed and shipped."}</p>
                    </div>
                  ) : (
                    fulfillmentOrders.map((ord) => {
                      const isWorking = advancingOrderId === ord.id;
                      return (
                        <div
                          key={ord.id}
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-color)",
                            borderRadius: 12,
                            padding: 18,
                            boxShadow: "var(--shadow-sm)",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                            <div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                <span style={{ fontSize: 16, fontWeight: 900 }}>Order #{ord.id}</span>
                                <span style={{ fontFamily: "monospace", fontSize: 12, background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4, color: "var(--text-secondary)" }}>
                                  🚚 {ord.tracking_number}
                                </span>
                                <span
                                  style={{
                                    background: ord.status === "Delivered" ? "#dcfce7" : ord.status === "Shipped" ? "#ede9fe" : ord.status === "Packed" ? "#dbeafe" : ord.status === "Picking" ? "#fef3c7" : "#fee2e2",
                                    color: ord.status === "Delivered" ? "#166534" : ord.status === "Shipped" ? "#5b21b6" : ord.status === "Packed" ? "#1e40af" : ord.status === "Picking" ? "#92400e" : "#991b1b",
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    fontSize: 11,
                                    fontWeight: 800,
                                  }}
                                >
                                  {ord.status}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                                {lang === "zh-TW" ? "收件人：" : "Recipient: "}<strong>{ord.recipient_name}</strong> • {ord.shipping_address}
                              </div>
                            </div>

                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <button
                                type="button"
                                onClick={() => window.open(`${API_URL}/api/warehouse/fulfillment/orders/${ord.id}/packing-slip-html?autoprint=true`, '_blank')}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  border: "1px solid #0284c7",
                                  background: "#f0f9ff",
                                  color: "#0284c7",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                📦 {lang === "zh-TW" ? "列印裝箱單" : "Packing Slip"}
                              </button>
                              <button
                                type="button"
                                onClick={() => window.open(`${API_URL}/api/orders/${ord.id}/invoice-html?autoprint=true`, '_blank')}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: 6,
                                  border: "1px solid var(--border-color)",
                                  background: "var(--bg-secondary)",
                                  color: "var(--text-primary)",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                📄 {lang === "zh-TW" ? "發票" : "Invoice"}
                              </button>
                            </div>
                          </div>

                          {/* Items with Bin Location mapping */}
                          <div style={{ background: "var(--bg-secondary)", borderRadius: 8, padding: 10, marginBottom: 12 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
                              {lang === "zh-TW" ? "商品存放儲位與揀貨指引：" : "Items & Warehouse Locations to Pick:"}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              {ord.items.map((it) => (
                                <div key={it.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, background: "var(--bg-card)", padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border-color)" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontFamily: "monospace", fontWeight: 800, background: "var(--accent-light)", color: "var(--accent)", padding: "1px 6px", borderRadius: 4, fontSize: 11 }}>
                                      📍 {it.location_code}
                                    </span>
                                    <span>{lang === "zh-TW" ? it.title_zh || it.title_en : it.title_en}</span>
                                    <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
                                      (Zone {it.zone} / Aisle {it.aisle} / Shelf {it.shelf} / Bin {it.bin})
                                    </span>
                                  </div>
                                  <div style={{ fontWeight: 800, color: "var(--accent)" }}>
                                    × {it.quantity}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Fulfillment Advance Pipeline Buttons */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: 10, flexWrap: "wrap", gap: 8 }}>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                              {lang === "zh-TW" ? "履約階段推進：" : "Advance Stage: "}
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {ord.status === "Processing" && (
                                <button
                                  disabled={isWorking}
                                  onClick={() => handleAdvanceFulfillment(ord.id, "Confirmed")}
                                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#3b82f6", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                >
                                  ✓ {lang === "zh-TW" ? "確認訂單 (鎖定庫存)" : "Confirm Order"}
                                </button>
                              )}
                              {ord.status === "Confirmed" && (
                                <button
                                  disabled={isWorking}
                                  onClick={() => handleAdvanceFulfillment(ord.id, "Picking")}
                                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#f59e0b", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                >
                                  🏃 {lang === "zh-TW" ? "開始揀貨 (Picking)" : "Start Picking"}
                                </button>
                              )}
                              {ord.status === "Picking" && (
                                <button
                                  disabled={isWorking}
                                  onClick={() => handleAdvanceFulfillment(ord.id, "Packed")}
                                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#6366f1", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                >
                                  📦 {lang === "zh-TW" ? "裝箱核對完畢 (Packed)" : "Mark Packed"}
                                </button>
                              )}
                              {ord.status === "Packed" && (
                                <button
                                  disabled={isWorking}
                                  onClick={() => handleAdvanceFulfillment(ord.id, "Shipped")}
                                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#10b981", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                >
                                  🚚 {lang === "zh-TW" ? "出庫出貨 (自動扣減庫存)" : "Ship (Deduct Stock)"}
                                </button>
                              )}
                              {ord.status === "Shipped" && (
                                <button
                                  disabled={isWorking}
                                  onClick={() => handleAdvanceFulfillment(ord.id, "Delivered")}
                                  style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#166534", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                                >
                                  🎉 {lang === "zh-TW" ? "確認送達 (Delivered)" : "Mark Delivered"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* SUB-PANEL 5: PROCUREMENT, LOW-STOCK ALERTS & PURCHASE ORDERS (OPTION B) */}
            {warehouseSubTab === "procurement" && (
              <div>
                {/* Procurement Overview & Action */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h3 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 800 }}>
                      🚨 {lang === "zh-TW" ? "庫存安全預警與採購進貨系統 (Procurement & POs)" : "Low-Stock Alerts & Purchase Orders (Procurement)"}
                    </h3>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                      {lang === "zh-TW"
                        ? "即時監測各書籍實體在庫與保留量，當低於安全水位 (Safety Stock) 時自動發出預警，支援供應商採購單與到貨驗收直接入庫儲位。"
                        : "Monitor live available stock vs safety thresholds. Trigger procurement POs to suppliers and put away received shipments directly into bins."}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (products.length > 0) setNewPoBookId(products[0].id);
                      if (suppliersList.length > 0) setNewPoSupplierId(suppliersList[0].id);
                      setIsCreatePoModalOpen(true);
                    }}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--accent)",
                      color: "white",
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      boxShadow: "var(--shadow-sm)",
                    }}
                  >
                    <span>➕</span> {lang === "zh-TW" ? "新增供應商採購單 (New PO)" : "Create Purchase Order"}
                  </button>
                </div>

                {/* Section 1: Low-Stock Alerts Table */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, marginBottom: 24, boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontWeight: 800, fontSize: 15 }}>
                      ⚠️ {lang === "zh-TW" ? "書籍安全庫存預警指標" : "Product Inventory Safety Alerts"}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                        {lang === "zh-TW" ? "嚴重缺貨 (CRITICAL): " : "CRITICAL: "} {lowStockAlerts.filter((a) => a.urgency === "CRITICAL").length}
                      </span>
                      <span style={{ background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                        {lang === "zh-TW" ? "低於水位 (LOW): " : "LOW: "} {lowStockAlerts.filter((a) => a.urgency === "LOW").length}
                      </span>
                    </div>
                  </div>

                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                          <th style={{ padding: 10, textAlign: "left" }}>{lang === "zh-TW" ? "書籍名稱" : "Book Title"}</th>
                          <th style={{ padding: 10, textAlign: "center" }}>{lang === "zh-TW" ? "實體在庫" : "On-Hand"}</th>
                          <th style={{ padding: 10, textAlign: "center" }}>{lang === "zh-TW" ? "訂單保留" : "Reserved"}</th>
                          <th style={{ padding: 10, textAlign: "center" }}>{lang === "zh-TW" ? "可銷售量" : "Available"}</th>
                          <th style={{ padding: 10, textAlign: "center" }}>{lang === "zh-TW" ? "安全庫存水位" : "Safety Stock"}</th>
                          <th style={{ padding: 10, textAlign: "center" }}>{lang === "zh-TW" ? "建議採購量" : "Suggested PO"}</th>
                          <th style={{ padding: 10, textAlign: "center" }}>{lang === "zh-TW" ? "預警狀態" : "Urgency"}</th>
                          <th style={{ padding: 10, textAlign: "center" }}>{lang === "zh-TW" ? "操作" : "Action"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lowStockAlerts.map((a) => (
                          <tr key={a.product_id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                            <td style={{ padding: 10 }}>
                              <div style={{ fontWeight: 700 }}>{lang === "zh-TW" ? a.title_zh || a.title_en : a.title_en}</div>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>ISBN: {a.isbn || "N/A"} • {a.category_name}</div>
                            </td>
                            <td style={{ padding: 10, textAlign: "center", fontWeight: 700 }}>{a.total_on_hand}</td>
                            <td style={{ padding: 10, textAlign: "center", color: "#d97706", fontWeight: 700 }}>{a.total_reserved}</td>
                            <td style={{ padding: 10, textAlign: "center", fontWeight: 900, color: a.total_available <= a.safety_stock ? "#b91c1c" : "var(--text-primary)" }}>
                              {a.total_available}
                            </td>
                            <td style={{ padding: 10, textAlign: "center", color: "var(--text-secondary)" }}>{a.safety_stock}</td>
                            <td style={{ padding: 10, textAlign: "center", fontWeight: 700, color: "var(--accent)" }}>{a.reorder_quantity}</td>
                            <td style={{ padding: 10, textAlign: "center" }}>
                              <span
                                style={{
                                  background: a.urgency === "CRITICAL" ? "#fee2e2" : a.urgency === "LOW" ? "#fef3c7" : "#ecfdf5",
                                  color: a.urgency === "CRITICAL" ? "#991b1b" : a.urgency === "LOW" ? "#92400e" : "#065f46",
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                {a.urgency}
                              </span>
                            </td>
                            <td style={{ padding: 10, textAlign: "center" }}>
                              <button
                                onClick={() => {
                                  setNewPoBookId(a.product_id);
                                  setNewPoQuantity(a.reorder_quantity || 50);
                                  setNewPoUnitCost(a.cost_price || 0);
                                  if (suppliersList.length > 0) setNewPoSupplierId(suppliersList[0].id);
                                  setIsCreatePoModalOpen(true);
                                }}
                                style={{
                                  padding: "4px 10px",
                                  borderRadius: 6,
                                  border: "1px solid var(--accent)",
                                  background: "var(--accent-light)",
                                  color: "var(--accent)",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                ➕ {lang === "zh-TW" ? "補貨" : "Reorder"}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Section 2: Purchase Orders History */}
                <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 14 }}>
                    📋 {lang === "zh-TW" ? "供應商採購單與收貨入庫記錄 (Purchase Orders)" : "Purchase Orders & Goods Receipts"} ({purchaseOrdersList.length})
                  </div>

                  {purchaseOrdersList.length === 0 ? (
                    <div style={{ textAlign: "center", padding: 30, color: "var(--text-secondary)", fontSize: 13 }}>
                      {lang === "zh-TW" ? "目前尚未建立任何供應商採購單。" : "No purchase orders generated yet."}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      {purchaseOrdersList.map((po) => (
                        <div
                          key={po.id}
                          style={{
                            border: "1px solid var(--border-color)",
                            background: "var(--bg-secondary)",
                            borderRadius: 10,
                            padding: 14,
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            flexWrap: "wrap",
                            gap: 12,
                          }}
                        >
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontFamily: "monospace", fontWeight: 800, fontSize: 13 }}>{po.po_number}</span>
                              <span
                                style={{
                                  background: po.status === "RECEIVED" ? "#dcfce7" : "#dbeafe",
                                  color: po.status === "RECEIVED" ? "#166534" : "#1e40af",
                                  padding: "2px 8px",
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontWeight: 800,
                                }}
                              >
                                {po.status}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 4 }}>
                              🏢 <strong>{po.supplier_name}</strong> • {lang === "zh-TW" ? "建單者：" : "Created by: "} {po.created_by_name}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                              {lang === "zh-TW" ? "採購項目：" : "Items: "}
                              {po.items.map((it) => `${it.product_title_en} (×${it.quantity_ordered})`).join(", ")}
                            </div>
                          </div>

                          <div style={{ textAlign: "right", display: "flex", alignItems: "center", gap: 14 }}>
                            <div>
                              <div style={{ fontWeight: 900, fontSize: 16, color: "var(--accent)" }}>
                                ${po.total_cost.toFixed(2)}
                              </div>
                              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                {new Date(po.created_at).toLocaleDateString()}
                              </div>
                            </div>

                            {po.status === "ORDERED" ? (
                              <button
                                onClick={() => {
                                  setPoToReceive(po);
                                  if (warehouseLocations.length > 0) setReceiveLocationId(warehouseLocations[0].id);
                                  setIsReceivePoModalOpen(true);
                                }}
                                style={{
                                  padding: "6px 14px",
                                  borderRadius: 6,
                                  border: "none",
                                  background: "#10b981",
                                  color: "white",
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                  boxShadow: "var(--shadow-sm)",
                                }}
                              >
                                📥 {lang === "zh-TW" ? "到貨驗收入庫" : "Receive Shipment"}
                              </button>
                            ) : (
                              <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>
                                ✓ {lang === "zh-TW" ? "已驗收入庫" : "Received"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
        {/* MODAL 1: CREATE PURCHASE ORDER */}
        {isCreatePoModalOpen && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "var(--bg-card)", borderRadius: 14, maxWidth: 520, width: "100%", padding: 24, boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>➕ {lang === "zh-TW" ? "開立供應商採購單" : "Create Purchase Order"}</h3>
                <button onClick={() => setIsCreatePoModalOpen(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
              </div>

              <form onSubmit={handleCreatePurchaseOrder} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    {lang === "zh-TW" ? "書籍供應商 (Supplier)" : "Supplier"}
                  </label>
                  <select
                    value={newPoSupplierId}
                    onChange={(e) => setNewPoSupplierId(Number(e.target.value))}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                  >
                    {suppliersList.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} ({s.lead_time_days} days lead time)</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    {lang === "zh-TW" ? "採購書籍 (Book Item)" : "Book to Order"}
                  </label>
                  <select
                    value={newPoBookId}
                    onChange={(e) => {
                      const bid = Number(e.target.value);
                      setNewPoBookId(bid);
                      const b = products.find((p) => p.id === bid);
                      if (b) setNewPoUnitCost(b.cost_price || Math.round(b.price * 0.6 * 100) / 100);
                    }}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {lang === "zh-TW" ? p.title_zh || p.title_en : p.title_en} (${p.price})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      {lang === "zh-TW" ? "採購數量 (Qty)" : "Quantity"}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={newPoQuantity}
                      onChange={(e) => setNewPoQuantity(Number(e.target.value))}
                      required
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                      {lang === "zh-TW" ? "預估進貨單價 ($)" : "Unit Cost ($)"}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={newPoUnitCost}
                      onChange={(e) => setNewPoUnitCost(Number(e.target.value))}
                      style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    {lang === "zh-TW" ? "採購單備註 (Notes)" : "Notes"}
                  </label>
                  <textarea
                    rows={2}
                    value={newPoNotes}
                    onChange={(e) => setNewPoNotes(e.target.value)}
                    placeholder="e.g. Standard monthly replenishment"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  <button type="button" onClick={() => setIsCreatePoModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", cursor: "pointer" }}>
                    {lang === "zh-TW" ? "取消" : "Cancel"}
                  </button>
                  <button type="submit" disabled={creatingPo} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontWeight: 700, cursor: "pointer" }}>
                    {creatingPo ? "Submitting..." : lang === "zh-TW" ? "送出採購單" : "Create PO"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: RECEIVE PURCHASE ORDER (PUT AWAY) */}
        {isReceivePoModalOpen && poToReceive && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
            <div style={{ background: "var(--bg-card)", borderRadius: 14, maxWidth: 520, width: "100%", padding: 24, boxShadow: "var(--shadow-lg)", border: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📥 {lang === "zh-TW" ? "到貨驗收與上架儲位" : "Receive Shipment & Put Away"}</h3>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{poToReceive.po_number} • {poToReceive.supplier_name}</div>
                </div>
                <button onClick={() => setIsReceivePoModalOpen(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
              </div>

              <form onSubmit={handleReceivePurchaseOrder} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 8, fontSize: 13 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4 }}>{lang === "zh-TW" ? "驗收項目清單：" : "Items to Put Away:"}</div>
                  {poToReceive.items.map((it) => (
                    <div key={it.id} style={{ display: "flex", justifyContent: "space-between", margin: "2px 0" }}>
                      <span>{it.product_title_en}</span>
                      <strong>× {it.quantity_ordered}</strong>
                    </div>
                  ))}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    {lang === "zh-TW" ? "上架目標儲位 (Target Put-Away Bin)" : "Put-Away Storage Bin Location"}
                  </label>
                  <select
                    value={receiveLocationId}
                    onChange={(e) => setReceiveLocationId(Number(e.target.value))}
                    required
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                  >
                    {warehouseLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.location_code} ({loc.zone_name_en} - {loc.category_hint || "General"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    {lang === "zh-TW" ? "入庫商品品相 (Condition)" : "Grading Condition"}
                  </label>
                  <select
                    value={receiveCondition}
                    onChange={(e) => setReceiveCondition(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                  >
                    <option value="brand_new">🟢 Brand New (全新未拆封)</option>
                    <option value="minor_wear">🟡 Minor Wear (外觀輕微摩擦/展示品)</option>
                    <option value="damaged">🔴 Damaged (瑕疵/隔離品)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                    {lang === "zh-TW" ? "驗收備註 (Receiving Notes)" : "Receiving Notes"}
                  </label>
                  <input
                    type="text"
                    value={receiveNotes}
                    onChange={(e) => setReceiveNotes(e.target.value)}
                    placeholder="e.g. Inspected at Dock Bay 1, carton undamaged"
                    style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)" }}
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                  <button type="button" onClick={() => setIsReceivePoModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", cursor: "pointer" }}>
                    {lang === "zh-TW" ? "取消" : "Cancel"}
                  </button>
                  <button type="submit" disabled={receivingPo} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#10b981", color: "white", fontWeight: 700, cursor: "pointer" }}>
                    {receivingPo ? "Processing..." : lang === "zh-TW" ? "確認入庫上架" : "Confirm Put Away"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
