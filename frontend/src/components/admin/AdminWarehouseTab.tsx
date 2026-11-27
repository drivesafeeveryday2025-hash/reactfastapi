import { useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";
import type {
  FulfillmentOrder,
  InventoryItem,
  LowStockAlert,
  PickListResponse,
  PurchaseOrder,
  Supplier,
  WarehouseAdjustment,
  WarehouseFacility,
  WarehouseLocation,
  WarehouseOverview,
} from "../../types";

interface AdminWarehouseTabProps {
  products: any[];
  warehouseOverview: WarehouseOverview | null;
  warehouseFacilities: WarehouseFacility[];
  warehouseLocations: WarehouseLocation[];
  inventoryList: InventoryItem[];
  adjustmentsList: WarehouseAdjustment[];
  fulfillmentOrders: FulfillmentOrder[];
  lowStockAlerts: LowStockAlert[];
  suppliersList: Supplier[];
  purchaseOrdersList: PurchaseOrder[];
  loadingWarehouse: boolean;
  onRefreshWarehouse: () => Promise<void>;
  onRefreshOrders: () => void;
  onOpenScanner: () => void;
}

export default function AdminWarehouseTab({
  products,
  warehouseOverview,
  warehouseFacilities,
  warehouseLocations,
  inventoryList,
  adjustmentsList,
  fulfillmentOrders,
  lowStockAlerts,
  suppliersList,
  purchaseOrdersList,
  loadingWarehouse,
  onRefreshWarehouse,
  onRefreshOrders,
  onOpenScanner,
}: AdminWarehouseTabProps) {
  const { token, user } = useAuth();
  const { lang } = useLanguage();

  const [warehouseSubTab, setWarehouseSubTab] = useState<"inventory" | "fulfillment" | "procurement" | "adjustment" | "stocktake">("inventory");

  // Live Inventory filters
  const [invWarehouseFilter, setInvWarehouseFilter] = useState<string>("all");
  const [invZoneFilter, setInvZoneFilter] = useState<string>("all");
  const [invConditionFilter, setInvConditionFilter] = useState<string>("all");
  const [invSearchQuery, setInvSearchQuery] = useState<string>("");

  // Fulfillment
  const [pickListResult, setPickListResult] = useState<PickListResponse | null>(null);
  const [advancingOrderId, setAdvancingOrderId] = useState<number | null>(null);
  const [pickListChecked, setPickListChecked] = useState<Record<number, boolean>>({});

  // Procurement & Receiving modals
  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [newPoSupplierId, setNewPoSupplierId] = useState<number | "">("");
  const [newPoBookId, setNewPoBookId] = useState<number | "">("");
  const [newPoQuantity, setNewPoQuantity] = useState<number>(50);
  const [newPoUnitCost, setNewPoUnitCost] = useState<number>(0);
  const [newPoNotes, setNewPoNotes] = useState<string>("");
  const [creatingPo, setCreatingPo] = useState(false);

  const [isReceivePoModalOpen, setIsReceivePoModalOpen] = useState(false);
  const [poToReceive, setPoToReceive] = useState<PurchaseOrder | null>(null);
  const [receiveLocationId, setReceiveLocationId] = useState<number | "">("");
  const [receiveCondition, setReceiveCondition] = useState<string>("brand_new");
  const [receiveNotes, setReceiveNotes] = useState<string>("");
  const [receivingPo, setReceivingPo] = useState(false);

  // Stock Adjustment
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

  // Stocktake Excel Export
  const [stkWarehouseFilter, setStkWarehouseFilter] = useState<string>("all");
  const [stkZoneFilter, setStkZoneFilter] = useState<string>("all");
  const [stkConditionFilter, setStkConditionFilter] = useState<string>("all");
  const [stkSelectedProductIds, setStkSelectedProductIds] = useState<number[]>([]);
  const [stkExporting, setStkExporting] = useState(false);

  const filteredInventory = inventoryList.filter((item) => {
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
  });

  const filteredStocktake = inventoryList.filter((item) => {
    const matchWh = stkWarehouseFilter === "all" || item.warehouse_id.toString() === stkWarehouseFilter;
    const matchZone = stkZoneFilter === "all" || item.zone === stkZoneFilter;
    const matchCond = stkConditionFilter === "all" || item.condition === stkConditionFilter;
    const matchProd = stkSelectedProductIds.length === 0 || stkSelectedProductIds.includes(item.product_id);
    return matchWh && matchZone && matchCond && matchProd;
  });

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
        await onRefreshWarehouse();
        onRefreshOrders();
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
        await onRefreshWarehouse();
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
        await onRefreshWarehouse();
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
        onRefreshWarehouse();
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

  return (
    <div>
      {/* Header Banner */}
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
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            onClick={onOpenScanner}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "var(--accent)",
              color: "white",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            📷 {lang === "zh-TW" ? "條碼掃描與儲位速查" : "Barcode Scanner & Bin Lookup"}
          </button>
          <button
            onClick={onRefreshWarehouse}
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
            🔄 {loadingWarehouse ? (lang === "zh-TW" ? "更新中..." : "Refreshing...") : lang === "zh-TW" ? "重新整理數據" : "Refresh Data"}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
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
            {warehouseOverview?.total_warehouses || 0}{" "}
            <span style={{ fontSize: 16, fontWeight: 500, color: "var(--text-secondary)" }}>
              {lang === "zh-TW" ? "倉" : "Facilities"} / {warehouseOverview?.total_locations || 0} {lang === "zh-TW" ? "儲位" : "Bins"}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
            {lang === "zh-TW" ? "同品類書籍依分區集中存放" : "Categorized by dedicated zones"}
          </div>
        </div>
      </div>

      {/* Sub-Tab Selector */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, borderBottom: "1px solid var(--border-color)", paddingBottom: 12, flexWrap: "wrap" }}>
        {[
          { id: "inventory", icon: "📋", label: `${lang === "zh-TW" ? "即時儲位庫存表" : "Live Inventory & Locations"} (${inventoryList.length})` },
          { id: "fulfillment", icon: "🚚", label: `${lang === "zh-TW" ? "揀貨與出貨履約" : "Fulfillment & Pick Lists"} (${fulfillmentOrders.filter((o) => ["Processing", "Confirmed", "Picking", "Packed"].includes(o.status)).length})` },
          { id: "procurement", icon: "🚨", label: `${lang === "zh-TW" ? "庫存預警與採購進貨" : "Low Stock & POs"} (${lowStockAlerts.filter((a) => a.urgency !== "NORMAL").length})` },
          { id: "adjustment", icon: "⚖️", label: `${lang === "zh-TW" ? "庫存與儲位調整單" : "Stock Adjustment & Vouchers"} (${adjustmentsList.length})` },
          { id: "stocktake", icon: "📊", label: lang === "zh-TW" ? "盤點規劃與 Excel 匯出" : "Stocktake Planner & Excel Export" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setWarehouseSubTab(tab.id as any)}
            style={{
              padding: "8px 16px",
              borderRadius: 20,
              border: "none",
              background: warehouseSubTab === tab.id ? "var(--accent)" : "var(--bg-secondary)",
              color: warehouseSubTab === tab.id ? "white" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* SUB-TAB 1: LIVE INVENTORY */}
      {warehouseSubTab === "inventory" && (
        <div>
          <div style={{ background: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.25)", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>💡</span>
            <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
              <b>{lang === "zh-TW" ? "智慧分區儲放策略 (Category Zoning)：" : "Smart Category Zoning Strategy: "}</b>
              {lang === "zh-TW"
                ? "同類別書籍集中存放於鄰近儲區。Zone A 為科技資訊專區、Zone B 為世界文學與小說、Zone C 為個人成長與藝術、Zone D 為待驗隔離與微損品專區、Zone S 為旗艦門市前場展示。"
                : "Similar categories are clustered in proximity: Zone A (Tech & Programming), Zone B (World Literature & Fiction), Zone C (Personal Growth & Arts), Zone D (Quarantine & Inspection), Zone S (Retail Sales Floor & Buffer Stock)."}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <select value={invWarehouseFilter} onChange={(e) => setInvWarehouseFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}>
              <option value="all">{lang === "zh-TW" ? "🏢 全部倉庫據點 (All Facilities)" : "🏢 All Warehouses"}</option>
              {warehouseFacilities.map((f) => (
                <option key={f.id} value={f.id.toString()}>{f.code} - {lang === "zh-TW" ? f.name_zh : f.name_en}</option>
              ))}
            </select>

            <select value={invZoneFilter} onChange={(e) => setInvZoneFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}>
              <option value="all">{lang === "zh-TW" ? "📍 全部儲位分區 (All Zones)" : "📍 All Storage Zones"}</option>
              <option value="Zone A">{lang === "zh-TW" ? "Zone A: 科技與資訊" : "Zone A: Tech & Programming"}</option>
              <option value="Zone B">{lang === "zh-TW" ? "Zone B: 文學與小說" : "Zone B: Literature & Fiction"}</option>
              <option value="Zone C">{lang === "zh-TW" ? "Zone C: 成長與藝術" : "Zone C: Growth & Arts"}</option>
              <option value="Zone D">{lang === "zh-TW" ? "Zone D: 隔離與待驗" : "Zone D: Quarantine & Inspection"}</option>
              <option value="Zone S-FRONT">{lang === "zh-TW" ? "Zone S-FRONT: 門市展架" : "Zone S-FRONT: Storefront Display"}</option>
              <option value="Zone S-BACK">{lang === "zh-TW" ? "Zone S-BACK: 門市備貨區" : "Zone S-BACK: Store Backroom"}</option>
            </select>

            <select value={invConditionFilter} onChange={(e) => setInvConditionFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }}>
              <option value="all">{lang === "zh-TW" ? "🏷️ 全部商品狀況" : "🏷️ All Conditions"}</option>
              <option value="brand_new">{lang === "zh-TW" ? "🟢 全新 (Brand New)" : "🟢 Brand New"}</option>
              <option value="minor_wear">{lang === "zh-TW" ? "🟡 微損/展示本" : "🟡 Minor Wear"}</option>
              <option value="damaged">{lang === "zh-TW" ? "🔴 瑕疵/隔離品" : "🔴 Damaged"}</option>
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
              <b style={{ color: "var(--accent)" }}>{filteredInventory.length}</b>
            </div>
          </div>

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
                {filteredInventory.map((item) => {
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
                          {item.image_url && <img src={item.image_url} alt="" style={{ width: 34, height: 48, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border-color)", flexShrink: 0 }} />}
                          <div>
                            <div style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: 13 }}>{lang === "zh-TW" ? item.product_title_zh : item.product_title_en}</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                              {item.product_author_en} • <span style={{ background: "var(--bg-secondary)", padding: "1px 6px", borderRadius: 4 }}>{lang === "zh-TW" ? item.category_name_zh : item.category_name_en}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: 12, fontFamily: "monospace", fontSize: 12, color: "var(--text-secondary)" }}>{item.isbn || `SKU-${item.product_id}`}</td>
                      <td style={{ padding: 12 }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.warehouse_code}</span>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? item.warehouse_name_zh : item.warehouse_name_en}</div>
                      </td>
                      <td style={{ padding: 12 }}>
                        <span style={{ fontWeight: 700, color: "var(--accent)" }}>{item.zone}</span>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? item.zone_name_zh : item.zone_name_en}</div>
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
                      <td style={{ padding: 12, textAlign: "right", fontWeight: 900, fontSize: 14 }}>{item.quantity}</td>
                      <td style={{ padding: 12, textAlign: "right", fontSize: 12 }}>
                        <span style={{ color: "#059669", fontWeight: 700 }}>{item.available_quantity}</span>
                        <span style={{ color: "var(--text-secondary)" }}> / </span>
                        <span style={{ color: "#d97706", fontWeight: 600 }}>{item.reserved_quantity}</span>
                      </td>
                      <td style={{ padding: 12, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button onClick={() => quickAdjust(item)} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                            ⚡ {lang === "zh-TW" ? "調整單" : "Adjust"}
                          </button>
                          <button onClick={() => window.open(`${API_URL}/api/warehouse/locations/${item.location_id}/bin-label-html`, "_blank")} style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                            🏷️ {lang === "zh-TW" ? "儲位標籤" : "Label"}
                          </button>
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

      {/* SUB-TAB 2: ADJUSTMENTS */}
      {warehouseSubTab === "adjustment" && (
        <div style={{ display: "grid", gridTemplateColumns: "minmax(340px, 460px) 1fr", gap: 24, alignItems: "start" }}>
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
                <div style={{ fontWeight: 800, marginBottom: 4 }}>✅ {lang === "zh-TW" ? "調整單開立成功！" : "Adjustment Voucher Approved & Executed!"}</div>
                <div>{lang === "zh-TW" ? "憑證號碼: " : "Voucher Ref: "}<b>{adjSuccessVoucher.voucher_no}</b></div>
              </div>
            )}

            {adjError && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 12, marginBottom: 16, color: "#991b1b", fontSize: 13 }}>
                ⚠️ {adjError}
              </div>
            )}

            <form onSubmit={handleIssueAdjustment} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--text-secondary)" }}>
                  {lang === "zh-TW" ? "調整作業類型" : "Operation Type"}
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  {[
                    { id: "qty", label: lang === "zh-TW" ? "📦 數量增減" : "📦 Qty Change" },
                    { id: "relocate", label: lang === "zh-TW" ? "🔄 儲位移轉" : "🔄 Relocate" },
                    { id: "condition", label: lang === "zh-TW" ? "🏷️ 品相變更" : "🏷️ Condition" },
                  ].map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setAdjType(op.id as any)}
                      style={{
                        padding: "8px 6px",
                        borderRadius: 6,
                        border: adjType === op.id ? "2px solid var(--accent)" : "1px solid var(--border-color)",
                        background: adjType === op.id ? "var(--bg-secondary)" : "var(--bg-card)",
                        color: "var(--text-primary)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>
                  {lang === "zh-TW" ? "選擇書籍商品 *" : "Target Book Product *"}
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
                    <option key={p.id} value={p.id}>#{p.id} {p.title_en} ({p.detail?.isbn || "No ISBN"})</option>
                  ))}
                </select>
              </div>

              {adjType === "qty" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "調整儲位" : "Location"}</label>
                    <select value={adjToLocId} onChange={(e) => setAdjToLocId(e.target.value ? Number(e.target.value) : "")} required style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}>
                      <option value="">{lang === "zh-TW" ? "-- 選擇儲位 --" : "-- Select Location --"}</option>
                      {warehouseLocations.map((l) => <option key={l.id} value={l.id}>{l.location_code} ({l.zone})</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "商品品相" : "Condition"}</label>
                    <select value={adjToCond} onChange={(e) => setAdjToCond(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}>
                      <option value="brand_new">🟢 Brand New</option>
                      <option value="minor_wear">🟡 Minor Wear</option>
                      <option value="damaged">🔴 Damaged</option>
                    </select>
                  </div>
                </div>
              )}

              {adjType === "relocate" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "原儲位" : "From Location"}</label>
                    <select value={adjFromLocId} onChange={(e) => setAdjFromLocId(e.target.value ? Number(e.target.value) : "")} required style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}>
                      <option value="">-- From Location --</option>
                      {warehouseLocations.map((l) => <option key={l.id} value={l.id}>{l.location_code}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "目標新儲位" : "To Location"}</label>
                    <select value={adjToLocId} onChange={(e) => setAdjToLocId(e.target.value ? Number(e.target.value) : "")} required style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}>
                      <option value="">-- To Location --</option>
                      {warehouseLocations.map((l) => <option key={l.id} value={l.id}>{l.location_code}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {adjType === "condition" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "原品相" : "From Condition"}</label>
                    <select value={adjFromCond} onChange={(e) => setAdjFromCond(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}>
                      <option value="brand_new">🟢 Brand New</option>
                      <option value="minor_wear">🟡 Minor Wear</option>
                      <option value="damaged">🔴 Damaged</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "調整為新品相" : "To Condition"}</label>
                    <select value={adjToCond} onChange={(e) => setAdjToCond(e.target.value)} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}>
                      <option value="brand_new">🟢 Brand New</option>
                      <option value="minor_wear">🟡 Minor Wear</option>
                      <option value="damaged">🔴 Damaged</option>
                    </select>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "數量 (+/- Qty) *" : "Quantity Change *"}</label>
                  <input type="number" value={adjChangeQty} onChange={(e) => setAdjChangeQty(Number(e.target.value))} required style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "調整原因碼 *" : "Reason Code *"}</label>
                  <select value={adjReasonCode} onChange={(e) => setAdjReasonCode(e.target.value)} required style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 12 }}>
                    <option value="RESTOCK_RECEIVING">📥 Restock Receiving</option>
                    <option value="DAMAGE_FOUND">⚠️ Damage Identified</option>
                    <option value="COUNT_DISCREPANCY">🔍 Count Discrepancy</option>
                    <option value="RELOCATION">🚚 Shelf Relocation</option>
                    <option value="CONDITION_RECLASSIFY">🏷️ Condition Reclassify</option>
                    <option value="EXPIRED_SCRAP">🗑️ Scrap / Decommission</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "調整事由說明" : "Audit Notes"}</label>
                <textarea value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)} rows={2} placeholder="Provide context or reference..." style={{ width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", fontSize: 13 }} />
              </div>

              <button type="submit" disabled={adjSubmitting} style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontWeight: 700, fontSize: 14, cursor: adjSubmitting ? "not-allowed" : "pointer", marginTop: 4 }}>
                {adjSubmitting ? "Submitting Voucher..." : lang === "zh-TW" ? "📝 簽核開立調整單" : "📝 Approve & Submit Adjustment"}
              </button>
            </form>
          </div>

          <div>
            <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 800 }}>📜 {lang === "zh-TW" ? "庫存異動與調整單紀錄 (Audit Trail)" : "Adjustment Voucher Audit Trail"}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 13, margin: "0 0 16px 0" }}>
              {lang === "zh-TW" ? "所有經主管核可的庫存增減、儲位搬遷與瑕疵隔離單據" : "Permanent immutable record of stock vouchers and approvals."}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {adjustmentsList.map((a) => (
                <div key={a.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 10, padding: 16, boxShadow: "var(--shadow-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 800, background: "var(--bg-secondary)", padding: "2px 8px", borderRadius: 6, fontSize: 12, color: "var(--accent)" }}>{a.voucher_no}</span>
                      <span style={{ background: "#ecfdf5", color: "#065f46", fontSize: 11, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>{a.status}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{new Date(a.created_at).toLocaleString()}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)", marginBottom: 4 }}>{lang === "zh-TW" ? a.product_title_zh : a.product_title_en}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span>Change: <b style={{ color: a.change_qty >= 0 ? "#059669" : "#dc2626" }}>{a.change_qty > 0 ? `+${a.change_qty}` : a.change_qty}</b></span>
                    <span>•</span>
                    <span>Reason: <b style={{ color: "var(--text-primary)" }}>{a.reason_code}</b></span>
                    {a.from_location_code && a.to_location_code && <><span>•</span><span>{a.from_location_code} ➔ {a.to_location_code}</span></>}
                  </div>
                  {a.notes && <div style={{ fontSize: 12, background: "var(--bg-secondary)", padding: "8px 10px", borderRadius: 6, color: "var(--text-primary)", fontStyle: "italic", marginBottom: 6 }}>"{a.notes}"</div>}
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", textAlign: "right" }}>Authorized by: <b>{a.created_by_name}</b></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: STOCKTAKE PLANNER & EXCEL */}
      {warehouseSubTab === "stocktake" && (
        <div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 22, marginBottom: 20, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h3 style={{ margin: "0 0 6px 0", fontSize: 20, fontWeight: 800 }}>📊 {lang === "zh-TW" ? "實體盤點作業規劃與 Excel 盤點表匯出" : "Stocktake Count Planner & Excel Checklist Export"}</h3>
                <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14, maxWidth: 760, lineHeight: 1.5 }}>
                  {lang === "zh-TW" ? "支援按區域分區或指定特定書籍組織盤點作業，匯出專業 Excel (.xlsx) 檔案供實盤手寫核對。" : "Organize physical inventory audits by warehouse zone or specific products. Export a print-ready Excel (.xlsx) checklist."}
                </p>
              </div>
              <button onClick={handleExportStocktakeExcel} disabled={stkExporting} style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 24px", borderRadius: 10, border: "none", background: "#059669", color: "white", fontWeight: 800, fontSize: 14, cursor: stkExporting ? "not-allowed" : "pointer" }}>
                <span>📥</span> {stkExporting ? (lang === "zh-TW" ? "正在產生 Excel..." : "Generating Excel...") : lang === "zh-TW" ? "匯出列印盤點表 (.xlsx)" : "Export Stocktake Checklist (.xlsx)"}
              </button>
            </div>

            <hr style={{ border: "none", borderTop: "1px solid var(--border-color)", margin: "18px 0" }} />

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>Audit Facility</label>
                <select value={stkWarehouseFilter} onChange={(e) => setStkWarehouseFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
                  <option value="all">All Facilities</option>
                  {warehouseFacilities.map((f) => <option key={f.id} value={f.id.toString()}>{f.code} - {f.name_en}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>Target Zone</label>
                <select value={stkZoneFilter} onChange={(e) => setStkZoneFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
                  <option value="all">All Zones</option>
                  <option value="Zone A">Zone A: Tech</option>
                  <option value="Zone B">Zone B: Literature</option>
                  <option value="Zone C">Zone C: Growth & Arts</option>
                  <option value="Zone D">Zone D: Quarantine</option>
                  <option value="Zone S-FRONT">Zone S-FRONT</option>
                  <option value="Zone S-BACK">Zone S-BACK</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 4 }}>Condition Filter</label>
                <select value={stkConditionFilter} onChange={(e) => setStkConditionFilter(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", fontSize: 13 }}>
                  <option value="all">All Conditions</option>
                  <option value="brand_new">🟢 Brand New</option>
                  <option value="minor_wear">🟡 Minor Wear</option>
                  <option value="damaged">🔴 Damaged</option>
                </select>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>Audited Scope: <b style={{ color: "var(--accent)", fontSize: 16 }}>{filteredStocktake.length}</b> SKUs</span>
              </div>
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>🎯 Filter by Specific Products (Click to toggle):</span>
                {stkSelectedProductIds.length > 0 && (
                  <button type="button" onClick={() => setStkSelectedProductIds([])} style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid var(--border-color)", background: "var(--bg-card)", fontSize: 11, cursor: "pointer" }}>
                    ✕ Clear Selection
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
                      onClick={() => setStkSelectedProductIds((prev) => (prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]))}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 14,
                        border: isSelected ? "1.5px solid var(--accent)" : "1px solid var(--border-color)",
                        background: isSelected ? "var(--accent)" : "var(--bg-secondary)",
                        color: isSelected ? "white" : "var(--text-primary)",
                        fontSize: 11,
                        fontWeight: isSelected ? 700 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {isSelected ? "✓" : "+"} {p.title_en}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-color)", padding: 20, boxShadow: "var(--shadow-sm)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#1e293b", color: "white", textAlign: "left" }}>
                  <th style={{ padding: 10 }}>#</th>
                  <th style={{ padding: 10 }}>ISBN / SKU</th>
                  <th style={{ padding: 10 }}>Book Title</th>
                  <th style={{ padding: 10 }}>Warehouse & Zone</th>
                  <th style={{ padding: 10 }}>Location</th>
                  <th style={{ padding: 10 }}>Condition</th>
                  <th style={{ padding: 10, textAlign: "right" }}>System Qty</th>
                  <th style={{ padding: 10, textAlign: "center", background: "#0284c7" }}>Physical Count</th>
                </tr>
              </thead>
              <tbody>
                {filteredStocktake.map((item, idx) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid var(--border-color)", background: idx % 2 === 0 ? "transparent" : "var(--bg-secondary)" }}>
                    <td style={{ padding: 10 }}>{idx + 1}</td>
                    <td style={{ padding: 10, fontFamily: "monospace" }}>{item.isbn || `SKU-${item.product_id}`}</td>
                    <td style={{ padding: 10, fontWeight: 700 }}>{lang === "zh-TW" ? item.product_title_zh : item.product_title_en}</td>
                    <td style={{ padding: 10 }}>{item.warehouse_code} - {item.zone}</td>
                    <td style={{ padding: 10, fontFamily: "monospace" }}>{item.aisle}-{item.shelf}-{item.bin}</td>
                    <td style={{ padding: 10 }}>{item.condition}</td>
                    <td style={{ padding: 10, textAlign: "right", fontWeight: 800 }}>{item.quantity}</td>
                    <td style={{ padding: 6, textAlign: "center", background: "rgba(254, 240, 138, 0.25)" }}>[ _____ ]</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: FULFILLMENT & PICK LISTS */}
      {warehouseSubTab === "fulfillment" && (
        <div>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 20, marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
            <div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 800 }}>🚚 {lang === "zh-TW" ? "訂單揀貨與波次出庫履約系統" : "Order Fulfillment & Wave Pick Pipeline"}</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>
                {lang === "zh-TW" ? "一鍵生成分區波次揀貨單，並於出庫時自動扣減實體庫存。" : "Generate consolidated wave pick lists sorted by Zone -> Aisle -> Shelf -> Bin, and deduct physical stock upon dispatch."}
              </p>
            </div>
            <button onClick={() => handleGeneratePickList()} style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
              📋 {lang === "zh-TW" ? "生成所有待出貨波次揀貨單" : "Generate Wave Pick List"}
            </button>
          </div>

          {pickListResult && (
            <div style={{ background: "var(--bg-card)", border: "2px solid var(--accent)", borderRadius: 14, padding: 22, marginBottom: 24, boxShadow: "var(--shadow-md)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: 14, marginBottom: 16 }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: 18, fontWeight: 900 }}>📋 Consolidated Wave Pick List ({pickListResult.total_orders_count} Orders • {pickListResult.total_items_to_pick} Books)</h4>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>Generated: {pickListResult.generated_at}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => window.print()} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>🖨️ Print</button>
                  <button onClick={() => setPickListResult(null)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--bg-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✕ Close</button>
                </div>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ padding: 10 }}>Picked</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Bin Location</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Book & ISBN</th>
                    <th style={{ padding: 10 }}>Pick Qty</th>
                    <th style={{ padding: 10, textAlign: "left" }}>Order IDs</th>
                  </tr>
                </thead>
                <tbody>
                  {pickListResult.pick_items.map((it) => {
                    const isChecked = !!pickListChecked[it.product_id];
                    return (
                      <tr key={it.product_id} style={{ borderBottom: "1px solid var(--border-color)", background: isChecked ? "rgba(16, 185, 129, 0.08)" : "transparent" }}>
                        <td style={{ padding: 10, textAlign: "center" }}>
                          <input type="checkbox" checked={isChecked} onChange={(e) => setPickListChecked((prev) => ({ ...prev, [it.product_id]: e.target.checked }))} />
                        </td>
                        <td style={{ padding: 10 }}><span style={{ fontFamily: "monospace", fontWeight: 800, color: "var(--accent)" }}>{it.location_code}</span></td>
                        <td style={{ padding: 10, fontWeight: 700, textDecoration: isChecked ? "line-through" : "none" }}>{lang === "zh-TW" ? it.title_zh || it.title_en : it.title_en}</td>
                        <td style={{ padding: 10, textAlign: "center", fontWeight: 900, color: "var(--accent)" }}>× {it.quantity_to_pick}</td>
                        <td style={{ padding: 10 }}>{it.order_ids.map((oid) => `#${oid}`).join(", ")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {fulfillmentOrders.map((ord) => {
              const isWorking = advancingOrderId === ord.id;
              return (
                <div key={ord.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <span style={{ fontSize: 16, fontWeight: 900, marginRight: 8 }}>Order #{ord.id}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 12, background: "var(--bg-secondary)", padding: "2px 6px", borderRadius: 4, marginRight: 8 }}>🚚 {ord.tracking_number}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, padding: "2px 8px", borderRadius: 10, background: "var(--accent-light)", color: "var(--accent)" }}>{ord.status}</span>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{ord.recipient_name} • {ord.shipping_address}</div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" onClick={() => window.open(`${API_URL}/api/warehouse/fulfillment/orders/${ord.id}/packing-slip-html?autoprint=true`, "_blank")} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #0284c7", background: "#f0f9ff", color: "#0284c7", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        📦 Packing Slip
                      </button>
                      <button type="button" onClick={() => window.open(`${API_URL}/api/orders/${ord.id}/invoice-html?autoprint=true`, "_blank")} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        📄 Invoice
                      </button>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--border-color)", paddingTop: 10 }}>
                    {ord.status === "Processing" && <button disabled={isWorking} onClick={() => handleAdvanceFulfillment(ord.id, "Confirmed")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#3b82f6", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>✓ Confirm</button>}
                    {ord.status === "Confirmed" && <button disabled={isWorking} onClick={() => handleAdvanceFulfillment(ord.id, "Picking")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#f59e0b", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🏃 Start Picking</button>}
                    {ord.status === "Picking" && <button disabled={isWorking} onClick={() => handleAdvanceFulfillment(ord.id, "Packed")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#6366f1", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>📦 Mark Packed</button>}
                    {ord.status === "Packed" && <button disabled={isWorking} onClick={() => handleAdvanceFulfillment(ord.id, "Shipped")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#10b981", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🚚 Ship (Deduct Stock)</button>}
                    {ord.status === "Shipped" && <button disabled={isWorking} onClick={() => handleAdvanceFulfillment(ord.id, "Delivered")} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#166534", color: "white", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🎉 Mark Delivered</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: PROCUREMENT & PURCHASE ORDERS */}
      {warehouseSubTab === "procurement" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div>
              <h3 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 800 }}>🚨 {lang === "zh-TW" ? "庫存安全預警與採購進貨系統" : "Low-Stock Alerts & Purchase Orders"}</h3>
              <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "即時監測低於安全水位書籍，快速建立供應商採購單並到貨入庫。" : "Monitor safety thresholds and put away received shipments directly into bins."}</p>
            </div>
            <button
              onClick={() => {
                if (products.length > 0) setNewPoBookId(products[0].id);
                if (suppliersList.length > 0) setNewPoSupplierId(suppliersList[0].id);
                setIsCreatePoModalOpen(true);
              }}
              style={{ padding: "10px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >
              ➕ {lang === "zh-TW" ? "新增採購單 (New PO)" : "Create Purchase Order"}
            </button>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, marginBottom: 24, overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ padding: 10, textAlign: "left" }}>Book Title</th>
                  <th style={{ padding: 10 }}>On-Hand</th>
                  <th style={{ padding: 10 }}>Reserved</th>
                  <th style={{ padding: 10 }}>Available</th>
                  <th style={{ padding: 10 }}>Safety Stock</th>
                  <th style={{ padding: 10 }}>Urgency</th>
                  <th style={{ padding: 10 }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {lowStockAlerts.map((a) => (
                  <tr key={a.product_id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: 10, fontWeight: 700 }}>{lang === "zh-TW" ? a.title_zh || a.title_en : a.title_en}</td>
                    <td style={{ padding: 10, textAlign: "center" }}>{a.total_on_hand}</td>
                    <td style={{ padding: 10, textAlign: "center", color: "#d97706" }}>{a.total_reserved}</td>
                    <td style={{ padding: 10, textAlign: "center", fontWeight: 900 }}>{a.total_available}</td>
                    <td style={{ padding: 10, textAlign: "center" }}>{a.safety_stock}</td>
                    <td style={{ padding: 10, textAlign: "center" }}>
                      <span style={{ background: a.urgency === "CRITICAL" ? "#fee2e2" : a.urgency === "LOW" ? "#fef3c7" : "#ecfdf5", color: a.urgency === "CRITICAL" ? "#991b1b" : a.urgency === "LOW" ? "#92400e" : "#065f46", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{a.urgency}</span>
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
                        style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--accent)", background: "var(--accent-light)", color: "var(--accent)", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                      >
                        ➕ Reorder
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18 }}>
            <h4 style={{ margin: "0 0 14px 0", fontSize: 15, fontWeight: 800 }}>📋 Purchase Orders ({purchaseOrdersList.length})</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {purchaseOrdersList.map((po) => (
                <div key={po.id} style={{ border: "1px solid var(--border-color)", background: "var(--bg-secondary)", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontFamily: "monospace", fontWeight: 800 }}>{po.po_number}</span>
                      <span style={{ background: po.status === "RECEIVED" ? "#dcfce7" : "#dbeafe", color: po.status === "RECEIVED" ? "#166534" : "#1e40af", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>{po.status}</span>
                    </div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>🏢 <strong>{po.supplier_name}</strong></div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{po.items.map((it) => `${it.product_title_en} (×${it.quantity_ordered})`).join(", ")}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ fontWeight: 900, fontSize: 16, color: "var(--accent)" }}>${po.total_cost.toFixed(2)}</div>
                    {po.status === "ORDERED" ? (
                      <button
                        onClick={() => {
                          setPoToReceive(po);
                          if (warehouseLocations.length > 0) setReceiveLocationId(warehouseLocations[0].id);
                          setIsReceivePoModalOpen(true);
                        }}
                        style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#10b981", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        📥 Receive Shipment
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ Received</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE PO MODAL */}
      {isCreatePoModalOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 14, maxWidth: 520, width: "100%", padding: 24, border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>➕ Create Purchase Order</h3>
              <button onClick={() => setIsCreatePoModalOpen(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleCreatePurchaseOrder} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <select value={newPoSupplierId} onChange={(e) => setNewPoSupplierId(Number(e.target.value))} required style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                {suppliersList.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.lead_time_days}d)</option>)}
              </select>
              <select value={newPoBookId} onChange={(e) => setNewPoBookId(Number(e.target.value))} required style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                {products.map((p) => <option key={p.id} value={p.id}>{p.title_en} (${p.price})</option>)}
              </select>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input type="number" min={1} value={newPoQuantity} onChange={(e) => setNewPoQuantity(Number(e.target.value))} required placeholder="Quantity" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }} />
                <input type="number" step="0.01" min={0} value={newPoUnitCost} onChange={(e) => setNewPoUnitCost(Number(e.target.value))} placeholder="Unit Cost" style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }} />
              </div>
              <textarea rows={2} value={newPoNotes} onChange={(e) => setNewPoNotes(e.target.value)} placeholder="Notes..." style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsCreatePoModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-color)" }}>Cancel</button>
                <button type="submit" disabled={creatingPo} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "white", fontWeight: 700 }}>{creatingPo ? "Saving..." : "Create PO"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECEIVE PO MODAL */}
      {isReceivePoModalOpen && poToReceive && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 14, maxWidth: 520, width: "100%", padding: 24, border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>📥 Receive Shipment ({poToReceive.po_number})</h3>
              <button onClick={() => setIsReceivePoModalOpen(false)} style={{ border: "none", background: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleReceivePurchaseOrder} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <select value={receiveLocationId} onChange={(e) => setReceiveLocationId(Number(e.target.value))} required style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                {warehouseLocations.map((loc) => <option key={loc.id} value={loc.id}>{loc.location_code} ({loc.zone_name_en})</option>)}
              </select>
              <select value={receiveCondition} onChange={(e) => setReceiveCondition(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
                <option value="brand_new">🟢 Brand New</option>
                <option value="minor_wear">🟡 Minor Wear</option>
                <option value="damaged">🔴 Damaged</option>
              </select>
              <input type="text" value={receiveNotes} onChange={(e) => setReceiveNotes(e.target.value)} placeholder="Receiving Notes..." style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button type="button" onClick={() => setIsReceivePoModalOpen(false)} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border-color)" }}>Cancel</button>
                <button type="submit" disabled={receivingPo} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#10b981", color: "white", fontWeight: 700 }}>{receivingPo ? "Processing..." : "Confirm Put Away"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
