export interface NavigationMenuItem {
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

export interface User {
  id: number;
  email: string;
  role?: string;
  full_name?: string;
  phone?: string;
  address?: string;
}

export interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  product_title_en?: string;
  product_title_zh?: string;
  product_image_url?: string;
}

export interface Order {
  id: number;
  user_id: number;
  total_amount: number;
  shipping_fee: number;
  discount_amount?: number;
  coupon_code?: string;
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

export interface SiteSettings {
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

export interface Promotion {
  id: number;
  title_en: string;
  title_zh: string;
  badge_en: string;
  badge_zh: string;
  discount_code: string;
  image_url: string;
}

export interface Category {
  id: number;
  name_en: string;
  name_zh: string;
  icon: string;
  sort_order: number;
}

export interface ProdDetail {
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

export interface Product {
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

export interface Review {
  id: number;
  product_id: number;
  user_id: number;
  user_name?: string;
  rating: number;
  title?: string;
  comment?: string;
  is_verified_purchase: boolean;
  user_email?: string;
  created_at: string;
}

export interface ReviewSummary {
  average_rating: number;
  total_reviews: number;
  rating_distribution: { [key: number]: number };
  reviews?: Review[];
}

export interface WishlistItem {
  id: number;
  user_id?: number;
  product_id: number;
  title_en?: string;
  title_zh?: string;
  author_en?: string;
  price?: number;
  image_url?: string;
  isbn?: string | null;
  created_at: string;
  product?: Product;
}

export interface CouponValidationResult {
  valid: boolean;
  code: string;
  discount_type: "PERCENT" | "FIXED" | string;
  discount_value: number;
  discount_amount: number;
  description?: string;
  message: string;
}

export interface LoginLog {
  id: number;
  user_id: number;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  login_time: string;
}

export interface ActivityLog {
  id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface ErrorLog {
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

// Admin Portal Types
export interface OverviewData {
  manager_email: string;
  role: string;
  total_books: number;
  total_categories: number;
  total_users: number;
  total_orders: number;
}

export interface WarehouseOverview {
  total_units_on_hand: number;
  total_units_reserved: number;
  total_distinct_skus: number;
  condition_counts: {
    brand_new: number;
    minor_wear: number;
    damaged: number;
  };
  total_locations: number;
  total_warehouses: number;
  recent_adjustments_count: number;
}

export interface WarehouseFacility {
  id: number;
  code: string;
  name_en: string;
  name_zh: string;
  address_en?: string;
  address_zh?: string;
  is_active: boolean;
}

export interface WarehouseLocation {
  id: number;
  warehouse_id: number;
  warehouse_code?: string;
  warehouse_name_en?: string;
  warehouse_name_zh?: string;
  zone: string;
  zone_name_en: string;
  zone_name_zh: string;
  aisle: string;
  shelf: string;
  bin: string;
  location_code: string;
  category_hint?: string;
  is_active: boolean;
}

export interface InventoryItem {
  id: number;
  product_id: number;
  location_id: number;
  condition: string;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  last_counted_at?: string;
  updated_at: string;
  product_title_en: string;
  product_title_zh: string;
  product_author_en: string;
  isbn?: string;
  price: number;
  category_id: number;
  category_name_en: string;
  category_name_zh: string;
  image_url?: string;
  location_code: string;
  warehouse_id: number;
  warehouse_code: string;
  warehouse_name_en: string;
  warehouse_name_zh: string;
  zone: string;
  zone_name_en: string;
  zone_name_zh: string;
  aisle: string;
  shelf: string;
  bin: string;
}

export interface WarehouseAdjustment {
  id: number;
  voucher_no: string;
  product_id: number;
  product_title_en: string;
  product_title_zh: string;
  isbn?: string;
  from_location_id?: number;
  from_location_code?: string;
  to_location_id?: number;
  to_location_code?: string;
  from_condition?: string;
  to_condition?: string;
  change_qty: number;
  reason_code: string;
  notes?: string;
  created_by_name: string;
  status: string;
  created_at: string;
}

export interface FulfillmentOrderItem {
  id: number;
  product_id: number;
  title_en: string;
  title_zh: string;
  isbn: string;
  quantity: number;
  unit_price: number;
  location_code: string;
  zone: string;
  aisle: string;
  shelf: string;
  bin: string;
  available_at_location: number;
}

export interface FulfillmentOrder {
  id: number;
  customer_id: number;
  customer_email: string;
  recipient_name: string;
  recipient_phone: string;
  shipping_address: string;
  delivery_method: string;
  payment_method: string;
  status: string;
  tracking_number: string;
  total_amount: number;
  shipping_fee: number;
  created_at: string;
  items: FulfillmentOrderItem[];
  total_items_count: number;
}

export interface PickListItem {
  product_id: number;
  title_en: string;
  title_zh: string;
  isbn: string;
  location_code: string;
  zone: string;
  aisle: string;
  shelf: string;
  bin: string;
  quantity_to_pick: number;
  order_ids: number[];
}

export interface PickListResponse {
  generated_at: string;
  total_orders_count: number;
  total_items_to_pick: number;
  pick_items: PickListItem[];
}

export interface LowStockAlert {
  product_id: number;
  title_en: string;
  title_zh: string;
  isbn: string;
  category_name: string;
  total_on_hand: number;
  total_reserved: number;
  total_available: number;
  safety_stock: number;
  reorder_quantity: number;
  cost_price: number;
  retail_price: number;
  urgency: "CRITICAL" | "LOW" | "NORMAL";
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  lead_time_days: number;
  is_active: boolean;
  created_at: string;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_id: number;
  supplier_name: string;
  status: "ORDERED" | "RECEIVED" | "CANCELLED";
  total_cost: number;
  notes: string | null;
  created_by_name: string;
  ordered_at: string;
  received_at: string | null;
  created_at: string;
  items: {
    id: number;
    product_id: number;
    product_title_en: string;
    product_title_zh: string;
    isbn: string;
    quantity_ordered: number;
    quantity_received: number;
    unit_cost: number;
  }[];
}

export interface CategorySalesBreakdown {
  category_id: number;
  category_name: string;
  total_units_sold: number;
  gross_revenue: number;
  gross_profit: number;
  margin_percent: number;
}

export interface FinancialAnalyticsData {
  total_gross_revenue: number;
  total_cogs: number;
  total_gross_profit: number;
  gross_margin_percent: number;
  total_orders_count: number;
  average_order_value: number;
  category_breakdown: CategorySalesBreakdown[];
}

export interface DeadStockItem {
  product_id: number;
  title_en: string;
  title_zh: string;
  isbn?: string | null;
  category_name: string;
  days_since_last_sale: number;
  total_on_hand: number;
  unit_cost: number;
  capital_tied_up: number;
  recommendation: string;
}

export interface BarcodeScannerLookupResult {
  scanned_code: string;
  entity_type: "LOCATION" | "PRODUCT" | "UNKNOWN";
  location_details?: any | null;
  product_details?: any | null;
}
