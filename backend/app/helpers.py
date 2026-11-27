from sqlalchemy import desc
from sqlalchemy.orm import Session, joinedload

from . import models


def format_order(order: models.C00_Order) -> dict:
    """Serializes an order ORM object and its line items into an API-ready dictionary."""
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
        "coupon_code": getattr(order, "coupon_code", None),
        "discount_amount": getattr(order, "discount_amount", 0.0) or 0.0,
        "created_at": order.created_at,
        "items": items_out,
    }


def apply_order_stock_transition(
    db: Session,
    order: models.C00_Order,
    old_status: str,
    new_status: str,
    pre_ship_statuses: tuple[str, ...] = ("Processing", "Confirmed", "Picking", "Packed"),
) -> None:
    """Applies physical warehouse stock deduction on shipment or releases reservations on cancellation."""
    if new_status in ("Shipped", "Out for Delivery", "Delivered") and old_status in pre_ship_statuses:
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
    elif new_status == "Cancelled" and old_status in pre_ship_statuses:
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


def format_inventory_item(inv: models.W00_Inventory) -> dict:
    """Serializes a warehouse inventory item with joined product and location metadata."""
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


def format_adjustment(adj: models.W00_Adjustment) -> dict:
    """Serializes a warehouse stock adjustment voucher."""
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


def get_primary_location_for_product(db: Session, product_id: int) -> dict:
    """Finds the primary brand-new warehouse storage bin with highest stock for a product."""
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


def format_po(po: models.W00_PurchaseOrder) -> dict:
    """Serializes a Purchase Order ORM record and its line items."""
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
