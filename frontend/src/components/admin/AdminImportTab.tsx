import { useState, type FormEvent } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { API_URL } from "../../services/api";

interface AdminImportTabProps {
  onImportSuccess: () => void;
}

export default function AdminImportTab({ onImportSuccess }: AdminImportTabProps) {
  const { token } = useAuth();
  const { lang } = useLanguage();

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [importError, setImportError] = useState("");

  async function handleDownloadTemplate(type: "excel" | "word") {
    const endpoint = type === "excel" ? "/api/products/excel-template" : "/api/products/word-template";
    const filename = type === "excel" ? "apex_books_template.xlsx" : "apex_books_template.docx";
    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.detail || "Access denied.");
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
      alert("Download error: " + err.message);
    }
  }

  async function handleImportSubmit(e: FormEvent) {
    e.preventDefault();
    if (!importFile) {
      setImportError(lang === "zh-TW" ? "請先選擇欲匯入的檔案 (.xlsx, .xls 或 .docx)" : "Please select an Excel (.xlsx/.xls) or Word (.docx) file first");
      return;
    }
    const isWord = importFile.name.toLowerCase().endsWith(".docx");
    const isExcel = importFile.name.toLowerCase().endsWith(".xlsx") || importFile.name.toLowerCase().endsWith(".xls");

    if (!isWord && !isExcel) {
      setImportError(lang === "zh-TW" ? "不支援的檔案格式，請上傳 .xlsx, .xls 或 .docx 檔案" : "Unsupported file format. Please upload .xlsx, .xls or .docx");
      return;
    }

    setImportLoading(true);
    setImportError("");
    setImportResult(null);

    const formData = new FormData();
    formData.append("file", importFile);
    const endpoint = isWord ? `${API_URL}/api/products/import-word` : `${API_URL}/api/products/import-excel`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setImportError(data.detail || "Import failed");
      } else {
        setImportResult(data);
        onImportSuccess();
      }
    } catch (err: any) {
      setImportError(err.message || "Network error during upload");
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 24, textAlign: "center" }}>
        <h2 style={{ margin: "0 0 6px 0", fontSize: 26, fontWeight: 800 }}>
          📥 {lang === "zh-TW" ? "Excel 與 Word 書籍批次匯入" : "Bulk Product Importer (Excel & Word)"}
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
          {lang === "zh-TW"
            ? "直接使用試算表 (.xlsx/.xls) 或 Word 文件 (.docx) 快速新增、批次比對與更新書籍資料庫。"
            : "Batch import and upsert books via Microsoft Excel spreadsheet (.xlsx) or Word document (.docx)."}
        </p>
      </div>

      <div style={{ padding: 20, borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border-color)", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
              Step 1: {lang === "zh-TW" ? "下載官方標準匯入範本" : "Download Official Standard Templates"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {lang === "zh-TW" ? "包含規範、範例書籍資料與防呆格式。支援試算表或 Word 表格格式。" : "Pre-formatted templates with validation rules and sample book rows."}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => handleDownloadTemplate("excel")}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--accent)", color: "white", border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >
              <span>📊</span> {lang === "zh-TW" ? "Excel 範本 (.xlsx)" : "Excel (.xlsx)"}
            </button>
            <button
              type="button"
              onClick={() => handleDownloadTemplate("word")}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "#2563eb", color: "white", border: "none", padding: "9px 16px", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 13 }}
            >
              <span>📄</span> {lang === "zh-TW" ? "Word 範本 (.docx)" : "Word (.docx)"}
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleImportSubmit} style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 24 }}>
        <div style={{ padding: 20, borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 14 }}>
            Step 2: {lang === "zh-TW" ? "上傳填寫完畢的檔案" : "Upload Your Filled File"}
          </div>

          <div
            style={{ border: "2px dashed var(--border-color)", borderRadius: 12, padding: "36px 20px", textAlign: "center", background: "var(--bg-secondary)", cursor: "pointer" }}
            onClick={() => document.getElementById("admin-portal-file")?.click()}
          >
            <input
              id="admin-portal-file"
              type="file"
              accept=".xlsx,.xls,.docx"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setImportFile(e.target.files[0]);
                  setImportError("");
                  setImportResult(null);
                }
              }}
            />
            <div style={{ fontSize: 44, marginBottom: 10 }}>
              {importFile ? (importFile.name.toLowerCase().endsWith(".docx") ? "📄" : "📊") : "📥"}
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--text-primary)" }}>
              {importFile ? importFile.name : lang === "zh-TW" ? "點擊此處選擇 .xlsx, .xls 或 .docx 檔案" : "Click to select .xlsx, .xls or .docx file"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
              {importFile ? `${(importFile.size / 1024).toFixed(1)} KB` : lang === "zh-TW" ? "自動智慧辨識欄位並執行比對更新 (Upsert)" : "Supports Microsoft Excel (.xlsx/.xls) and Microsoft Word (.docx)"}
            </div>
          </div>

          {importError && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: "#fef2f2", color: "#991b1b", border: "1px solid #fecaca", fontSize: 13, fontWeight: 600 }}>
              ⚠️ {importError}
            </div>
          )}

          <button
            type="submit"
            disabled={!importFile || importLoading}
            style={{
              marginTop: 18,
              width: "100%",
              padding: "13px 20px",
              background: !importFile || importLoading ? "var(--border-color)" : "var(--accent)",
              color: "white",
              border: "none",
              borderRadius: 8,
              fontWeight: 800,
              fontSize: 15,
              cursor: !importFile || importLoading ? "not-allowed" : "pointer",
            }}
          >
            {importLoading ? (
              <>⏳ {lang === "zh-TW" ? "正在剖析並寫入 PostgreSQL 資料庫..." : "Processing & Upserting..."}</>
            ) : (
              <>🚀 {lang === "zh-TW" ? "開始執行批次匯入" : "Start Bulk Import"}</>
            )}
          </button>
        </div>
      </form>

      {importResult && (
        <div style={{ padding: 22, borderRadius: 14, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 24 }}>{importResult.success ? "✅" : "⚠️"}</span>
            <strong style={{ fontSize: 18 }}>
              {importResult.success ? (lang === "zh-TW" ? "匯入作業圓滿完成！" : "Bulk Import Completed Successfully!") : lang === "zh-TW" ? "匯入完成 (部分列有異常)" : "Import finished with notices"}
            </strong>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18, textAlign: "center" }}>
            <div style={{ padding: 12, borderRadius: 10, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "總處理筆數" : "Total Rows"}</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{importResult.total_rows}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" }}>
              <div style={{ fontSize: 11 }}>{lang === "zh-TW" ? "全新新增" : "Inserted"}</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{importResult.inserted}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af" }}>
              <div style={{ fontSize: 11 }}>{lang === "zh-TW" ? "比對更新" : "Updated"}</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{importResult.updated}</div>
            </div>
            <div style={{ padding: 12, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
              <div style={{ fontSize: 11 }}>{lang === "zh-TW" ? "失敗跳過" : "Failed"}</div>
              <div style={{ fontSize: 22, fontWeight: 900 }}>{importResult.failed}</div>
            </div>
          </div>

          {importResult.imported_books && importResult.imported_books.length > 0 && (
            <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: 8, padding: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-secondary)", marginBottom: 8 }}>
                {lang === "zh-TW" ? "已寫入資料庫書籍：" : "Database Records Processed:"}
              </div>
              {importResult.imported_books.map((b: any) => (
                <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 4px", borderBottom: "1px solid var(--border-color)" }}>
                  <span>
                    <strong style={{ color: b.action === "INSERTED" ? "#059669" : "#2563eb", marginRight: 8 }}>[{b.action}]</strong>
                    #{b.id} {lang === "zh-TW" ? b.title_zh : b.title_en}
                  </span>
                  <span style={{ fontWeight: 800 }}>${Number(b.price).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
