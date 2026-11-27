import { useCart } from "../../contexts/CartContext";
import { useLanguage } from "../../contexts/LanguageContext";

export default function CartDrawer({ onCheckout }: { onCheckout: () => void }) {
  const {
    cartOpen,
    setCartOpen,
    cartItems,
    cartTotal,
    totalCartCount,
    updateCartQty,
    couponCodeInput,
    setCouponCodeInput,
    appliedCoupon,
    setAppliedCoupon,
    couponLoading,
    couponError,
    applyCoupon,
  } = useCart();
  const { lang, t, localize } = useLanguage();

  if (!cartOpen) return null;

  return (
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
          <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>
            ✕
          </button>
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
                  <button
                    onClick={() => updateCartQty(book.id, -1)}
                    style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}
                  >
                    -
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{quantity}</span>
                  <button
                    onClick={() => updateCartQty(book.id, 1)}
                    style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}
                  >
                    +
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {cartItems.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
            <div style={{ marginBottom: 12 }}>
              {appliedCoupon ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#ecfdf5", border: "1px solid #a7f3d0", padding: "8px 12px", borderRadius: 8, fontSize: 12, color: "#065f46" }}>
                  <div>
                    <span style={{ fontWeight: 800 }}>🏷️ {appliedCoupon.code}</span>
                    <span style={{ marginLeft: 6 }}>(-${appliedCoupon.discount_amount.toFixed(2)})</span>
                  </div>
                  <button
                    onClick={() => setAppliedCoupon(null)}
                    style={{ background: "none", border: "none", color: "#065f46", cursor: "pointer", fontWeight: 800, fontSize: 14 }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <form onSubmit={applyCoupon} style={{ display: "flex", gap: 6 }}>
                  <input
                    type="text"
                    placeholder={lang === "zh-TW" ? "優惠碼 (如: WELCOME10)" : "Promo code (e.g. WELCOME10)"}
                    value={couponCodeInput}
                    onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "1px solid var(--border-color)",
                      background: "var(--bg-card)",
                      color: "var(--text-primary)",
                      fontSize: 12,
                    }}
                  />
                  <button
                    type="submit"
                    disabled={couponLoading || !couponCodeInput.trim()}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      border: "none",
                      background: "var(--accent)",
                      color: "white",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {couponLoading ? "..." : lang === "zh-TW" ? "套用" : "Apply"}
                  </button>
                </form>
              )}
              {couponError && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 4 }}>{couponError}</div>}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: appliedCoupon ? 4 : 16, fontSize: 18, fontWeight: 800 }}>
              <span>{t("cart_total")}:</span>
              <span style={{ color: "var(--accent)" }}>
                ${Math.max(0, cartTotal - (appliedCoupon?.discount_amount || 0)).toFixed(2)}
              </span>
            </div>
            {appliedCoupon && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14, fontSize: 12, color: "#059669" }}>
                <span>{lang === "zh-TW" ? "原價 / 折扣" : "Subtotal / Discount"}:</span>
                <span>${cartTotal.toFixed(2)} - ${appliedCoupon.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <button
              onClick={onCheckout}
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
  );
}
