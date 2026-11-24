import { useEffect, useState, type FormEvent } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import { useTheme } from "./contexts/ThemeContext";
import { useLanguage } from "./contexts/LanguageContext";
import AdminPortal from "./components/AdminPortal";
import AdminLogin from "./components/AdminLogin";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface NavigationMenuItem {
  id: number;
  parent_id: number | null;
  title_en: string;
  title_zh: string;
  url: string;
  icon: string | null;
  badge_en: string | null;
  badge_zh: string | null;
  sort_order: number;
  is_active: boolean;
  requires_auth: boolean;
  requires_role: string | null;
  children: NavigationMenuItem[];
}

interface User {
  id: number;
  email: string;
  role?: string;
  full_name?: string;
  phone?: string;
  address?: string;
}

interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product_title_en?: string;
  product_title_zh?: string;
  product_image_url?: string;
}

interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  shipping_fee: number;
  status: string;
  delivery_method: string;
  payment_method: string;
  recipient_name?: string;
  recipient_phone?: string;
  shipping_address?: string;
  delivery_notes?: string;
  tracking_number?: string;
  estimated_delivery?: string;
  created_at: string;
  items: OrderItem[];
}

interface SiteSettings {
  store_name_en: string;
  store_name_zh: string;
  hero_title_en: string;
  hero_title_zh: string;
  hero_subtitle_en: string;
  hero_subtitle_zh: string;
  about_text_en: string;
  about_text_zh: string;
  address_en: string;
  address_zh: string;
  phone: string;
  email: string;
  opening_hours_en: string;
  opening_hours_zh: string;
}

interface Promotion {
  id: number;
  title_en: string;
  title_zh: string;
  badge_en: string;
  badge_zh: string;
  discount_code: string;
  image_url: string;
}

interface Category {
  id: number;
  name_en: string;
  name_zh: string;
  icon: string;
  sort_order: number;
}

interface ProdDetail {
  full_synopsis_en: string;
  full_synopsis_zh: string;
  publisher_en: string;
  publisher_zh: string;
  isbn: string;
  publication_year: number;
  page_count: number;
  format_en: string;
  format_zh: string;
}

interface Product {
  id: number;
  category_id: number;
  title_en: string;
  title_zh: string;
  author_en: string;
  author_zh: string;
  short_desc_en: string;
  short_desc_zh: string;
  price: number;
  image_url: string;
  is_recommended: boolean;
  detail?: ProdDetail;
}

interface LoginLog {
  id: number;
  user_id: number;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  login_time: string;
}

interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

interface ErrorLog {
  id: number;
  error_type: string;
  error_message: string;
  stack_trace: string | null;
  endpoint: string | null;
  http_method: string | null;
  user_id: number | null;
  ip_address: string | null;
  created_at: string;
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t, localize } = useLanguage();

  const navigate = useNavigate();

  const [token, setToken] = useState<string | null>(() => localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);

  // Navigation Menus from PostgreSQL (Hierarchical parent-child)
  const [navMenus, setNavMenus] = useState<NavigationMenuItem[]>([]);
  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

  const isManager =
    user?.role === "manager" ||
    user?.role === "superadmin" ||
    user?.email === "react@mail" ||
    user?.email === "react@mail.com";

  // Authentication states
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  // Data from PostgreSQL
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [recommended, setRecommended] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);

  // Interactive user states
  const [cart, setCart] = useState<{ [productId: number]: number }>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<Product | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Checkout Modal states
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [deliveryMethod, setDeliveryMethod] = useState<"standard" | "express" | "pickup">("standard");
  const [paymentMethod, setPaymentMethod] = useState<"credit_card" | "apple_pay" | "cod" | "bank_transfer">("credit_card");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [checkoutSubmitting, setCheckoutSubmitting] = useState(false);
  const [checkoutSuccessOrder, setCheckoutSuccessOrder] = useState<Order | null>(null);

  // User Section ("My Account, Profile & Orders") states
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalTab, setUserModalTab] = useState<"orders" | "profile" | "bought_items">("orders");
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [loadingMyOrders, setLoadingMyOrders] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: "", phone: "", address: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);
  const [activeTrackingOrderId, setActiveTrackingOrderId] = useState<number | null>(null);

  // System Activity Monitor Modal
  const [logsOpen, setLogsOpen] = useState(false);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [logsTab, setLogsTab] = useState<"activities" | "logins" | "errors">("activities");

  // Chatbox states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: "bot" | "user"; text: string }>>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Excel Bulk Import states
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelLoading, setExcelLoading] = useState(false);
  const [excelResult, setExcelResult] = useState<any>(null);
  const [excelError, setExcelError] = useState("");

  function reloadCatalog() {
    fetch(`${API_URL}/api/categories`).then((r) => r.ok && r.json()).then(setCategories);
    fetch(`${API_URL}/api/products/recommended`).then((r) => r.ok && r.json()).then(setRecommended);
    const url = selectedCat ? `${API_URL}/api/products?category_id=${selectedCat}` : `${API_URL}/api/products`;
    fetch(url).then((r) => r.ok && r.json()).then(setProducts);
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
        reloadCatalog();
        trackActivity(isWord ? "WORD_IMPORT" : "EXCEL_IMPORT", "PRODUCT", undefined, `Imported ${data.inserted} books, updated ${data.updated} from ${excelFile.name}`);
      }
    } catch (err: any) {
      setExcelError(err.message || "Network error during upload");
    } finally {
      setExcelLoading(false);
    }
  }

  async function handleDownloadTemplate() {
    try {
      const res = await fetch(`${API_URL}/api/products/excel-template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "Only authorized administrator (react@mail) can access this function.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "apex_books_template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error downloading template: " + (err.message || "Network error"));
    }
  }

  async function handleDownloadWordTemplate() {
    try {
      const res = await fetch(`${API_URL}/api/products/word-template`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.detail || "Only authorized administrator (react@mail) can access this function.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "apex_books_template.docx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Error downloading Word template: " + (err.message || "Network error"));
    }
  }

  // Track system activity helper
  function trackActivity(action: string, entity_type?: string, entity_id?: number, details?: string) {
    fetch(`${API_URL}/api/activity`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ action, entity_type, entity_id, details }),
    }).catch(() => {});
  }

  // Initialize chat greeting based on language
  useEffect(() => {
    setChatMessages([
      {
        sender: "bot",
        text: t("chat_welcome"),
      },
    ]);
  }, [lang]);

  // Check login status
  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: User) => setUser(data))
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
        setUser(null);
      });
  }, [token]);

  // Fetch initial bookstore content from DB
  useEffect(() => {
    fetch(`${API_URL}/api/settings`).then((r) => r.ok && r.json()).then(setSettings);
    fetch(`${API_URL}/api/promotions`).then((r) => r.ok && r.json()).then(setPromotions);
    fetch(`${API_URL}/api/categories`).then((r) => r.ok && r.json()).then(setCategories);
    fetch(`${API_URL}/api/products/recommended`).then((r) => r.ok && r.json()).then(setRecommended);
    fetch(`${API_URL}/api/navigation`)
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) setNavMenus(data);
      })
      .catch((e) => console.error("Failed to load navigation menus", e));
  }, []);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-nav-dropdown]")) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  function handleNavClick(url: string, e?: React.MouseEvent) {
    setOpenDropdownId(null);
    if (url.startsWith("action:")) {
      if (e) e.preventDefault();
      const action = url.replace("action:", "");
      if (action === "orders" || action === "hub") {
        loadMyOrders();
        setUserModalTab("orders");
        setUserModalOpen(true);
      } else if (action === "profile") {
        setUserModalTab("profile");
        setUserModalOpen(true);
      } else if (action === "bought_items") {
        setUserModalTab("bought_items");
        setUserModalOpen(true);
      } else if (action === "chat") {
        setChatOpen(true);
      } else if (action === "logs") {
        loadSystemLogs();
      } else if (action === "import") {
        setExcelModalOpen(true);
      }
    } else if (url.startsWith("#")) {
      if (e) e.preventDefault();
      const targetEl = document.querySelector(url);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth" });
      }
    } else if (url.startsWith("/")) {
      navigate(url);
    }
  }

  // Filter products by selected category
  useEffect(() => {
    const url = selectedCat
      ? `${API_URL}/api/products?category_id=${selectedCat}`
      : `${API_URL}/api/products`;
    fetch(url).then((r) => r.ok && r.json()).then(setProducts);
  }, [selectedCat]);

  // Fetch logs when monitor modal opens
  function loadSystemLogs() {
    fetch(`${API_URL}/api/system/logins`)
      .then((r) => r.ok && r.json())
      .then(setLoginLogs);
    fetch(`${API_URL}/api/system/activities`)
      .then((r) => r.ok && r.json())
      .then(setActivityLogs);
    fetch(`${API_URL}/api/system/errors`)
      .then((r) => r.ok && r.json())
      .then(setErrorLogs);
    setLogsOpen(true);
  }

  function triggerTestError() {
    fetch(`${API_URL}/api/system/test-error`)
      .finally(() => {
        setTimeout(loadSystemLogs, 400);
      });
  }

  // Auth Handler
  async function handleAuth(e: FormEvent) {
    e.preventDefault();
    setAuthError("");
    setAuthMessage("");
    const endpoint = authMode === "login" ? "/api/login" : "/api/register";

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.detail || "Authentication failed");
        return;
      }
      if (authMode === "register") {
        setAuthMessage(
          lang === "zh-TW"
            ? "帳號註冊成功！請直接登入。"
            : "Account created successfully! Please sign in."
        );
        setAuthMode("login");
      } else {
        localStorage.setItem("token", data.access_token);
        setToken(data.access_token);
      }
    } catch {
      setAuthError(
        lang === "zh-TW"
          ? "無法連線至後端伺服器，請確認 FastAPI 正在執行中。"
          : "Cannot connect to backend server. Please verify FastAPI is running."
      );
    }
  }

  function handleLogout() {
    trackActivity("USER_LOGOUT", "SESSION", user?.id, "User clicked sign out");
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setCart({});
  }

  function addToCart(id: number) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    trackActivity("ADD_TO_BAG", "BOOK", id, "Added book to shopping bag");
  }

  function updateCartQty(id: number, delta: number) {
    setCart((prev) => {
      const current = prev[id] || 0;
      const next = current + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  }

  const allKnownBooks = [...products, ...recommended].reduce<{ [id: number]: Product }>((acc, b) => {
    acc[b.id] = b;
    return acc;
  }, {});

  const cartItems = Object.entries(cart)
    .map(([idStr, qty]) => {
      const bId = Number(idStr);
      return {
        book: allKnownBooks[bId],
        quantity: qty,
      };
    })
    .filter((item) => item.book);

  const cartTotal = cartItems.reduce((sum, item) => sum + item.book.price * item.quantity, 0);
  const totalCartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // Delivery fee calculation
  const shippingFee =
    deliveryMethod === "express"
      ? 12.0
      : deliveryMethod === "pickup"
      ? 0.0
      : cartTotal >= 35.0
      ? 0.0
      : 5.0;

  const orderGrandTotal = Math.max(0, cartTotal + shippingFee);

  // Initialize and sync profile form when user updates
  useEffect(() => {
    if (user) {
      setProfileForm({
        full_name: user.full_name || "",
        phone: user.phone || "",
        address: user.address || "",
      });
      setRecipientName(user.full_name || user.email.split("@")[0]);
      setRecipientPhone(user.phone || "");
      setShippingAddress(user.address || "");
    }
  }, [user]);

  function loadMyOrders() {
    if (!token) return;
    setLoadingMyOrders(true);
    fetch(`${API_URL}/api/orders/my-orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok && r.json())
      .then((data) => {
        if (Array.isArray(data)) setMyOrders(data);
      })
      .finally(() => setLoadingMyOrders(false));
  }

  useEffect(() => {
    if (token) {
      loadMyOrders();
    }
  }, [token]);

  // Open Checkout Modal
  function openCheckout() {
    if (!token) {
      alert(lang === "zh-TW" ? "請先登入會員以進行結帳。" : "Please log in to proceed with checkout.");
      return;
    }
    if (user) {
      if (!recipientName) setRecipientName(user.full_name || user.email.split("@")[0]);
      if (!recipientPhone) setRecipientPhone(user.phone || "");
      if (!shippingAddress) setShippingAddress(user.address || "");
    }
    setCartOpen(false);
    setCheckoutModalOpen(true);
  }

  // Submit complete order with delivery and payment options
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
        setCart({});
        setCheckoutModalOpen(false);
        setCheckoutSuccessOrder(orderData);
        const successMsg =
          lang === "zh-TW"
            ? `訂單 #${orderData.id} 建立成功！結帳總額：$${orderData.total_amount.toFixed(2)}`
            : `Order #${orderData.id} placed successfully! Total: $${orderData.total_amount.toFixed(2)}`;
        setOrderSuccess(successMsg);
        setTimeout(() => setOrderSuccess(null), 6000);
        loadMyOrders();
        trackActivity("PLACE_ORDER", "ORDER", orderData.id, `Placed order #${orderData.id}`);
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

  // Save updated user profile details
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

  // Aggregated library of books bought by user
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
        last_purchased: string;
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
        last_purchased: "",
      };
    }
    acc[item.product_id].total_quantity += item.quantity;
    return acc;
  }, {});

  function copyPromo(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    trackActivity("COPY_COUPON", "PROMOTION", undefined, `Copied promo code ${code}`);
    setTimeout(() => setCopiedCode(null), 2500);
  }

  async function handleSendChat(e: FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput.trim();
    const userMsg = { sender: "user" as const, text: msg };
    setChatInput("");
    setChatMessages((prev) => [...prev, userMsg]);

    trackActivity("CHAT_QUERY", "CHAT", undefined, msg);

    if (!token) {
      const loginNotice =
        lang === "zh-TW"
          ? "🔒 為了防範惡意網路爬蟲並保護服務品質，AI 客服助理僅開放給登入會員使用。請先登入您的帳號！"
          : "🔒 To prevent automated web-bot abuse, the AI assistant is reserved for signed-in members. Please sign in first!";
      setChatMessages((prev) => [...prev, { sender: "bot", text: loginNotice }]);
      return;
    }

    setChatLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "Accept-Language": lang,
        },
        body: JSON.stringify({ message: msg }),
      });

      const data = await res.json();

      if (res.status === 429) {
        // Rate limit burst/daily quota hit
        const rateLimitMsg = `⚠️ ${data.detail || "Rate limit reached. Please wait before asking again."}`;
        setChatMessages((prev) => [...prev, { sender: "bot", text: rateLimitMsg }]);
      } else if (res.status === 401) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text:
              lang === "zh-TW"
                ? "登入狀態已過期，請重新登入後再進行提問。"
                : "Your session has expired. Please sign in again.",
          },
        ]);
      } else if (!res.ok) {
        setChatMessages((prev) => [
          ...prev,
          {
            sender: "bot",
            text:
              lang === "zh-TW"
                ? "抱歉，目前客服系統忙碌中，請稍後再試。"
                : "Sorry, our assistant is temporarily busy. Please try again shortly.",
          },
        ]);
      } else {
        setChatMessages((prev) => [...prev, { sender: "bot", text: data.reply }]);
      }
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text:
            lang === "zh-TW"
              ? "無法連線至書店伺服器，請確認後端運行中。"
              : "Unable to reach bookstore server. Please verify backend is running.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  // --- REUSABLE HEADER CONTROLS ---
  const ControlButtons = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {/* Language Switcher */}
      <button
        onClick={toggleLang}
        title={t("lang_label")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 20,
          border: "1px solid var(--border-color)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <span>🌐</span> {lang === "en" ? "繁體中文" : "English"}
      </button>

      {/* Theme Switcher */}
      <button
        onClick={toggleTheme}
        title={t("theme_toggle_label")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "6px 12px",
          borderRadius: 20,
          border: "1px solid var(--border-color)",
          background: "var(--bg-card)",
          color: "var(--text-primary)",
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.2s",
        }}
      >
        <span>{theme === "light" ? "🌙" : "☀️"}</span>
        <span>{theme === "light" ? t("theme_dark") : t("theme_light")}</span>
      </button>
    </div>
  );

  // --- VIEW 1: SIGN IN / REGISTER SCREEN (WHEN NOT LOGGED IN) ---
  const CustomerSignInView = (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-secondary)",
          padding: 20,
          position: "relative",
        }}
      >
        {/* Top-Right Theme & Language Controls on Login Page */}
        <div style={{ position: "absolute", top: 24, right: 24 }}>
          {ControlButtons}
        </div>

        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "var(--bg-card)",
            padding: 36,
            borderRadius: 16,
            boxShadow: "var(--shadow-lg)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <span style={{ fontSize: 44 }}>📚</span>
            <h2 style={{ fontSize: 24, margin: "10px 0 4px 0", color: "var(--text-primary)" }}>
              {localize(settings, "store_name") || "Apex Book Haven"}
            </h2>
            <p style={{ color: "var(--text-secondary)", margin: 0, fontSize: 14 }}>
              {authMode === "login" ? t("auth_sub_login") : t("auth_sub_register")}
            </p>
          </div>

          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                {t("auth_email_label")}
              </label>
              <input
                type="email"
                placeholder="reader@example.com"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>
                {t("auth_pass_label")}
              </label>
              <input
                type="password"
                placeholder="••••••••"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
                minLength={6}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-primary)",
                  color: "var(--text-primary)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <button
              type="submit"
              style={{
                padding: 12,
                background: "var(--accent)",
                color: "white",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                marginTop: 6,
              }}
            >
              {authMode === "login" ? t("auth_btn_login") : t("auth_btn_register")}
            </button>
          </form>

          {authError && (
            <div style={{ background: "#fef2f2", color: "#b91c1c", padding: "10px 14px", borderRadius: 8, marginTop: 14, fontSize: 13, border: "1px solid #fecaca" }}>
              {authError}
            </div>
          )}
          {authMessage && (
            <div style={{ background: "#f0fdf4", color: "#15803d", padding: "10px 14px", borderRadius: 8, marginTop: 14, fontSize: 13, border: "1px solid #bbf7d0" }}>
              {authMessage}
            </div>
          )}

          <div style={{ marginTop: 22, textAlign: "center", fontSize: 14, color: "var(--text-secondary)" }}>
            <button
              type="button"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setAuthError("");
                setAuthMessage("");
              }}
              style={{ background: "none", border: "none", color: "var(--accent)", fontWeight: 700, cursor: "pointer", padding: 0 }}
            >
              {authMode === "login" ? t("auth_toggle_to_reg") : t("auth_toggle_to_log")}
            </button>
          </div>
        </div>
      </div>
    );

  // --- VIEW 2: LOGGED IN BOOKSTORE HOMEPAGE ---
  const CustomerStorefrontView = (
    <div style={{ background: "var(--bg-primary)", color: "var(--text-primary)", minHeight: "100vh" }}>
      {/* Toast Notification */}
      {orderSuccess && (
        <div style={{ position: "fixed", top: 20, right: 20, background: "#16a34a", color: "white", padding: "14px 22px", borderRadius: 10, boxShadow: "var(--shadow-lg)", zIndex: 120, fontWeight: 600 }}>
          🎉 {orderSuccess}
        </div>
      )}

      {/* TOP NAVIGATION BAR */}
      <header
        style={{
          position: "sticky",
          top: 0,
          background: "var(--bg-navbar)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--border-color)",
          zIndex: 60,
          padding: "14px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 900, fontSize: 22, color: "var(--accent)" }}>
          <span>📚</span> {localize(settings, "store_name")}
        </div>

        {/* DATABASE-DRIVEN HIERARCHICAL NAVIGATION (PARENT & CHILD DROPDOWNS) */}
        <nav style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700 }}>
          {navMenus
            .filter((item) => {
              if (!item.is_active) return false;
              if (item.requires_auth && !token) return false;
              if (item.requires_role === "manager" && !isManager) return false;
              return true;
            })
            .map((menu) => {
              const hasChildren = menu.children && menu.children.length > 0;
              const isOpen = openDropdownId === menu.id;

              return (
                <div
                  key={menu.id}
                  data-nav-dropdown
                  style={{ position: "relative" }}
                  onMouseEnter={() => hasChildren && setOpenDropdownId(menu.id)}
                  onMouseLeave={() => hasChildren && setOpenDropdownId(null)}
                >
                  <button
                    onClick={(e) => {
                      if (hasChildren) {
                        setOpenDropdownId(isOpen ? null : menu.id);
                      } else {
                        handleNavClick(menu.url, e);
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 20,
                      border: "1px solid",
                      borderColor: isOpen ? "var(--border-accent)" : "transparent",
                      background: isOpen ? "var(--accent-light)" : "transparent",
                      color: isOpen ? "var(--accent)" : "var(--text-primary)",
                      cursor: "pointer",
                      fontSize: 14,
                      fontWeight: 700,
                      transition: "all 0.2s ease",
                    }}
                  >
                    {menu.icon && <span style={{ fontSize: 15 }}>{menu.icon}</span>}
                    <span>{localize(menu, "title")}</span>
                    {hasChildren && (
                      <span
                        style={{
                          fontSize: 10,
                          marginLeft: 2,
                          transition: "transform 0.2s ease",
                          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
                          color: isOpen ? "var(--accent)" : "var(--text-secondary)",
                        }}
                      >
                        ▼
                      </span>
                    )}
                  </button>

                  {/* SUBMENU DROPDOWN CARD */}
                  {hasChildren && isOpen && (
                    <div
                      style={{
                        position: "absolute",
                        top: "calc(100% + 4px)",
                        left: 0,
                        minWidth: 260,
                        background: "var(--bg-modal)",
                        border: "1px solid var(--border-color)",
                        borderRadius: 14,
                        padding: "8px",
                        boxShadow: "0 12px 28px -6px rgba(0, 0, 0, 0.2), 0 8px 10px -4px rgba(0, 0, 0, 0.08)",
                        zIndex: 100,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {menu.children
                        .filter((c) => c.is_active)
                        .map((child) => (
                          <div
                            key={child.id}
                            onClick={(e) => {
                              if (child.url.startsWith("/")) {
                                navigate(child.url);
                                setOpenDropdownId(null);
                              } else {
                                handleNavClick(child.url, e);
                              }
                            }}
                            style={{
                              padding: "10px 14px",
                              borderRadius: 10,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              cursor: "pointer",
                              transition: "all 0.15s ease",
                              gap: 12,
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--accent-light)";
                              e.currentTarget.style.color = "var(--accent)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "inherit";
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              {child.icon && <span style={{ fontSize: 16 }}>{child.icon}</span>}
                              <span style={{ fontSize: 13, fontWeight: 700 }}>
                                {localize(child, "title")}
                              </span>
                            </div>
                            {child.badge_en && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 800,
                                  padding: "2px 7px",
                                  borderRadius: 10,
                                  background:
                                    child.badge_en === "Hot"
                                      ? "#fef2f2"
                                      : child.badge_en === "Live"
                                      ? "#ecfdf5"
                                      : "var(--accent-light)",
                                  color:
                                    child.badge_en === "Hot"
                                      ? "#dc2626"
                                      : child.badge_en === "Live"
                                      ? "#059669"
                                      : "var(--accent)",
                                  border:
                                    child.badge_en === "Hot"
                                      ? "1px solid #fecaca"
                                      : child.badge_en === "Live"
                                      ? "1px solid #a7f3d0"
                                      : "1px solid var(--border-accent)",
                                }}
                              >
                                {lang === "zh-TW" ? child.badge_zh || child.badge_en : child.badge_en}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
        </nav>

        {/* Right Action Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {ControlButtons}

          {/* Book Bag / Cart Button */}
          <button
            onClick={() => setCartOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "var(--accent-light)",
              border: "1px solid var(--border-accent)",
              padding: "7px 16px",
              borderRadius: 20,
              cursor: "pointer",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            <span>🛍️</span> {t("nav_cart")} ({totalCartCount})
          </button>

          {/* User Section: My Account, Profile & Orders */}
          <button
            onClick={() => {
              loadMyOrders();
              setUserModalOpen(true);
            }}
            title={lang === "zh-TW" ? "會員專區：個人資料、購買記錄與訂單物流追蹤" : "Customer Hub: Profile, items bought & order tracking"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid var(--border-color)",
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 700,
              transition: "all 0.2s",
            }}
          >
            <span>👤</span>
            <span>{user?.full_name || user?.email?.split("@")[0] || "My Account"}</span>
            {myOrders.length > 0 && (
              <span
                style={{
                  background: "var(--accent)",
                  color: "white",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontSize: 11,
                  fontWeight: 800,
                }}
              >
                {myOrders.length}
              </span>
            )}
          </button>
          <button
            onClick={handleLogout}
            style={{
              padding: "6px 12px",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              background: "var(--bg-card)",
              color: "var(--text-primary)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t("nav_logout")}
          </button>
        </div>
      </header>

      {/* 1. INTRODUCE / HERO SECTION */}
      <section
        id="hero"
        style={{
          background: "var(--bg-hero)",
          padding: "90px 24px 70px 24px",
          textAlign: "center",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div style={{ maxWidth: 1160, margin: "0 auto" }}>
          <span
            style={{
              display: "inline-block",
              background: "var(--bg-card)",
              color: "var(--accent)",
              padding: "6px 16px",
              borderRadius: 20,
              fontSize: 13,
              fontWeight: 700,
              marginBottom: 16,
              boxShadow: "var(--shadow-sm)",
              border: "1px solid var(--border-color)",
            }}
          >
            ✨ {t("hero_badge")}
          </span>

          <h1
            style={{
              fontSize: 46,
              fontWeight: 900,
              color: "var(--text-hero-title)",
              margin: "0 0 16px 0",
              letterSpacing: "-0.5px",
              lineHeight: 1.25,
            }}
          >
            {localize(settings, "hero_title")}
          </h1>

          <p
            style={{
              fontSize: 18,
              color: "var(--text-hero-sub)",
              lineHeight: 1.6,
              maxWidth: 820,
              margin: "0 auto 32px auto",
            }}
          >
            {localize(settings, "hero_subtitle")}
          </p>

          <div style={{ display: "flex", justifyContent: "center", gap: 16 }}>
            <a
              href="#catalog"
              style={{
                background: "var(--accent)",
                color: "white",
                padding: "14px 32px",
                borderRadius: 30,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 16,
                boxShadow: "var(--shadow-md)",
              }}
            >
              {t("hero_btn_explore")}
            </a>
            <a
              href="#about"
              style={{
                background: "var(--bg-card)",
                color: "var(--text-primary)",
                padding: "14px 28px",
                borderRadius: 30,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 16,
                border: "1px solid var(--border-color)",
              }}
            >
              {t("hero_btn_story")}
            </a>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: 36,
              marginTop: 50,
              color: "var(--text-hero-sub)",
              fontSize: 14,
              fontWeight: 600,
              flexWrap: "wrap",
            }}
          >
            <div>{t("hero_tag1")}</div>
            <div>{t("hero_tag2")}</div>
            <div>{t("hero_tag3")}</div>
          </div>
        </div>
      </section>

      {/* 2. PROMOTIONS SECTION */}
      <section id="promotions" style={{ padding: "70px 24px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ marginBottom: 28 }}>
          <h2 style={{ fontSize: 30, fontWeight: 800, margin: "0 0 6px 0", color: "var(--text-primary)" }}>
            🎁 {t("promos_title")}
          </h2>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("promos_subtitle")}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24 }}>
          {promotions.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex",
                border: "1px solid var(--border-accent)",
                borderRadius: 16,
                overflow: "hidden",
                background: "var(--bg-card)",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <img src={p.image_url} alt={localize(p, "title")} style={{ width: 140, objectFit: "cover" }} />
              <div style={{ padding: 18, display: "flex", flexDirection: "column", justifyContent: "center", flex: 1 }}>
                <span
                  style={{
                    background: "var(--accent)",
                    color: "white",
                    padding: "3px 8px",
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 800,
                    width: "fit-content",
                    marginBottom: 8,
                  }}
                >
                  {localize(p, "badge")}
                </span>
                <h3 style={{ margin: "0 0 8px 0", fontSize: 16, color: "var(--text-primary)" }}>
                  {localize(p, "title")}
                </h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                  <span>{t("promos_code_label")}:</span>
                  <button
                    onClick={() => copyPromo(p.discount_code)}
                    style={{
                      background: "var(--accent-light)",
                      border: "1px dashed var(--accent)",
                      color: "var(--accent)",
                      padding: "3px 8px",
                      borderRadius: 4,
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    {copiedCode === p.discount_code ? t("promos_copied") : p.discount_code}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. RECOMMENDED BOOKS SECTION */}
      <section
        id="recommended"
        style={{
          padding: "70px 24px",
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-color)",
          borderBottom: "1px solid var(--border-color)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ width: "100%" }}>
          <div style={{ textAlign: "center", marginBottom: 36 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text-primary)" }}>
              ⭐ {t("recom_title")}
            </h2>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("recom_subtitle")}</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
            {recommended.map((book) => (
              <div
                key={book.id}
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
                    <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)" }}>
                      ${book.price.toFixed(2)}
                    </span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => {
                          setSelectedBook(book);
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
            ))}
          </div>
        </div>
      </section>

      {/* 4. BOOK CATALOG SECTION */}
      <section id="catalog" style={{ padding: "70px 24px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30, flexWrap: "wrap", gap: 14 }}>
          <div>
            <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text-primary)" }}>
              📖 {t("catalog_title")}
            </h2>
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("catalog_subtitle")}</p>
          </div>
          {isManager && (
            <button
              onClick={() => {
                setExcelModalOpen(true);
                setExcelError("");
                setExcelResult(null);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--accent-light)",
                border: "1px solid var(--border-accent)",
                padding: "9px 18px",
                borderRadius: 24,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 14,
                color: "var(--accent)",
              }}
            >
              <span>📊</span> {lang === "zh-TW" ? "批次匯入書籍 (.xlsx / .docx)" : "Batch Import (.xlsx / .docx)"}
            </button>
          )}
        </div>

        {/* Dynamic Category Buttons */}
        <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginBottom: 36 }}>
          <button
            onClick={() => {
              setSelectedCat(null);
              trackActivity("FILTER_GENRE", "CATEGORY", undefined, "Viewed all genres");
            }}
            style={{
              padding: "9px 20px",
              borderRadius: 30,
              border: "1px solid var(--border-color)",
              background: selectedCat === null ? "var(--accent)" : "var(--bg-card)",
              color: selectedCat === null ? "white" : "var(--text-primary)",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            {t("catalog_all")} ({products.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setSelectedCat(c.id);
                trackActivity("FILTER_GENRE", "CATEGORY", c.id, `Selected genre ${c.name_en}`);
              }}
              style={{
                padding: "9px 20px",
                borderRadius: 30,
                border: "1px solid var(--border-color)",
                background: selectedCat === c.id ? "var(--accent)" : "var(--bg-card)",
                color: selectedCat === c.id ? "white" : "var(--text-primary)",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              {c.icon} {localize(c, "name")}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 24 }}>
          {products.map((book) => (
            <div
              key={book.id}
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
              <img src={book.image_url} alt={localize(book, "title")} style={{ width: "100%", height: 210, objectFit: "cover" }} />
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
                  <span style={{ fontSize: 19, fontWeight: 800, color: "var(--text-primary)" }}>
                    ${book.price.toFixed(2)}
                  </span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => {
                        setSelectedBook(book);
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
          ))}
        </div>
      </section>

      {/* 5. ABOUT US SECTION */}
      <section
        id="about"
        style={{
          padding: "80px 32px",
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-color)",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          <span style={{ fontSize: 34 }}>🌿</span>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: "12px 0 16px 0", color: "var(--text-primary)" }}>
            {t("about_title")}
          </h2>
          <p style={{ fontSize: 17, lineHeight: 1.8, color: "var(--text-secondary)", margin: "0 auto 28px auto" }}>
            {localize(settings, "about_text")}
          </p>

          <div
            style={{
              display: "inline-flex",
              gap: 28,
              background: "var(--bg-card)",
              padding: "16px 36px",
              borderRadius: 16,
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-sm)",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <div>
              <strong>{t("about_stat1_title")}</strong>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("about_stat1_desc")}</div>
            </div>
            <div>
              <strong>{t("about_stat2_title")}</strong>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("about_stat2_desc")}</div>
            </div>
            <div>
              <strong>{t("about_stat3_title")}</strong>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("about_stat3_desc")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. CONTACT US SECTION */}
      <section id="contact" style={{ padding: "80px 24px", width: "100%", boxSizing: "border-box" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px 0", color: "var(--text-primary)" }}>
            📍 {t("contact_title")}
          </h2>
          <p style={{ color: "var(--text-secondary)", margin: 0 }}>{t("contact_subtitle")}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
          <div style={{ padding: 28, background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border-color)", textAlign: "center" }}>
            <span style={{ fontSize: 32 }}>📍</span>
            <h3 style={{ margin: "12px 0 6px 0", color: "var(--text-primary)" }}>{t("contact_location_title")}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>{localize(settings, "address")}</p>
          </div>
          <div style={{ padding: 28, background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border-color)", textAlign: "center" }}>
            <span style={{ fontSize: 32 }}>📞</span>
            <h3 style={{ margin: "12px 0 6px 0", color: "var(--text-primary)" }}>{t("contact_support_title")}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 4px 0" }}>{settings?.phone}</p>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>{settings?.email}</p>
          </div>
          <div style={{ padding: 28, background: "var(--bg-secondary)", borderRadius: 16, border: "1px solid var(--border-color)", textAlign: "center" }}>
            <span style={{ fontSize: 32 }}>⏰</span>
            <h3 style={{ margin: "12px 0 6px 0", color: "var(--text-primary)" }}>{t("contact_hours_title")}</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: 0 }}>{localize(settings, "opening_hours")}</p>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        style={{
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border-color)",
          color: "var(--text-muted)",
          padding: "30px 24px",
          textAlign: "center",
          fontSize: 14,
        }}
      >
        © 2026 {localize(settings, "store_name")}. {t("footer_rights")}
      </footer>

      {/* MODAL: BOOK DETAIL POPUP */}
      {selectedBook && (
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
              onClick={() => setSelectedBook(null)}
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
              src={selectedBook.image_url}
              alt={localize(selectedBook, "title")}
              style={{ width: "100%", height: 230, objectFit: "cover", borderRadius: 12, marginBottom: 18 }}
            />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <h2 style={{ margin: 0, fontSize: 22 }}>{localize(selectedBook, "title")}</h2>
              <span style={{ fontSize: 22, fontWeight: 800, color: "var(--accent)" }}>
                ${selectedBook.price.toFixed(2)}
              </span>
            </div>
            <p style={{ fontSize: 14, color: "var(--accent)", margin: "0 0 16px 0", fontWeight: 600 }}>
              {t("by_author")} {localize(selectedBook, "author")}
            </p>

            <h4 style={{ margin: "0 0 6px 0", fontSize: 14, color: "var(--text-secondary)" }}>{t("modal_synopsis")}</h4>
            <p style={{ color: "var(--text-primary)", lineHeight: 1.6, fontSize: 14, marginBottom: 18 }}>
              {localize(selectedBook.detail, "full_synopsis") || localize(selectedBook, "short_desc")}
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
              <div>🏛️ <strong>{t("modal_publisher")}:</strong> {localize(selectedBook.detail, "publisher")}</div>
              <div>📅 <strong>{t("modal_year")}:</strong> {selectedBook.detail?.publication_year}</div>
              <div>📖 <strong>{t("modal_pages")}:</strong> {selectedBook.detail?.page_count}</div>
              <div>📦 <strong>{t("modal_format")}:</strong> {localize(selectedBook.detail, "format")}</div>
              <div style={{ gridColumn: "1 / -1" }}>🔢 <strong>{t("modal_isbn")}:</strong> {selectedBook.detail?.isbn}</div>
            </div>

            <button
              onClick={() => {
                addToCart(selectedBook.id);
                setSelectedBook(null);
              }}
              style={{
                width: "100%",
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
              {t("modal_add_btn")} • ${selectedBook.price.toFixed(2)}
            </button>
          </div>
        </div>
      )}

      {/* SLIDE-OUT BOOK BAG (CART) DRAWER */}
      {cartOpen && (
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
              <button onClick={() => setCartOpen(false)} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>✕</button>
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
                      <button onClick={() => updateCartQty(book.id, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>-</button>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>{quantity}</span>
                      <button onClick={() => updateCartQty(book.id, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid var(--border-color)", background: "var(--bg-card)", color: "var(--text-primary)", cursor: "pointer" }}>+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 18, fontWeight: 800 }}>
                  <span>{t("cart_total")}:</span>
                  <span style={{ color: "var(--accent)" }}>${cartTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={openCheckout}
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
      )}

      {/* ===================== MODAL: COMPLETE CHECKOUT PROCESS ===================== */}
      {checkoutModalOpen && (
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
            {/* Checkout Header */}
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>🛍️</span>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  {lang === "zh-TW" ? "購物車結帳與出貨配送設定" : "Checkout & Shipping Options"}
                </h3>
              </div>
              <button onClick={() => setCheckoutModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Checkout Form Content */}
            <form onSubmit={handleCheckoutSubmit} style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 22 }}>
              {/* SECTION 1: ITEMS IN CART REVIEW */}
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

              {/* SECTION 2: DELIVERY METHOD */}
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
                  {/* Standard Delivery */}
                  <div
                    onClick={() => setDeliveryMethod("standard")}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      border: "2px solid",
                      borderColor: deliveryMethod === "standard" ? "var(--accent)" : "var(--border-color)",
                      background: deliveryMethod === "standard" ? "var(--accent-light)" : "var(--bg-card)",
                      cursor: "pointer",
                      transition: "all 0.2s",
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

                  {/* Express Delivery */}
                  <div
                    onClick={() => setDeliveryMethod("express")}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      border: "2px solid",
                      borderColor: deliveryMethod === "express" ? "var(--accent)" : "var(--border-color)",
                      background: deliveryMethod === "express" ? "var(--accent-light)" : "var(--bg-card)",
                      cursor: "pointer",
                      transition: "all 0.2s",
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

                  {/* Store Pickup */}
                  <div
                    onClick={() => setDeliveryMethod("pickup")}
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      border: "2px solid",
                      borderColor: deliveryMethod === "pickup" ? "var(--accent)" : "var(--border-color)",
                      background: deliveryMethod === "pickup" ? "var(--accent-light)" : "var(--bg-card)",
                      cursor: "pointer",
                      transition: "all 0.2s",
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

              {/* SECTION 3: RECIPIENT & SHIPPING DETAILS */}
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

              {/* SECTION 4: PAYMENT METHOD */}
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

              {/* SECTION 5: FINAL BREAKDOWN */}
              <div style={{ background: "var(--bg-secondary)", padding: 16, borderRadius: 12, border: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
                  <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "商品小計" : "Items Subtotal"}:</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
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

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: 12, justifyContent: "flex-end", marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setCheckoutModalOpen(false)}
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
      )}

      {/* ===================== MODAL: ORDER SUCCESS & TRACKING SHORTCUT ===================== */}
      {checkoutSuccessOrder && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 120, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-modal)", color: "var(--text-primary)", width: "100%", maxWidth: 520, borderRadius: 16, padding: 28, textAlign: "center", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-modal)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <h2 style={{ margin: "0 0 6px 0", fontSize: 22, fontWeight: 900 }}>
              {lang === "zh-TW" ? "訂單建立成功！" : "Order Successfully Placed!"}
            </h2>
            <p style={{ color: "var(--text-secondary)", fontSize: 14, margin: "0 0 20px 0" }}>
              {lang === "zh-TW" ? "感謝您的訂購，我們已收到您的訂單並開始為您備貨。" : "Thank you for your purchase. We have received your order and started preparation."}
            </p>

            <div style={{ background: "var(--bg-secondary)", borderRadius: 12, padding: 16, textAlign: "left", marginBottom: 24, fontSize: 13, border: "1px solid var(--border-color)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "訂單編號" : "Order ID"}:</span>
                <strong>#{checkoutSuccessOrder.id}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "物流追蹤碼" : "Tracking Number"}:</span>
                <span style={{ fontFamily: "monospace", fontWeight: 700, color: "var(--accent)" }}>
                  {checkoutSuccessOrder.tracking_number}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "配送方式" : "Delivery Method"}:</span>
                <span>
                  {checkoutSuccessOrder.delivery_method === "express" ? "⚡ Express Courier" :
                   checkoutSuccessOrder.delivery_method === "pickup" ? "🏬 Store Pickup" : "🚚 Standard Courier"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: 8, fontSize: 15, fontWeight: 800 }}>
                <span>{lang === "zh-TW" ? "結帳總額" : "Total Paid"}:</span>
                <span style={{ color: "var(--accent)" }}>${checkoutSuccessOrder.total_amount.toFixed(2)}</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <button
                onClick={() => {
                  setCheckoutSuccessOrder(null);
                  setUserModalTab("orders");
                  setActiveTrackingOrderId(checkoutSuccessOrder.id);
                  loadMyOrders();
                  setUserModalOpen(true);
                }}
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "none",
                  background: "var(--accent)",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                🚚 {lang === "zh-TW" ? "即時追蹤此訂單" : "Track Order Live"}
              </button>
              <button
                onClick={() => setCheckoutSuccessOrder(null)}
                style={{
                  padding: "12px 18px",
                  borderRadius: 10,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  color: "var(--text-primary)",
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                {lang === "zh-TW" ? "繼續瀏覽" : "Continue Shopping"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================== MODAL: USER ACCOUNT, PROFILE & ORDER TRACKING ===================== */}
      {userModalOpen && (
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
            {/* Modal Header */}
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
              <button onClick={() => setUserModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Modal Tabs */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)" }}>
              <button
                onClick={() => setUserModalTab("orders")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  border: "none",
                  borderBottom: userModalTab === "orders" ? "2px solid var(--accent)" : "2px solid transparent",
                  background: userModalTab === "orders" ? "var(--bg-modal)" : "transparent",
                  color: userModalTab === "orders" ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                🚚 {lang === "zh-TW" ? "訂單歷史與物流追蹤" : "Order Tracking & History"} ({myOrders.length})
              </button>
              <button
                onClick={() => setUserModalTab("profile")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  border: "none",
                  borderBottom: userModalTab === "profile" ? "2px solid var(--accent)" : "2px solid transparent",
                  background: userModalTab === "profile" ? "var(--bg-modal)" : "transparent",
                  color: userModalTab === "profile" ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                ⚙️ {lang === "zh-TW" ? "個人資料修改" : "Personal Details"}
              </button>
              <button
                onClick={() => setUserModalTab("bought_items")}
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  border: "none",
                  borderBottom: userModalTab === "bought_items" ? "2px solid var(--accent)" : "2px solid transparent",
                  background: userModalTab === "bought_items" ? "var(--bg-modal)" : "transparent",
                  color: userModalTab === "bought_items" ? "var(--accent)" : "var(--text-secondary)",
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                📚 {lang === "zh-TW" ? "已購買書籍清單" : "Items Bought Shelf"} ({Object.keys(boughtItemsSummary).length})
              </button>
            </div>

            {/* Tab Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {/* TAB 1: ORDER TRACKING & HISTORY */}
              {userModalTab === "orders" && (
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
                            {/* Order Header */}
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

                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 18, fontWeight: 900, color: "var(--accent)" }}>
                                  ${ord.total_amount.toFixed(2)}
                                </div>
                                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                                  {ord.items.length} {lang === "zh-TW" ? "本書籍" : "items"}
                                </div>
                              </div>
                            </div>

                            {/* LIVE VISUAL TRACKER STEPPER */}
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
                                      {/* Connector Line between steps */}
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
                                            transition: "background 0.3s",
                                          }}
                                        />
                                      )}
                                      {/* Step Circle */}
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
                                      {/* Step Label */}
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

                            {/* Delivery & Shipping Info */}
                            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, fontSize: 12, marginBottom: 14 }}>
                              <div>
                                <span style={{ color: "var(--text-secondary)" }}>{lang === "zh-TW" ? "配送方式：" : "Method: "}</span>
                                <strong>
                                  {ord.delivery_method === "express" ? "⚡ Express Courier" :
                                   ord.delivery_method === "pickup" ? "🏬 Store Pickup" : "🚚 Standard Courier"}
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

                            {/* Purchased Items in this Order */}
                            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 10 }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {ord.items.map((item) => (
                                  <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      {item.product_image_url && (
                                        <img src={item.product_image_url} alt="" style={{ width: 24, height: 32, objectFit: "cover", borderRadius: 3 }} />
                                      )}
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

              {/* TAB 2: PERSONAL PROFILE SETTINGS */}
              {userModalTab === "profile" && (
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
                      {profileSaving ? (lang === "zh-TW" ? "儲存中..." : "Saving...") : (lang === "zh-TW" ? "儲存修改資料" : "Save Profile Changes")}
                    </button>
                  </form>
                </div>
              )}

              {/* TAB 3: BOUGHT ITEMS SHELF */}
              {userModalTab === "bought_items" && (
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
                            <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 13, marginTop: 2 }}>
                              ${b.unit_price.toFixed(2)}
                            </div>
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
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SYSTEM ACTIVITY MONITOR (S00_ LOGS) */}
      {logsOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", zIndex: 115, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "var(--bg-modal)", color: "var(--text-primary)", width: "100%", maxWidth: 960, maxHeight: "85vh", borderRadius: 16, display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-modal)" }}>
            <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 22 }}>📊</span>
                <h3 style={{ margin: 0, fontSize: 18 }}>System Monitor (PostgreSQL S00_ Logs)</h3>
              </div>
              <button onClick={() => setLogsOpen(false)} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 20, cursor: "pointer" }}>✕</button>
            </div>

            {/* Log Tabs & Test Error Button */}
            <div style={{ display: "flex", borderBottom: "1px solid var(--border-color)", background: "var(--bg-secondary)", alignItems: "center" }}>
              <button
                onClick={() => setLogsTab("activities")}
                style={{
                  flex: 1,
                  padding: 12,
                  background: logsTab === "activities" ? "var(--bg-modal)" : "transparent",
                  color: logsTab === "activities" ? "var(--accent)" : "var(--text-secondary)",
                  border: "none",
                  borderBottom: logsTab === "activities" ? "2px solid var(--accent)" : "none",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                User Activities ({activityLogs.length})
              </button>
              <button
                onClick={() => setLogsTab("logins")}
                style={{
                  flex: 1,
                  padding: 12,
                  background: logsTab === "logins" ? "var(--bg-modal)" : "transparent",
                  color: logsTab === "logins" ? "var(--accent)" : "var(--text-secondary)",
                  border: "none",
                  borderBottom: logsTab === "logins" ? "2px solid var(--accent)" : "none",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Logins ({loginLogs.length})
              </button>
              <button
                onClick={() => setLogsTab("errors")}
                style={{
                  flex: 1,
                  padding: 12,
                  background: logsTab === "errors" ? "var(--bg-modal)" : "transparent",
                  color: logsTab === "errors" ? "#ef4444" : "var(--text-secondary)",
                  border: "none",
                  borderBottom: logsTab === "errors" ? "2px solid #ef4444" : "none",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                🚨 Error Logs ({errorLogs.length})
              </button>
              <button
                onClick={triggerTestError}
                title="Trigger a deliberate 1/0 error to verify backend error logging"
                style={{
                  marginRight: 12,
                  padding: "6px 12px",
                  background: "#fee2e2",
                  color: "#b91c1c",
                  border: "1px solid #fecaca",
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                ⚡ Test Trigger Error
              </button>
            </div>

            {/* Log Content List */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20, fontSize: 13, fontFamily: "monospace" }}>
              {logsTab === "activities" ? (
                activityLogs.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>No activity logs recorded yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {activityLogs.map((log) => (
                      <div key={log.id} style={{ padding: 12, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontWeight: "bold" }}>
                          <span style={{ color: "var(--accent)" }}>[{log.action}]</span>
                          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ color: "var(--text-primary)" }}>
                          User ID: {log.user_id ?? "Guest"} • Entity: {log.entity_type || "N/A"} #{log.entity_id ?? ""}
                        </div>
                        {log.details && (
                          <div style={{ color: "var(--text-secondary)", marginTop: 4, wordBreak: "break-all" }}>
                            Details: {log.details}
                          </div>
                        )}
                        <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>
                          IP: {log.ip_address}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : logsTab === "logins" ? (
                loginLogs.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>No login logs recorded yet.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {loginLogs.map((log) => (
                      <div key={log.id} style={{ padding: 12, borderRadius: 8, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontWeight: "bold", color: log.status === "SUCCESS" ? "#16a34a" : "#dc2626" }}>
                            Status: {log.status}
                          </span>
                          <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{new Date(log.login_time).toLocaleString()}</span>
                        </div>
                        <div>User ID: {log.user_id} • IP: {log.ip_address}</div>
                        <div style={{ color: "var(--text-secondary)", fontSize: 11, marginTop: 4, wordBreak: "break-all" }}>
                          Agent: {log.user_agent}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                errorLogs.length === 0 ? (
                  <p style={{ color: "var(--text-secondary)", textAlign: "center" }}>No error logs recorded. Everything is healthy!</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {errorLogs.map((err) => (
                      <div key={err.id} style={{ padding: 14, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontWeight: "bold" }}>
                          <span style={{ background: "#dc2626", color: "white", padding: "2px 8px", borderRadius: 4, fontSize: 11 }}>
                            {err.error_type}
                          </span>
                          <span style={{ color: "#7f1d1d", fontSize: 11 }}>{new Date(err.created_at).toLocaleString()}</span>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: "bold", marginBottom: 4 }}>{err.error_message}</div>
                        <div style={{ fontSize: 12, color: "#b91c1c", marginBottom: 8 }}>
                          Endpoint: <strong>{err.http_method} {err.endpoint}</strong> • IP: {err.ip_address} • User ID: {err.user_id ?? "Guest"}
                        </div>
                        {err.stack_trace && (
                          <details style={{ background: "#ffffff", padding: 10, borderRadius: 6, border: "1px solid #fecaca", fontSize: 11, color: "#374151", overflowX: "auto" }}>
                            <summary style={{ cursor: "pointer", fontWeight: 700, color: "#991b1b" }}>View Full Python Stack Trace</summary>
                            <pre style={{ margin: "8px 0 0 0", whiteSpace: "pre-wrap" }}>{err.stack_trace}</pre>
                          </details>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXCEL BULK PRODUCT IMPORT (Restricted to Managers) */}
      {excelModalOpen && isManager && (
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
              <button onClick={() => setExcelModalOpen(false)} style={{ background: "none", border: "none", color: "var(--text-primary)", fontSize: 22, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ padding: 24, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Step 1: Download Template */}
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
                      onClick={handleDownloadTemplate}
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
                      onClick={handleDownloadWordTemplate}
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

              {/* Step 2: Upload File */}
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
                    {excelFile ? excelFile.name : (lang === "zh-TW" ? "點擊此處選擇 .xlsx, .xls 或 .docx 檔案" : "Click to select .xlsx, .xls or .docx file")}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                    {excelFile ? `${(excelFile.size / 1024).toFixed(1)} KB` : (lang === "zh-TW" ? "支援 Microsoft Excel (.xlsx/.xls) 與 Microsoft Word (.docx) 格式" : "Supports Microsoft Excel (.xlsx/.xls) and Microsoft Word (.docx) formats")}
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
                    <>⏳ {lang === "zh-TW" ? "正在解析 Excel 並寫入 PostgreSQL 資料庫..." : "Parsing & importing to PostgreSQL..."}</>
                  ) : (
                    <>🚀 {lang === "zh-TW" ? "開始執行批次匯入" : "Start Bulk Import"}</>
                  )}
                </button>
              </form>

              {/* Step 3: Result Summary Card */}
              {excelResult && (
                <div style={{ padding: 16, borderRadius: 12, background: "var(--bg-secondary)", border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ fontSize: 20 }}>{excelResult.success ? "✅" : "⚠️"}</span>
                    <strong style={{ fontSize: 16 }}>
                      {excelResult.success
                        ? (lang === "zh-TW" ? "匯入作業完成！" : "Import Completed Successfully!")
                        : (lang === "zh-TW" ? "匯入作業結束 (部分資料有誤)" : "Import finished with notices")}
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
                            <strong style={{ color: b.action === "INSERTED" ? "#059669" : "#2563eb", marginRight: 6 }}>
                              [{b.action}]
                            </strong>
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
      )}

      {/* FLOATING SUPPORT CHATBOX (BOTTOM-RIGHT) */}
      <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 90 }}>
        {chatOpen ? (
          <div
            style={{
              width: 350,
              height: 440,
              background: "var(--bg-card)",
              borderRadius: 16,
              boxShadow: "var(--shadow-modal)",
              border: "1px solid var(--border-color)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                background: "var(--accent)",
                color: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontWeight: "bold",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>📖</span> {t("chat_title")}
              </div>
              <button onClick={() => setChatOpen(false)} style={{ background: "none", border: "none", color: "white", fontSize: 18, cursor: "pointer" }}>✕</button>
            </div>

            <div style={{ flex: 1, padding: 14, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {chatMessages.map((m, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: m.sender === "user" ? "flex-end" : "flex-start",
                    background: m.sender === "user" ? "var(--accent)" : "var(--bg-secondary)",
                    color: m.sender === "user" ? "white" : "var(--text-primary)",
                    padding: "9px 13px",
                    borderRadius: 14,
                    fontSize: 13,
                    maxWidth: "82%",
                    lineHeight: 1.4,
                    whiteSpace: "pre-line",
                    border: m.sender === "user" ? "none" : "1px solid var(--border-color)",
                  }}
                >
                  {m.text}
                </div>
              ))}
              {chatLoading && (
                <div
                  style={{
                    alignSelf: "flex-start",
                    background: "var(--bg-secondary)",
                    color: "var(--text-secondary)",
                    padding: "8px 12px",
                    borderRadius: 14,
                    fontSize: 13,
                    fontStyle: "italic",
                    border: "1px solid var(--border-color)",
                  }}
                >
                  {lang === "zh-TW" ? "📚 助理正在查詢書店資料庫..." : "📚 Assistant is checking catalog..."}
                </div>
              )}
            </div>

            <form onSubmit={handleSendChat} style={{ display: "flex", borderTop: "1px solid var(--border-color)", padding: 10, background: "var(--bg-secondary)" }}>
              <input
                type="text"
                placeholder={t("chat_placeholder")}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                disabled={chatLoading}
                style={{
                  flex: 1,
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                  padding: "8px 10px",
                  fontSize: 13,
                  outline: "none",
                  background: "var(--bg-card)",
                  color: "var(--text-primary)",
                }}
              />
              <button
                type="submit"
                disabled={chatLoading}
                style={{
                  marginLeft: 8,
                  padding: "8px 14px",
                  background: chatLoading ? "var(--border-color)" : "var(--accent)",
                  color: "white",
                  border: "none",
                  borderRadius: 8,
                  cursor: chatLoading ? "not-allowed" : "pointer",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {t("chat_send")}
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={() => {
              setChatOpen(true);
              trackActivity("OPEN_CHATBOX", "CHAT", undefined, "User opened support chat");
            }}
            style={{
              width: 60,
              height: 60,
              borderRadius: "50%",
              background: "var(--accent)",
              color: "white",
              border: "none",
              boxShadow: "0 6px 16px rgba(234, 88, 12, 0.45)",
              fontSize: 26,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title={t("chat_title")}
          >
            💬
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Routes>
      {/* 1. Dedicated Manager Login Route */}
      <Route
        path="/admin/login"
        element={
          <AdminLogin
            onLoginSuccess={(tok, usr) => {
              localStorage.setItem("token", tok);
              setToken(tok);
              setUser(usr);
            }}
            lang={lang}
          />
        }
      />

      {/* 2. Dedicated Manager Portal Route */}
      <Route
        path="/admin"
        element={
          <AdminPortal
            user={user}
            token={token}
            onLogout={handleLogout}
            lang={lang}
            toggleLang={toggleLang}
            theme={theme}
            toggleTheme={toggleTheme}
          />
        }
      />

      {/* 3. Customer Storefront Route */}
      <Route
        path="*"
        element={!user ? CustomerSignInView : CustomerStorefrontView}
      />
    </Routes>
  );
}
