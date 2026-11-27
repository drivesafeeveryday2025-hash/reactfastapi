import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";
import type { Order } from "../../types";

interface OrderSuccessModalProps {
  order: Order | null;
  onClose: () => void;
  onTrackLive: (orderId: number) => void;
}

export default function OrderSuccessModal({ order, onClose, onTrackLive }: OrderSuccessModalProps) {
  const { lang } = useLanguage();
  if (!order) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-modal)", color: "var(--text-primary)", width: "100%", maxWidth: 520, borderRadius: 16, padding: 28, textAlign: "center", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-modal)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
        <h2 style={{ margin: "0 0 6px 0", fontSize: 22, fontWeight: 900 }}>
          {lang === "zh-TW" ? "訂單建立成功！" : "Order Successfully Placed!"}
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px 0" }}>
          {lang === "zh-TW" ? "感謝您的訂購，我們已收到您的訂單並開始為您備貨。" : "Thank you for your purchase. We have received your order and started preparation."}
        </p>

        <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 16, textAlign: "left", marginBottom: 24, fontSize: 13, border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "訂單編號" : "Order ID"}:</span>
            <strong>#{order.id}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "物流追蹤碼" : "Tracking Number"}:</span>
            <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--accent)" }}>
              {order.tracking_number}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "配送方式" : "Delivery Method"}:</span>
            <span>
              {order.delivery_method === "express" ? "⚡ Express Courier" : order.delivery_method === "pickup" ? "🏬 Store Pickup" : "🚚 Standard Courier"}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: 8, fontSize: 15, fontWeight: 800 }}>
            <span>{lang === "zh-TW" ? "結帳總額" : "Total Paid"}:</span>
            <span style={{ color: "var(--accent)" }}>${order.total_amount.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => window.open(`${API_URL}/api/orders/${order.id}/invoice-html?autoprint=true`, "_blank")}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid var(--border-color)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            📄 {lang === "zh-TW" ? "下載發票" : "Tax Invoice"}
          </button>
          <button
            onClick={() => onTrackLive(order.id)}
            style={{
              flex: 1,
              padding: "12px 18px",
              borderRadius: 10,
              border: "none",
              background: "var(--accent)",
              color: "white",
              fontWeight: 800,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            🚚 {lang === "zh-TW" ? "即時追蹤此訂單" : "Track Order Live"}
          </button>
          <button
            onClick={onClose}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: "1px solid var(--border-color)",
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            {lang === "zh-TW" ? "繼續瀏覽" : "Continue Shopping"}
          </button>
        </div>
      </div>
    </div>
  );
}
