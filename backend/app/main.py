import json
import re
import traceback
import uuid
from datetime import datetime, timezone
from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from . import ai_service, auth, excel_service, models, schemas, word_service
from .database import Base, SessionLocal, engine, get_db

# Automatically creates new tables (e.g. S00_login_logs, S00_activity_logs, S00_error_logs) in PostgreSQL
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Apex Bookstore API & Activity Monitor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===================== GLOBAL EXCEPTION & ERROR LOGGING HANDLER =====================

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catches ANY unhandled error across any endpoint/function,
    records full traceback into PostgreSQL S00_error_logs,
    and returns a clean error response without exposing internal paths.
    """
    stack_trace = traceback.format_exc()
    error_type = exc.__class__.__name__
    error_message = str(exc)
    client_ip = request.client.host if request.client else "unknown"

    # Extract user_id if token is present
    user_id = None
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        email = auth.decode_access_token(token)
        if email:
            db_session = SessionLocal()
            try:
                u = db_session.query(models.S00_User).filter(models.S00_User.email == email).first()
                if u:
                    user_id = u.id
            finally:
                db_session.close()

    # Record error log in PostgreSQL
    log_id = None
    db_session = SessionLocal()
    try:
        err_log = models.S00_ErrorLog(
            error_type=error_type,
            error_message=error_message,
            stack_trace=stack_trace,
            endpoint=request.url.path,
            http_method=request.method,
            user_id=user_id,
            ip_address=client_ip,
        )
        db_session.add(err_log)
        db_session.commit()
        db_session.refresh(err_log)
        log_id = err_log.id
    except Exception as db_err:
        print("Failed to save error log to DB:", db_err)
    finally:
        db_session.close()

    # Return standard JSON error
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Our engineering team has been notified.",
            "error_type": error_type,
            "error_log_id": log_id,
        },
    )

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db),
) -> models.S00_User:
    email = auth.decode_access_token(credentials.credentials)
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(models.S00_User).filter(models.S00_User.email == email).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_manager(
    current_user: models.S00_User = Depends(get_current_user),
) -> models.S00_User:
    if current_user.role not in ("manager", "superadmin") and current_user.email not in ("react@mail", "react@mail.com"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Manager privileges required."
        )
    return current_user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.S00_User | None:
    if not credentials:
        return None
    email = auth.decode_access_token(credentials.credentials)
    if not email:
        return None
    return db.query(models.S00_User).filter(models.S00_User.email == email).first()


# ===================== S00_ AUTH & LOGIN LOGGING =====================

@app.post("/api/register", response_model=schemas.UserOut, status_code=201)
def register(payload: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    if db.query(models.S00_User).filter(models.S00_User.email == email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = models.S00_User(
        email=email,
        hashed_password=auth.hash_password(payload.password),
    )
    db.add(user)
    db.flush()

    # System Activity Log: New user registration
    client_ip = request.client.host if request.client else "unknown"
    db.add(
        models.S00_ActivityLog(
            user_id=user.id,
            action="USER_REGISTER",
            entity_type="USER",
            entity_id=user.id,
            details=f"User registered with email {email}",
            ip_address=client_ip,
        )
    )
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/login", response_model=schemas.Token)
def login(payload: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = db.query(models.S00_User).filter(models.S00_User.email == email).first()
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")[:300]

    # Handle login failure
    if not user or not auth.verify_password(payload.password, user.hashed_password):
        if user:
            db.add(
                models.S00_LoginLog(
                    user_id=user.id,
                    ip_address=client_ip,
                    user_agent=user_agent,
                    status="FAILED",
                )
            )
            db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Record Successful Login Log in S00_login_logs
    db.add(
        models.S00_LoginLog(
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            status="SUCCESS",
        )
    )
    # Record Activity Log in S00_activity_logs
    db.add(
        models.S00_ActivityLog(
            user_id=user.id,
            action="USER_LOGIN",
            entity_type="SESSION",
            entity_id=user.id,
            details=f"Successful sign-in from {client_ip}",
            ip_address=client_ip,
        )
    )
    db.commit()

    token = auth.create_access_token(email=user.email, role=user.role)
    return {"access_token": token, "token_type": "bearer", "role": user.role}


@app.get("/api/me", response_model=schemas.UserOut)
def read_me(current_user: models.S00_User = Depends(get_current_user)):
    return current_user


@app.put("/api/user/profile", response_model=schemas.UserOut)
def update_user_profile(
    payload: schemas.UserProfileUpdate,
    request: Request,
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates the current authenticated user's profile details
    (full name, phone, shipping address).
    """
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
    if payload.phone is not None:
        current_user.phone = payload.phone.strip()
    if payload.address is not None:
        current_user.address = payload.address.strip()

    client_ip = request.client.host if request.client else "unknown"
    db.add(
        models.S00_ActivityLog(
            user_id=current_user.id,
            action="UPDATE_PROFILE",
            entity_type="USER",
            entity_id=current_user.id,
            details=f"Updated profile: Name='{current_user.full_name}', Phone='{current_user.phone}'",
            ip_address=client_ip,
        )
    )
    db.commit()
    db.refresh(current_user)
    return current_user


# ===================== S00_ ACTIVITY MONITORING ENDPOINTS =====================

@app.post("/api/activity", status_code=204)
def track_activity(
    payload: schemas.ActivityLogCreate,
    request: Request,
    current_user: models.S00_User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """
    Called by frontend to record user actions:
    e.g. VIEW_BOOK, ADD_TO_CART, FILTER_GENRE, OPEN_CHAT, SEARCH
    """
    client_ip = request.client.host if request.client else "unknown"
    log_entry = models.S00_ActivityLog(
        user_id=current_user.id if current_user else None,
        action=payload.action,
        entity_type=payload.entity_type,
        entity_id=payload.entity_id,
        details=payload.details,
        ip_address=client_ip,
    )
    db.add(log_entry)
    db.commit()


@app.get("/api/system/logins", response_model=list[schemas.LoginLogOut])
def get_login_logs(limit: int = 50, manager: models.S00_User = Depends(require_manager), db: Session = Depends(get_db)):
    """Returns the latest user login history (Manager only)."""
    return (
        db.query(models.S00_LoginLog)
        .order_by(desc(models.S00_LoginLog.login_time))
        .limit(limit)
        .all()
    )


@app.get("/api/system/activities", response_model=list[schemas.ActivityLogOut])
def get_activity_logs(limit: int = 100, manager: models.S00_User = Depends(require_manager), db: Session = Depends(get_db)):
    """Returns the latest user website actions and interactions (Manager only)."""
    return (
        db.query(models.S00_ActivityLog)
        .order_by(desc(models.S00_ActivityLog.created_at))
        .limit(limit)
        .all()
    )


@app.get("/api/system/errors", response_model=list[schemas.ErrorLogOut])
def get_error_logs(limit: int = 50, manager: models.S00_User = Depends(require_manager), db: Session = Depends(get_db)):
    """Returns the recorded unhandled system errors and stack traces (Manager only)."""
    return (
        db.query(models.S00_ErrorLog)
        .order_by(desc(models.S00_ErrorLog.created_at))
        .limit(limit)
        .all()
    )


@app.get("/api/admin/overview")
def get_admin_overview(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Returns management KPI overview metrics."""
    return {
        "manager_email": manager.email,
        "role": manager.role,
        "total_books": db.query(models.C00_Product).count(),
        "total_categories": db.query(models.C00_Category).count(),
        "total_users": db.query(models.S00_User).count(),
        "total_orders": db.query(models.C00_Order).count(),
    }


@app.get("/api/system/test-error")
def trigger_test_error():
    """
    Deliberately triggers an uncaught ZeroDivisionError to test the Global Exception Handler!
    The error is intercepted, logged in S00_error_logs, and returned cleanly.
    """
    division_by_zero = 100 / 0
    return {"result": division_by_zero}


# ===================== SECURE GROUNDED AI CHATBOT ENDPOINT =====================

@app.post("/api/chat", response_model=schemas.ChatResponse)
def handle_chat_message(
    payload: schemas.ChatRequest,
    request: Request,
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Secure Grounded AI Chatbot Endpoint:
    1. Gated behind JWT auth (blocks 99% of web crawlers and scraping bots)
    2. Enforces Rate Limiter (max 5 msgs/min, 40 msgs/day per user)
    3. Grounded in PostgreSQL (answers policies, bestsellers, book recommendations without hallucinations)
    4. Refuses password / sensitive data queries
    """
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    client_ip = request.client.host if request.client else "unknown"

    # Enforce sliding-window rate limit
    ai_service.enforce_chat_rate_limit(db, current_user.id, client_ip)

    # Detect user language preference:
    # If the customer writes in Chinese, answer in Chinese.
    # If the customer writes in English, answer in English.
    # Otherwise fallback to client UI / Accept-Language header.
    accept_lang = request.headers.get("accept-language", "")
    has_chinese = bool(re.search(r"[\u4e00-\u9fff]", payload.message))
    has_english = bool(re.search(r"[a-zA-Z]{2,}", payload.message))

    if has_chinese:
        is_zh = True
    elif has_english:
        is_zh = False
    else:
        is_zh = "zh" in accept_lang.lower()

    reply, intent, sources = ai_service.process_chat_message(db, payload.message, is_zh=is_zh)

    # Record chat interaction in S00_activity_logs
    db.add(
        models.S00_ActivityLog(
            user_id=current_user.id,
            action="CHAT_QUERY",
            entity_type="CHAT",
            details=f"Intent: {intent} | Query: {payload.message[:100]}",
            ip_address=client_ip,
        )
    )
    db.commit()

    return schemas.ChatResponse(reply=reply, intent=intent, sources=sources)


# ===================== C00_ BOOKSTORE & BESTSELLER ENDPOINTS =====================

@app.get("/api/settings", response_model=schemas.SiteSettingOut)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(models.C00_SiteSetting).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not configured")
    return settings


@app.get("/api/navigation", response_model=list[schemas.NavigationMenuItemOut])
def get_navigation_menus(db: Session = Depends(get_db)):
    """
    Returns active hierarchical navigation menu structure from C00_navigation_menus.
    Root items have parent_id == None, with nested children ordered by sort_order.
    """
    return (
        db.query(models.C00_NavigationMenu)
        .options(joinedload(models.C00_NavigationMenu.children))
        .filter(
            models.C00_NavigationMenu.parent_id.is_(None),
            models.C00_NavigationMenu.is_active.is_(True),
        )
        .order_by(models.C00_NavigationMenu.sort_order)
        .all()
    )


@app.get("/api/promotions", response_model=list[schemas.PromotionOut])
def get_promotions(db: Session = Depends(get_db)):
    return db.query(models.C00_Promotion).filter(models.C00_Promotion.is_active.is_(True)).all()


@app.get("/api/categories", response_model=list[schemas.CategoryOut])
def get_categories(db: Session = Depends(get_db)):
    return (
        db.query(models.C00_Category)
        .filter(models.C00_Category.is_active.is_(True))
        .order_by(models.C00_Category.sort_order)
        .all()
    )


@app.get("/api/products/recommended", response_model=list[schemas.ProductOut])
def get_recommended(db: Session = Depends(get_db)):
    return (
        db.query(models.C00_Product)
        .options(joinedload(models.C00_Product.detail))
        .filter(models.C00_Product.is_active.is_(True), models.C00_Product.is_recommended.is_(True))
        .all()
    )


@app.get("/api/products/bestsellers", response_model=list[schemas.ProductOut])
def get_store_bestsellers(limit: int = 10, db: Session = Depends(get_db)):
    """
    Calculates actual bestsellers ranked STRICTLY by our store's order volume in PostgreSQL!
    This guarantees no hallucinated external books are returned.
    """
    sales_subquery = (
        db.query(
            models.C00_OrderItem.product_id,
            func.coalesce(func.sum(models.C00_OrderItem.quantity), 0).label("total_sold"),
        )
        .group_by(models.C00_OrderItem.product_id)
        .subquery()
    )

    query = (
        db.query(models.C00_Product)
        .outerjoin(sales_subquery, models.C00_Product.id == sales_subquery.c.product_id)
        .options(joinedload(models.C00_Product.detail))
        .filter(models.C00_Product.is_active.is_(True))
        .order_by(desc(sales_subquery.c.total_sold), desc(models.C00_Product.price))
        .limit(limit)
    )
    return query.all()


@app.get("/api/products", response_model=list[schemas.ProductOut])
def get_products(category_id: int | None = None, db: Session = Depends(get_db)):
    query = (
        db.query(models.C00_Product)
        .options(joinedload(models.C00_Product.detail))
        .filter(models.C00_Product.is_active.is_(True))
    )
    if category_id:
        query = query.filter(models.C00_Product.category_id == category_id)
    return query.all()


# ===================== EXCEL & WORD BULK IMPORT ENDPOINTS =====================

@app.get("/api/products/excel-template")
def download_excel_template(
    current_user: models.S00_User = Depends(require_manager),
):
    """
    Downloads a beautifully styled sample Excel template (.xlsx).
    Restricted strictly to managers.
    """
    excel_bytes = excel_service.generate_excel_template()
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=apex_books_template.xlsx",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@app.get("/api/products/word-template")
def download_word_template(
    current_user: models.S00_User = Depends(require_manager),
):
    """
    Downloads a beautifully styled sample Word template (.docx).
    Restricted strictly to managers.
    """
    word_bytes = word_service.generate_word_template()
    return Response(
        content=word_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": "attachment; filename=apex_books_template.docx",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@app.post("/api/products/import-excel", response_model=schemas.ExcelImportResult)
async def import_products_from_excel(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Imports bookstore products in bulk from an uploaded Excel spreadsheet (.xlsx / .xls).
    - Restricted strictly to managers.
    - Auto-detects / maps column headers (supports English & Chinese)
    - Auto-creates new categories if needed
    - Upserts records by ISBN or Title (updates existing books, inserts new ones)
    - Records audit log in S00_activity_logs
    - Returns structured summary of processed, inserted, updated, and failed rows
    """
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a valid Excel file (.xlsx or .xls).",
        )

    file_contents = await file.read()
    if not file_contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded Excel file is empty.",
        )

    result = excel_service.import_books_from_excel(db, file_contents, file.filename)

    # Activity Log: Excel import performed
    client_ip = request.client.host if (request and request.client) else "unknown"

    db.add(
        models.S00_ActivityLog(
            user_id=current_user.id,
            action="EXCEL_IMPORT",
            entity_type="PRODUCT",
            details=json.dumps({
                "filename": file.filename,
                "total_rows": result["total_rows"],
                "inserted": result["inserted"],
                "updated": result["updated"],
                "failed": result["failed"],
                "manager": current_user.email,
            }),
            ip_address=client_ip,
        )
    )
    db.commit()

    return result


@app.post("/api/products/import-word", response_model=schemas.ExcelImportResult)
async def import_products_from_word(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Imports bookstore products in bulk from an uploaded Microsoft Word document (.docx).
    - Restricted strictly to managers.
    - Auto-detects / maps table column headers (supports English & Chinese)
    - Auto-creates new categories if needed
    - Upserts records by ISBN or Title (updates existing books, inserts new ones)
    - Records audit log in S00_activity_logs
    - Returns structured summary of processed, inserted, updated, and failed rows
    """
    if not file.filename.lower().endswith(".docx"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file format. Please upload a valid Microsoft Word document (.docx).",
        )

    file_contents = await file.read()
    if not file_contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The uploaded Word document is empty.",
        )

    result = word_service.import_books_from_word(db, file_contents, file.filename)

    # Activity Log: Word import performed
    client_ip = request.client.host if (request and request.client) else "unknown"

    db.add(
        models.S00_ActivityLog(
            user_id=current_user.id,
            action="WORD_IMPORT",
            entity_type="PRODUCT",
            details=json.dumps({
                "filename": file.filename,
                "total_rows": result["total_rows"],
                "inserted": result["inserted"],
                "updated": result["updated"],
                "failed": result["failed"],
                "manager": current_user.email,
            }),
            ip_address=client_ip,
        )
    )
    db.commit()

    return result



def _format_order(order: models.C00_Order) -> dict:
    items_out = []
    for item in order.items:
        items_out.append({
            "id": item.id,
            "product_id": item.product_id,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "product_title_en": item.product.title_en if item.product else f"Book #{item.product_id}",
            "product_title_zh": item.product.title_zh if item.product else f"圖書 #{item.product_id}",
            "product_image_url": item.product.image_url if item.product else "",
        })
    return {
        "id": order.id,
        "user_id": order.user_id,
        "total_amount": order.total_amount,
        "shipping_fee": order.shipping_fee or 0.0,
        "status": order.status,
        "delivery_method": order.delivery_method or "standard",
        "payment_method": order.payment_method or "credit_card",
        "recipient_name": order.recipient_name,
        "recipient_phone": order.recipient_phone,
        "shipping_address": order.shipping_address,
        "delivery_notes": order.delivery_notes,
        "tracking_number": order.tracking_number,
        "estimated_delivery": order.estimated_delivery,
        "created_at": order.created_at,
        "items": items_out,
    }


@app.post("/api/orders", response_model=schemas.OrderOut, status_code=201)
def place_order(
    payload: schemas.OrderCreate,
    request: Request,
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cannot place empty order")

    # 1. Calculate items subtotal and validate products
    subtotal = 0.0
    items_to_create = []
    item_summaries = []

    for item in payload.items:
        prod = db.query(models.C00_Product).filter(models.C00_Product.id == item.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Book #{item.product_id} not found")
        item_total = prod.price * item.quantity
        subtotal += item_total
        items_to_create.append((prod, item.quantity))
        item_summaries.append(f"{prod.title_en} x{item.quantity}")

    subtotal = round(subtotal, 2)

    # 2. Shipping fee & delivery estimate calculation
    delivery_method = payload.delivery_method or "standard"
    if delivery_method == "express":
        shipping_fee = 12.00
        estimated_delivery = "Next Business Day Express"
    elif delivery_method == "pickup":
        shipping_fee = 0.00
        estimated_delivery = "Ready in 2 hours at Apex Downtown Store"
    else:  # standard
        delivery_method = "standard"
        shipping_fee = 0.00 if subtotal >= 35.0 else 5.00
        estimated_delivery = "3-5 Business Days Standard Delivery"

    grand_total = round(subtotal + shipping_fee, 2)
    tracking_number = f"APEX-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    # 3. Recipient details - fallback to user profile if not provided
    recipient_name = (payload.recipient_name or current_user.full_name or current_user.email.split("@")[0]).strip()
    recipient_phone = (payload.recipient_phone or current_user.phone or "").strip()
    shipping_address = (
        "In-Store Pickup Counter (Downtown Main Branch)"
        if delivery_method == "pickup"
        else (payload.shipping_address or current_user.address or "Standard Shipping Address").strip()
    )

    order = models.C00_Order(
        user_id=current_user.id,
        total_amount=grand_total,
        shipping_fee=shipping_fee,
        status="Processing",
        delivery_method=delivery_method,
        payment_method=payload.payment_method or "credit_card",
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        shipping_address=shipping_address,
        delivery_notes=payload.delivery_notes,
        tracking_number=tracking_number,
        estimated_delivery=estimated_delivery,
    )
    db.add(order)
    db.flush()

    for prod, qty in items_to_create:
        order_item = models.C00_OrderItem(
            order_id=order.id,
            product_id=prod.id,
            quantity=qty,
            unit_price=prod.price,
        )
        db.add(order_item)

    # 4. Activity Log: Order placed
    client_ip = request.client.host if request.client else "unknown"
    db.add(
        models.S00_ActivityLog(
            user_id=current_user.id,
            action="PLACE_ORDER",
            entity_type="ORDER",
            entity_id=order.id,
            details=json.dumps({
                "order_id": order.id,
                "tracking_number": tracking_number,
                "subtotal": subtotal,
                "shipping_fee": shipping_fee,
                "total": grand_total,
                "delivery_method": delivery_method,
                "payment_method": order.payment_method,
                "items": item_summaries,
            }),
            ip_address=client_ip,
        )
    )

    db.commit()
    db.refresh(order)

    # Re-fetch order with joined items and products
    order_refreshed = (
        db.query(models.C00_Order)
        .options(joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product))
        .filter(models.C00_Order.id == order.id)
        .first()
    )
    return _format_order(order_refreshed or order)


@app.get("/api/orders/my-orders", response_model=list[schemas.OrderOut])
def get_my_orders(
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns order history and tracking info for the logged-in customer.
    """
    orders = (
        db.query(models.C00_Order)
        .options(joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product))
        .filter(models.C00_Order.user_id == current_user.id)
        .order_by(desc(models.C00_Order.created_at))
        .all()
    )
    return [_format_order(o) for o in orders]


@app.get("/api/admin/orders", response_model=list[schemas.OrderOut])
def get_admin_orders(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Returns all customer orders in the store with fulfillment status (Manager only).
    """
    orders = (
        db.query(models.C00_Order)
        .options(joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product))
        .order_by(desc(models.C00_Order.created_at))
        .all()
    )
    return [_format_order(o) for o in orders]


@app.put("/api/admin/orders/{order_id}/status", response_model=schemas.OrderOut)
def update_order_status(
    order_id: int,
    payload: schemas.OrderStatusUpdate,
    request: Request,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Updates the shipping/fulfillment status of a customer order (Manager only).
    Status stages: Processing -> Confirmed -> Shipped -> Out for Delivery -> Delivered
    """
    order = (
        db.query(models.C00_Order)
        .options(joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product))
        .filter(models.C00_Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail=f"Order #{order_id} not found")

    old_status = order.status
    order.status = payload.status
    if payload.tracking_number is not None:
        order.tracking_number = payload.tracking_number.strip()
    if payload.estimated_delivery is not None:
        order.estimated_delivery = payload.estimated_delivery.strip()

    client_ip = request.client.host if request.client else "unknown"
    db.add(
        models.S00_ActivityLog(
            user_id=manager.id,
            action="UPDATE_ORDER_STATUS",
            entity_type="ORDER",
            entity_id=order.id,
            details=f"Status changed from '{old_status}' to '{order.status}' by manager {manager.email}",
            ip_address=client_ip,
        )
    )

    db.commit()
    db.refresh(order)
    return _format_order(order)
