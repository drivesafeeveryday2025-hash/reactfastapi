from datetime import datetime
from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    id: int
    email: str

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


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


class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int


class OrderCreate(BaseModel):
    items: list[OrderItemCreate]


class OrderItemOut(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price: float

    model_config = {"from_attributes": True}


class OrderOut(BaseModel):
    id: int
    user_id: int
    total_amount: float
    status: str
    created_at: datetime
    items: list[OrderItemOut] = []

    model_config = {"from_attributes": True}
