import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";
import type { Product, Review, ReviewSummary } from "../../types";

interface BookDetailModalProps {
  book: Product | null;
  onClose: () => void;
}

export default function BookDetailModal({ book, onClose }: BookDetailModalProps) {
  const { token } = useAuth();
  const { addToCart, wishlistIds, toggleWishlist } = useCart();
  const { lang, t, localize } = useLanguage();

  const [bookReviews, setBookReviews] = useState<Review[]>([]);
  const [reviewSummary, setReviewSummary] = useState<ReviewSummary | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewTitle, setNewReviewTitle] = useState("");
  const [newReviewComment, setNewReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSuccessMsg, setReviewSuccessMsg] = useState<string | null>(null);

  async function loadBookReviews(productId: number) {
    setLoadingReviews(true);
    try {
      const res = await fetch(`${API_URL}/api/products/${productId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setBookReviews(data.reviews || []);
        setReviewSummary({
          average_rating: data.average_rating ?? 5.0,
          total_reviews: data.total_reviews ?? 0,
          rating_distribution: data.rating_distribution ?? {},
        });
      }
    } catch (err) {
      console.error("Failed to load reviews", err);
    } finally {
      setLoadingReviews(false);
    }
  }

  useEffect(() => {
    if (book) {
      loadBookReviews(book.id);
      setReviewSuccessMsg(null);
      setNewReviewTitle("");
      setNewReviewComment("");
      setNewRating(5);
    }
  }, [book]);

  async function handleSubmitReview(e: FormEvent) {
    e.preventDefault();
    if (!book) return;
    if (!token) {
      alert(lang === "zh-TW" ? "請先登入以發表書評。" : "Please log in to submit a review.");
      return;
    }
    setSubmittingReview(true);
    try {
      const res = await fetch(`${API_URL}/api/products/${book.id}/reviews`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating: newRating,
          title: newReviewTitle.trim() || undefined,
          comment: newReviewComment.trim() || "Great read!",
        }),
      });
      if (res.ok) {
        setReviewSuccessMsg(
          lang === "zh-TW"
            ? "感謝您的寶貴評價！書評已發佈成功。"
            : "Thank you for your rating! Review submitted successfully."
        );
        setNewReviewTitle("");
        setNewReviewComment("");
        loadBookReviews(book.id);
      } else {
        const err = await res.json();
        alert(err.detail || (lang === "zh-TW" ? "送出評價失敗" : "Failed to submit review"));
      }
    } catch {
      alert(lang === "zh-TW" ? "網路連線異常，請稍後重試" : "Network error, please try again.");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (!book) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.65)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 110,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--bg-modal)",
          color: "var(--text-primary)",
          padding: 28,
          borderRadius: 20,
          maxWidth: 640,
          width: "100%",
          position: "relative",
          boxShadow: "var(--shadow-modal)",
          border: "1px solid var(--border-color)",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "var(--bg-subtle)",
            color: "var(--text-primary)",
            border: "none",
            borderRadius: "50%",
            width: 32,
            height: 32,
            cursor: "pointer",
            fontSize: 16,
            fontWeight: "bold",
          }}
        >
          ✕
        </button>

        <img
          src={book.image_url}
          alt={localize(book, "title")}
          style={{ width: "100%", height: 230, objectFit: "cover", borderRadius: 12, marginBottom: 18 }}
        />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
          <h2 style={{ margin: 0, fontSize: 22 }}>{localize(book, "title")}</h2>
          <span style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>
            ${book.price.toFixed(2)}
          </span>
        </div>
        <p style={{ fontSize: 14, color: "var(--accent)", margin: "0 0 8px 0", fontWeight: 600 }}>
          {t("by_author")} {localize(book, "author")}
        </p>

        {reviewSummary && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 0 16px 0" }}>
            <span style={{ color: "#f59e0b", fontSize: 16 }}>
              {"★".repeat(Math.round(reviewSummary.average_rating || 5)) + "☆".repeat(5 - Math.round(reviewSummary.average_rating || 5))}
            </span>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{(reviewSummary.average_rating || 5.0).toFixed(1)}</span>
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              ({reviewSummary.total_reviews} {lang === "zh-TW" ? "則評價" : "verified reviews"})
            </span>
          </div>
        )}

        <h4 style={{ margin: "0 0 6px 0", fontSize: 14, color: "var(--text-secondary)" }}>{t("modal_synopsis")}</h4>
        <p style={{ color: "var(--text-primary)", lineHeight: 1.6, fontSize: 14, marginBottom: 18 }}>
          {localize(book.detail, "full_synopsis") || localize(book, "short_desc")}
        </p>

        <div
          style={{
            background: "var(--bg-secondary)",
            padding: 14,
            borderRadius: 12,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
            fontSize: 13,
            marginBottom: 20,
            border: "1px solid var(--border-color)",
          }}
        >
          <div>🏛️ <strong>{t("modal_publisher")}:</strong> {localize(book.detail, "publisher")}</div>
          <div>📅 <strong>{t("modal_year")}:</strong> {book.detail?.publication_year}</div>
          <div>📖 <strong>{t("modal_pages")}:</strong> {book.detail?.page_count}</div>
          <div>📦 <strong>{t("modal_format")}:</strong> {localize(book.detail, "format")}</div>
          <div style={{ gridColumn: "1 / -1" }}>🔢 <strong>{t("modal_isbn")}:</strong> {book.detail?.isbn}</div>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
          <button
            onClick={() => {
              addToCart(book.id);
              onClose();
            }}
            style={{
              flex: 1,
              padding: 14,
              background: "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            {t("modal_add_btn")} • ${book.price.toFixed(2)}
          </button>
          <button
            onClick={() => toggleWishlist(book.id)}
            title={wishlistIds.has(book.id) ? (lang === "zh-TW" ? "已在願望清單" : "In Wishlist") : (lang === "zh-TW" ? "加入願望清單" : "Add to Wishlist")}
            style={{
              padding: "14px 18px",
              borderRadius: 10,
              border: "1px solid var(--border-color)",
              background: wishlistIds.has(book.id) ? "rgba(239, 68, 68, 0.08)" : "var(--bg-secondary)",
              color: wishlistIds.has(book.id) ? "#ef4444" : "var(--text-primary)",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>{wishlistIds.has(book.id) ? "❤️" : "🤍"}</span>
            <span>{wishlistIds.has(book.id) ? (lang === "zh-TW" ? "已收藏" : "Saved") : (lang === "zh-TW" ? "收藏" : "Wishlist")}</span>
          </button>
        </div>

        {/* Reviews & Ratings Section */}
        <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              ⭐ {lang === "zh-TW" ? "讀者評價與星級打分" : "Customer Reviews & Ratings"}
            </h3>
            {reviewSummary && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--bg-secondary)", padding: "4px 10px", borderRadius: 12, border: "1px solid var(--border-color)" }}>
                <span style={{ color: "#f59e0b", fontSize: 14 }}>★</span>
                <span style={{ fontWeight: 800, fontSize: 13 }}>{reviewSummary.average_rating.toFixed(1)} / 5.0</span>
                <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>({reviewSummary.total_reviews})</span>
              </div>
            )}
          </div>

          <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, border: "1px solid var(--border-color)", marginBottom: 18 }}>
            <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 700 }}>
              ✍️ {lang === "zh-TW" ? "撰寫您的書評心得" : "Write a Review for this Book"}
            </h4>
            {reviewSuccessMsg && (
              <div style={{ background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46", padding: "8px 12px", borderRadius: 8, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
                {reviewSuccessMsg}
              </div>
            )}
            {token ? (
              <form onSubmit={handleSubmitReview} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
                    {lang === "zh-TW" ? "評分：" : "Your Rating:"}
                  </span>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setNewRating(star)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: 20,
                          color: star <= newRating ? "#f59e0b" : "var(--text-secondary)",
                          padding: 0,
                          lineHeight: 1,
                        }}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#f59e0b" }}>
                    {newRating} / 5
                  </span>
                </div>
                <input
                  type="text"
                  placeholder={lang === "zh-TW" ? "評價主旨 (例如: 深入淺出的經典好書！)" : "Review Headline (e.g. Must-read masterpiece!)"}
                  value={newReviewTitle}
                  onChange={(e) => setNewReviewTitle(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                  }}
                />
                <textarea
                  placeholder={lang === "zh-TW" ? "分享您對這本書的具體心得、收穫或閱讀體驗..." : "Share your thoughts, key takeaways, and reading experience..."}
                  value={newReviewComment}
                  onChange={(e) => setNewReviewComment(e.target.value)}
                  rows={3}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    color: "var(--text-primary)",
                    fontSize: 13,
                    resize: "vertical",
                  }}
                />
                <button
                  type="submit"
                  disabled={submittingReview}
                  style={{
                    alignSelf: "flex-end",
                    padding: "8px 18px",
                    borderRadius: 8,
                    border: "none",
                    background: "var(--accent)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: submittingReview ? "not-allowed" : "pointer",
                    opacity: submittingReview ? 0.7 : 1,
                  }}
                >
                  {submittingReview ? (lang === "zh-TW" ? "送出中..." : "Submitting...") : (lang === "zh-TW" ? "發佈書評" : "Post Review")}
                </button>
              </form>
            ) : (
              <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                {lang === "zh-TW" ? "登入會員後即可針對此書籍發表您的星級評分與閱讀心得。" : "Please log in to submit your star rating and review for this book."}
              </div>
            )}
          </div>

          {loadingReviews ? (
            <div style={{ textAlign: "center", padding: 20, color: "var(--text-secondary)", fontSize: 13 }}>
              ⏳ {lang === "zh-TW" ? "載入評論中..." : "Loading reviews..."}
            </div>
          ) : bookReviews.length === 0 ? (
            <div style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)", fontSize: 13 }}>
              💬 {lang === "zh-TW" ? "目前尚無評論，歡迎成為第一位分享心得的讀者！" : "No reviews yet. Be the first to share your thoughts!"}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {bookReviews.map((rev) => (
                <div
                  key={rev.id}
                  style={{
                    padding: 14,
                    borderRadius: 10,
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#f59e0b", fontSize: 14 }}>
                        {"★".repeat(rev.rating) + "☆".repeat(5 - rev.rating)}
                      </span>
                      {rev.title && <span style={{ fontWeight: 800, fontSize: 13 }}>{rev.title}</span>}
                      {rev.is_verified_purchase && (
                        <span
                          style={{
                            background: "#ecfdf5",
                            color: "#059669",
                            border: "1px solid #a7f3d0",
                            padding: "1px 6px",
                            borderRadius: 8,
                            fontSize: 10,
                            fontWeight: 800,
                          }}
                        >
                          ✓ {lang === "zh-TW" ? "已驗證購買者" : "Verified Purchase"}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                      {rev.user_name || (rev.user_email ? rev.user_email.split("@")[0] : "Verified Reader")} •{" "}
                      {rev.created_at ? new Date(rev.created_at).toLocaleDateString() : ""}
                    </span>
                  </div>
                  {rev.comment && (
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", lineHeight: 1.5 }}>
                      {rev.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
