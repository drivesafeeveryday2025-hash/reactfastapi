import json
import re
import traceback
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from . import ai_service, auth, models, schemas
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

    token = auth.create_access_token(email=user.email)
    return {"access_token": token, "token_type": "bearer"}


@app.get("/api/me", response_model=schemas.UserOut)
def read_me(current_user: models.S00_User = Depends(get_current_user)):
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
def get_login_logs(limit: int = 50, db: Session = Depends(get_db)):
    """Returns the latest user login history."""
    return (
        db.query(models.S00_LoginLog)
        .order_by(desc(models.S00_LoginLog.login_time))
        .limit(limit)
        .all()
    )


@app.get("/api/system/activities", response_model=list[schemas.ActivityLogOut])
def get_activity_logs(limit: int = 100, db: Session = Depends(get_db)):
    """Returns the latest user website actions and interactions."""
    return (
        db.query(models.S00_ActivityLog)
        .order_by(desc(models.S00_ActivityLog.created_at))
        .limit(limit)
        .all()
    )


@app.get("/api/system/errors", response_model=list[schemas.ErrorLogOut])
def get_error_logs(limit: int = 50, db: Session = Depends(get_db)):
    """Returns the recorded unhandled system errors and stack traces."""
    return (
        db.query(models.S00_ErrorLog)
        .order_by(desc(models.S00_ErrorLog.created_at))
        .limit(limit)
        .all()
    )


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


@app.post("/api/orders", response_model=schemas.OrderOut, status_code=201)
def place_order(
    payload: schemas.OrderCreate,
    request: Request,
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cannot place empty order")

    total = 0.0
    order = models.C00_Order(user_id=current_user.id, total_amount=0.0)
    db.add(order)
    db.flush()

    item_summaries = []
    for item in payload.items:
        prod = db.query(models.C00_Product).filter(models.C00_Product.id == item.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Book #{item.product_id} not found")
        item_total = prod.price * item.quantity
        total += item_total
        order_item = models.C00_OrderItem(
            order_id=order.id,
            product_id=prod.id,
            quantity=item.quantity,
            unit_price=prod.price,
        )
        db.add(order_item)
        item_summaries.append(f"{prod.title_en} x{item.quantity}")

    order.total_amount = round(total, 2)

    # Activity Log: Order placed
    client_ip = request.client.host if request.client else "unknown"
    db.add(
        models.S00_ActivityLog(
            user_id=current_user.id,
            action="PLACE_ORDER",
            entity_type="ORDER",
            entity_id=order.id,
            details=json.dumps({"order_id": order.id, "total": order.total_amount, "items": item_summaries}),
            ip_address=client_ip,
        )
    )

    db.commit()
    db.refresh(order)
    return order
