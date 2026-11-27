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
    role: Mapped[str] = mapped_column(String(50), default="customer")
    full_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    orders: Mapped[list["C00_Order"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    login_logs: Mapped[list["S00_LoginLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    activities: Mapped[list["S00_ActivityLog"]] = relationship(back_populates="user", cascade="all, delete-orphan")


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


class S00_ChatRateLimit(Base):
    __tablename__ = "S00_chat_rate_limits"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("S00_users.id"), index=True)
    ip_address: Mapped[str | None] = mapped_column(String(50), nullable=True)
    message_count_minute: Mapped[int] = mapped_column(Integer, default=1)
    message_count_day: Mapped[int] = mapped_column(Integer, default=1)
    window_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    day_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False)


class S00_LoginAttempt(Base):
    __tablename__ = "S00_login_attempts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    ip_address: Mapped[str] = mapped_column(String(50), index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    attempt_time: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )
    is_successful: Mapped[bool] = mapped_column(Boolean, default=False)
    user_agent: Mapped[str | None] = mapped_column(String(300), nullable=True)


class S00_PasswordReset(Base):
    __tablename__ = "S00_password_resets"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("S00_users.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    token: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["S00_User"] = relationship()



# ===================== C00_ BOOKSTORE CONFIG & CATALOG =====================

class C00_KnowledgeBase(Base):
    __tablename__ = "C00_knowledge_base"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    topic: Mapped[str] = mapped_column(String(100), index=True)  # refund, shipping, gift_wrap, member_perks, tech_support, payment
    question_en: Mapped[str] = mapped_column(String(255))
    question_zh: Mapped[str] = mapped_column(String(255))
    answer_en: Mapped[Text] = mapped_column(Text)
    answer_zh: Mapped[Text] = mapped_column(Text)
    keywords: Mapped[str] = mapped_column(String(300), index=True)  # search tags
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


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
    cost_price: Mapped[float] = mapped_column(Float, default=0.0)
    safety_stock: Mapped[int] = mapped_column(Integer, default=15)
    reorder_quantity: Mapped[int] = mapped_column(Integer, default=50)
    image_url: Mapped[str] = mapped_column(String(500))
    is_recommended: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    category: Mapped["C00_Category"] = relationship(back_populates="products")
    detail: Mapped["C00_ProdDetail"] = relationship(
        back_populates="product", uselist=False, cascade="all, delete-orphan"
    )
    reviews: Mapped[list["C00_Review"]] = relationship(back_populates="product", cascade="all, delete-orphan")


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
    shipping_fee: Mapped[float] = mapped_column(Float, default=0.0)
    status: Mapped[str] = mapped_column(String(50), default="Processing")  # Processing, Confirmed, Shipped, Out for Delivery, Delivered
    delivery_method: Mapped[str] = mapped_column(String(50), default="standard")  # standard, express, pickup
    payment_method: Mapped[str] = mapped_column(String(50), default="credit_card")  # credit_card, apple_pay, cod, bank_transfer
    recipient_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    recipient_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    shipping_address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    delivery_notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    tracking_number: Mapped[str | None] = mapped_column(String(100), nullable=True)
    estimated_delivery: Mapped[str | None] = mapped_column(String(100), nullable=True)
    coupon_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
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


class C00_Review(Base):
    __tablename__ = "C00_reviews"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("C00_products.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("S00_users.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    title: Mapped[str | None] = mapped_column(String(150), nullable=True)
    comment: Mapped[str] = mapped_column(Text)
    is_verified_purchase: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    product: Mapped["C00_Product"] = relationship(back_populates="reviews")
    user: Mapped["S00_User"] = relationship()


class C00_Wishlist(Base):
    __tablename__ = "C00_wishlists"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("S00_users.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("C00_products.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    user: Mapped["S00_User"] = relationship()
    product: Mapped["C00_Product"] = relationship()


class C00_Coupon(Base):
    __tablename__ = "C00_coupons"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    discount_type: Mapped[str] = mapped_column(String(20), default="PERCENT")  # PERCENT or FIXED
    discount_value: Mapped[float] = mapped_column(Float)
    min_spend: Mapped[float] = mapped_column(Float, default=0.0)
    max_discount: Mapped[float | None] = mapped_column(Float, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    usage_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class C00_NavigationMenu(Base):
    __tablename__ = "C00_navigation_menus"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("C00_navigation_menus.id", ondelete="CASCADE"), nullable=True, index=True
    )
    title_en: Mapped[str] = mapped_column(String(100))
    title_zh: Mapped[str] = mapped_column(String(100))
    url: Mapped[str] = mapped_column(String(250))
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)
    badge_en: Mapped[str | None] = mapped_column(String(50), nullable=True)
    badge_zh: Mapped[str | None] = mapped_column(String(50), nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    requires_auth: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_role: Mapped[str | None] = mapped_column(String(50), nullable=True)

    parent: Mapped["C00_NavigationMenu | None"] = relationship(
        "C00_NavigationMenu", back_populates="children", remote_side=[id]
    )
    children: Mapped[list["C00_NavigationMenu"]] = relationship(
        "C00_NavigationMenu", back_populates="parent", cascade="all, delete-orphan", order_by="C00_NavigationMenu.sort_order"
    )


# ===================== W00_ WAREHOUSE & INVENTORY MANAGEMENT =====================

class W00_Warehouse(Base):
    __tablename__ = "W00_warehouses"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name_en: Mapped[str] = mapped_column(String(100))
    name_zh: Mapped[str] = mapped_column(String(100))
    address_en: Mapped[str | None] = mapped_column(String(255), nullable=True)
    address_zh: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    locations: Mapped[list["W00_Location"]] = relationship(back_populates="warehouse", cascade="all, delete-orphan")


class W00_Location(Base):
    __tablename__ = "W00_locations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("W00_warehouses.id", ondelete="CASCADE"), index=True)
    zone: Mapped[str] = mapped_column(String(50), index=True)
    zone_name_en: Mapped[str] = mapped_column(String(100))
    zone_name_zh: Mapped[str] = mapped_column(String(100))
    aisle: Mapped[str] = mapped_column(String(20))
    shelf: Mapped[str] = mapped_column(String(20))
    bin: Mapped[str] = mapped_column(String(20))
    location_code: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    category_hint: Mapped[str | None] = mapped_column(String(100), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    warehouse: Mapped["W00_Warehouse"] = relationship(back_populates="locations")
    inventories: Mapped[list["W00_Inventory"]] = relationship(back_populates="location", cascade="all, delete-orphan")


class W00_Inventory(Base):
    __tablename__ = "W00_inventory"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("C00_products.id", ondelete="CASCADE"), index=True)
    location_id: Mapped[int] = mapped_column(ForeignKey("W00_locations.id", ondelete="CASCADE"), index=True)
    condition: Mapped[str] = mapped_column(String(50), default="brand_new", index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    reserved_quantity: Mapped[int] = mapped_column(Integer, default=0)
    last_counted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    product: Mapped["C00_Product"] = relationship()
    location: Mapped["W00_Location"] = relationship(back_populates="inventories")


class W00_Adjustment(Base):
    __tablename__ = "W00_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    voucher_no: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("C00_products.id", ondelete="CASCADE"), index=True)
    from_location_id: Mapped[int | None] = mapped_column(ForeignKey("W00_locations.id", ondelete="SET NULL"), nullable=True)
    to_location_id: Mapped[int | None] = mapped_column(ForeignKey("W00_locations.id", ondelete="SET NULL"), nullable=True)
    from_condition: Mapped[str | None] = mapped_column(String(50), nullable=True)
    to_condition: Mapped[str | None] = mapped_column(String(50), nullable=True)
    change_qty: Mapped[int] = mapped_column(Integer, default=0)
    reason_code: Mapped[str] = mapped_column(String(50))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("S00_users.id", ondelete="SET NULL"), nullable=True)
    created_by_name: Mapped[str] = mapped_column(String(100), default="Warehouse Manager")
    status: Mapped[str] = mapped_column(String(30), default="APPROVED")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    product: Mapped["C00_Product"] = relationship()
    from_location: Mapped["W00_Location | None"] = relationship("W00_Location", foreign_keys=[from_location_id])
    to_location: Mapped["W00_Location | None"] = relationship("W00_Location", foreign_keys=[to_location_id])
    user: Mapped["S00_User | None"] = relationship("S00_User", foreign_keys=[created_by_user_id])


class W00_Supplier(Base):
    __tablename__ = "W00_suppliers"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True, index=True)
    contact_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    email: Mapped[str | None] = mapped_column(String(150), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    lead_time_days: Mapped[int] = mapped_column(Integer, default=5)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    purchase_orders: Mapped[list["W00_PurchaseOrder"]] = relationship(back_populates="supplier")


class W00_PurchaseOrder(Base):
    __tablename__ = "W00_purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    po_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("W00_suppliers.id"), index=True)
    status: Mapped[str] = mapped_column(String(30), default="ORDERED", index=True)  # DRAFT, ORDERED, RECEIVED, CANCELLED
    total_cost: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("S00_users.id", ondelete="SET NULL"), nullable=True)
    created_by_name: Mapped[str] = mapped_column(String(100), default="Warehouse Manager")
    ordered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True
    )

    supplier: Mapped["W00_Supplier"] = relationship(back_populates="purchase_orders")
    items: Mapped[list["W00_PurchaseOrderItem"]] = relationship(back_populates="purchase_order", cascade="all, delete-orphan")


class W00_PurchaseOrderItem(Base):
    __tablename__ = "W00_purchase_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    po_id: Mapped[int] = mapped_column(ForeignKey("W00_purchase_orders.id", ondelete="CASCADE"), index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("C00_products.id"), index=True)
    quantity_ordered: Mapped[int] = mapped_column(Integer)
    quantity_received: Mapped[int] = mapped_column(Integer, default=0)
    unit_cost: Mapped[float] = mapped_column(Float)

    purchase_order: Mapped["W00_PurchaseOrder"] = relationship(back_populates="items")
    product: Mapped["C00_Product"] = relationship()


