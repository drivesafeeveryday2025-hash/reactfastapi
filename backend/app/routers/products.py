import json
from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile, status
from sqlalchemy import desc, func
from sqlalchemy.orm import Session, joinedload

from .. import excel_service, models, schemas, word_service
from ..database import get_db
from ..dependencies import get_current_user, require_manager

router = APIRouter(tags=["Products, Categories, Reviews & Wishlists"])


@router.get("/api/categories", response_model=list[schemas.CategoryOut])
def get_categories(db: Session = Depends(get_db)):
    return (
        db.query(models.C00_Category)
        .filter(models.C00_Category.is_active.is_(True))
        .order_by(models.C00_Category.sort_order)
        .all()
    )


@router.get("/api/products/recommended", response_model=list[schemas.ProductOut])
def get_recommended(db: Session = Depends(get_db)):
    return (
        db.query(models.C00_Product)
        .options(joinedload(models.C00_Product.detail))
        .filter(models.C00_Product.is_active.is_(True), models.C00_Product.is_recommended.is_(True))
        .all()
    )


@router.get("/api/products/bestsellers", response_model=list[schemas.ProductOut])
def get_store_bestsellers(limit: int = 10, db: Session = Depends(get_db)):
    """Calculates bestsellers ranked by store order volume."""
    sales_subquery = (
        db.query(
            models.C00_OrderItem.product_id,
            func.coalesce(func.sum(models.C00_OrderItem.quantity), 0).label("total_sold"),
        )
        .group_by(models.C00_OrderItem.product_id)
        .subquery()
    )

    return (
        db.query(models.C00_Product)
        .outerjoin(sales_subquery, models.C00_Product.id == sales_subquery.c.product_id)
        .options(joinedload(models.C00_Product.detail))
        .filter(models.C00_Product.is_active.is_(True))
        .order_by(desc(sales_subquery.c.total_sold), desc(models.C00_Product.price))
        .limit(limit)
        .all()
    )


@router.get("/api/products", response_model=list[schemas.ProductOut])
def get_products(category_id: int | None = None, db: Session = Depends(get_db)):
    query = (
        db.query(models.C00_Product)
        .options(joinedload(models.C00_Product.detail))
        .filter(models.C00_Product.is_active.is_(True))
    )
    if category_id:
        query = query.filter(models.C00_Product.category_id == category_id)
    return query.all()


@router.get("/api/products/excel-template")
def download_excel_template(
    current_user: models.S00_User = Depends(require_manager),
):
    excel_bytes = excel_service.generate_excel_template()
    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=apex_books_template.xlsx",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get("/api/products/word-template")
def download_word_template(
    current_user: models.S00_User = Depends(require_manager),
):
    word_bytes = word_service.generate_word_template()
    return Response(
        content=word_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": "attachment; filename=apex_books_template.docx",
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post("/api/products/import-excel", response_model=schemas.ExcelImportResult)
async def import_products_from_excel(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
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


@router.post("/api/products/import-word", response_model=schemas.ExcelImportResult)
async def import_products_from_word(
    file: UploadFile = File(...),
    request: Request = None,
    current_user: models.S00_User = Depends(require_manager),
    db: Session = Depends(get_db),
):
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


@router.get("/api/products/{product_id}/reviews", response_model=schemas.ReviewSummaryOut)
def get_product_reviews(product_id: int, db: Session = Depends(get_db)):
    reviews = (
        db.query(models.C00_Review)
        .options(joinedload(models.C00_Review.user))
        .filter(models.C00_Review.product_id == product_id)
        .order_by(desc(models.C00_Review.created_at))
        .all()
    )
    dist = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    total_score = 0
    items_out = []
    for r in reviews:
        r_val = max(1, min(5, r.rating))
        dist[r_val] += 1
        total_score += r_val
        user_display = (r.user.full_name or r.user.email.split("@")[0]) if r.user else "Anonymous Reader"
        items_out.append(
            schemas.ReviewOut(
                id=r.id,
                product_id=r.product_id,
                user_id=r.user_id,
                user_name=user_display,
                rating=r.rating,
                title=r.title,
                comment=r.comment,
                is_verified_purchase=r.is_verified_purchase,
                created_at=r.created_at,
            )
        )
    total_count = len(reviews)
    avg = round(total_score / total_count, 1) if total_count > 0 else 5.0
    return schemas.ReviewSummaryOut(
        average_rating=avg,
        total_reviews=total_count,
        rating_distribution=dist,
        reviews=items_out,
    )


@router.post("/api/products/{product_id}/reviews", response_model=schemas.ReviewOut, status_code=201)
def submit_product_review(
    product_id: int,
    payload: schemas.ReviewCreate,
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prod = db.query(models.C00_Product).filter(models.C00_Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    purchased = (
        db.query(models.C00_OrderItem)
        .join(models.C00_Order, models.C00_OrderItem.order_id == models.C00_Order.id)
        .filter(
            models.C00_Order.user_id == current_user.id,
            models.C00_OrderItem.product_id == product_id,
            models.C00_Order.status.in_(["Confirmed", "Picking", "Packed", "Shipped", "Out for Delivery", "Delivered"]),
        )
        .first()
    )

    review = models.C00_Review(
        product_id=product_id,
        user_id=current_user.id,
        rating=max(1, min(5, payload.rating)),
        title=payload.title.strip() if payload.title else None,
        comment=payload.comment.strip(),
        is_verified_purchase=True if purchased else False,
    )
    db.add(review)
    db.commit()
    db.refresh(review)

    user_display = current_user.full_name or current_user.email.split("@")[0]
    return schemas.ReviewOut(
        id=review.id,
        product_id=review.product_id,
        user_id=review.user_id,
        user_name=user_display,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        is_verified_purchase=review.is_verified_purchase,
        created_at=review.created_at,
    )


@router.get("/api/wishlist", response_model=list[schemas.WishlistItemOut])
def get_user_wishlist(
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    items = (
        db.query(models.C00_Wishlist)
        .options(joinedload(models.C00_Wishlist.product).joinedload(models.C00_Product.detail))
        .filter(models.C00_Wishlist.user_id == current_user.id)
        .order_by(desc(models.C00_Wishlist.created_at))
        .all()
    )
    results = []
    for w in items:
        p = w.product
        if p:
            isbn = p.detail.isbn if p.detail else None
            results.append(
                schemas.WishlistItemOut(
                    id=w.id,
                    product_id=p.id,
                    title_en=p.title_en,
                    title_zh=p.title_zh,
                    author_en=p.author_en,
                    price=p.price,
                    image_url=p.image_url,
                    isbn=isbn,
                    created_at=w.created_at,
                )
            )
    return results


@router.post("/api/wishlist/toggle/{product_id}")
def toggle_wishlist_item(
    product_id: int,
    current_user: models.S00_User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    prod = db.query(models.C00_Product).filter(models.C00_Product.id == product_id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Product not found")

    existing = (
        db.query(models.C00_Wishlist)
        .filter(models.C00_Wishlist.user_id == current_user.id, models.C00_Wishlist.product_id == product_id)
        .first()
    )
    if existing:
        db.delete(existing)
        db.commit()
        return {"wishlisted": False, "product_id": product_id, "message": "Removed from wishlist"}
    else:
        item = models.C00_Wishlist(user_id=current_user.id, product_id=product_id)
        db.add(item)
        db.commit()
        return {"wishlisted": True, "product_id": product_id, "message": "Added to wishlist"}
