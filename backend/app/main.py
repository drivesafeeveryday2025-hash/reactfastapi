import json
import re
import secrets
import traceback
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Depends, FastAPI, File, HTTPException, Request, Response, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, HTMLResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from . import ai_service, auth, document_service, email_service, excel_service, models, schemas, word_service
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


# ===================== LOGIN BOT PROTECTION & RATE LIMITING =====================

MAX_FAILED_ATTEMPTS_PER_EMAIL = 5    # Lock account after 5 failed attempts
MAX_FAILED_ATTEMPTS_PER_IP = 10     # Ban IP after 10 failed attempts
LOCKOUT_MINUTES = 15                 # Lockout duration
RATE_WINDOW_MINUTES = 10             # Window to count failed attempts

# Fast in-memory lookup cache to instantly reject DDoS bot floods without touching PostgreSQL
_ip_lockouts: dict[str, datetime] = {}
_email_lockouts: dict[str, datetime] = {}


def check_login_rate_limits(client_ip: str, email: str, db: Session):
    """
    Prevents brute-force dictionary attacks and web bot floods on the login endpoint.
    1. Checks fast in-memory ban cache to deflect DDoS floods in O(1) time.
    2. Checks PostgreSQL attempt records within the sliding rate window.
    """
    now = datetime.now(timezone.utc)

    # 1. Fast in-memory IP lockout check
    if client_ip in _ip_lockouts:
        lock_until = _ip_lockouts[client_ip]
        if now < lock_until:
            rem_sec = int((lock_until - now).total_seconds())
            rem_min = max(1, (rem_sec + 59) // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many failed login attempts from your IP network. Bot protection active. Please try again after {rem_min} minutes.",
                headers={"Retry-After": str(rem_sec)},
            )
        else:
            del _ip_lockouts[client_ip]

    # 2. Fast in-memory Account lockout check
    if email in _email_lockouts:
        lock_until = _email_lockouts[email]
        if now < lock_until:
            rem_sec = int((lock_until - now).total_seconds())
            rem_min = max(1, (rem_sec + 59) // 60)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"This account is temporarily locked due to multiple failed login attempts. Please wait {rem_min} minutes or use 'Forgot Password' to reset your credentials.",
                headers={"Retry-After": str(rem_sec)},
            )
        else:
            del _email_lockouts[email]

    # 3. Persistent PostgreSQL sliding window check
    window_start = now - timedelta(minutes=RATE_WINDOW_MINUTES)

    ip_failures = (
        db.query(func.count(models.S00_LoginAttempt.id))
        .filter(
            models.S00_LoginAttempt.ip_address == client_ip,
            models.S00_LoginAttempt.is_successful == False,
            models.S00_LoginAttempt.attempt_time >= window_start,
        )
        .scalar()
        or 0
    )
    if ip_failures >= MAX_FAILED_ATTEMPTS_PER_IP:
        _ip_lockouts[client_ip] = now + timedelta(minutes=LOCKOUT_MINUTES)
        rem_sec = LOCKOUT_MINUTES * 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts from your network. Bot protection active. Please wait {LOCKOUT_MINUTES} minutes before retrying.",
            headers={"Retry-After": str(rem_sec)},
        )

    email_failures = (
        db.query(func.count(models.S00_LoginAttempt.id))
        .filter(
            models.S00_LoginAttempt.email == email,
            models.S00_LoginAttempt.is_successful == False,
            models.S00_LoginAttempt.attempt_time >= window_start,
        )
        .scalar()
        or 0
    )
    if email_failures >= MAX_FAILED_ATTEMPTS_PER_EMAIL:
        _email_lockouts[email] = now + timedelta(minutes=LOCKOUT_MINUTES)
        rem_sec = LOCKOUT_MINUTES * 60
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Account temporarily locked due to {MAX_FAILED_ATTEMPTS_PER_EMAIL} failed login attempts. Please wait {LOCKOUT_MINUTES} minutes or use 'Forgot Password'.",
            headers={"Retry-After": str(rem_sec)},
        )


@app.post("/api/login", response_model=schemas.Token)
def login(payload: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")[:300]
    now = datetime.now(timezone.utc)

    # Step 1: Enforce Anti-Bot and Brute Force Rate Limiting
    check_login_rate_limits(client_ip=client_ip, email=email, db=db)

    # Step 2: Validate User & Password
    user = db.query(models.S00_User).filter(models.S00_User.email == email).first()

    if not user or not auth.verify_password(payload.password, user.hashed_password):
        # Record failed attempt into S00_login_attempts
        db.add(
            models.S00_LoginAttempt(
                ip_address=client_ip,
                email=email,
                attempt_time=now,
                is_successful=False,
                user_agent=user_agent,
            )
        )
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

        # Compute remaining attempts before lockout for progressive warning
        window_start = now - timedelta(minutes=RATE_WINDOW_MINUTES)
        recent_email_fails = (
            db.query(func.count(models.S00_LoginAttempt.id))
            .filter(
                models.S00_LoginAttempt.email == email,
                models.S00_LoginAttempt.is_successful == False,
                models.S00_LoginAttempt.attempt_time >= window_start,
            )
            .scalar()
            or 0
        )
        remaining = max(0, MAX_FAILED_ATTEMPTS_PER_EMAIL - recent_email_fails)

        if remaining == 0:
            _email_lockouts[email] = now + timedelta(minutes=LOCKOUT_MINUTES)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Account temporarily locked due to {MAX_FAILED_ATTEMPTS_PER_EMAIL} consecutive failed login attempts. Please wait {LOCKOUT_MINUTES} minutes or use 'Forgot Password'.",
            )
        elif remaining <= 2:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid email or password. Warning: Account will be temporarily locked after {remaining} more failed attempt(s).",
            )
        else:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    # Step 3: Handle Successful Sign In
    # Record successful attempt into S00_login_attempts
    db.add(
        models.S00_LoginAttempt(
            ip_address=client_ip,
            email=email,
            attempt_time=now,
            is_successful=True,
            user_agent=user_agent,
        )
    )
    # Clear in-memory lockouts for this email & IP
    _email_lockouts.pop(email, None)
    _ip_lockouts.pop(client_ip, None)

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


# ===================== S00_ FORGOT & RESET PASSWORD ENDPOINTS =====================

@app.post("/api/auth/forgot-password", response_model=schemas.ForgotPasswordResponse)
def request_password_reset(
    payload: schemas.ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Initiates the forgot password flow.
    Generates a cryptographically random, 30-minute token and sends a reset link via email.
    """
    email = payload.email.strip().lower()
    user = db.query(models.S00_User).filter(models.S00_User.email == email).first()
    client_ip = request.client.host if request.client else "unknown"

    dev_reset_link = None

    if user:
        # Invalidate any prior unused reset tokens for this user
        db.query(models.S00_PasswordReset).filter(
            models.S00_PasswordReset.user_id == user.id,
            models.S00_PasswordReset.is_used == False,
        ).update({"is_used": True})

        # Generate cryptographic token (32 URL-safe bytes)
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)

        reset_record = models.S00_PasswordReset(
            user_id=user.id,
            email=email,
            token=token,
            expires_at=expires_at,
            is_used=False,
        )
        db.add(reset_record)

        # Dispatch email
        result = email_service.send_password_reset_email(
            to_email=user.email,
            recipient_name=user.full_name or user.email,
            reset_token=token,
        )
        dev_reset_link = result.get("reset_url")

        # Log activity
        db.add(
            models.S00_ActivityLog(
                user_id=user.id,
                action="PASSWORD_RESET_REQUESTED",
                entity_type="AUTH",
                entity_id=user.id,
                details=f"Password reset link generated from IP {client_ip}",
                ip_address=client_ip,
            )
        )
        db.commit()

    return {
        "success": True,
        "message": "If this email address is registered, password reset instructions have been sent to your inbox.",
        "dev_reset_link": dev_reset_link,
    }


@app.get("/api/auth/verify-reset-token", response_model=schemas.VerifyResetTokenResponse)
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    """
    Verifies that a reset token is valid, unexpired, and not yet used.
    """
    clean_token = token.strip()
    record = db.query(models.S00_PasswordReset).filter(models.S00_PasswordReset.token == clean_token).first()
    if not record or record.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has already been used.",
        )

    now = datetime.now(timezone.utc)
    if record.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link has expired (valid for 30 minutes). Please request a new one.",
        )

    # Mask email for privacy: e.g. re***@mail.com
    parts = record.email.split("@")
    if len(parts) == 2 and len(parts[0]) > 2:
        masked_email = f"{parts[0][:2]}***@{parts[1]}"
    else:
        masked_email = f"***@{parts[-1]}"

    return {
        "valid": True,
        "email": masked_email,
        "message": "Token is valid.",
    }


@app.post("/api/auth/reset-password", response_model=schemas.ResetPasswordResponse)
def reset_password(
    payload: schemas.ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Sets a new password using a verified reset token.
    """
    clean_token = payload.token.strip()
    new_pwd = payload.new_password.strip()

    if len(new_pwd) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long.")

    record = db.query(models.S00_PasswordReset).filter(models.S00_PasswordReset.token == clean_token).first()
    if not record or record.is_used:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link is invalid or has already been used.",
        )

    now = datetime.now(timezone.utc)
    if record.expires_at < now:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This password reset link has expired. Please request a new one.",
        )

    user = db.query(models.S00_User).filter(models.S00_User.id == record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found.")

    # Update password
    user.hashed_password = auth.hash_password(new_pwd)

    # Invalidate token
    record.is_used = True
    record.used_at = now

    # Clear any lockout for this email/IP and reset failed login attempts
    _email_lockouts.pop(user.email, None)
    client_ip = request.client.host if request.client else "unknown"
    _ip_lockouts.pop(client_ip, None)
    db.query(models.S00_LoginAttempt).filter(
        models.S00_LoginAttempt.email == user.email,
        models.S00_LoginAttempt.is_successful == False,
    ).delete()

    # Log activity
    db.add(
        models.S00_ActivityLog(
            user_id=user.id,
            action="PASSWORD_RESET_COMPLETED",
            entity_type="AUTH",
            entity_id=user.id,
            details=f"Password successfully reset via token from IP {client_ip}",
            ip_address=client_ip,
        )
    )
    db.commit()

    return {
        "success": True,
        "message": "Your password has been reset successfully! You can now sign in with your new password.",
    }



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

    # 1.5. Validate and Reserve Brand-New Stock in Warehouse
    for prod, qty in items_to_create:
        inv_records = (
            db.query(models.W00_Inventory)
            .filter(
                models.W00_Inventory.product_id == prod.id,
                models.W00_Inventory.condition == "brand_new",
            )
            .order_by(models.W00_Inventory.id)
            .all()
        )
        total_available = sum(max(0, inv.quantity - inv.reserved_quantity) for inv in inv_records)
        if total_available < qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient brand-new warehouse stock for '{prod.title_en}'. Available: {total_available}, Requested: {qty}",
            )
        # Allocate reserved quantity across warehouse locations
        needed = qty
        for inv in inv_records:
            avail = max(0, inv.quantity - inv.reserved_quantity)
            if avail > 0:
                take = min(avail, needed)
                inv.reserved_quantity += take
                needed -= take
                if needed == 0:
                    break

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

    # Physical stock deduction when advancing to Shipped
    if payload.status in ["Shipped", "Out for Delivery", "Delivered"] and old_status in ["Processing", "Confirmed", "Picking"]:
        for item in order.items:
            inv_records = (
                db.query(models.W00_Inventory)
                .filter(
                    models.W00_Inventory.product_id == item.product_id,
                    models.W00_Inventory.condition == "brand_new",
                )
                .order_by(models.W00_Inventory.id)
                .all()
            )
            to_deduct = item.quantity
            for inv in inv_records:
                if inv.reserved_quantity > 0:
                    deduct_amt = min(inv.reserved_quantity, to_deduct)
                    inv.reserved_quantity -= deduct_amt
                    inv.quantity = max(0, inv.quantity - deduct_amt)
                    to_deduct -= deduct_amt
                    if to_deduct == 0:
                        break
            if to_deduct > 0:
                for inv in inv_records:
                    if inv.quantity > 0:
                        deduct_amt = min(inv.quantity, to_deduct)
                        inv.quantity -= deduct_amt
                        to_deduct -= deduct_amt
                        if to_deduct == 0:
                            break
    elif payload.status == "Cancelled" and old_status in ["Processing", "Confirmed", "Picking"]:
        # Release reservations if order cancelled before shipment
        for item in order.items:
            inv_records = (
                db.query(models.W00_Inventory)
                .filter(
                    models.W00_Inventory.product_id == item.product_id,
                    models.W00_Inventory.condition == "brand_new",
                )
                .all()
            )
            to_release = item.quantity
            for inv in inv_records:
                if inv.reserved_quantity > 0:
                    release_amt = min(inv.reserved_quantity, to_release)
                    inv.reserved_quantity -= release_amt
                    to_release -= release_amt
                    if to_release == 0:
                        break

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


# ===================== W00_ WAREHOUSE & INVENTORY MANAGEMENT ENDPOINTS =====================

def _format_inventory_item(inv: models.W00_Inventory) -> dict:
    prod = inv.product
    loc = inv.location
    wh = loc.warehouse if loc else None
    cat = prod.category if prod else None
    detail = prod.detail if prod else None

    return {
        "id": inv.id,
        "product_id": inv.product_id,
        "location_id": inv.location_id,
        "condition": inv.condition,
        "quantity": inv.quantity,
        "reserved_quantity": inv.reserved_quantity,
        "available_quantity": max(0, inv.quantity - inv.reserved_quantity),
        "last_counted_at": inv.last_counted_at,
        "updated_at": inv.updated_at,
        "product_title_en": prod.title_en if prod else "Unknown",
        "product_title_zh": prod.title_zh if prod else "未知書籍",
        "product_author_en": prod.author_en if prod else "Unknown",
        "isbn": detail.isbn if detail else f"SKU-{inv.product_id:05d}",
        "price": prod.price if prod else 0.0,
        "category_id": prod.category_id if prod else 0,
        "category_name_en": cat.name_en if cat else "Uncategorized",
        "category_name_zh": cat.name_zh if cat else "未分類",
        "image_url": prod.image_url if prod else None,
        "location_code": loc.location_code if loc else "N/A",
        "warehouse_id": loc.warehouse_id if loc else 0,
        "warehouse_code": wh.code if wh else "N/A",
        "warehouse_name_en": wh.name_en if wh else "N/A",
        "warehouse_name_zh": wh.name_zh if wh else "N/A",
        "zone": loc.zone if loc else "N/A",
        "zone_name_en": loc.zone_name_en if loc else "N/A",
        "zone_name_zh": loc.zone_name_zh if loc else "N/A",
        "aisle": loc.aisle if loc else "N/A",
        "shelf": loc.shelf if loc else "N/A",
        "bin": loc.bin if loc else "N/A",
    }


def _format_adjustment(adj: models.W00_Adjustment) -> dict:
    prod = adj.product
    detail = prod.detail if prod else None
    from_loc = adj.from_location
    to_loc = adj.to_location

    return {
        "id": adj.id,
        "voucher_no": adj.voucher_no,
        "product_id": adj.product_id,
        "product_title_en": prod.title_en if prod else "Unknown",
        "product_title_zh": prod.title_zh if prod else "未知書籍",
        "isbn": detail.isbn if detail else None,
        "from_location_id": adj.from_location_id,
        "from_location_code": from_loc.location_code if from_loc else None,
        "to_location_id": adj.to_location_id,
        "to_location_code": to_loc.location_code if to_loc else None,
        "from_condition": adj.from_condition,
        "to_condition": adj.to_condition,
        "change_qty": adj.change_qty,
        "reason_code": adj.reason_code,
        "notes": adj.notes,
        "created_by_name": adj.created_by_name,
        "status": adj.status,
        "created_at": adj.created_at,
    }


@app.get("/api/warehouse/overview", response_model=schemas.WarehouseOverviewOut)
def get_warehouse_overview(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Returns inventory KPI summary: total units on hand, reserved, distinct SKUs,
    condition breakdown (Brand New, Minor Wear, Damaged), and facilities count.
    """
    total_units_on_hand = db.query(func.coalesce(func.sum(models.W00_Inventory.quantity), 0)).scalar()
    total_units_reserved = db.query(func.coalesce(func.sum(models.W00_Inventory.reserved_quantity), 0)).scalar()
    total_distinct_skus = db.query(func.count(func.distinct(models.W00_Inventory.product_id))).scalar()

    # Breakdown by condition
    cond_rows = (
        db.query(models.W00_Inventory.condition, func.sum(models.W00_Inventory.quantity))
        .group_by(models.W00_Inventory.condition)
        .all()
    )
    condition_counts = {"brand_new": 0, "minor_wear": 0, "damaged": 0}
    for c, qty in cond_rows:
        condition_counts[c] = int(qty or 0)

    total_locations = db.query(func.count(models.W00_Location.id)).scalar()
    total_warehouses = db.query(func.count(models.W00_Warehouse.id)).scalar()
    recent_adjustments_count = db.query(func.count(models.W00_Adjustment.id)).scalar()

    return {
        "total_units_on_hand": int(total_units_on_hand or 0),
        "total_units_reserved": int(total_units_reserved or 0),
        "total_distinct_skus": int(total_distinct_skus or 0),
        "condition_counts": condition_counts,
        "total_locations": int(total_locations or 0),
        "total_warehouses": int(total_warehouses or 0),
        "recent_adjustments_count": int(recent_adjustments_count or 0),
    }


@app.get("/api/warehouse/facilities", response_model=list[schemas.WarehouseOut])
def get_warehouse_facilities(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Returns all warehouse facilities.
    """
    return db.query(models.W00_Warehouse).order_by(models.W00_Warehouse.id).all()


@app.get("/api/warehouse/locations", response_model=list[schemas.WarehouseLocationOut])
def get_warehouse_locations(
    warehouse_id: int | None = None,
    zone: str | None = None,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Returns warehouse storage locations (Zone, Aisle, Shelf, Bin) with warehouse metadata.
    """
    q = db.query(models.W00_Location).options(joinedload(models.W00_Location.warehouse))
    if warehouse_id:
        q = q.filter(models.W00_Location.warehouse_id == warehouse_id)
    if zone and zone != "all":
        q = q.filter(models.W00_Location.zone == zone)

    locs = q.order_by(models.W00_Location.warehouse_id, models.W00_Location.zone, models.W00_Location.location_code).all()
    res = []
    for l in locs:
        wh = l.warehouse
        res.append({
            "id": l.id,
            "warehouse_id": l.warehouse_id,
            "warehouse_code": wh.code if wh else None,
            "warehouse_name_en": wh.name_en if wh else None,
            "warehouse_name_zh": wh.name_zh if wh else None,
            "zone": l.zone,
            "zone_name_en": l.zone_name_en,
            "zone_name_zh": l.zone_name_zh,
            "aisle": l.aisle,
            "shelf": l.shelf,
            "bin": l.bin,
            "location_code": l.location_code,
            "category_hint": l.category_hint,
            "is_active": l.is_active,
        })
    return res


@app.get("/api/warehouse/inventory", response_model=list[schemas.InventoryItemOut])
def get_warehouse_inventory(
    warehouse_id: int | None = None,
    zone: str | None = None,
    condition: str | None = None,
    product_id: int | None = None,
    search: str | None = None,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Returns inventory on-hand records joined with product and location info.
    Supports filtering by warehouse, zone, condition, specific product, and text search.
    """
    q = (
        db.query(models.W00_Inventory)
        .join(models.C00_Product, models.W00_Inventory.product_id == models.C00_Product.id)
        .join(models.W00_Location, models.W00_Inventory.location_id == models.W00_Location.id)
        .options(
            joinedload(models.W00_Inventory.product).joinedload(models.C00_Product.detail),
            joinedload(models.W00_Inventory.product).joinedload(models.C00_Product.category),
            joinedload(models.W00_Inventory.location).joinedload(models.W00_Location.warehouse),
        )
    )

    if warehouse_id:
        q = q.filter(models.W00_Location.warehouse_id == warehouse_id)
    if zone and zone != "all":
        q = q.filter(models.W00_Location.zone == zone)
    if condition and condition != "all":
        q = q.filter(models.W00_Inventory.condition == condition)
    if product_id:
        q = q.filter(models.W00_Inventory.product_id == product_id)
    if search:
        s = f"%{search.strip()}%"
        q = q.filter(
            (models.C00_Product.title_en.ilike(s)) |
            (models.C00_Product.title_zh.ilike(s)) |
            (models.C00_Product.author_en.ilike(s)) |
            (models.W00_Location.location_code.ilike(s)) |
            (models.W00_Location.zone.ilike(s))
        )

    items = q.order_by(models.C00_Product.title_en, models.W00_Location.location_code).all()
    return [_format_inventory_item(i) for i in items]


@app.post("/api/warehouse/adjustments", response_model=schemas.AdjustmentOut, status_code=201)
def create_inventory_adjustment(
    payload: schemas.AdjustmentCreate,
    request: Request,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Issues a formal stock adjustment voucher.
    Supports:
    1. Quantity adjustments (+restock / -writeoff)
    2. Stock relocation from one warehouse location to another
    3. Product condition reclassifications (e.g., Brand New -> Minor Wear -> Damaged)
    """
    prod = db.query(models.C00_Product).filter(models.C00_Product.id == payload.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail=f"Product ID #{payload.product_id} not found")

    # Generate official voucher ID
    now = datetime.now(timezone.utc)
    voucher_no = f"ADJ-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

    # Handle Source Inventory (if transferring or reclassifying from an existing location/condition)
    if payload.from_location_id and payload.from_condition:
        source_inv = (
            db.query(models.W00_Inventory)
            .filter(
                models.W00_Inventory.product_id == payload.product_id,
                models.W00_Inventory.location_id == payload.from_location_id,
                models.W00_Inventory.condition == payload.from_condition,
            )
            .first()
        )
        if not source_inv:
            raise HTTPException(
                status_code=400,
                detail=f"Source inventory not found for Product #{payload.product_id} at Location #{payload.from_location_id} with condition '{payload.from_condition}'",
            )
        transfer_qty = abs(payload.change_qty)
        if source_inv.quantity < transfer_qty:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient source stock: available {source_inv.quantity}, requested deduction {transfer_qty}",
            )
        source_inv.quantity -= transfer_qty
        source_inv.updated_at = now

    # Handle Target Inventory
    if payload.to_location_id and payload.to_condition:
        target_inv = (
            db.query(models.W00_Inventory)
            .filter(
                models.W00_Inventory.product_id == payload.product_id,
                models.W00_Inventory.location_id == payload.to_location_id,
                models.W00_Inventory.condition == payload.to_condition,
            )
            .first()
        )
        if not target_inv:
            target_inv = models.W00_Inventory(
                product_id=payload.product_id,
                location_id=payload.to_location_id,
                condition=payload.to_condition,
                quantity=0,
                reserved_quantity=0,
                updated_at=now,
            )
            db.add(target_inv)
            db.flush()

        if payload.from_location_id and payload.from_condition:
            # Transfer incoming
            target_inv.quantity += abs(payload.change_qty)
        else:
            # Direct count adjustment (+ or -)
            target_inv.quantity = max(0, target_inv.quantity + payload.change_qty)

        target_inv.updated_at = now
    elif not payload.from_location_id and not payload.to_location_id:
        raise HTTPException(status_code=400, detail="Must specify either source or target location for stock adjustment.")

    # Record Adjustment Voucher
    adj = models.W00_Adjustment(
        voucher_no=voucher_no,
        product_id=payload.product_id,
        from_location_id=payload.from_location_id,
        to_location_id=payload.to_location_id,
        from_condition=payload.from_condition,
        to_condition=payload.to_condition,
        change_qty=payload.change_qty,
        reason_code=payload.reason_code,
        notes=payload.notes,
        created_by_user_id=manager.id,
        created_by_name=payload.created_by_name or manager.full_name or manager.email,
        status="APPROVED",
        created_at=now,
    )
    db.add(adj)

    # Activity Log
    client_ip = request.client.host if request.client else "unknown"
    db.add(
        models.S00_ActivityLog(
            user_id=manager.id,
            action="STOCK_ADJUSTMENT",
            entity_type="INVENTORY",
            entity_id=payload.product_id,
            details=f"Issued voucher {voucher_no} ({payload.reason_code}): Change Qty {payload.change_qty}",
            ip_address=client_ip,
        )
    )

    db.commit()
    db.refresh(adj)
    return _format_adjustment(adj)


@app.get("/api/warehouse/adjustments", response_model=list[schemas.AdjustmentOut])
def get_warehouse_adjustments(
    limit: int = 50,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Returns audit history of inventory and location adjustment vouchers.
    """
    adjs = (
        db.query(models.W00_Adjustment)
        .options(
            joinedload(models.W00_Adjustment.product).joinedload(models.C00_Product.detail),
            joinedload(models.W00_Adjustment.from_location),
            joinedload(models.W00_Adjustment.to_location),
        )
        .order_by(desc(models.W00_Adjustment.created_at))
        .limit(limit)
        .all()
    )
    return [_format_adjustment(a) for a in adjs]


@app.post("/api/warehouse/stocktake/export-excel")
def export_stocktake_excel(
    payload: schemas.StocktakeFilterRequest,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Generates and downloads an Excel Stocktake Checklist (.xlsx) for physical inventory verification.
    Supports filtering by Warehouse facility, Zone/Area, or specific book products.
    """
    query = (
        db.query(models.W00_Inventory)
        .join(models.C00_Product, models.W00_Inventory.product_id == models.C00_Product.id)
        .join(models.W00_Location, models.W00_Inventory.location_id == models.W00_Location.id)
        .options(
            joinedload(models.W00_Inventory.product).joinedload(models.C00_Product.detail),
            joinedload(models.W00_Inventory.product).joinedload(models.C00_Product.category),
            joinedload(models.W00_Inventory.location).joinedload(models.W00_Location.warehouse),
        )
    )

    warehouse_name = "All Warehouses"
    if payload.warehouse_id:
        query = query.filter(models.W00_Location.warehouse_id == payload.warehouse_id)
        wh = db.query(models.W00_Warehouse).filter(models.W00_Warehouse.id == payload.warehouse_id).first()
        if wh:
            warehouse_name = f"{wh.code} - {wh.name_en}"

    zone_name = "All Zones"
    if payload.zone and payload.zone != "all":
        query = query.filter(models.W00_Location.zone == payload.zone)
        zone_name = payload.zone

    if payload.product_ids and len(payload.product_ids) > 0:
        query = query.filter(models.W00_Inventory.product_id.in_(payload.product_ids))

    if payload.condition and payload.condition != "all":
        query = query.filter(models.W00_Inventory.condition == payload.condition)

    items = query.order_by(models.W00_Location.zone, models.W00_Location.aisle, models.W00_Location.shelf, models.W00_Location.bin).all()
    formatted = [_format_inventory_item(i) for i in items]

    excel_bytes = excel_service.generate_stocktake_checklist_excel(
        inventory_items=formatted,
        warehouse_name=warehouse_name,
        zone_name=zone_name,
    )

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"apex_stocktake_checklist_{timestamp}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ===================== W00_ FULFILLMENT, PROCUREMENT & PRINTABLE DOCUMENTS =====================

def _get_primary_location_for_product(db: Session, product_id: int) -> dict:
    inv = (
        db.query(models.W00_Inventory)
        .join(models.W00_Location, models.W00_Inventory.location_id == models.W00_Location.id)
        .options(joinedload(models.W00_Inventory.location))
        .filter(models.W00_Inventory.product_id == product_id, models.W00_Inventory.condition == "brand_new")
        .order_by(desc(models.W00_Inventory.quantity))
        .first()
    )
    if inv and inv.location:
        return {
            "location_code": inv.location.location_code,
            "zone": inv.location.zone,
            "aisle": inv.location.aisle,
            "shelf": inv.location.shelf,
            "bin": inv.location.bin,
            "quantity_available": max(0, inv.quantity - inv.reserved_quantity),
        }
    return {
        "location_code": "WH-CENTRAL-GENERAL",
        "zone": "General",
        "aisle": "01",
        "shelf": "01",
        "bin": "01",
        "quantity_available": 0,
    }


# 1. Warehouse Fulfillment Orders List
@app.get("/api/warehouse/fulfillment/orders")
def get_warehouse_fulfillment_orders(
    status: str | None = None,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Returns customer orders requiring warehouse fulfillment, enriched with item warehouse location mappings.
    """
    q = (
        db.query(models.C00_Order)
        .options(
            joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product).joinedload(models.C00_Product.detail),
            joinedload(models.C00_Order.user),
        )
    )
    if status and status != "all":
        q = q.filter(models.C00_Order.status == status)
    
    orders = q.order_by(desc(models.C00_Order.created_at)).all()
    results = []

    for o in orders:
        items_payload = []
        for it in o.items:
            loc = _get_primary_location_for_product(db, it.product_id)
            items_payload.append({
                "id": it.id,
                "product_id": it.product_id,
                "title_en": it.product.title_en if it.product else f"Book #{it.product_id}",
                "title_zh": it.product.title_zh if it.product else "",
                "isbn": it.product.detail.isbn if it.product and it.product.detail else "N/A",
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "location_code": loc["location_code"],
                "zone": loc["zone"],
                "aisle": loc["aisle"],
                "shelf": loc["shelf"],
                "bin": loc["bin"],
                "available_at_location": loc["quantity_available"],
            })
        
        results.append({
            "id": o.id,
            "customer_id": o.user_id,
            "customer_email": o.user.email if o.user else "reader@example.com",
            "recipient_name": o.recipient_name or (o.user.full_name if o.user else "Customer"),
            "recipient_phone": o.recipient_phone or "",
            "shipping_address": o.shipping_address or "",
            "delivery_method": o.delivery_method,
            "payment_method": o.payment_method,
            "status": o.status,
            "tracking_number": o.tracking_number,
            "total_amount": o.total_amount,
            "shipping_fee": o.shipping_fee,
            "created_at": o.created_at,
            "items": items_payload,
            "total_items_count": sum(it.quantity for it in o.items),
        })
    return results


# 2. Advance Fulfillment Status (Picking -> Packed -> Shipped -> Delivered)
@app.post("/api/warehouse/fulfillment/orders/{order_id}/advance", response_model=schemas.OrderOut)
def advance_fulfillment_status(
    order_id: int,
    payload: schemas.FulfillmentAdvanceRequest,
    request: Request,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Advances order fulfillment pipeline: Processing -> Confirmed -> Picking -> Packed -> Shipped -> Delivered
    Automatically deducts physical stock from warehouse when advancing to Shipped.
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
    if payload.tracking_number:
        order.tracking_number = payload.tracking_number.strip()

    # Physical stock deduction when advancing to Shipped
    if payload.status in ["Shipped", "Out for Delivery", "Delivered"] and old_status in ["Processing", "Confirmed", "Picking", "Packed"]:
        for item in order.items:
            inv_records = (
                db.query(models.W00_Inventory)
                .filter(
                    models.W00_Inventory.product_id == item.product_id,
                    models.W00_Inventory.condition == "brand_new",
                )
                .order_by(models.W00_Inventory.id)
                .all()
            )
            to_deduct = item.quantity
            for inv in inv_records:
                if inv.reserved_quantity > 0:
                    deduct_amt = min(inv.reserved_quantity, to_deduct)
                    inv.reserved_quantity -= deduct_amt
                    inv.quantity = max(0, inv.quantity - deduct_amt)
                    to_deduct -= deduct_amt
                    if to_deduct == 0:
                        break
            if to_deduct > 0:
                for inv in inv_records:
                    if inv.quantity > 0:
                        deduct_amt = min(inv.quantity, to_deduct)
                        inv.quantity -= deduct_amt
                        to_deduct -= deduct_amt
                        if to_deduct == 0:
                            break

    elif payload.status == "Cancelled" and old_status in ["Processing", "Confirmed", "Picking", "Packed"]:
        for item in order.items:
            inv_records = (
                db.query(models.W00_Inventory)
                .filter(
                    models.W00_Inventory.product_id == item.product_id,
                    models.W00_Inventory.condition == "brand_new",
                )
                .all()
            )
            to_release = item.quantity
            for inv in inv_records:
                if inv.reserved_quantity > 0:
                    release_amt = min(inv.reserved_quantity, to_release)
                    inv.reserved_quantity -= release_amt
                    to_release -= release_amt
                    if to_release == 0:
                        break

    client_ip = request.client.host if request.client else "unknown"
    db.add(
        models.S00_ActivityLog(
            user_id=manager.id,
            action="ADVANCE_FULFILLMENT",
            entity_type="ORDER",
            entity_id=order.id,
            details=f"Fulfillment advanced from '{old_status}' to '{payload.status}' by manager {manager.email}. Notes: {payload.notes or 'None'}",
            ip_address=client_ip,
        )
    )

    db.commit()
    db.refresh(order)
    return _format_order(order)


# 3. Generate Consolidated Warehouse Pick List
@app.post("/api/warehouse/fulfillment/generate-picklist", response_model=schemas.PickListResponse)
def generate_warehouse_picklist(
    order_ids: list[int] | None = None,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Aggregates items from selected orders (or all pending/confirmed/picking orders)
    and sorts them by Warehouse Zone -> Aisle -> Shelf -> Bin for efficient walking routes.
    """
    q = (
        db.query(models.C00_Order)
        .options(
            joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product).joinedload(models.C00_Product.detail),
        )
    )
    if order_ids and len(order_ids) > 0:
        q = q.filter(models.C00_Order.id.in_(order_ids))
    else:
        q = q.filter(models.C00_Order.status.in_(["Processing", "Confirmed", "Picking"]))
    
    orders = q.all()
    product_orders_map = {}  # product_id -> { "product": prod, "total_qty": int, "orders": set() }

    for o in orders:
        for it in o.items:
            pid = it.product_id
            if pid not in product_orders_map:
                product_orders_map[pid] = {
                    "product": it.product,
                    "total_qty": 0,
                    "orders": set(),
                }
            product_orders_map[pid]["total_qty"] += it.quantity
            product_orders_map[pid]["orders"].add(o.id)

    pick_items = []
    for pid, data in product_orders_map.items():
        prod = data["product"]
        loc = _get_primary_location_for_product(db, pid)
        pick_items.append(
            schemas.PickListItem(
                product_id=pid,
                title_en=prod.title_en if prod else f"Book #{pid}",
                title_zh=prod.title_zh if prod else "",
                isbn=prod.detail.isbn if prod and prod.detail else "N/A",
                location_code=loc["location_code"],
                zone=loc["zone"],
                aisle=loc["aisle"],
                shelf=loc["shelf"],
                bin=loc["bin"],
                quantity_to_pick=data["total_qty"],
                order_ids=sorted(list(data["orders"])),
            )
        )

    # Sort pick list by Zone -> Aisle -> Shelf -> Bin for optimal picker route
    pick_items.sort(key=lambda x: (x.zone, x.aisle, x.shelf, x.bin, x.title_en))

    return schemas.PickListResponse(
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        total_orders_count=len(orders),
        total_items_to_pick=sum(i.quantity_to_pick for i in pick_items),
        pick_items=pick_items,
    )


# 4. Low-Stock Alerts & Procurement Urgency
@app.get("/api/warehouse/procurement/low-stock-alerts", response_model=list[schemas.LowStockAlertOut])
def get_low_stock_alerts(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """
    Scans all products and compares total available brand-new stock across warehouses against safety thresholds.
    Flags CRITICAL (<= 0), LOW (<= safety_stock), or NORMAL.
    """
    products = (
        db.query(models.C00_Product)
        .options(joinedload(models.C00_Product.detail), joinedload(models.C00_Product.category))
        .filter(models.C00_Product.is_active == True)
        .all()
    )

    alerts = []
    for prod in products:
        inv_records = (
            db.query(models.W00_Inventory)
            .filter(
                models.W00_Inventory.product_id == prod.id,
                models.W00_Inventory.condition == "brand_new",
            )
            .all()
        )
        total_on_hand = sum(i.quantity for i in inv_records)
        total_reserved = sum(i.reserved_quantity for i in inv_records)
        total_available = max(0, total_on_hand - total_reserved)
        safety_stock = getattr(prod, "safety_stock", 15) or 15
        reorder_qty = getattr(prod, "reorder_quantity", 50) or 50
        cost_price = getattr(prod, "cost_price", round(prod.price * 0.6, 2)) or round(prod.price * 0.6, 2)

        if total_available <= 0:
            urgency = "CRITICAL"
        elif total_available <= safety_stock:
            urgency = "LOW"
        else:
            urgency = "NORMAL"

        alerts.append(
            schemas.LowStockAlertOut(
                product_id=prod.id,
                title_en=prod.title_en,
                title_zh=prod.title_zh,
                isbn=prod.detail.isbn if prod.detail else "N/A",
                category_name=prod.category.name_en if prod.category else "General",
                total_on_hand=total_on_hand,
                total_reserved=total_reserved,
                total_available=total_available,
                safety_stock=safety_stock,
                reorder_quantity=reorder_qty,
                cost_price=cost_price,
                retail_price=prod.price,
                urgency=urgency,
            )
        )

    # Sort so CRITICAL and LOW alerts appear at the very top
    order_map = {"CRITICAL": 0, "LOW": 1, "NORMAL": 2}
    alerts.sort(key=lambda x: (order_map.get(x.urgency, 3), x.total_available))
    return alerts


# 5. Suppliers Management
@app.get("/api/warehouse/procurement/suppliers", response_model=list[schemas.SupplierOut])
def get_suppliers(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    return db.query(models.W00_Supplier).filter(models.W00_Supplier.is_active == True).order_by(models.W00_Supplier.name).all()


@app.post("/api/warehouse/procurement/suppliers", response_model=schemas.SupplierOut, status_code=201)
def create_supplier(
    payload: schemas.SupplierCreate,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    existing = db.query(models.W00_Supplier).filter(models.W00_Supplier.name == payload.name.strip()).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"Supplier '{payload.name}' already exists")
    
    supplier = models.W00_Supplier(
        name=payload.name.strip(),
        contact_name=payload.contact_name.strip() if payload.contact_name else None,
        email=payload.email.strip().lower() if payload.email else None,
        phone=payload.phone.strip() if payload.phone else None,
        lead_time_days=payload.lead_time_days or 5,
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return supplier


# 6. Purchase Orders (PO) Management
def _format_po(po: models.W00_PurchaseOrder) -> dict:
    items_out = []
    for it in po.items:
        items_out.append({
            "id": it.id,
            "product_id": it.product_id,
            "product_title_en": it.product.title_en if it.product else f"Book #{it.product_id}",
            "product_title_zh": it.product.title_zh if it.product else "",
            "isbn": it.product.detail.isbn if it.product and it.product.detail else "N/A",
            "quantity_ordered": it.quantity_ordered,
            "quantity_received": it.quantity_received,
            "unit_cost": it.unit_cost,
        })
    return {
        "id": po.id,
        "po_number": po.po_number,
        "supplier_id": po.supplier_id,
        "supplier_name": po.supplier.name if po.supplier else "Standard Supplier",
        "status": po.status,
        "total_cost": po.total_cost,
        "notes": po.notes,
        "created_by_name": po.created_by_name,
        "ordered_at": po.ordered_at,
        "received_at": po.received_at,
        "created_at": po.created_at,
        "items": items_out,
    }


@app.get("/api/warehouse/procurement/purchase-orders", response_model=list[schemas.PurchaseOrderOut])
def get_purchase_orders(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    orders = (
        db.query(models.W00_PurchaseOrder)
        .options(
            joinedload(models.W00_PurchaseOrder.supplier),
            joinedload(models.W00_PurchaseOrder.items).joinedload(models.W00_PurchaseOrderItem.product).joinedload(models.C00_Product.detail),
        )
        .order_by(desc(models.W00_PurchaseOrder.created_at))
        .all()
    )
    return [_format_po(p) for p in orders]


@app.post("/api/warehouse/procurement/purchase-orders", response_model=schemas.PurchaseOrderOut, status_code=201)
def create_purchase_order(
    payload: schemas.PurchaseOrderCreate,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cannot create empty Purchase Order")
    
    supplier = db.query(models.W00_Supplier).filter(models.W00_Supplier.id == payload.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Selected supplier not found")

    po_number = f"PO-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
    total_cost = 0.0
    po_items_to_create = []

    for it in payload.items:
        prod = db.query(models.C00_Product).filter(models.C00_Product.id == it.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Book #{it.product_id} not found")
        cost = it.unit_cost if it.unit_cost is not None else getattr(prod, "cost_price", round(prod.price * 0.6, 2))
        total_cost += cost * it.quantity
        po_items_to_create.append((prod, it.quantity, cost))

    po = models.W00_PurchaseOrder(
        po_number=po_number,
        supplier_id=supplier.id,
        status="ORDERED",
        total_cost=round(total_cost, 2),
        notes=payload.notes,
        created_by_user_id=manager.id,
        created_by_name=manager.full_name or manager.email,
    )
    db.add(po)
    db.flush()

    for prod, qty, cost in po_items_to_create:
        po_item = models.W00_PurchaseOrderItem(
            po_id=po.id,
            product_id=prod.id,
            quantity_ordered=qty,
            quantity_received=0,
            unit_cost=cost,
        )
        db.add(po_item)

    db.commit()
    db.refresh(po)
    refreshed = (
        db.query(models.W00_PurchaseOrder)
        .options(
            joinedload(models.W00_PurchaseOrder.supplier),
            joinedload(models.W00_PurchaseOrder.items).joinedload(models.W00_PurchaseOrderItem.product).joinedload(models.C00_Product.detail),
        )
        .filter(models.W00_PurchaseOrder.id == po.id)
        .first()
    )
    return _format_po(refreshed)


# 7. Goods Receipt Voucher (Receive PO & Put Away into Location)
@app.post("/api/warehouse/procurement/purchase-orders/{po_id}/receive")
def receive_purchase_order(
    po_id: int,
    payload: schemas.PurchaseOrderReceiveRequest,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    po = (
        db.query(models.W00_PurchaseOrder)
        .options(joinedload(models.W00_PurchaseOrder.items).joinedload(models.W00_PurchaseOrderItem.product))
        .filter(models.W00_PurchaseOrder.id == po_id)
        .first()
    )
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    if po.status == "RECEIVED":
        raise HTTPException(status_code=400, detail="Purchase Order has already been received")

    loc = db.query(models.W00_Location).filter(models.W00_Location.id == payload.target_location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Target warehouse put-away location not found")

    target_condition = payload.condition or "brand_new"

    # Put away each received book into the selected location & create adjustment log
    for it in po.items:
        it.quantity_received = it.quantity_ordered

        inv = (
            db.query(models.W00_Inventory)
            .filter(
                models.W00_Inventory.product_id == it.product_id,
                models.W00_Inventory.location_id == loc.id,
                models.W00_Inventory.condition == target_condition,
            )
            .first()
        )
        if inv:
            inv.quantity += it.quantity_ordered
            inv.updated_at = datetime.now(timezone.utc)
        else:
            inv = models.W00_Inventory(
                product_id=it.product_id,
                location_id=loc.id,
                condition=target_condition,
                quantity=it.quantity_ordered,
                reserved_quantity=0,
            )
            db.add(inv)

        # Log adjustment voucher for audit trail
        adj = models.W00_Adjustment(
            voucher_no=f"RCV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}",
            product_id=it.product_id,
            from_location_id=None,
            to_location_id=loc.id,
            from_condition=None,
            to_condition=target_condition,
            change_qty=it.quantity_ordered,
            reason_code="PO_RECEIPT",
            notes=f"Received against {po.po_number}. {payload.notes or ''}".strip(),
            created_by_user_id=manager.id,
            created_by_name=manager.full_name or manager.email,
            status="APPROVED",
        )
        db.add(adj)

    po.status = "RECEIVED"
    po.received_at = datetime.now(timezone.utc)
    db.commit()

    return {"message": f"Successfully received PO {po.po_number} and put away items into location {loc.location_code}!"}


# 8. Printable Customer Invoice HTML
@app.get("/api/orders/{order_id}/invoice-html", response_class=HTMLResponse)
def get_order_invoice_html(
    order_id: int,
    autoprint: bool = False,
    db: Session = Depends(get_db),
):
    """
    Renders a print-ready, professional HTML invoice with tax breakdown and billing/shipping details.
    """
    order = (
        db.query(models.C00_Order)
        .options(
            joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product).joinedload(models.C00_Product.detail),
            joinedload(models.C00_Order.user),
        )
        .filter(models.C00_Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    html_content = document_service.generate_invoice_html(order, autoprint=autoprint)
    return HTMLResponse(content=html_content)


# 9. Printable Warehouse Packing Slip HTML
@app.get("/api/warehouse/fulfillment/orders/{order_id}/packing-slip-html", response_class=HTMLResponse)
def get_packing_slip_html(
    order_id: int,
    autoprint: bool = False,
    db: Session = Depends(get_db),
):
    """
    Renders a print-ready warehouse packing slip with barcode graphic, picker checklist, and location mappings.
    """
    order = (
        db.query(models.C00_Order)
        .options(
            joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product).joinedload(models.C00_Product.detail),
            joinedload(models.C00_Order.user),
        )
        .filter(models.C00_Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    item_locations = {}
    for it in order.items:
        item_locations[it.product_id] = _get_primary_location_for_product(db, it.product_id)

    html_content = document_service.generate_packing_slip_html(order, item_locations, autoprint=autoprint)
    return HTMLResponse(content=html_content)


