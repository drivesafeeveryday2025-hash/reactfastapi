from datetime import datetime, timezone
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


# ===================== S00_ SYSTEM & USER TABLES =====================

class S00_Role(Base):
    __tablename__ = "S00_roles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, default="customer")


class S00_User(Base):
    __tablename__ = "S00_users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    orders: Mapped[list["C00_Order"]] = relationship(back_populates="user")
    login_logs: Mapped[list["S00_LoginLog"]] = relationship(back_populates="user")
    activities: Mapped[list["S00_ActivityLog"]] = relationship(back_populates="user")


class S00_LoginLog(Base):
    __tablename__ = "S00_login_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("S00_users.id"), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="SUCCESS")  # SUCCESS, FAILED
    login_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    user: Mapped["S00_User"] = relationship(back_populates="login_logs")


class S00_ActivityLog(Base):
    __tablename__ = "S00_activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("S00_users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(100), index=True)  # VIEW_BOOK, ADD_TO_CART, PLACE_ORDER, FILTER_GENRE, CHAT_QUERY
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)  # BOOK, CATEGORY, ORDER, CHAT
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON or text payload
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    user: Mapped["S00_User"] = relationship(back_populates="activities")


class S00_ErrorLog(Base):
    __tablename__ = "S00_error_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    error_type: Mapped[str] = mapped_column(String(100), index=True)
    error_message: Mapped[str] = mapped_column(Text)
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    endpoint: Mapped[str | None] = mapped_column(String(200), nullable=True)
    http_method: Mapped[str | None] = mapped_column(String(20), nullable=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("S00_users.id"), nullable=True, index=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )


# ===================== C00_ BOOKSTORE CONFIG & CATALOG =====================

class C00_SiteSetting(Base):
    __tablename__ = "C00_site_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_name_en: Mapped[str] = mapped_column(String(100), default="Apex Book Haven")
    store_name_zh: Mapped[str] = mapped_column(String(100), default="文萃讀坊 (Apex Books)")
    hero_title_en: Mapped[str] = mapped_column(String(255), default="Curated Stories & Wisdom for Curious Minds")
    hero_title_zh: Mapped[str] = mapped_column(String(255), default="為熱愛探索的心靈，精選世界好書與智慧")
    hero_subtitle_en: Mapped[str] = mapped_column(String(255), default="Discover award-winning literature, timeless classics, and tech masterpieces delivered directly to your doorstep.")
    hero_subtitle_zh: Mapped[str] = mapped_column(String(255), default="發掘得獎文學、經典著作與科技經典，為您的思緒開啟全新視野。")
    about_text_en: Mapped[str] = mapped_column(Text)
    about_text_zh: Mapped[str] = mapped_column(Text)
    address_en: Mapped[str] = mapped_column(String(255), default="88 Literature Blvd, Culture Square")
    address_zh: Mapped[str] = mapped_column(String(255), default="文化特區 文藝大道 88 號")
    phone: Mapped[str] = mapped_column(String(50), default="+886 2 2345-6789")
    email: Mapped[str] = mapped_column(String(100), default="service@apexbooks.com")
    opening_hours_en: Mapped[str] = mapped_column(String(100), default="Mon - Sun: 10:00 AM - 09:30 PM")
    opening_hours_zh: Mapped[str] = mapped_column(String(100), default="週一至週日：10:00 - 21:30")


class C00_Promotion(Base):
    __tablename__ = "C00_promotions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title_en: Mapped[str] = mapped_column(String(100))
    title_zh: Mapped[str] = mapped_column(String(100))
    badge_en: Mapped[str] = mapped_column(String(50))
    badge_zh: Mapped[str] = mapped_column(String(50))
    discount_code: Mapped[str] = mapped_column(String(50))
    image_url: Mapped[str] = mapped_column(String(500))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class C00_Category(Base):
    __tablename__ = "C00_categories"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name_en: Mapped[str] = mapped_column(String(100), unique=True)
    name_zh: Mapped[str] = mapped_column(String(100), unique=True)
    icon: Mapped[str] = mapped_column(String(50), default="📚")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    products: Mapped[list["C00_Product"]] = relationship(back_populates="category")


class C00_Product(Base):
    __tablename__ = "C00_products"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("C00_categories.id"))
    title_en: Mapped[str] = mapped_column(String(150), index=True)
    title_zh: Mapped[str] = mapped_column(String(150), index=True)
    author_en: Mapped[str] = mapped_column(String(100))
    author_zh: Mapped[str] = mapped_column(String(100))
    short_desc_en: Mapped[str] = mapped_column(String(300))
    short_desc_zh: Mapped[str] = mapped_column(String(300))
    price: Mapped[float] = mapped_column(Float)
    image_url: Mapped[str] = mapped_column(String(500))
    is_recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped["C00_Category"] = relationship(back_populates="products")
    detail: Mapped["C00_ProdDetail"] = relationship(
        back_populates="product", uselist=False, cascade="all, delete-orphan"
    )


class C00_ProdDetail(Base):
    __tablename__ = "C00_prod_details"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("C00_products.id"), unique=True)
    full_synopsis_en: Mapped[str] = mapped_column(Text)
    full_synopsis_zh: Mapped[str] = mapped_column(Text)
    publisher_en: Mapped[str] = mapped_column(String(100))
    publisher_zh: Mapped[str] = mapped_column(String(100))
    isbn: Mapped[str] = mapped_column(String(50))
    publication_year: Mapped[int] = mapped_column(Integer)
    page_count: Mapped[int] = mapped_column(Integer)
    format_en: Mapped[str] = mapped_column(String(50), default="Paperback")
    format_zh: Mapped[str] = mapped_column(String(50), default="平裝版")

    product: Mapped["C00_Product"] = relationship(back_populates="detail")


class C00_Order(Base):
    __tablename__ = "C00_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("S00_users.id"))
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="confirmed")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["S00_User"] = relationship(back_populates="orders")
    items: Mapped[list["C00_OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class C00_OrderItem(Base):
    __tablename__ = "C00_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("C00_orders.id"))
    product_id: Mapped[int] = mapped_column(ForeignKey("C00_products.id"))
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    unit_price: Mapped[float] = mapped_column(Float)

    order: Mapped["C00_Order"] = relationship(back_populates="items")
    product: Mapped["C00_Product"] = relationship()
