import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useLanguage } from "../../contexts/LanguageContext";
import type { Product } from "../../types";

interface BookCardProps {
  book: Product;
  showRecommendedBadge?: boolean;
  onSelectBook: (book: Product) => void;
}

export default function BookCard({ book, showRecommendedBadge, onSelectBook }: BookCardProps) {
  const { trackActivity } = useAuth();
  const { addToCart, wishlistIds, toggleWishlist } = useCart();
  const { lang, t, localize } = useLanguage();

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 16,
        overflow: "hidden",
        border: "1px solid var(--border-color)",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ position: "relative" }}>
        <img src={book.image_url} alt={localize(book, "title")} style={{ width: "100%", height: 210, objectFit: "cover" }} />
        {showRecommendedBadge && (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              background: "var(--accent)",
              color: "white",
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {t("recom_badge")}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(book.id);
          }}
          title={
            wishlistIds.has(book.id)
              ? lang === "zh-TW"
                ? "從願望清單移除"
                : "Remove from wishlist"
              : lang === "zh-TW"
              ? "加入願望清單"
              : "Add to wishlist"
          }
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(255, 255, 255, 0.9)",
            border: "none",
            borderRadius: "50%",
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
            fontSize: 16,
            zIndex: 2,
          }}
        >
          {wishlistIds.has(book.id) ? "❤️" : "🤍"}
        </button>
      </div>

      <div style={{ padding: 18, display: "flex", flexDirection: "column", flex: 1 }}>
        <h3 style={{ margin: "0 0 4px 0", fontSize: 17, fontWeight: 700, color: "var(--text-primary)" }}>
          {localize(book, "title")}
        </h3>
        <p style={{ fontSize: 13, color: "var(--accent)", margin: "0 0 10px 0", fontWeight: 600 }}>
          {t("by_author")} {localize(book, "author")}
        </p>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px 0", flex: 1, lineHeight: 1.5 }}>
          {localize(book, "short_desc")}
        </p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
          <span style={{ fontSize: showRecommendedBadge ? 20 : 19, fontWeight: 800, color: "var(--text-primary)" }}>
            ${book.price.toFixed(2)}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                onSelectBook(book);
                trackActivity("VIEW_BOOK_DETAIL", "BOOK", book.id, book.title_en);
              }}
              style={{
                padding: "7px 12px",
                background: "var(--bg-subtle)",
                color: "var(--text-primary)",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {t("btn_details")}
            </button>
            <button
              onClick={() => addToCart(book.id)}
              style={{
                padding: "7px 14px",
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {t("btn_add_cart")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
