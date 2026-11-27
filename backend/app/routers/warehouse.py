import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import HTMLResponse
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from .. import barcode_service, document_service, excel_service, helpers, models, schemas
from ..database import get_db
from ..dependencies import require_manager

router = APIRouter(tags=["Warehouse, Fulfillment & Barcodes"])


@router.get("/api/warehouse/overview", response_model=schemas.WarehouseOverviewOut)
def get_warehouse_overview(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    total_units_on_hand = db.query(func.coalesce(func.sum(models.W00_Inventory.quantity), 0)).scalar()
    total_units_reserved = db.query(func.coalesce(func.sum(models.W00_Inventory.reserved_quantity), 0)).scalar()
    total_distinct_skus = db.query(func.count(func.distinct(models.W00_Inventory.product_id))).scalar()

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


@router.get("/api/warehouse/facilities", response_model=list[schemas.WarehouseOut])
def get_warehouse_facilities(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    return db.query(models.W00_Warehouse).order_by(models.W00_Warehouse.id).all()


@router.get("/api/warehouse/locations", response_model=list[schemas.WarehouseLocationOut])
def get_warehouse_locations(
    warehouse_id: int | None = None,
    zone: str | None = None,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
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


@router.get("/api/warehouse/inventory", response_model=list[schemas.InventoryItemOut])
def get_warehouse_inventory(
    warehouse_id: int | None = None,
    zone: str | None = None,
    condition: str | None = None,
    product_id: int | None = None,
    search: str | None = None,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
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
    return [helpers.format_inventory_item(i) for i in items]


@router.post("/api/warehouse/adjustments", response_model=schemas.AdjustmentOut, status_code=201)
def create_inventory_adjustment(
    payload: schemas.AdjustmentCreate,
    request: Request,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    prod = db.query(models.C00_Product).filter(models.C00_Product.id == payload.product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail=f"Product ID #{payload.product_id} not found")

    now = datetime.now(timezone.utc)
    voucher_no = f"ADJ-{now.strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

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
            target_inv.quantity += abs(payload.change_qty)
        else:
            target_inv.quantity = max(0, target_inv.quantity + payload.change_qty)

        target_inv.updated_at = now
    elif not payload.from_location_id and not payload.to_location_id:
        raise HTTPException(status_code=400, detail="Must specify either source or target location for stock adjustment.")

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
    return helpers.format_adjustment(adj)


@router.get("/api/warehouse/adjustments", response_model=list[schemas.AdjustmentOut])
def get_warehouse_adjustments(
    limit: int = 50,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
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
    return [helpers.format_adjustment(a) for a in adjs]


@router.post("/api/warehouse/stocktake/export-excel")
def export_stocktake_excel(
    payload: schemas.StocktakeFilterRequest,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
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
    formatted = [helpers.format_inventory_item(i) for i in items]

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


@router.get("/api/warehouse/fulfillment/orders")
def get_warehouse_fulfillment_orders(
    status: str | None = None,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
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
            loc = helpers.get_primary_location_for_product(db, it.product_id)
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


@router.post("/api/warehouse/fulfillment/orders/{order_id}/advance", response_model=schemas.OrderOut)
def advance_fulfillment_status(
    order_id: int,
    payload: schemas.FulfillmentAdvanceRequest,
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
    if payload.tracking_number:
        order.tracking_number = payload.tracking_number.strip()

    helpers.apply_order_stock_transition(
        db,
        order,
        old_status,
        payload.status,
        pre_ship_statuses=("Processing", "Confirmed", "Picking", "Packed"),
    )

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
    return helpers.format_order(order)


@router.post("/api/warehouse/fulfillment/generate-picklist", response_model=schemas.PickListResponse)
def generate_warehouse_picklist(
    order_ids: list[int] | None = None,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
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
    product_orders_map = {}

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
        loc = helpers.get_primary_location_for_product(db, pid)
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

    pick_items.sort(key=lambda x: (x.zone, x.aisle, x.shelf, x.bin, x.title_en))

    return schemas.PickListResponse(
        generated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        total_orders_count=len(orders),
        total_items_to_pick=sum(i.quantity_to_pick for i in pick_items),
        pick_items=pick_items,
    )


@router.get("/api/warehouse/fulfillment/orders/{order_id}/packing-slip-html", response_class=HTMLResponse)
def get_packing_slip_html(
    order_id: int,
    autoprint: bool = False,
    db: Session = Depends(get_db),
):
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
        item_locations[it.product_id] = helpers.get_primary_location_for_product(db, it.product_id)

    html_content = document_service.generate_packing_slip_html(order, item_locations, autoprint=autoprint)
    return HTMLResponse(content=html_content)


@router.get("/api/warehouse/locations/{location_id}/bin-label-html", response_class=HTMLResponse)
def get_location_bin_label_html(
    location_id: int,
    db: Session = Depends(get_db),
):
    loc = db.query(models.W00_Location).filter(models.W00_Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=404, detail="Warehouse location not found")

    books = (
        db.query(models.W00_Inventory)
        .options(joinedload(models.W00_Inventory.product))
        .filter(models.W00_Inventory.location_id == location_id, models.W00_Inventory.quantity > 0)
        .all()
    )
    html = barcode_service.generate_bin_label_html(loc, books_in_bin=books)
    return HTMLResponse(content=html)


@router.get("/api/warehouse/scanner/lookup", response_model=schemas.BarcodeLookupResult)
def barcode_scanner_lookup(
    code: str,
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    clean = code.strip().upper()

    loc = db.query(models.W00_Location).options(joinedload(models.W00_Location.warehouse)).filter(
        func.upper(models.W00_Location.location_code) == clean
    ).first()
    if loc:
        invs = (
            db.query(models.W00_Inventory)
            .options(joinedload(models.W00_Inventory.product).joinedload(models.C00_Product.detail))
            .filter(models.W00_Inventory.location_id == loc.id)
            .all()
        )
        books_payload = [
            {
                "product_id": i.product_id,
                "title_en": i.product.title_en if i.product else f"Book #{i.product_id}",
                "isbn": i.product.detail.isbn if i.product and i.product.detail else "N/A",
                "condition": i.condition,
                "quantity": i.quantity,
                "reserved": i.reserved_quantity,
                "available": max(0, i.quantity - i.reserved_quantity),
            }
            for i in invs
        ]
        return schemas.BarcodeLookupResult(
            scanned_code=clean,
            entity_type="LOCATION",
            location_details={
                "id": loc.id,
                "location_code": loc.location_code,
                "warehouse": loc.warehouse.name_en if loc.warehouse else "Warehouse",
                "zone": loc.zone,
                "aisle": loc.aisle,
                "shelf": loc.shelf,
                "bin": loc.bin,
                "category_hint": loc.category_hint or "General",
                "stored_books": books_payload,
            },
        )

    prod_query = db.query(models.C00_Product).options(joinedload(models.C00_Product.detail))
    prod = None
    if clean.isdigit():
        prod = prod_query.filter(models.C00_Product.id == int(clean)).first()
    if not prod:
        prod = (
            prod_query.join(models.C00_ProdDetail, models.C00_Product.id == models.C00_ProdDetail.product_id)
            .filter(func.upper(models.C00_ProdDetail.isbn) == clean)
            .first()
        )

    if prod:
        invs = (
            db.query(models.W00_Inventory)
            .options(joinedload(models.W00_Inventory.location))
            .filter(models.W00_Inventory.product_id == prod.id)
            .all()
        )
        locations_payload = [
            {
                "location_code": i.location.location_code if i.location else "N/A",
                "zone": i.location.zone if i.location else "General",
                "condition": i.condition,
                "quantity": i.quantity,
                "reserved": i.reserved_quantity,
                "available": max(0, i.quantity - i.reserved_quantity),
            }
            for i in invs
        ]
        return schemas.BarcodeLookupResult(
            scanned_code=clean,
            entity_type="PRODUCT",
            product_details={
                "id": prod.id,
                "title_en": prod.title_en,
                "title_zh": prod.title_zh,
                "author": prod.author_en,
                "price": prod.price,
                "cost_price": getattr(prod, "cost_price", round(prod.price * 0.6, 2)),
                "isbn": prod.detail.isbn if prod.detail else "N/A",
                "stock_locations": locations_payload,
                "total_on_hand": sum(i.quantity for i in invs),
                "total_available": sum(max(0, i.quantity - i.reserved_quantity) for i in invs),
            },
        )

    return schemas.BarcodeLookupResult(
        scanned_code=clean,
        entity_type="UNKNOWN",
        location_details=None,
        product_details=None,
    )
