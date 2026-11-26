from datetime import datetime
from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str
    role: str = "customer"
    full_name: str | None = None
    phone: str | None = None
    address: str | None = None

    model_config = {"from_attributes": True}


class UserProfileUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    address: str | None = None


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str = "customer"


# ===================== S00_ PASSWORD RESET & SECURITY SCHEMAS =====================

class ForgotPasswordRequest(BaseModel):
    email: str


class ForgotPasswordResponse(BaseModel):
    success: bool
    message: str
    dev_reset_link: str | None = None


class VerifyResetTokenResponse(BaseModel):
    valid: bool
    email: str | None = None
    message: str | None = None


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


class ResetPasswordResponse(BaseModel):
    success: bool
    message: str



# ===================== S00_ SYSTEM LOG SCHEMAS =====================

class LoginLogOut(BaseModel):
    id: int
    user_id: int
    ip_address: str | None = None
    user_agent: str | None = None
    status: str
    login_time: datetime

    model_config = {"from_attributes": True}


class ActivityLogCreate(BaseModel):
    action: str  # e.g. VIEW_BOOK, ADD_TO_CART, FILTER_GENRE, OPEN_CHAT, SEARCH
    entity_type: str | None = None  # BOOK, CATEGORY, ORDER, CHAT
    entity_id: int | None = None
    details: str | None = None  # JSON string or description


class ActivityLogOut(BaseModel):
    id: int
    user_id: int | None = None
    action: str
    entity_type: str | None = None
    entity_id: int | None = None
    details: str | None = None
    ip_address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ErrorLogOut(BaseModel):
    id: int
    error_type: str
    error_message: str
    stack_trace: str | None = None
    endpoint: str | None = None
    http_method: str | None = None
    user_id: int | None = None
    ip_address: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ===================== C00_ BOOKSTORE CATALOG SCHEMAS =====================

class ProdDetailOut(BaseModel):
    id: int
    full_synopsis_en: str
    full_synopsis_zh: str
    publisher_en: str
    publisher_zh: str
    isbn: str
    publication_year: int
    page_count: int
    format_en: str
    format_zh: str

    model_config = {"from_attributes": True}


class ProductOut(BaseModel):
    id: int
    category_id: int
    title_en: str
    title_zh: str
    author_en: str
    author_zh: str
    short_desc_en: str
    short_desc_zh: str
    price: float
    image_url: str
    is_recommended: bool
    detail: ProdDetailOut | None = None

    model_config = {"from_attributes": True}


class CategoryOut(BaseModel):
    id: int
    name_en: str
    name_zh: str
    icon: str
    sort_order: int

    model_config = {"from_attributes": True}


class PromotionOut(BaseModel):
    id: int
    title_en: str
    title_zh: str
    badge_en: str
    badge_zh: str
    discount_code: str
    image_url: str

    model_config = {"from_attributes": True}


class SiteSettingOut(BaseModel):
    store_name_en: str
    store_name_zh: str
    hero_title_en: str
    hero_title_zh: str
    hero_subtitle_en: str
    hero_subtitle_zh: str
    about_text_en: str
    about_text_zh: str
    address_en: str
    address_zh: str
    phone: str
    email: str
    opening_hours_en: str
    opening_hours_zh: str

    model_config = {"from_attributes": True}


class NavigationMenuItemOut(BaseModel):
    id: int
    parent_id: int | None = None
    title_en: str
    title_zh: str
    url: str
    icon: str | None = None
    badge_en: str | None = None
    badge_zh: str | None = None
    sort_order: int = 0
    is_active: bool = True
    requires_auth: bool = False
    requires_role: str | None = None
    children: list["NavigationMenuItemOut"] = []

    model_config = {"from_attributes": True}


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int


class OrderCreate(BaseModel):
    items: list[OrderItemCreate]
    delivery_method: str = "standard"  # standard, express, pickup
    payment_method: str = "credit_card"  # credit_card, apple_pay, cod, bank_transfer
    recipient_name: str | None = None
    recipient_phone: str | None = None
    shipping_address: str | None = None
    delivery_notes: str | None = None


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float
    product_title_en: str | None = None
    product_title_zh: str | None = None
    product_image_url: str | None = None

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    user_id: int
    total_amount: float
    shipping_fee: float = 0.0
    status: str
    delivery_method: str = "standard"
    payment_method: str = "credit_card"
    recipient_name: str | None = None
    recipient_phone: str | None = None
    shipping_address: str | None = None
    delivery_notes: str | None = None
    tracking_number: str | None = None
    estimated_delivery: str | None = None
    created_at: datetime
    items: list[OrderItemOut] = []

    model_config = {"from_attributes": True}


class OrderStatusUpdate(BaseModel):
    status: str
    tracking_number: str | None = None
    estimated_delivery: str | None = None


# ===================== CHATBOT & KNOWLEDGE SCHEMAS =====================

class ChatRequest(BaseModel):
    message: str


class ChatResponse(BaseModel):
    reply: str
    intent: str
    sources: list[str] = []


class KnowledgeBaseOut(BaseModel):
    id: int
    topic: str
    question_en: str
    question_zh: str
    answer_en: str
    answer_zh: str
    keywords: str

    model_config = {"from_attributes": True}


# ===================== EXCEL IMPORT SCHEMAS =====================

class ExcelImportRowError(BaseModel):
    row: int
    title: str | None = None
    isbn: str | None = None
    reason: str


class ExcelImportBookSummary(BaseModel):
    id: int
    title_en: str
    title_zh: str
    author_en: str
    price: float
    isbn: str | None = None
    action: str  # INSERTED or UPDATED


class ExcelImportResult(BaseModel):
    success: bool
    filename: str
    total_rows: int
    inserted: int
    updated: int
    failed: int
    errors: list[ExcelImportRowError] = []
    imported_books: list[ExcelImportBookSummary] = []


# ===================== W00_ WAREHOUSE & INVENTORY SCHEMAS =====================

class WarehouseOut(BaseModel):
    id: int
    code: str
    name_en: str
    name_zh: str
    address_en: str | None = None
    address_zh: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class WarehouseLocationOut(BaseModel):
    id: int
    warehouse_id: int
    warehouse_code: str | None = None
    warehouse_name_en: str | None = None
    warehouse_name_zh: str | None = None
    zone: str
    zone_name_en: str
    zone_name_zh: str
    aisle: str
    shelf: str
    bin: str
    location_code: str
    category_hint: str | None = None
    is_active: bool

    model_config = {"from_attributes": True}


class InventoryItemOut(BaseModel):
    id: int
    product_id: int
    location_id: int
    condition: str  # brand_new, minor_wear, damaged
    quantity: int
    reserved_quantity: int
    available_quantity: int
    last_counted_at: datetime | None = None
    updated_at: datetime

    # Product details
    product_title_en: str
    product_title_zh: str
    product_author_en: str
    isbn: str | None = None
    price: float
    category_id: int
    category_name_en: str
    category_name_zh: str
    image_url: str | None = None

    # Location details
    location_code: str
    warehouse_id: int
    warehouse_code: str
    warehouse_name_en: str
    warehouse_name_zh: str
    zone: str
    zone_name_en: str
    zone_name_zh: str
    aisle: str
    shelf: str
    bin: str


class WarehouseOverviewOut(BaseModel):
    total_units_on_hand: int
    total_units_reserved: int
    total_distinct_skus: int
    condition_counts: dict[str, int]
    total_locations: int
    total_warehouses: int
    recent_adjustments_count: int


class AdjustmentCreate(BaseModel):
    product_id: int
    change_qty: int = 0
    reason_code: str  # COUNT_DISCREPANCY, DAMAGE_FOUND, RELOCATION, RESTOCK_RECEIVING, CONDITION_RECLASSIFY, EXPIRED_SCRAP
    notes: str | None = None
    from_location_id: int | None = None
    to_location_id: int | None = None
    from_condition: str | None = None
    to_condition: str | None = None
    created_by_name: str | None = "Warehouse Manager"


class AdjustmentOut(BaseModel):
    id: int
    voucher_no: str
    product_id: int
    product_title_en: str
    product_title_zh: str
    isbn: str | None = None
    from_location_id: int | None = None
    from_location_code: str | None = None
    to_location_id: int | None = None
    to_location_code: str | None = None
    from_condition: str | None = None
    to_condition: str | None = None
    change_qty: int
    reason_code: str
    notes: str | None = None
    created_by_name: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StocktakeFilterRequest(BaseModel):
    warehouse_id: int | None = None
    zone: str | None = None
    product_ids: list[int] | None = None
    condition: str | None = None


# ===================== FULFILLMENT & PROCUREMENT SCHEMAS =====================

class FulfillmentAdvanceRequest(BaseModel):
    status: str  # Processing -> Confirmed -> Picking -> Packed -> Shipped -> Delivered
    tracking_number: str | None = None
    notes: str | None = None


class PickListItem(BaseModel):
    product_id: int
    title_en: str
    title_zh: str
    isbn: str | None = None
    location_code: str
    zone: str
    aisle: str
    shelf: str
    bin: str
    quantity_to_pick: int
    order_ids: list[int]


class PickListResponse(BaseModel):
    generated_at: str
    total_orders_count: int
    total_items_to_pick: int
    pick_items: list[PickListItem]


class LowStockAlertOut(BaseModel):
    product_id: int
    title_en: str
    title_zh: str
    isbn: str | None = None
    category_name: str | None = None
    total_on_hand: int
    total_reserved: int
    total_available: int
    safety_stock: int
    reorder_quantity: int
    cost_price: float
    retail_price: float
    urgency: str  # CRITICAL (available <= 0), LOW (available <= safety_stock), NORMAL


class SupplierCreate(BaseModel):
    name: str
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    lead_time_days: int = 5


class SupplierOut(BaseModel):
    id: int
    name: str
    contact_name: str | None = None
    email: str | None = None
    phone: str | None = None
    lead_time_days: int
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class PurchaseOrderItemCreate(BaseModel):
    product_id: int
    quantity: int
    unit_cost: float | None = None


class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    notes: str | None = None
    items: list[PurchaseOrderItemCreate]


class PurchaseOrderItemOut(BaseModel):
    id: int
    product_id: int
    product_title_en: str
    product_title_zh: str
    isbn: str | None = None
    quantity_ordered: int
    quantity_received: int
    unit_cost: float


class PurchaseOrderOut(BaseModel):
    id: int
    po_number: str
    supplier_id: int
    supplier_name: str
    status: str
    total_cost: float
    notes: str | None = None
    created_by_name: str
    ordered_at: datetime
    received_at: datetime | None = None
    created_at: datetime
    items: list[PurchaseOrderItemOut]


class PurchaseOrderReceiveRequest(BaseModel):
    target_location_id: int
    condition: str = "brand_new"
    notes: str | None = None



