import re
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from .. import ai_service, models, schemas
from ..database import get_db
from ..dependencies import get_current_user, get_optional_user, require_manager

router = APIRouter(tags=["System, Navigation, Chat & Analytics"])


@router.post("/api/activity", status_code=204)
def track_activity(
    payload: schemas.ActivityLogCreate,
    request: Request,
    current_user: models.S00_User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """Records customer browsing and storefront interaction events."""
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


@router.get("/api/system/logins", response_model=list[schemas.LoginLogOut])
def get_login_logs(
    limit: int = 50,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Returns the latest user login history (Manager only)."""
    return (
        db.query(models.S00_LoginLog)
        .order_by(desc(models.S00_LoginLog.login_time))
        .limit(limit)
        .all()
    )


@router.get("/api/system/activities", response_model=list[schemas.ActivityLogOut])
def get_activity_logs(
    limit: int = 100,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Returns the latest user website actions and interactions (Manager only)."""
    return (
        db.query(models.S00_ActivityLog)
        .order_by(desc(models.S00_ActivityLog.created_at))
        .limit(limit)
        .all()
    )


@router.get("/api/system/errors", response_model=list[schemas.ErrorLogOut])
def get_error_logs(
    limit: int = 50,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Returns recorded unhandled system errors and stack traces (Manager only)."""
    return (
        db.query(models.S00_ErrorLog)
        .order_by(desc(models.S00_ErrorLog.created_at))
        .limit(limit)
        .all()
    )


@router.get("/api/admin/overview")
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


@router.get("/api/admin/analytics/financial", response_model=schemas.FinancialAnalyticsOut)
def get_financial_analytics(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Computes Gross Revenue, COGS, Gross Profit, Margin %, and Category breakdown."""
    orders = (
        db.query(models.C00_Order)
        .options(joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product).joinedload(models.C00_Product.category))
        .filter(models.C00_Order.status != "Cancelled")
        .all()
    )

    total_revenue = 0.0
    total_cogs = 0.0
    category_map = {}

    for ord in orders:
        total_revenue += ord.total_amount
        for it in ord.items:
            prod = it.product
            cost = getattr(prod, "cost_price", 0.0) or (round(it.unit_price * 0.6, 2))
            item_cogs = cost * it.quantity
            item_revenue = it.unit_price * it.quantity
            total_cogs += item_cogs

            cat_id = prod.category_id if prod else 1
            cat_name = prod.category.name_en if prod and prod.category else "General"
            if cat_id not in category_map:
                category_map[cat_id] = {
                    "category_id": cat_id,
                    "category_name": cat_name,
                    "units": 0,
                    "revenue": 0.0,
                    "cogs": 0.0,
                }
            category_map[cat_id]["units"] += it.quantity
            category_map[cat_id]["revenue"] += item_revenue
            category_map[cat_id]["cogs"] += item_cogs

    total_profit = max(0.0, round(total_revenue - total_cogs, 2))
    margin_pct = round((total_profit / total_revenue * 100), 1) if total_revenue > 0 else 0.0
    avg_order = round(total_revenue / len(orders), 2) if orders else 0.0

    breakdown = []
    for cat_data in category_map.values():
        cat_prof = max(0.0, round(cat_data["revenue"] - cat_data["cogs"], 2))
        cat_margin = round((cat_prof / cat_data["revenue"] * 100), 1) if cat_data["revenue"] > 0 else 0.0
        breakdown.append(
            schemas.CategorySalesBreakdown(
                category_id=cat_data["category_id"],
                category_name=cat_data["category_name"],
                total_units_sold=cat_data["units"],
                gross_revenue=round(cat_data["revenue"], 2),
                gross_profit=cat_prof,
                margin_percent=cat_margin,
            )
        )
    breakdown.sort(key=lambda x: x.gross_revenue, reverse=True)

    return schemas.FinancialAnalyticsOut(
        total_gross_revenue=round(total_revenue, 2),
        total_cogs=round(total_cogs, 2),
        total_gross_profit=total_profit,
        gross_margin_percent=margin_pct,
        total_orders_count=len(orders),
        average_order_value=avg_order,
        category_breakdown=breakdown,
    )


@router.get("/api/admin/analytics/dead-stock", response_model=list[schemas.DeadStockItemOut])
def get_dead_stock_analytics(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    """Detects books with >= 45 days of zero order activity and computes tied-up capital."""
    products = (
        db.query(models.C00_Product)
        .options(joinedload(models.C00_Product.category), joinedload(models.C00_Product.detail))
        .filter(models.C00_Product.is_active == True)
        .all()
    )

    dead_stock_list = []
    for prod in products:
        inv_sum = db.query(func.coalesce(func.sum(models.W00_Inventory.quantity), 0)).filter(
            models.W00_Inventory.product_id == prod.id
        ).scalar()

        if inv_sum > 0:
            last_item = (
                db.query(models.C00_OrderItem)
                .join(models.C00_Order, models.C00_OrderItem.order_id == models.C00_Order.id)
                .filter(models.C00_OrderItem.product_id == prod.id, models.C00_Order.status != "Cancelled")
                .order_by(desc(models.C00_Order.created_at))
                .first()
            )
            now = datetime.now(timezone.utc)
            if last_item and hasattr(last_item, "order") and last_item.order.created_at:
                days_inactive = (now - last_item.order.created_at).days
            else:
                days_inactive = 95

            cost = getattr(prod, "cost_price", round(prod.price * 0.6, 2)) or round(prod.price * 0.6, 2)
            capital_tied = round(inv_sum * cost, 2)

            if days_inactive >= 45:
                recommendation = "Clearance 30% Off Promotion" if days_inactive < 75 else "Bundle Special or Publisher Return"
                dead_stock_list.append(
                    schemas.DeadStockItemOut(
                        product_id=prod.id,
                        title_en=prod.title_en,
                        title_zh=prod.title_zh,
                        isbn=prod.detail.isbn if prod.detail else "N/A",
                        category_name=prod.category.name_en if prod.category else "General",
                        days_since_last_sale=days_inactive,
                        total_on_hand=inv_sum,
                        unit_cost=cost,
                        capital_tied_up=capital_tied,
                        recommendation=recommendation,
                    )
                )

    dead_stock_list.sort(key=lambda x: (x.days_since_last_sale, x.capital_tied_up), reverse=True)
    return dead_stock_list


@router.get("/api/system/test-error")
def trigger_test_error():
    """Deliberately triggers an uncaught ZeroDivisionError to test the Global Exception Handler."""
    division_by_zero = 100 / 0
    return {"result": division_by_zero}


@router.post("/api/chat", response_model=schemas.ChatResponse)
def handle_chat_message(
    payload: schemas.ChatRequest,
    request: Request,
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Secure Grounded AI Chatbot endpoint."""
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    client_ip = request.client.host if request.client else "unknown"
    ai_service.enforce_chat_rate_limit(db, current_user.id, client_ip)

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


@router.get("/api/settings", response_model=schemas.SiteSettingOut)
def get_settings(db: Session = Depends(get_db)):
    settings = db.query(models.C00_SiteSetting).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not configured")
    return settings


@router.get("/api/navigation", response_model=list[schemas.NavigationMenuItemOut])
def get_navigation_menus(db: Session = Depends(get_db)):
    """Returns active hierarchical navigation menu structure from C00_navigation_menus."""
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


@router.get("/api/promotions", response_model=list[schemas.PromotionOut])
def get_promotions(db: Session = Depends(get_db)):
    return db.query(models.C00_Promotion).filter(models.C00_Promotion.is_active.is_(True)).all()
