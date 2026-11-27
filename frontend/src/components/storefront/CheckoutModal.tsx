import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";
import type { Order } from "../../types";

interface CheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onOrderSuccess: (order: Order) => void;
}

export default function CheckoutModal({ open, onClose, onOrderSuccess }: CheckoutModalProps) {
  const { token, user, trackActivity } = useAuth();
  const {
    cartItems,
    cartTotal,
    clearCart,
    couponCodeInput,
    setCouponCodeInput,
    appliedCoupon,
    setAppliedCoupon,
    couponLoading,
    couponError,
    applyCoupon,
  } = useCart();
  const { lang, localize } = useLanguage();

  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "express" | "pickup">("standard");
  const [paymentMethod, setPaymentMethod] = useState<"credit_card" | "apple_pay" | "cod" | "bank_transfer">("credit_card");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);

  useEffect(() => {
    if (open && user) {
      if (!recipientName) setRecipientName(user.full_name || user.email.split("@")[0]);
      if (!recipientPhone) setRecipientPhone(user.phone || "");
      if (!shippingAddress) setShippingAddress(user.address || "");
    }
  }, [open, user]);

  if (!open) return null;

  const shippingFee =
    deliveryMethod === "express"
      ? 12.0
      : deliveryMethod === "pickup"
      ? 0.0
      : cartTotal >= 35.0
      ? 0.0
      : 5.0;

  const couponDiscount = appliedCoupon ? appliedCoupon.discount_amount : 0.0;
  const orderGrandTotal = Math.max(0, cartTotal - couponDiscount + shippingFee);

  async function handleCheckoutSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token || cartItems.length === 0) return;
    setCheckoutSubmitting(true);
    try {
      const payload = {
        items: cartItems.map((ci) => ({ product_id: ci.book.id, quantity: ci.quantity })),
        delivery_method: deliveryMethod,
        payment_method: paymentMethod,
        recipient_name: recipientName,
        recipient_phone: recipientPhone,
        shipping_address: deliveryMethod === "pickup" ? "In-Store Pickup" : shippingAddress,
        delivery_notes: deliveryNotes,
        coupon_code: appliedCoupon ? appliedCoupon.code : undefined,
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
        const orderData: Order = await res.json();
        clearCart();
        onClose();
        trackActivity("PLACE_ORDER", "ORDER", orderData.id, `Placed order #${orderData.id}`);
        onOrderSuccess(orderData);
      } else {
        const err = await res.json();
        alert(err.detail || (lang === "zh-TW" ? "訂單送出失敗，請檢查資料後重試。" : "Failed to place order."));
      }
    } catch {
      alert(lang === "zh-TW" ? "訂單送出失敗，請重試。" : "Failed to place order.");
    } finally {
      setCheckoutSubmitting(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div
        style={{
          background: "var(--bg-modal)",
          color: "var(--text-primary)",
          width: "100%",
          maxWidth: 780,
          maxHeight: "90vh",
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid var(--border-color)",
          boxShadow: "var(--shadow-modal)",
        }}
      >
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🛍️</span>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              {lang === "zh-TW" ? "購物車結帳與出貨配送設定" : "Checkout & Shipping Options"}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <form onSubmit={handleCheckoutSubmit} style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
          <div>
            <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              1. {lang === "zh-TW" ? "訂購商品清單" : "Items in Your Order"} ({cartItems.length})
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 150, overflowY: "auto", background: "var(--bg-secondary)", padding: 10, borderRadius: 10, border: "1px solid var(--border-color)" }}>
              {cartItems.map(({ book, quantity }) => (
                <div key={book.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700 }}>{localize(book, "title")}</span>
                    <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>× {quantity}</span>
                  </div>
                  <span style={{ fontWeight: 800 }}>${(book.price * quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                2. {lang === "zh-TW" ? "選擇配送方式" : "Choose Delivery Method"}
              </h4>
              {cartTotal >= 35.0 && (
                <span style={{ fontSize: 12, color: "#059669", fontWeight: 700 }}>
                  🎉 {lang === "zh-TW" ? "滿 $35 享有標準宅配免運！" : "Eligible for FREE Standard Shipping (over $35)!"}
                </span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12 }}>
              <div
                onClick={() => setDeliveryMethod("standard")}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "2px solid",
                  borderColor: deliveryMethod === "standard" ? "var(--accent)" : "var(--border-color)",
                  background: deliveryMethod === "standard" ? "var(--accent-light)" : "var(--bg-card)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>🚚 {lang === "zh-TW" ? "標準宅配" : "Standard Courier"}</span>
                  <span style={{ fontWeight: 900, color: "var(--accent)" }}>
                    {cartTotal >= 35.0 ? (lang === "zh-TW" ? "免運費" : "FREE") : "$5.00"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {lang === "zh-TW" ? "預計 3-5 個工作天配送至指定地址" : "Delivered in 3-5 business days"}
                </div>
              </div>

              <div
                onClick={() => setDeliveryMethod("express")}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "2px solid",
                  borderColor: deliveryMethod === "express" ? "var(--accent)" : "var(--border-color)",
                  background: deliveryMethod === "express" ? "var(--accent-light)" : "var(--bg-card)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>⚡ {lang === "zh-TW" ? "隔日快捷" : "Express Delivery"}</span>
                  <span style={{ fontWeight: 900, color: "#7c3aed" }}>$12.00</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {lang === "zh-TW" ? "次日工作天優先送達" : "Next business day priority dispatch"}
                </div>
              </div>

              <div
                onClick={() => setDeliveryMethod("pickup")}
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: "2px solid",
                  borderColor: deliveryMethod === "pickup" ? "var(--accent)" : "var(--border-color)",
                  background: deliveryMethod === "pickup" ? "var(--accent-light)" : "var(--bg-card)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>🏬 {lang === "zh-TW" ? "門市自取" : "Store Pickup"}</span>
                  <span style={{ fontWeight: 900, color: "#059669" }}>{lang === "zh-TW" ? "免費" : "FREE"}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {lang === "zh-TW" ? "下單 2 小時後可於門市服務台取件" : "Ready in 2 hours at Downtown Store"}
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              3. {lang === "zh-TW" ? "收件人與配送資訊" : "Recipient & Shipping Address"}
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  {lang === "zh-TW" ? "收件人姓名 *" : "Full Name *"}
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. John Doe"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  {lang === "zh-TW" ? "聯絡電話 *" : "Phone Number *"}
                </label>
                <input
                  type="tel"
                  required
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  placeholder="e.g. +852 9876 5432"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {deliveryMethod !== "pickup" ? (
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                  {lang === "zh-TW" ? "詳細配送地址 *" : "Full Shipping Address *"}
                </label>
                <textarea
                  required
                  rows={2}
                  value={shippingAddress}
                  onChange={(e) => setShippingAddress(e.target.value)}
                  placeholder="e.g. Flat 4B, Tower 1, Apex Gardens, 88 Central Road, Hong Kong"
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box", fontFamily: "inherit" }}
                />
              </div>
            ) : (
              <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "10px 14px", borderRadius: 8, color: "#065f46", fontSize: 13, marginBottom: 12 }}>
                📍 <strong>{lang === "zh-TW" ? "門市自取地點：" : "Pickup Counter: "}</strong>
                {lang === "zh-TW" ? "Apex 旗艦書店 1 樓服務處 (香港中環皇后大道中 128 號)" : "Apex Book Haven Downtown - 128 Queen's Road Central, Hong Kong"}
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
                {lang === "zh-TW" ? "配送備註 (選填)" : "Delivery Notes / Special Instructions (Optional)"}
              </label>
              <input
                type="text"
                value={deliveryNotes}
                onChange={(e) => setDeliveryNotes(e.target.value)}
                placeholder={lang === "zh-TW" ? "例如：請放於管理處或抵達前來電..." : "e.g. Leave with building security or call upon arrival"}
                style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div>
            <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              4. {lang === "zh-TW" ? "選擇付款方式" : "Select Payment Method"}
            </h4>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
              {[
                { id: "credit_card", icon: "💳", name: lang === "zh-TW" ? "信用卡 / 簽帳卡" : "Credit / Debit Card" },
                { id: "apple_pay", icon: "📱", name: lang === "zh-TW" ? "Apple / Google Pay" : "Apple / Google Pay" },
                { id: "cod", icon: "💵", name: lang === "zh-TW" ? "貨到付款 (COD)" : "Cash on Delivery" },
                { id: "bank_transfer", icon: "🏦", name: lang === "zh-TW" ? "銀行轉帳 / FPS" : "Bank Transfer / FPS" },
              ].map((p) => (
                <div
                  key={p.id}
                  onClick={() => setPaymentMethod(p.id as any)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "2px solid",
                    borderColor: paymentMethod === p.id ? "var(--accent)" : "var(--border-color)",
                    background: paymentMethod === p.id ? "var(--accent-light)" : "var(--bg-card)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{p.icon}</span>
                  <span>{p.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 800, color: "var(--accent)", textTransform: "uppercase", letterSpacing: 0.5 }}>
              4.5. {lang === "zh-TW" ? "優惠代碼與折扣券 (PROMO CODE)" : "Promo Code & Discounts"}
            </h4>
            <div style={{ background: "var(--bg-secondary)", padding: 14, borderRadius: 12, border: "1px solid var(--border-color)" }}>
              {appliedCoupon ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ecfdf5", border: "1px solid #10b981", padding: "10px 14px", borderRadius: 8, color: "#065f46" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>
                      🎉 {appliedCoupon.code} <span style={{ fontSize: 12, fontWeight: 500 }}>({appliedCoupon.message})</span>
                    </div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      {lang === "zh-TW" ? `已成功折抵：-$${appliedCoupon.discount_amount.toFixed(2)}` : `Discount applied: -$${appliedCoupon.discount_amount.toFixed(2)}`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAppliedCoupon(null)}
                    style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid #059669", background: "white", color: "#059669", fontWeight: 700, cursor: "pointer", fontSize: 12 }}
                  >
                    {lang === "zh-TW" ? "取消優惠碼" : "Remove"}
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      placeholder={lang === "zh-TW" ? "輸入折扣券 (如: WELCOME10, APEX20)" : "Enter promo code (e.g. WELCOME10, APEX20)"}
                      value={couponCodeInput}
                      onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                      style={{
                        flex: 1,
                        padding: "10px 12px",
                        borderRadius: 8,
                        border: "1px solid var(--border-color)",
                        background: "var(--bg-card)",
                        color: "var(--text-primary)",
                        fontSize: 13,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => applyCoupon()}
                      disabled={couponLoading || !couponCodeInput.trim()}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: "none",
                        background: "var(--accent)",
                        color: "white",
                        fontWeight: 700,
                        cursor: "pointer",
                        fontSize: 13,
                      }}
                    >
                      {couponLoading ? "..." : lang === "zh-TW" ? "套用折扣" : "Apply Code"}
                    </button>
                  </div>
                  {couponError && (
                    <div style={{ color: "#ef4444", fontSize: 12, marginTop: 6, fontWeight: 600 }}>⚠️ {couponError}</div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)", display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span>💡 {lang === "zh-TW" ? "試用優惠碼: " : "Try codes: "}</span>
                    <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setCouponCodeInput("WELCOME10")}>WELCOME10 (10% off)</span>
                    <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setCouponCodeInput("APEX20")}>APEX20 (20% off)</span>
                    <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setCouponCodeInput("BOOKWORM15")}>BOOKWORM15 ($15 off)</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "商品小計" : "Items Subtotal"}:</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>
            {appliedCoupon && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13, color: "#059669" }}>
                <span>{lang === "zh-TW" ? "優惠折扣" : "Promo Discount"} ({appliedCoupon.code}):</span>
                <span style={{ fontWeight: 800 }}>-${appliedCoupon.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 13 }}>
              <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "運費" : "Shipping Fee"}:</span>
              <span>
                {shippingFee === 0 ? (
                  <strong style={{ color: "#059669" }}>{lang === "zh-TW" ? "免費" : "FREE"}</strong>
                ) : (
                  `$${shippingFee.toFixed(2)}`
                )}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: 10, fontSize: 18, fontWeight: 900 }}>
              <span>{lang === "zh-TW" ? "結帳應付總額" : "Total Amount"}:</span>
              <span style={{ color: "var(--accent)" }}>${orderGrandTotal.toFixed(2)}</span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "12px 20px",
                borderRadius: 8,
                border: "1px solid var(--border-color)",
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {lang === "zh-TW" ? "返回修改" : "Back"}
            </button>
            <button
              type="submit"
              disabled={checkoutSubmitting}
              style={{
                padding: "12px 28px",
                borderRadius: 8,
                border: "none",
                background: "var(--accent)",
                color: "white",
                fontWeight: 800,
                fontSize: 15,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 8,
                opacity: checkoutSubmitting ? 0.7 : 1,
              }}
            >
              {checkoutSubmitting ? (
                <span>⏳ {lang === "zh-TW" ? "處理訂單中..." : "Placing Order..."}</span>
              ) : (
                <span>💳 {lang === "zh-TW" ? `確認下單並結帳 ($${orderGrandTotal.toFixed(2)})` : `Place Order & Pay ($${orderGrandTotal.toFixed(2)})`}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
