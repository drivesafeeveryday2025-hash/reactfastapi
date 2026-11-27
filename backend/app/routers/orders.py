import json
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from .. import document_service, helpers, models, schemas
from ..database import get_db
from ..dependencies import get_current_user, require_manager

router = APIRouter(tags=["Orders, Coupons & Invoices"])


@router.post("/api/coupons/validate", response_model=schemas.CouponValidateResponse)
def validate_promo_coupon(
    payload: schemas.CouponValidateRequest,
    db: Session = Depends(get_db),
):
    clean_code = payload.code.strip().upper()
    coupon = (
        db.query(models.C00_Coupon)
        .filter(models.C00_Coupon.code == clean_code, models.C00_Coupon.is_active == True)
        .first()
    )
    if not coupon:
        return schemas.CouponValidateResponse(
            valid=False,
            code=clean_code,
            discount_amount=0.0,
            discount_type="NONE",
            discount_value=0.0,
            message="Invalid or expired promo code.",
        )

    now = datetime.now(timezone.utc)
    if coupon.expires_at and coupon.expires_at < now:
        return schemas.CouponValidateResponse(
            valid=False,
            code=clean_code,
            discount_amount=0.0,
            discount_type=coupon.discount_type,
            discount_value=coupon.discount_value,
            message="This promo code has expired.",
        )

    if payload.cart_subtotal < coupon.min_spend:
        return schemas.CouponValidateResponse(
            valid=False,
            code=clean_code,
            discount_amount=0.0,
            discount_type=coupon.discount_type,
            discount_value=coupon.discount_value,
            message=f"Minimum spend of ${coupon.min_spend:.2f} required to use this promo code.",
        )

    if coupon.discount_type == "PERCENT":
        discount = round(payload.cart_subtotal * (coupon.discount_value / 100.0), 2)
        if coupon.max_discount:
            discount = min(discount, coupon.max_discount)
    else:
        discount = min(coupon.discount_value, payload.cart_subtotal)

    return schemas.CouponValidateResponse(
        valid=True,
        code=clean_code,
        discount_amount=discount,
        discount_type=coupon.discount_type,
        discount_value=coupon.discount_value,
        message=f"Promo code '{clean_code}' applied! Saved ${discount:.2f}",
    )


@router.post("/api/orders", response_model=schemas.OrderOut, status_code=201)
def place_order(
    payload: schemas.OrderCreate,
    request: Request,
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.items:
        raise HTTPException(status_code=400, detail="Cannot place empty order")

    subtotal = 0.0
    items_to_create = []
    item_summaries = []

    for item in payload.items:
        prod = db.query(models.C00_Product).filter(models.C00_Product.id == item.product_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Book #{item.product_id} not found")
        subtotal += prod.price * item.quantity
        items_to_create.append((prod, item.quantity))
        item_summaries.append(f"{prod.title_en} x{item.quantity}")

    subtotal = round(subtotal, 2)

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
        needed = qty
        for inv in inv_records:
            avail = max(0, inv.quantity - inv.reserved_quantity)
            if avail > 0:
                take = min(avail, needed)
                inv.reserved_quantity += take
                needed -= take
                if needed == 0:
                    break

    delivery_method = payload.delivery_method or "standard"
    if delivery_method == "express":
        shipping_fee = 12.00
        estimated_delivery = "Next Business Day Express"
    elif delivery_method == "pickup":
        shipping_fee = 0.00
        estimated_delivery = "Ready in 2 hours at Apex Downtown Store"
    else:
        delivery_method = "standard"
        shipping_fee = 0.00 if subtotal >= 35.0 else 5.00
        estimated_delivery = "3-5 Business Days Standard Delivery"

    discount_amount = 0.0
    applied_coupon_code = None
    if payload.coupon_code:
        clean_code = payload.coupon_code.strip().upper()
        coupon = db.query(models.C00_Coupon).filter(
            models.C00_Coupon.code == clean_code,
            models.C00_Coupon.is_active == True,
        ).first()
        if coupon:
            now = datetime.now(timezone.utc)
            if not (coupon.expires_at and coupon.expires_at < now) and (subtotal >= coupon.min_spend):
                if coupon.discount_type == "PERCENT":
                    discount_amount = round(subtotal * (coupon.discount_value / 100.0), 2)
                    if coupon.max_discount:
                        discount_amount = min(discount_amount, coupon.max_discount)
                else:
                    discount_amount = min(coupon.discount_value, subtotal)
                applied_coupon_code = clean_code
                coupon.usage_count += 1

    grand_total = max(0.0, round(subtotal + shipping_fee - discount_amount, 2))
    tracking_number = f"APEX-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

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
        coupon_code=applied_coupon_code,
        discount_amount=discount_amount,
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

    order_refreshed = (
        db.query(models.C00_Order)
        .options(joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product))
        .filter(models.C00_Order.id == order.id)
        .first()
    )
    return helpers.format_order(order_refreshed or order)


@router.get("/api/orders/my-orders", response_model=list[schemas.OrderOut])
def get_my_orders(
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    orders = (
        db.query(models.C00_Order)
        .options(joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product))
        .filter(models.C00_Order.user_id == current_user.id)
        .order_by(desc(models.C00_Order.created_at))
        .all()
    )
    return [helpers.format_order(o) for o in orders]


@router.get("/api/admin/orders", response_model=list[schemas.OrderOut])
def get_admin_orders(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    orders = (
        db.query(models.C00_Order)
        .options(joinedload(models.C00_Order.items).joinedload(models.C00_OrderItem.product))
        .order_by(desc(models.C00_Order.created_at))
        .all()
    )
    return [helpers.format_order(o) for o in orders]


@router.put("/api/admin/orders/{order_id}/status", response_model=schemas.OrderOut)
def update_order_status(
    order_id: int,
    payload: schemas.OrderStatusUpdate,
    request: Request,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
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

    helpers.apply_order_stock_transition(
        db,
        order,
        old_status,
        payload.status,
        pre_ship_statuses=("Processing", "Confirmed", "Picking"),
    )

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
    return helpers.format_order(order)


@router.get("/api/orders/{order_id}/invoice-html", response_class=HTMLResponse)
def get_order_invoice_html(
    order_id: int,
    autoprint: bool = False,
    db: Session = Depends(get_db),
):
    """Renders a print-ready HTML invoice with tax breakdown and billing/shipping details."""
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
