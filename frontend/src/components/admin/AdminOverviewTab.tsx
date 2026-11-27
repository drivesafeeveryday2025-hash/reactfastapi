import { useLanguage } from "../../contexts/LanguageContext";
import type { DeadStockItem, FinancialAnalyticsData, OverviewData } from "../../types";

interface AdminOverviewTabProps {
  userEmail: string;
  overview: OverviewData | null;
  loadingOverview: boolean;
  financialAnalytics: FinancialAnalyticsData | null;
  deadStockItems: DeadStockItem[];
  loadingFinancial: boolean;
  onSelectTab: (tab: "overview" | "orders" | "warehouse" | "products" | "import" | "logs") => void;
  onRefreshOrders: () => void;
}

export default function AdminOverviewTab({
  userEmail,
  overview,
  loadingOverview,
  financialAnalytics,
  deadStockItems,
  loadingFinancial,
  onSelectTab,
  onRefreshOrders,
}: AdminOverviewTabProps) {
  const { lang } = useLanguage();

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 6px 0", fontSize: 24, fontWeight: 800 }}>
          {lang === "zh-TW" ? "門市營運總覽" : "Store Operations Overview"}
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
          {lang === "zh-TW" ? `目前登入管理員：${userEmail}` : `Logged in as manager: ${userEmail}`}
        </p>
      </div>

      {/* KPI Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20, marginBottom: 30 }}>
        <div style={{ padding: 22, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
            📚 {lang === "zh-TW" ? "已上架書籍總數" : "Total Books in Catalog"}
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "var(--accent)" }}>
            {loadingOverview ? "..." : overview?.total_books ?? "..."}
          </div>
        </div>

        <div style={{ padding: 22, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
            🏷️ {lang === "zh-TW" ? "書籍分類類別" : "Active Categories"}
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#2563eb" }}>
            {overview?.total_categories ?? "..."}
          </div>
        </div>

        <div style={{ padding: 22, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
            👥 {lang === "zh-TW" ? "註冊會員帳號" : "Registered Users"}
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#059669" }}>
            {overview?.total_users ?? "..."}
          </div>
        </div>

        <div style={{ padding: 22, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", fontWeight: 700, marginBottom: 8 }}>
            📦 {lang === "zh-TW" ? "顧客訂單筆數" : "Processed Orders"}
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: "#d97706" }}>
            {overview?.total_orders ?? "..."}
          </div>
        </div>
      </div>

      {/* FINANCIAL MARGIN ANALYTICS */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
            📈 {lang === "zh-TW" ? "財務毛利與獲利分析 (Financial Margins & COGS)" : "Financial Margins & Revenue Intelligence"}
          </h3>
          {financialAnalytics && (
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {lang === "zh-TW"
                ? `累計完成訂單：${financialAnalytics.total_orders_count} 筆 • 平均客單價：$${financialAnalytics.average_order_value.toFixed(2)}`
                : `Total Orders: ${financialAnalytics.total_orders_count} • Avg Order Value: $${financialAnalytics.average_order_value.toFixed(2)}`}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 16 }}>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              💵 {lang === "zh-TW" ? "總營業額 (Gross Revenue)" : "Gross Revenue"}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "var(--accent)" }}>
              ${loadingFinancial ? "..." : financialAnalytics?.total_gross_revenue.toFixed(2) || "0.00"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
              {lang === "zh-TW" ? "涵蓋所有已完成與已送達訂單" : "Based on confirmed store orders"}
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              📉 {lang === "zh-TW" ? "銷貨成本 (COGS)" : "Cost of Goods Sold (COGS)"}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#64748b" }}>
              ${loadingFinancial ? "..." : financialAnalytics?.total_cogs.toFixed(2) || "0.00"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
              {lang === "zh-TW" ? "進貨採購成本與入庫計價" : "Acquisition cost of units sold"}
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              💰 {lang === "zh-TW" ? "毛利潤總額 (Gross Profit)" : "Gross Profit"}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#059669" }}>
              ${loadingFinancial ? "..." : financialAnalytics?.total_gross_profit.toFixed(2) || "0.00"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
              {lang === "zh-TW" ? "營業額扣減進貨成本後之毛利" : "Revenue minus acquisition cost"}
            </div>
          </div>

          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 18, boxShadow: "var(--shadow-sm)" }}>
            <div style={{ color: "var(--text-secondary)", fontSize: 12, fontWeight: 700, textTransform: "uppercase", marginBottom: 6 }}>
              📊 {lang === "zh-TW" ? "綜合毛利率 (Gross Margin %)" : "Gross Margin %"}
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#2563eb" }}>
              {loadingFinancial ? "..." : financialAnalytics?.gross_margin_percent.toFixed(1) || "0.0"}%
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
              {lang === "zh-TW" ? "健康經營獲利率指標" : "Overall profitability ratio"}
            </div>
          </div>
        </div>

        {financialAnalytics && financialAnalytics.category_breakdown.length > 0 && (
          <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-color)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px" }}>{lang === "zh-TW" ? "書籍品類分類" : "Category"}</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>{lang === "zh-TW" ? "銷售數量" : "Units Sold"}</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>{lang === "zh-TW" ? "總銷售額" : "Gross Revenue"}</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>{lang === "zh-TW" ? "毛利潤" : "Gross Profit"}</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>{lang === "zh-TW" ? "毛利率 %" : "Margin %"}</th>
                </tr>
              </thead>
              <tbody>
                {financialAnalytics.category_breakdown.map((cat) => (
                  <tr key={cat.category_id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "10px 14px", fontWeight: 700 }}>{cat.category_name}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>{cat.total_units_sold}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>${cat.gross_revenue.toFixed(2)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", color: "#059669", fontWeight: 700 }}>${cat.gross_profit.toFixed(2)}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <span style={{ background: cat.margin_percent >= 40 ? "#ecfdf5" : "#fef3c7", color: cat.margin_percent >= 40 ? "#065f46" : "#92400e", padding: "2px 8px", borderRadius: 6, fontWeight: 800, fontSize: 12 }}>
                        {cat.margin_percent.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DEAD STOCK & INVENTORY TURNOVER */}
      <div style={{ marginBottom: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
              ⚠️ {lang === "zh-TW" ? "呆滯庫存預警與智慧週轉清倉 (Dead Stock Intelligence)" : "Dead Stock & Inventory Turnover Detection"}
            </h3>
            <span style={{ background: "#fee2e2", color: "#991b1b", padding: "2px 8px", borderRadius: 6, fontSize: 11, fontWeight: 800 }}>
              {lang === "zh-TW" ? ">45 天無銷量預警" : "Inactive >45 Days"}
            </span>
          </div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {lang === "zh-TW" ? `共偵測到 ${deadStockItems.length} 項呆滯品項` : `Detected ${deadStockItems.length} inactive SKUs`}
          </span>
        </div>

        {deadStockItems.length === 0 ? (
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: 12, padding: 24, textAlign: "center", color: "#059669" }}>
            🎉 {lang === "zh-TW" ? "目前庫存週轉良好，未偵測到超過 45 天無銷量之呆滯品項！" : "Excellent inventory turnover! No dead stock or stalled SKUs detected over 45 days."}
          </div>
        ) : (
          <div style={{ background: "var(--bg-card)", borderRadius: 12, border: "1px solid var(--border-color)", overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border-color)", textAlign: "left" }}>
                  <th style={{ padding: "10px 14px" }}>{lang === "zh-TW" ? "書籍品名 / ISBN" : "Product Title & ISBN"}</th>
                  <th style={{ padding: "10px 14px" }}>{lang === "zh-TW" ? "分類類別" : "Category"}</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>{lang === "zh-TW" ? "未售天數" : "Days Inactive"}</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>{lang === "zh-TW" ? "在庫數量" : "Units On-Hand"}</th>
                  <th style={{ padding: "10px 14px", textAlign: "right" }}>{lang === "zh-TW" ? "積壓資金 (Capital Tied)" : "Capital Tied Up"}</th>
                  <th style={{ padding: "10px 14px" }}>{lang === "zh-TW" ? "智慧清倉建議 (Action Plan)" : "Recommended Action"}</th>
                </tr>
              </thead>
              <tbody>
                {deadStockItems.map((item) => (
                  <tr key={item.product_id} style={{ borderBottom: "1px solid var(--border-color)" }}>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 800 }}>{lang === "zh-TW" ? item.title_zh || item.title_en : item.title_en}</div>
                      {item.isbn && <div style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "monospace" }}>ISBN: {item.isbn}</div>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-secondary)" }}>{item.category_name}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right" }}>
                      <span style={{ color: "#dc2626", fontWeight: 800 }}>
                        {item.days_since_last_sale} {lang === "zh-TW" ? "天" : "days"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700 }}>{item.total_on_hand}</td>
                    <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 900, color: "#d97706" }}>
                      ${item.capital_tied_up.toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: 6, fontWeight: 700, fontSize: 11 }}>
                        {item.recommendation}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div style={{ padding: 24, borderRadius: 16, background: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <h3 style={{ margin: "0 0 14px 0", fontSize: 18, fontWeight: 800 }}>
          ⚡ {lang === "zh-TW" ? "管理員快速作業" : "Quick Operations"}
        </h3>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            onClick={() => {
              onSelectTab("orders");
              onRefreshOrders();
            }}
            style={{ padding: "10px 18px", borderRadius: 8, background: "var(--accent)", color: "white", border: "none", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            📦 {lang === "zh-TW" ? "管理顧客訂單與出貨" : "Manage Customer Orders"}
          </button>
          <button
            onClick={() => onSelectTab("import")}
            style={{ padding: "10px 18px", borderRadius: 8, background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            📥 {lang === "zh-TW" ? "執行 Excel / Word 批次匯入" : "Bulk Import Books"}
          </button>
          <button
            onClick={() => onSelectTab("products")}
            style={{ padding: "10px 18px", borderRadius: 8, background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            📖 {lang === "zh-TW" ? "檢視庫存書單" : "Browse Inventory Table"}
          </button>
          <button
            onClick={() => onSelectTab("logs")}
            style={{ padding: "10px 18px", borderRadius: 8, background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", fontWeight: 700, cursor: "pointer", fontSize: 14 }}
          >
            🛡️ {lang === "zh-TW" ? "稽核登入與系統操作" : "Audit Security Logs"}
          </button>
        </div>
      </div>
    </div>
  );
}
