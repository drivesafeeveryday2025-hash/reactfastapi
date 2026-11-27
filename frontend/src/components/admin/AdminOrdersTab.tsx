import { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";
import type { Order } from "../../types";

interface AdminOrdersTabProps {
  orders: Order[];
  loadingOrders: boolean;
  updatingOrderId: number | null;
  onRefreshOrders: () => void;
  onUpdateStatus: (orderId: number, newStatus: string) => void;
}

export default function AdminOrdersTab({
  orders,
  loadingOrders,
  updatingOrderId,
  onRefreshOrders,
  onUpdateStatus,
}: AdminOrdersTabProps) {
  const { lang } = useLanguage();
  const [orderSearchTerm, setOrderSearchTerm] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");

  const filteredOrders = orders.filter((o) => {
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
  });

  const statusColors: Record<string, { bg: string; text: string; border: string }> = {
    Processing: { bg: "#fef3c7", text: "#92400e", border: "#fde68a" },
    Confirmed: { bg: "#dbeafe", text: "#1e40af", border: "#bfdbfe" },
    Shipped: { bg: "#ede9fe", text: "#5b21b6", border: "#ddd6fe" },
    "Out for Delivery": { bg: "#ffedd5", text: "#9a3412", border: "#fed7aa" },
    Delivered: { bg: "#dcfce7", text: "#166534", border: "#bbf7d0" },
  };

  return (
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

        <button
          onClick={onRefreshOrders}
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
          🔄 {loadingOrders ? (lang === "zh-TW" ? "重新整理中..." : "Refreshing...") : lang === "zh-TW" ? "重新整理" : "Refresh Orders"}
        </button>
      </div>

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

      {loadingOrders && orders.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
          <span style={{ fontSize: 36 }}>⏳</span>
          <p>{lang === "zh-TW" ? "正在載入訂單資料..." : "Loading store orders..."}</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, background: "var(--bg-card)", borderRadius: 16, border: "1px solid var(--border-color)" }}>
          <span style={{ fontSize: 48 }}>📦</span>
          <h3 style={{ margin: "10px 0 6px 0" }}>{lang === "zh-TW" ? "查無符合條件的訂單" : "No Matching Orders Found"}</h3>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            {lang === "zh-TW" ? "目前無符合搜尋條件或狀態的訂單記錄。" : "No orders match the current filter or search criteria."}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {filteredOrders.map((order) => {
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
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-color)", paddingBottom: 14, marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 17, fontWeight: 900 }}>#{order.id}</span>
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
                    <div style={{ fontSize: 20, fontWeight: 900, color: "var(--accent)" }}>${order.total_amount.toFixed(2)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {lang === "zh-TW" ? `運費 $${order.shipping_fee.toFixed(2)}` : `Shipping: $${order.shipping_fee.toFixed(2)}`}
                    </div>
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <button
                        type="button"
                        onClick={() => window.open(`${API_URL}/api/warehouse/fulfillment/orders/${order.id}/packing-slip-html?autoprint=true`, "_blank")}
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
                        onClick={() => window.open(`${API_URL}/api/orders/${order.id}/invoice-html?autoprint=true`, "_blank")}
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

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginBottom: 16 }}>
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
                      {order.payment_method === "apple_pay"
                        ? "📱 Apple / Google Pay"
                        : order.payment_method === "cod"
                        ? "💵 Cash on Delivery"
                        : order.payment_method === "bank_transfer"
                        ? "🏦 Bank Transfer"
                        : "💳 Credit / Debit Card"}
                    </div>
                    {order.estimated_delivery && (
                      <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>⏱️ {order.estimated_delivery}</div>
                    )}
                  </div>
                </div>

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
                            <img src={item.product_image_url} alt="Book cover" style={{ width: 32, height: 44, objectFit: "cover", borderRadius: 4 }} />
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

                <div style={{ background: "var(--bg-secondary)", padding: 12, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
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
                        onClick={() => onUpdateStatus(order.id, btn.s)}
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
  );
}
