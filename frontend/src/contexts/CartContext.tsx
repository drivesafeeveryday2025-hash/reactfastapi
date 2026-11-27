import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { API_URL } from "../services/api";
import type { CouponValidationResult, Product, WishlistItem } from "../types";
import { useAuth } from "./AuthContext";
import { useLanguage } from "./LanguageContext";

interface CartContextValue {
  cart: { [productId: number]: number };
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  addToCart: (id: number) => void;
  updateCartQty: (id: number, delta: number) => void;
  clearCart: () => void;
  registerBooks: (books: Product[]) => void;
  allKnownBooks: { [id: number]: Product };
  cartItems: { book: Product; quantity: number }[];
  cartTotal: number;
  totalCartCount: number;
  // Wishlist
  wishlistItems: WishlistItem[];
  wishlistIds: Set<number>;
  loadWishlist: () => Promise<void>;
  toggleWishlist: (productId: number) => Promise<void>;
  // Promo Coupons
  couponCodeInput: string;
  setCouponCodeInput: (val: string) => void;
  appliedCoupon: CouponValidationResult | null;
  setAppliedCoupon: (coupon: CouponValidationResult | null) => void;
  couponLoading: boolean;
  couponError: string | null;
  applyCoupon: (e?: FormEvent) => Promise<void>;
  clearShoppingSession: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { token, trackActivity } = useAuth();
  const { lang } = useLanguage();

  const [allKnownBooks, setAllKnownBooks] = useState<{ [id: number]: Product }>({});
  const [cart, setCart] = useState<{ [productId: number]: number }>({});
  const [cartOpen, setCartOpen] = useState(false);

  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [wishlistIds, setWishlistIds] = useState<Set<number>>(new Set());

  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  function registerBooks(books: Product[]) {
    if (!Array.isArray(books) || books.length === 0) return;
    setAllKnownBooks((prev) => {
      const next = { ...prev };
      for (const b of books) {
        next[b.id] = b;
      }
      return next;
    });
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

  function clearCart() {
    setCart({});
    setAppliedCoupon(null);
    setCouponCodeInput("");
    setCouponError(null);
  }

  function clearShoppingSession() {
    clearCart();
    setWishlistItems([]);
    setWishlistIds(new Set());
  }

  const cartItems = Object.entries(cart)
    .map(([idStr, qty]) => {
      const bId = Number(idStr);
      return { book: allKnownBooks[bId], quantity: qty };
    })
    .filter((item) => Boolean(item.book));

  const cartTotal = cartItems.reduce((sum, item) => sum + item.book.price * item.quantity, 0);
  const totalCartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  async function loadWishlist() {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/wishlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data: WishlistItem[] = await res.json();
        setWishlistItems(data);
        setWishlistIds(new Set(data.map((i) => i.product_id)));
      }
    } catch (err) {
      console.error("Failed to load wishlist", err);
    }
  }

  async function toggleWishlist(productId: number) {
    if (!token) {
      alert(lang === "zh-TW" ? "請先登入以使用願望清單功能。" : "Please log in to manage your wishlist.");
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/wishlist/toggle/${productId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const isNowWishlisted = Boolean(data.wishlisted ?? data.in_wishlist);
        setWishlistIds((prev) => {
          const next = new Set(prev);
          if (isNowWishlisted) next.add(productId);
          else next.delete(productId);
          return next;
        });
        loadWishlist();
      }
    } catch (err) {
      console.error("Failed to toggle wishlist", err);
    }
  }

  async function applyCoupon(e?: FormEvent) {
    if (e) e.preventDefault();
    const code = couponCodeInput.trim().toUpperCase();
    if (!code) return;
    setCouponLoading(true);
    setCouponError(null);
    try {
      const res = await fetch(`${API_URL}/api/coupons/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          cart_subtotal: cartTotal,
        }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon(data);
        setCouponError(null);
      } else {
        setCouponError(data.message || (lang === "zh-TW" ? "無效的優惠券代碼" : "Invalid coupon code"));
        setAppliedCoupon(null);
      }
    } catch {
      setCouponError(lang === "zh-TW" ? "優惠碼驗證失敗，請檢查網路連線" : "Failed to validate coupon code.");
    } finally {
      setCouponLoading(false);
    }
  }

  useEffect(() => {
    if (token) {
      loadWishlist();
    } else {
      setWishlistItems([]);
      setWishlistIds(new Set());
    }
  }, [token]);

  return (
    <CartContext.Provider
      value={{
        cart,
        cartOpen,
        setCartOpen,
        addToCart,
        updateCartQty,
        clearCart,
        registerBooks,
        allKnownBooks,
        cartItems,
        cartTotal,
        totalCartCount,
        wishlistItems,
        wishlistIds,
        loadWishlist,
        toggleWishlist,
        couponCodeInput,
        setCouponCodeInput,
        appliedCoupon,
        setAppliedCoupon,
        couponLoading,
        couponError,
        applyCoupon,
        clearShoppingSession,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
