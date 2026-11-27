import traceback
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from . import auth, models
from .database import Base, SessionLocal, engine
from .dependencies import get_current_user, get_optional_user, require_manager
from .routers import auth as auth_router
from .routers import orders as orders_router
from .routers import procurement as procurement_router
from .routers import products as products_router
from .routers import system as system_router
from .routers import warehouse as warehouse_router

# Re-export login lockout caches for backward-compatibility with security test suites
_ip_lockouts = auth_router._ip_lockouts
_email_lockouts = auth_router._email_lockouts

# Automatically creates any missing tables in PostgreSQL
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Apex Bookstore API & Activity Monitor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Catches ANY unhandled error across endpoints, records full traceback into
    PostgreSQL S00_error_logs, and returns a clean JSON error response.
    """
    stack_trace = traceback.format_exc()
    error_type = exc.__class__.__name__
    error_message = str(exc)
    client_ip = request.client.host if request.client else "unknown"

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

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "An internal server error occurred. Our engineering team has been notified.",
            "error_type": error_type,
            "error_log_id": log_id,
        },
    )


@app.get("/", tags=["Health"])
def read_root():
    """Root health endpoint providing quick links to API documentation and the frontend."""
    return {
        "status": "online",
        "service": "Apex Bookstore API",
        "swagger_docs": "http://localhost:8001/docs",
        "frontend_url": "http://localhost:5173",
    }


# Mount domain routers
app.include_router(auth_router.router)
app.include_router(system_router.router)
app.include_router(products_router.router)
app.include_router(orders_router.router)
app.include_router(warehouse_router.router)
app.include_router(procurement_router.router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8001, reload=True)

