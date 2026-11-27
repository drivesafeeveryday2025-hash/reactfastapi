import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";
import type { BarcodeScannerLookupResult } from "../../types";

interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
}

export default function BarcodeScannerModal({ open, onClose }: BarcodeScannerModalProps) {
  const { token } = useAuth();
  const { lang } = useLanguage();

  const [scannerInputCode, setScannerInputCode] = useState("");
  const [scannerResult, setScannerResult] = useState<BarcodeScannerLookupResult | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);

  if (!open) return null;

  async function handleScannerLookup(codeToScan?: string) {
    const code = (codeToScan !== undefined ? codeToScan : scannerInputCode).trim();
    if (!code) return;
    setScannerLoading(true);
    setScannerError(null);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/scanner/lookup?code=${encodeURIComponent(code)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data: BarcodeScannerLookupResult = await res.json();
        setScannerResult(data);
      } else {
        const err = await res.json();
        setScannerError(err.detail || "Barcode lookup failed");
      }
    } catch {
      setScannerError("Network error during barcode scan lookup");
    } finally {
      setScannerLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-modal)", color: "var(--text-primary)", width: "100%", maxWidth: 740, maxHeight: "90vh", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-modal)" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>📷</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {lang === "zh-TW" ? "條碼掃描與儲位速查 (Barcode & Bin Scanner)" : "Barcode Scanner & Shelf Bin Lookup"}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
                {lang === "zh-TW" ? "支援手持式條碼機、Code128 儲位標籤與書籍 ISBN 條碼速查" : "Scan or enter any Location Code (e.g. WH-CENTRAL-A01-S01-B01) or Book ISBN / SKU"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleScannerLookup();
            }}
            style={{ marginBottom: 20 }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                autoFocus
                placeholder={lang === "zh-TW" ? "掃描或輸入儲位碼 (WH-CENTRAL-A01-S01-B01) 或書籍 ISBN / ID..." : "Scan or enter Bin Code or Book ISBN / SKU..."}
                value={scannerInputCode}
                onChange={(e) => setScannerInputCode(e.target.value)}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  borderRadius: 10,
                  border: "2px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                  fontSize: 15,
                  fontWeight: 600,
                }}
              />
              <button
                type="submit"
                disabled={scannerLoading || !scannerInputCode.trim()}
                style={{
                  padding: "12px 24px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--accent)",
                  color: "white",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {scannerLoading ? "..." : lang === "zh-TW" ? "查詢" : "Scan / Lookup"}
              </button>
            </div>

            <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <span>💡 {lang === "zh-TW" ? "快速測試範例：" : "Sample Barcodes: "}</span>
              <button
                type="button"
                onClick={() => {
                  setScannerInputCode("WH-CENTRAL-A01-S01-B01");
                  handleScannerLookup("WH-CENTRAL-A01-S01-B01");
                }}
                style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontSize: 11 }}
              >
                📍 Bin A01-S01-B01
              </button>
              <button
                type="button"
                onClick={() => {
                  setScannerInputCode("WH-CENTRAL-B01-S01-B01");
                  handleScannerLookup("WH-CENTRAL-B01-S01-B01");
                }}
                style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontSize: 11 }}
              >
                📍 Bin B01-S01-B01
              </button>
              <button
                type="button"
                onClick={() => {
                  setScannerInputCode("9780132350884");
                  handleScannerLookup("9780132350884");
                }}
                style={{ padding: "3px 8px", borderRadius: 4, border: "1px solid var(--border-color)", background: "var(--bg-secondary)", color: "var(--text-primary)", cursor: "pointer", fontSize: 11 }}
              >
                📚 ISBN: Clean Code
              </button>
            </div>
          </form>

          {scannerError && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", padding: 14, borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
              ⚠️ {scannerError}
            </div>
          )}

          {scannerResult && (
            <div>
              {scannerResult.entity_type === "LOCATION" && scannerResult.location_details && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                        <span style={{ background: "#ecfdf5", color: "#065f46", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                          📍 {lang === "zh-TW" ? "儲位識別成功" : "Storage Bin Identified"}
                        </span>
                        <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 900 }}>
                          {scannerResult.location_details.location_code}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        🏢 {scannerResult.location_details.warehouse_name_en || scannerResult.location_details.warehouse} • {scannerResult.location_details.zone_name_en || scannerResult.location_details.zone}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                        🏷️ {lang === "zh-TW" ? "分類存放建議：" : "Category Hint: "} <b>{scannerResult.location_details.category_hint}</b>
                      </div>
                    </div>
                    <button
                      onClick={() => window.open(`${API_URL}/api/warehouse/locations/${scannerResult.location_details!.id}/bin-label-html`, "_blank")}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        border: "1px solid var(--accent)",
                        background: "var(--accent-light)",
                        color: "var(--accent)",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      🏷️ {lang === "zh-TW" ? "列印 4x2.5 吋標籤" : "Print Shelf Bin Label"}
                    </button>
                  </div>

                  <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 800 }}>
                    📚 {lang === "zh-TW" ? "此儲位存放之在庫書籍清單" : "Books Stored in this Bin"} ({scannerResult.location_details.stored_books.length})
                  </h4>
                  {scannerResult.location_details.stored_books.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)", fontSize: 13, background: "var(--bg-secondary)", borderRadius: 10 }}>
                      {lang === "zh-TW" ? "此儲位目前為空儲位，尚未存放任何書籍。" : "This bin is currently empty with 0 books stored."}
                    </div>
                  ) : (
                    <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-color)", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                            <th style={{ padding: "8px 12px" }}>{lang === "zh-TW" ? "書名" : "Title"}</th>
                            <th style={{ padding: "8px 12px" }}>ISBN</th>
                            <th style={{ padding: "8px 12px" }}>{lang === "zh-TW" ? "品相" : "Condition"}</th>
                            <th style={{ padding: "8px 12px", textAlign: "right" }}>{lang === "zh-TW" ? "在庫數量" : "Qty"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {scannerResult.location_details.stored_books.map((b: any, idx: number) => (
                            <tr key={b.product_id || b.id || idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                              <td style={{ padding: "8px 12px", fontWeight: 700 }}>{lang === "zh-TW" ? b.title_zh || b.title_en : b.title_en}</td>
                              <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 11 }}>{b.isbn || "N/A"}</td>
                              <td style={{ padding: "8px 12px" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: b.condition === "brand_new" ? "#ecfdf5" : "#fef3c7", color: b.condition === "brand_new" ? "#065f46" : "#92400e" }}>
                                  {b.condition === "brand_new" ? "Brand New" : b.condition}
                                </span>
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>{b.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {scannerResult.entity_type === "PRODUCT" && scannerResult.product_details && (
                <div>
                  <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ background: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
                        📚 {lang === "zh-TW" ? "書籍品目識別成功" : "Book SKU Identified"}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 800 }}>
                        {lang === "zh-TW" ? scannerResult.product_details.title_zh || scannerResult.product_details.title_en : scannerResult.product_details.title_en}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                      ✍️ {scannerResult.product_details.author || scannerResult.product_details.author_en} • 💲${Number(scannerResult.product_details.price).toFixed(2)} • 🔢 ISBN: {scannerResult.product_details.isbn || "N/A"}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, marginTop: 6, color: "var(--accent)" }}>
                      📦 {lang === "zh-TW" ? `實體庫存總數：${scannerResult.product_details.total_on_hand} 本` : `Total On-Hand: ${scannerResult.product_details.total_on_hand} units`}
                    </div>
                  </div>

                  <h4 style={{ margin: "0 0 10px 0", fontSize: 14, fontWeight: 800 }}>
                    📍 {lang === "zh-TW" ? "在庫儲位分佈座標 (Bin Coordinates)" : "Shelf Bin Storage Locations"}
                  </h4>
                  {(scannerResult.product_details.bin_locations || scannerResult.product_details.stock_locations || []).length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)", fontSize: 13, background: "var(--bg-secondary)", borderRadius: 10 }}>
                      {lang === "zh-TW" ? "目前各儲位中皆無此商品之在庫存量。" : "No stock currently allocated to storage bins."}
                    </div>
                  ) : (
                    <div style={{ background: "var(--bg-card)", borderRadius: 10, border: "1px solid var(--border-color)", overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                            <th style={{ padding: "8px 12px" }}>{lang === "zh-TW" ? "儲位代碼" : "Location Code"}</th>
                            <th style={{ padding: "8px 12px" }}>{lang === "zh-TW" ? "分區" : "Zone"}</th>
                            <th style={{ padding: "8px 12px" }}>{lang === "zh-TW" ? "品相狀況" : "Condition"}</th>
                            <th style={{ padding: "8px 12px", textAlign: "right" }}>{lang === "zh-TW" ? "該儲位數量" : "Qty in Bin"}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(scannerResult.product_details.bin_locations || scannerResult.product_details.stock_locations || []).map((loc: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: "1px solid var(--border-color)" }}>
                              <td style={{ padding: "8px 12px", fontFamily: "monospace", fontWeight: 700 }}>{loc.location_code}</td>
                              <td style={{ padding: "8px 12px" }}>{loc.zone}</td>
                              <td style={{ padding: "8px 12px" }}>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4, background: loc.condition === "brand_new" ? "#ecfdf5" : "#fef3c7", color: loc.condition === "brand_new" ? "#065f46" : "#92400e" }}>
                                  {loc.condition === "brand_new" ? "Brand New" : loc.condition}
                                </span>
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 800 }}>{loc.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {scannerResult.entity_type === "UNKNOWN" && (
                <div style={{ background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", padding: 18, borderRadius: 10, fontSize: 13, textAlign: "center" }}>
                  🔍 {lang === "zh-TW" ? `未找到符合 "${scannerResult.scanned_code}" 之儲位代碼或書籍 ISBN / 商品 ID。` : `No matching location code or book ISBN / SKU found for "${scannerResult.scanned_code}".`}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
