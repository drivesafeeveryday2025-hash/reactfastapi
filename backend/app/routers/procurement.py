import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from .. import helpers, models, schemas
from ..database import get_db
from ..dependencies import require_manager

router = APIRouter(tags=["Procurement & Suppliers"])


@router.get("/api/warehouse/procurement/low-stock-alerts", response_model=list[schemas.LowStockAlertOut])
def get_low_stock_alerts(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
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

    order_map = {"CRITICAL": 0, "LOW": 1, "NORMAL": 2}
    alerts.sort(key=lambda x: (order_map.get(x.urgency, 3), x.total_available))
    return alerts


@router.get("/api/warehouse/procurement/suppliers", response_model=list[schemas.SupplierOut])
def get_suppliers(
    manager: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
    return db.query(models.W00_Supplier).filter(models.W00_Supplier.is_active == True).order_by(models.W00_Supplier.name).all()


@router.post("/api/warehouse/procurement/suppliers", response_model=schemas.SupplierOut, status_code=201)
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


@router.get("/api/warehouse/procurement/purchase-orders", response_model=list[schemas.PurchaseOrderOut])
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
    return [helpers.format_po(p) for p in orders]


@router.post("/api/warehouse/procurement/purchase-orders", response_model=schemas.PurchaseOrderOut, status_code=201)
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
    return helpers.format_po(refreshed)


@router.post("/api/warehouse/procurement/purchase-orders/{po_id}/receive")
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
