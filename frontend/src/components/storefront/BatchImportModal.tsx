import { useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";

interface BatchImportModalProps {
  open: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export default function BatchImportModal({ open, onClose, onImportComplete }: BatchImportModalProps) {
  const { token, isManager, trackActivity } = useAuth();
  const { lang } = useLanguage();

  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelResult, setExcelResult] = useState<any>(null);
  const [excelError, setExcelError] = useState("");

  if (!open || !isManager) return null;

  async function handleDownloadTemplate(type: "excel" | "word") {
    const endpoint = type === "excel" ? "/api/products/excel-template" : "/api/products/word-template";
    const filename = type === "excel" ? "apex_books_template.xlsx" : "apex_books_template.docx";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "Only authorized administrator can access this function.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error downloading template: " + (err.message || "Network error"));
    }
  }

  async function handleExcelImport(e: FormEvent) {
    e.preventDefault();
    if (!excelFile) {
      setExcelError(lang === "zh-TW" ? "請先選擇欲匯入的檔案 (.xlsx, .xls 或 .docx)" : "Please select an Excel (.xlsx/.xls) or Word (.docx) file first");
      return;
    }
    const isWord = excelFile.name.toLowerCase().endsWith(".docx");
    const isExcel = excelFile.name.toLowerCase().endsWith(".xlsx") || excelFile.name.toLowerCase().endsWith(".xls");

    if (!isWord && !isExcel) {
      setExcelError(lang === "zh-TW" ? "不支援的檔案格式，請上傳 .xlsx, .xls 或 .docx 檔案" : "Unsupported file format. Please upload .xlsx, .xls or .docx");
      return;
    }

    setExcelLoading(true);
    setExcelError("");
    setExcelResult(null);

    const formData = new FormData();
    formData.append("file", excelFile);
    const endpoint = isWord ? `${API_URL}/api/products/import-word` : `${API_URL}/api/products/import-excel`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setExcelError(data.detail || "Import failed");
      } else {
        setExcelResult(data);
        onImportComplete();
        trackActivity(isWord ? "WORD_IMPORT" : "EXCEL_IMPORT", "PRODUCT", undefined, `Imported ${data.inserted} books, updated ${data.updated} from ${excelFile.name}`);
      }
    } catch (err: any) {
      setExcelError(err.message || "Network error during upload");
    } finally {
      setExcelLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "var(--bg-modal)", color: "var(--text-primary)", width: "100%", maxWidth: 820, maxHeight: "90vh", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-modal)" }}>
        <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>📥</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                {lang === "zh-TW" ? "書籍批次匯入 (Excel / Word)" : "Bulk Book Import (Excel / Word)"}
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-secondary)" }}>
                {lang === "zh-TW" ? "透過 Excel 表格或 Word 文件批次新增或更新書店商品庫存" : "Batch import or update bookstore inventory via Excel (.xlsx) or Word (.docx)"}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 22, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ padding: 16, borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                  Step 1: {lang === "zh-TW" ? "下載標準匯入範本 (Excel 或 Word)" : "Download Standard Templates"}
                </div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                  {lang === "zh-TW" ? "包含完整中英文欄位規範、示範書籍資料與匯入指南。" : "Includes column specifications, sample books, and guidelines."}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("excel")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "var(--accent)",
                    color: "white",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <span>📊</span> {lang === "zh-TW" ? "Excel 範本 (.xlsx)" : "Excel (.xlsx)"}
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadTemplate("word")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    padding: "8px 14px",
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  <span>📄</span> {lang === "zh-TW" ? "Word 範本 (.docx)" : "Word (.docx)"}
                </button>
              </div>
            </div>
          </div>

          <form onSubmit={handleExcelImport} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              Step 2: {lang === "zh-TW" ? "選擇填寫後的檔案 (.xlsx, .xls 或 .docx) 並上傳" : "Upload Filled Excel or Word File"}
            </div>

            <div
              style={{
                border: "2px dashed var(--border-color)",
                borderRadius: 12,
                padding: "24px 16px",
                textAlign: "center",
                background: "var(--bg-card)",
                cursor: "pointer",
              }}
              onClick={() => document.getElementById("excel-file-input")?.click()}
            >
              <input
                id="excel-file-input"
                type="file"
                accept=".xlsx,.xls,.docx"
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setExcelFile(e.target.files[0]);
                    setExcelError("");
                    setExcelResult(null);
                  }
                }}
              />
              <div style={{ fontSize: 32, marginBottom: 8 }}>
                {excelFile ? (excelFile.name.toLowerCase().endsWith(".docx") ? "📄" : "📊") : "📥"}
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>
                {excelFile ? excelFile.name : lang === "zh-TW" ? "點擊此處選擇 .xlsx, .xls 或 .docx 檔案" : "Click to select .xlsx, .xls or .docx file"}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {excelFile ? `${(excelFile.size / 1024).toFixed(1)} KB` : lang === "zh-TW" ? "支援 Microsoft Excel (.xlsx/.xls) 與 Microsoft Word (.docx) 格式" : "Supports Microsoft Excel (.xlsx/.xls) and Microsoft Word (.docx) formats"}
              </div>
            </div>

            {excelError && (
              <div style={{ padding: 12, borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600 }}>
                ⚠️ {excelError}
              </div>
            )}

            <button
              type="submit"
              disabled={!excelFile || excelLoading}
              style={{
                padding: "12px 20px",
                background: !excelFile || excelLoading ? "var(--border-color)" : "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                cursor: !excelFile || excelLoading ? "not-allowed" : "pointer",
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {excelLoading ? (
                <>⏳ {lang === "zh-TW" ? "正在解析檔案並寫入 PostgreSQL 資料庫..." : "Parsing & importing to PostgreSQL..."}</>
              ) : (
                <>🚀 {lang === "zh-TW" ? "開始執行批次匯入" : "Start Bulk Import"}</>
              )}
            </button>
          </form>

          {excelResult && (
            <div style={{ padding: 16, borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 20 }}>{excelResult.success ? "✅" : "⚠️"}</span>
                <strong style={{ fontSize: 16 }}>
                  {excelResult.success ? (lang === "zh-TW" ? "匯入作業完成！" : "Import Completed Successfully!") : (lang === "zh-TW" ? "匯入作業結束 (部分資料有誤)" : "Import finished with notices")}
                </strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 16, textAlign: "center" }}>
                <div style={{ padding: 10, borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "處理總筆數" : "Total Rows"}</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{excelResult.total_rows}</div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
                  <div style={{ fontSize: 11 }}>{lang === "zh-TW" ? "全新新增" : "Inserted"}</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{excelResult.inserted}</div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" }}>
                  <div style={{ fontSize: 11 }}>{lang === "zh-TW" ? "比對更新" : "Updated"}</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{excelResult.updated}</div>
                </div>
                <div style={{ padding: 10, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
                  <div style={{ fontSize: 11 }}>{lang === "zh-TW" ? "失敗跳過" : "Failed"}</div>
                  <div style={{ fontSize: 20, fontWeight: 800 }}>{excelResult.failed}</div>
                </div>
              </div>

              {excelResult.imported_books && excelResult.imported_books.length > 0 && (
                <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: 8, background: "var(--bg-card)", padding: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 6 }}>
                    {lang === "zh-TW" ? "已寫入資料庫書籍清單：" : "Database Records Processed:"}
                  </div>
                  {excelResult.imported_books.map((b: any) => (
                    <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 6px", borderBottom: "1px solid var(--border-color)" }}>
                      <span>
                        <strong style={{ color: b.action === "INSERTED" ? "#059669" : "#2563eb", marginRight: 6 }}>[{b.action}]</strong>
                        #{b.id} {lang === "zh-TW" ? b.title_zh : b.title_en}
                      </span>
                      <span style={{ fontWeight: 700 }}>${Number(b.price).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {excelResult.errors && excelResult.errors.length > 0 && (
                <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#fef2f2", color: "#991b1b", fontSize: 12 }}>
                  <strong>{lang === "zh-TW" ? "異常列錯誤原因：" : "Row Error Details:"}</strong>
                  {excelResult.errors.map((err: any, idx: number) => (
                    <div key={idx} style={{ marginTop: 4 }}>• Row #{err.row}: {err.reason}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
