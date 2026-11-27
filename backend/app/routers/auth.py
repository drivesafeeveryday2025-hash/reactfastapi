import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import auth, email_service, models, schemas
from ..database import get_db
from ..dependencies import get_current_user

router = APIRouter(tags=["Authentication & User Profile"])

MAX_FAILED_ATTEMPTS_PER_EMAIL = 5
MAX_FAILED_ATTEMPTS_PER_IP = 10
LOCKOUT_MINUTES = 15
RATE_WINDOW_MINUTES = 10

_ip_lockouts: dict[str, datetime] = {}
_email_lockouts: dict[str, datetime] = {}


def check_login_rate_limits(client_ip: str, email: str, db: Session):
    """
    Prevents brute-force dictionary attacks and web bot floods on the login endpoint.
    1. Checks fast in-memory ban cache to deflect DDoS floods in O(1) time.
    2. Checks PostgreSQL attempt records within the sliding rate window.
    """
    now = datetime.now(timezone.utc)

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


@router.post("/api/register", response_model=schemas.UserOut, status_code=201)
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


@router.post("/api/login", response_model=schemas.Token)
def login(payload: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    client_ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")[:300]
    now = datetime.now(timezone.utc)

    check_login_rate_limits(client_ip=client_ip, email=email, db=db)

    user = db.query(models.S00_User).filter(models.S00_User.email == email).first()

    if not user or not auth.verify_password(payload.password, user.hashed_password):
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

    db.add(
        models.S00_LoginAttempt(
            ip_address=client_ip,
            email=email,
            attempt_time=now,
            is_successful=True,
            user_agent=user_agent,
        )
    )
    _email_lockouts.pop(email, None)
    _ip_lockouts.pop(client_ip, None)

    db.add(
        models.S00_LoginLog(
            user_id=user.id,
            ip_address=client_ip,
            user_agent=user_agent,
            status="SUCCESS",
        )
    )
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


@router.post("/api/auth/forgot-password", response_model=schemas.ForgotPasswordResponse)
def request_password_reset(
    payload: schemas.ForgotPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Generates a cryptographically random, 30-minute reset token and sends a reset link via email."""
    email = payload.email.strip().lower()
    user = db.query(models.S00_User).filter(models.S00_User.email == email).first()
    client_ip = request.client.host if request.client else "unknown"

    dev_reset_link = None

    if user:
        db.query(models.S00_PasswordReset).filter(
            models.S00_PasswordReset.user_id == user.id,
            models.S00_PasswordReset.is_used == False,
        ).update({"is_used": True})

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

        result = email_service.send_password_reset_email(
            to_email=user.email,
            recipient_name=user.full_name or user.email,
            reset_token=token,
        )
        dev_reset_link = result.get("reset_url")

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


@router.get("/api/auth/verify-reset-token", response_model=schemas.VerifyResetTokenResponse)
def verify_reset_token(token: str, db: Session = Depends(get_db)):
    """Verifies that a reset token is valid, unexpired, and not yet used."""
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


@router.post("/api/auth/reset-password", response_model=schemas.ResetPasswordResponse)
def reset_password(
    payload: schemas.ResetPasswordRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Sets a new password using a verified reset token."""
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

    user.hashed_password = auth.hash_password(new_pwd)
    record.is_used = True
    record.used_at = now

    _email_lockouts.pop(user.email, None)
    client_ip = request.client.host if request.client else "unknown"
    _ip_lockouts.pop(client_ip, None)
    db.query(models.S00_LoginAttempt).filter(
        models.S00_LoginAttempt.email == user.email,
        models.S00_LoginAttempt.is_successful == False,
    ).delete()

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


@router.get("/api/me", response_model=schemas.UserOut)
def read_me(current_user: models.S00_User = Depends(get_current_user)):
    return current_user


@router.put("/api/user/profile", response_model=schemas.UserOut)
def update_user_profile(
    payload: schemas.UserProfileUpdate,
    request: Request,
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Updates the current authenticated user's profile details."""
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
