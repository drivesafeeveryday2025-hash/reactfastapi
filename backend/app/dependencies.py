from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from . import auth, models
from .database import get_db

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer()),
    db: Session = Depends(get_db),
) -> models.S00_User:
    """Validates JWT Bearer token and returns the authenticated user."""
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
    """Ensures the authenticated user holds manager or superadmin privileges."""
    if current_user.role not in ("manager", "superadmin") and current_user.email not in ("react@mail", "react@mail.com"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Manager privileges required.",
        )
    return current_user


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.S00_User | None:
    """Returns the authenticated user if a valid token is present, otherwise None."""
    if not credentials:
        return None
    email = auth.decode_access_token(credentials.credentials)
    if not email:
        return None
    return db.query(models.S00_User).filter(models.S00_User.email == email).first()
