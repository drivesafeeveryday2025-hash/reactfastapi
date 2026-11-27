import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useCart } from "../../contexts/CartContext";
import { useLanguage } from "../../contexts/LanguageContext";
import type { NavigationMenuItem, SiteSettings } from "../../types";
import ControlButtons from "./ControlButtons";

interface NavbarProps {
  settings: SiteSettings | null;
  navMenus: NavigationMenuItem[];
  ordersCount: number;
  onOpenUserModal: (tab: "orders" | "profile" | "bought_items" | "wishlist") => void;
  onOpenChat: () => void;
  onOpenLogs: () => void;
  onOpenImport: () => void;
}

export default function Navbar({
  settings,
  navMenus,
  ordersCount,
  onOpenUserModal,
  onOpenChat,
  onOpenLogs,
  onOpenImport,
}: NavbarProps) {
  const { token, user, isManager, logout } = useAuth();
  const { totalCartCount, setCartOpen, wishlistItems, loadWishlist, clearShoppingSession } = useCart();
  const { lang, t, localize } = useLanguage();
  const navigate = useNavigate();

  const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);

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
        onOpenUserModal("orders");
      } else if (action === "profile") {
        onOpenUserModal("profile");
      } else if (action === "bought_items") {
        onOpenUserModal("bought_items");
      } else if (action === "wishlist") {
        loadWishlist();
        onOpenUserModal("wishlist");
      } else if (action === "chat") {
        onOpenChat();
      } else if (action === "logs") {
        onOpenLogs();
      } else if (action === "import") {
        onOpenImport();
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

  return (
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

      {/* Database-Driven Hierarchical Navigation */}
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
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{localize(child, "title")}</span>
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
        <ControlButtons />

        <button
          onClick={() => {
            if (!token) {
              alert(lang === "zh-TW" ? "請先登入以使用願望清單功能。" : "Please log in to manage your wishlist.");
              return;
            }
            loadWishlist();
            onOpenUserModal("wishlist");
          }}
          title={lang === "zh-TW" ? "願望清單" : "Saved Wishlist"}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            padding: "7px 14px",
            borderRadius: 20,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          <span>💖</span>
          <span>{lang === "zh-TW" ? "願望清單" : "Wishlist"}</span>
          {wishlistItems.length > 0 && (
            <span
              style={{
                background: "#ec4899",
                color: "white",
                borderRadius: 10,
                padding: "1px 6px",
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {wishlistItems.length}
            </span>
          )}
        </button>

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

        <button
          onClick={() => onOpenUserModal("orders")}
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
          {ordersCount > 0 && (
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
              {ordersCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            clearShoppingSession();
            logout();
          }}
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
  );
}
