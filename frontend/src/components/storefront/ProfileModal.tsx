import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";
import type { Order } from "../../types";

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
  activeTab: "orders" | "profile" | "bought_items" | "wishlist";
  setActiveTab: (tab: "orders" | "profile" | "bought_items" | "wishlist") => void;
  myOrders: Order[];
  loadingMyOrders: boolean;
  activeTrackingOrderId: number | null;
}

export default function ProfileModal({
  open,
  onClose,
  activeTab,
  setActiveTab,
  myOrders,
  loadingMyOrders,
  activeTrackingOrderId,
}: ProfileModalProps) {
  const { token, user, setUser } = useAuth();
  const { addToCart, setCartOpen, wishlistItems, toggleWishlist, allKnownBooks } = useCart();
  const { lang, localize } = useLanguage();

  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "", address: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || "",
        phone: user.phone || "",
        address: user.address || "",
      });
    }
  }, [user]);

  if (!open) return null;

  const boughtItemsSummary = myOrders.flatMap((o) => o.items).reduce<
    Record<
      number,
      {
        product_id: number;
        title_en: string;
        title_zh: string;
        image_url: string;
        unit_price: number;
        total_quantity: number;
      }
    >
  >((acc, item) => {
    if (!acc[item.product_id]) {
      acc[item.product_id] = {
        product_id: item.product_id,
        title_en: item.product_title_en || `Book #${item.product_id}`,
        title_zh: item.product_title_zh || `圖書 #${item.product_id}`,
        image_url: item.product_image_url || "",
        unit_price: item.unit_price,
        total_quantity: 0,
      };
    }
    acc[item.product_id].total_quantity += item.quantity;
    return acc;
  }, {});

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const res = await fetch(`${API_URL}/api/user/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(profileForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setUser(updated);
        setProfileMsg(lang === "zh-TW" ? "個人資料已成功更新！" : "Profile updated successfully!");
        setTimeout(() => setProfileMsg(null), 3500);
      } else {
        alert(lang === "zh-TW" ? "個人資料儲存失敗，請重試。" : "Failed to update profile.");
      }
    } catch {
      alert(lang === "zh-TW" ? "網路連線異常，請稍後重試。" : "Network error, please try again.");
    } finally {
      setProfileSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 112, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div
        style={{
          background: "var(--bg-modal)",
          color: "var(--text-primary)",
          width: "100%",
          maxWidth: 880,
          maxHeight: "88vh",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 24 }}>👤</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {lang === "zh-TW" ? "會員專區與訂單管理" : "Customer Account & Order Hub"}
              </h3>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {user?.email} • {user?.role?.toUpperCase() || "CUSTOMER"}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
          {[
            { id: "orders", icon: "🚚", label: `${lang === "zh-TW" ? "訂單歷史與物流追蹤" : "Order Tracking & History"} (${myOrders.length})` },
            { id: "profile", icon: "⚙️", label: lang === "zh-TW" ? "個人資料修改" : "Personal Details" },
            { id: "bought_items", icon: "📚", label: `${lang === "zh-TW" ? "已購買書籍清單" : "Items Bought Shelf"} (${Object.keys(boughtItemsSummary).length})` },
            { id: "wishlist", icon: "💖", label: `${lang === "zh-TW" ? "願望清單" : "Saved Wishlist"} (${wishlistItems.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                flex: 1,
                padding: "12px 16px",
                border: "none",
                borderBottom: activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
                background: activeTab === tab.id ? "var(--bg-modal)" : "transparent",
                color: activeTab === tab.id ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {activeTab === "orders" && (
            <div>
              {loadingMyOrders && myOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: 50, color: "var(--text-secondary)" }}>
                  <span style={{ fontSize: 36 }}>⏳</span>
                  <p>{lang === "zh-TW" ? "正在載入您的訂單與物流追蹤..." : "Loading your orders & live tracking..."}</p>
                </div>
              ) : myOrders.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
                  <span style={{ fontSize: 48 }}>🛍️</span>
                  <h4 style={{ margin: "12px 0 6px 0", fontSize: 18 }}>{lang === "zh-TW" ? "尚無任何訂單記錄" : "No Orders Placed Yet"}</h4>
                  <p style={{ margin: 0, fontSize: 14 }}>
                    {lang === "zh-TW" ? "歡迎選購您喜愛的書籍，結帳後將於此處呈現即時配送進度！" : "Explore our catalog and add books to your bag to place your first order!"}
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  {myOrders.map((ord) => {
                    const stages = ["Processing", "Confirmed", "Shipped", "Out for Delivery", "Delivered"];
                    const stageIndex = stages.indexOf(ord.status);
                    const currentStageIdx = stageIndex === -1 ? 0 : stageIndex;

                    return (
                      <div
                        key={ord.id}
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid",
                          borderColor: activeTrackingOrderId === ord.id ? "var(--accent)" : "var(--border-color)",
                          borderRadius: 14,
                          padding: 20,
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 16, fontWeight: 900 }}>Order #{ord.id}</span>
                              {ord.tracking_number && (
                                <span
                                  onClick={() => {
                                    navigator.clipboard.writeText(ord.tracking_number || "");
                                    alert(lang === "zh-TW" ? "物流追蹤碼已複製！" : "Tracking number copied!");
                                  }}
                                  title="Click to copy tracking code"
                                  style={{
                                    cursor: "pointer",
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
                                  🚚 {ord.tracking_number} 📋
                                </span>
                              )}
                              <span
                                style={{
                                  background: ord.status === "Delivered" ? "#dcfce7" : ord.status === "Shipped" || ord.status === "Out for Delivery" ? "#ede9fe" : "#fef3c7",
                                  color: ord.status === "Delivered" ? "#166534" : ord.status === "Shipped" || ord.status === "Out for Delivery" ? "#5b21b6" : "#92400e",
                                  padding: "3px 10px",
                                  borderRadius: 12,
                                  fontSize: 12,
                                  fontWeight: 800,
                                }}
                              >
                                {ord.status}
                              </span>
                            </div>
                            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                              {new Date(ord.created_at).toLocaleString()}
                            </div>
                          </div>

                          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                            <div style={{ fontSize: 18, fontWeight: 900, color: "var(--accent)" }}>${ord.total_amount.toFixed(2)}</div>
                            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                              {ord.items.length} {lang === "zh-TW" ? "本書籍" : "items"}
                            </div>
                            <button
                              type="button"
                              onClick={() => window.open(`${API_URL}/api/orders/${ord.id}/invoice-html?autoprint=true`, "_blank")}
                              title={lang === "zh-TW" ? "下載/列印電子發票" : "Print/Download Official Tax Invoice"}
                              style={{
                                marginTop: 4,
                                padding: "4px 10px",
                                borderRadius: 6,
                                border: "1px solid var(--border-color)",
                                background: "var(--bg-secondary)",
                                color: "var(--text-primary)",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              📄 {lang === "zh-TW" ? "下載發票" : "Tax Invoice"}
                            </button>
                          </div>
                        </div>

                        <div style={{ background: "var(--bg-secondary)", padding: "16px 14px", borderRadius: 12, marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
                            {stages.map((stg, i) => {
                              const isPassed = i <= currentStageIdx;
                              const isCurrent = i === currentStageIdx;
                              const stageNames: Record<string, { en: string; zh: string; icon: string }> = {
                                Processing: { en: "Placed", zh: "已下單", icon: "📝" },
                                Confirmed: { en: "Confirmed", zh: "已確認", icon: "✓" },
                                Shipped: { en: "Shipped", zh: "已出貨", icon: "📦" },
                                "Out for Delivery": { en: "Out for Delivery", zh: "配送中", icon: "🚚" },
                                Delivered: { en: "Delivered", zh: "已送達", icon: "🏠" },
                              };
                              const info = stageNames[stg] || { en: stg, zh: stg, icon: "•" };

                              return (
                                <div key={stg} style={{ flex: 1, textAlign: "center", position: "relative" }}>
                                  {i > 0 && (
                                    <div
                                      style={{
                                        position: "absolute",
                                        top: 13,
                                        right: "50%",
                                        left: "-50%",
                                        height: 3,
                                        background: isPassed ? "var(--accent)" : "var(--border-color)",
                                        zIndex: 1,
                                      }}
                                    />
                                  )}
                                  <div
                                    style={{
                                      width: 28,
                                      height: 28,
                                      borderRadius: "50%",
                                      background: isPassed ? "var(--accent)" : "var(--bg-card)",
                                      border: `2px solid ${isPassed ? "var(--accent)" : "var(--border-color)"}`,
                                      color: isPassed ? "white" : "var(--text-secondary)",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: 12,
                                      fontWeight: 800,
                                      margin: "0 auto 6px auto",
                                      position: "relative",
                                      zIndex: 2,
                                      boxShadow: isCurrent ? "0 0 0 4px var(--accent-light)" : "none",
                                    }}
                                  >
                                    {info.icon}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      fontWeight: isCurrent ? 800 : 600,
                                      color: isCurrent ? "var(--accent)" : isPassed ? "var(--text-primary)" : "var(--text-secondary)",
                                    }}
                                  >
                                    {lang === "zh-TW" ? info.zh : info.en}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, fontSize: 12, marginBottom: 14 }}>
                          <div>
                            <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "配送方式：" : "Method: "}</span>
                            <strong>
                              {ord.delivery_method === "express" ? "⚡ Express Courier" : ord.delivery_method === "pickup" ? "🏬 Store Pickup" : "🚚 Standard Courier"}
                            </strong>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "付款方式：" : "Payment: "}</span>
                            <strong>{ord.payment_method}</strong>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "收件人：" : "Recipient: "}</span>
                            <strong>{ord.recipient_name} ({ord.recipient_phone})</strong>
                          </div>
                          <div>
                            <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "配送地址：" : "Address: "}</span>
                            <span>{ord.shipping_address}</span>
                          </div>
                        </div>

                        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 10 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {ord.items.map((item) => (
                              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  {item.product_image_url && <img src={item.product_image_url} alt="" style={{ width: 24, height: 32, objectFit: "cover", borderRadius: 3 }} />}
                                  <span>{lang === "zh-TW" ? item.product_title_zh || item.product_title_en : item.product_title_en}</span>
                                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>× {item.quantity}</span>
                                </div>
                                <span style={{ fontWeight: 700 }}>${(item.unit_price * item.quantity).toFixed(2)}</span>
                              </div>
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

          {activeTab === "profile" && (
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <h4 style={{ margin: "0 0 16px 0", fontSize: 16, fontWeight: 800 }}>
                👤 {lang === "zh-TW" ? "修改個人資料與預設配送資訊" : "Edit Personal & Shipping Details"}
              </h4>

              {profileMsg && (
                <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46", padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16, fontWeight: 700 }}>
                  ✓ {profileMsg}
                </div>
              )}

              <form onSubmit={handleSaveProfile} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    {lang === "zh-TW" ? "帳號 Email (不可變更)" : "Email Address (Read-Only)"}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.email || ""}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-secondary)", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    {lang === "zh-TW" ? "真實姓名 / 稱謂" : "Full Name"}
                  </label>
                  <input
                    type="text"
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="e.g. John Doe"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    {lang === "zh-TW" ? "聯絡電話" : "Phone Number"}
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="e.g. +852 9123 4567"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
                    {lang === "zh-TW" ? "預設收件地址" : "Default Shipping Address"}
                  </label>
                  <textarea
                    rows={3}
                    value={profileForm.address}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    placeholder="e.g. Flat 12A, Tower 2, Central Garden, Hong Kong"
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={profileSaving}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    border: "none",
                    background: "var(--accent)",
                    color: "white",
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: "pointer",
                    marginTop: 8,
                    opacity: profileSaving ? 0.7 : 1,
                  }}
                >
                  {profileSaving ? (lang === "zh-TW" ? "儲存中..." : "Saving...") : lang === "zh-TW" ? "儲存修改資料" : "Save Profile Changes"}
                </button>
              </form>
            </div>
          )}

          {activeTab === "bought_items" && (
            <div>
              <h4 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 800 }}>
                📚 {lang === "zh-TW" ? "我買過的書籍項目" : "Books You've Purchased"}
              </h4>
              <p style={{ color: "var(--text-secondary)", margin: "0 0 20px 0", fontSize: 13 }}>
                {lang === "zh-TW" ? "彙整您歷次訂單購買的所有書籍，可直接一鍵再次加購！" : "Consolidated library of books bought across your orders. Reorder with one click!"}
              </p>

              {Object.keys(boughtItemsSummary).length === 0 ? (
                <div style={{ textAlign: "center", padding: 50, color: "var(--text-secondary)" }}>
                  <span style={{ fontSize: 44 }}>📖</span>
                  <p>{lang === "zh-TW" ? "您目前尚未購買任何書籍。" : "You have not purchased any books yet."}</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                  {Object.values(boughtItemsSummary).map((b) => (
                    <div
                      key={b.product_id}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 12,
                        padding: 14,
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      {b.image_url ? (
                        <img src={b.image_url} alt="" style={{ width: 50, height: 70, objectFit: "cover", borderRadius: 6 }} />
                      ) : (
                        <div style={{ width: 50, height: 70, background: "var(--bg-secondary)", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📚</div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {lang === "zh-TW" ? b.title_zh || b.title_en : b.title_en}
                        </div>
                        <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, marginTop: 2 }}>${b.unit_price.toFixed(2)}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 4 }}>
                          {lang === "zh-TW" ? `累計購買：${b.total_quantity} 本` : `Total bought: ${b.total_quantity} copies`}
                        </div>
                        <button
                          onClick={() => {
                            addToCart(b.product_id);
                            setCartOpen(true);
                          }}
                          style={{
                            marginTop: 8,
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid var(--border-accent)",
                            background: "var(--accent-light)",
                            color: "var(--accent)",
                            fontSize: 11,
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          🛒 {lang === "zh-TW" ? "再次購買" : "Buy Again"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "wishlist" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <h4 style={{ margin: "0 0 4px 0", fontSize: 16, fontWeight: 800 }}>
                    💖 {lang === "zh-TW" ? "我的願望清單" : "Saved Books & Wishlist"}
                  </h4>
                  <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 13 }}>
                    {lang === "zh-TW" ? "您收藏的書籍清單，可隨時一鍵移入購物車直接結帳。" : "Keep track of books you love and move them directly to your bag anytime."}
                  </p>
                </div>
              </div>

              {wishlistItems.length === 0 ? (
                <div style={{ textAlign: "center", padding: 60, color: "var(--text-secondary)" }}>
                  <span style={{ fontSize: 44 }}>🤍</span>
                  <h4 style={{ margin: "12px 0 6px 0", fontSize: 16 }}>
                    {lang === "zh-TW" ? "願望清單目前是空的" : "Your Wishlist is Empty"}
                  </h4>
                  <p style={{ margin: 0, fontSize: 13 }}>
                    {lang === "zh-TW" ? "瀏覽書目時點選封面右上角的愛心圖示，即可將書籍收藏至此！" : "Click the heart icon on any book cover to save it to your wishlist!"}
                  </p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                  {wishlistItems.map((item) => {
                    const b = item.product || allKnownBooks[item.product_id];
                    const title = b ? localize(b, "title") : (lang === "zh-TW" ? item.title_zh || item.title_en : item.title_en) || `Book #${item.product_id}`;
                    const author = b ? localize(b, "author") : item.author_en || "";
                    const price = b ? b.price : (item.price || 0);
                    const img = b ? b.image_url : item.image_url || "";

                    return (
                      <div
                        key={item.id}
                        style={{
                          background: "var(--bg-card)",
                          border: "1px solid var(--border-color)",
                          borderRadius: 12,
                          padding: 14,
                          display: "flex",
                          gap: 14,
                          alignItems: "center",
                          boxShadow: "var(--shadow-sm)",
                        }}
                      >
                        {img ? (
                          <img src={img} alt={title} style={{ width: 60, height: 85, objectFit: "cover", borderRadius: 8 }} />
                        ) : (
                          <div style={{ width: 60, height: 85, background: "var(--bg-secondary)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>📚</div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {title}
                          </div>
                          <div style={{ color: "var(--text-secondary)", fontSize: 12, marginTop: 2 }}>{author}</div>
                          <div style={{ color: "var(--accent)", fontWeight: 800, fontSize: 15, marginTop: 4 }}>${price.toFixed(2)}</div>
                          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                            <button
                              onClick={() => {
                                addToCart(item.product_id);
                                toggleWishlist(item.product_id);
                                setCartOpen(true);
                              }}
                              style={{
                                flex: 1,
                                padding: "6px 12px",
                                borderRadius: 6,
                                border: "none",
                                background: "var(--accent)",
                                color: "white",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              🛒 {lang === "zh-TW" ? "移至購物車" : "Move to Bag"}
                            </button>
                            <button
                              onClick={() => toggleWishlist(item.product_id)}
                              title={lang === "zh-TW" ? "移除" : "Remove"}
                              style={{
                                padding: "6px 10px",
                                borderRadius: 6,
                                border: "1px solid var(--border-color)",
                                background: "var(--bg-secondary)",
                                color: "var(--text-secondary)",
                                fontSize: 12,
                                cursor: "pointer",
                              }}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
