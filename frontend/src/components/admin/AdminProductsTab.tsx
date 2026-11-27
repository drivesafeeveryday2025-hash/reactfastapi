import { useState } from "react";
import { useLanguage } from "../../contexts/LanguageContext";

interface AdminProductsTabProps {
  products: any[];
  loadingProducts: boolean;
  onGoToImport: () => void;
}

export default function AdminProductsTab({ products, loadingProducts, onGoToImport }: AdminProductsTabProps) {
  const { lang } = useLanguage();
  const [searchTerm, setSearchTerm] = useState("");

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
            onClick={onGoToImport}
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
  );
}
