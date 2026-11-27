"""
Test suite for:
- Product Reviews & Star Ratings
- Wishlist / Saved Items
- Promo Coupons Engine & Order Discounting
- Financial Gross Margins & COGS Analytics
- Dead Stock & Inventory Turnover Detection
- Barcode & Bin Scanner Lookup
"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_advanced_suite():
    print("=== STARTING ADVANCED FEATURES TEST SUITE ===")

    # 1. Manager Login
    print("\n1. Authenticating Manager...")
    login_res = client.post("/api/login", json={"email": "react@mail.com", "password": "123456"})
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✓ Logged in successfully")

    # 2. Product Reviews & Ratings
    print("\n2. Testing Product Reviews & Ratings...")
    rev_get = client.get("/api/products/1/reviews")
    assert rev_get.status_code == 200
    rev_data = rev_get.json()
    print(f"  Book #1 average rating: {rev_data['average_rating']} ({rev_data['total_reviews']} reviews)")

    rev_submit = client.post(
        "/api/products/1/reviews",
        json={"rating": 5, "title": "Stunning quality", "comment": "The best book I have read this year!"},
        headers=headers,
    )
    assert rev_submit.status_code == 201
    print(f"✓ Submitted review for Book #1! Verified purchase flag: {rev_submit.json()['is_verified_purchase']}")

    # 3. Wishlists
    print("\n3. Testing Wishlist Toggle & Retrieval...")
    from app.database import SessionLocal
    from app import models
    with SessionLocal() as db:
        db.query(models.C00_Wishlist).filter(models.C00_Wishlist.product_id == 2).delete()
        db.commit()

    # Add Book #2 to wishlist
    wish_toggle = client.post("/api/wishlist/toggle/2", headers=headers)
    assert wish_toggle.status_code == 200
    assert wish_toggle.json()["wishlisted"] is True
    print("✓ Added Book #2 to wishlist")

    # Fetch wishlist
    wish_get = client.get("/api/wishlist", headers=headers)
    assert wish_get.status_code == 200
    wish_list = wish_get.json()
    assert any(w["product_id"] == 2 for w in wish_list)
    print(f"✓ Wishlist verified with {len(wish_list)} item(s)")

    # 4. Promo Coupons Validation
    print("\n4. Testing Promo Coupon Validation...")
    # Invalid coupon
    inv_coupon = client.post("/api/coupons/validate", json={"code": "NONEXISTENT", "cart_subtotal": 50.0})
    assert inv_coupon.status_code == 200
    assert inv_coupon.json()["valid"] is False

    # Valid coupon: WELCOME10 (10% off)
    val_coupon = client.post("/api/coupons/validate", json={"code": "WELCOME10", "cart_subtotal": 60.0})
    assert val_coupon.status_code == 200
    assert val_coupon.json()["valid"] is True
    assert val_coupon.json()["discount_amount"] == 6.0
    print(f"✓ Validated promo code WELCOME10! Discount: ${val_coupon.json()['discount_amount']}")

    # 5. Order Placement with Coupon Discount
    print("\n5. Testing Order Placement with Coupon Discount...")
    order_res = client.post(
        "/api/orders",
        json={
            "delivery_method": "standard",
            "payment_method": "credit_card",
            "items": [{"product_id": 1, "quantity": 1}],
            "coupon_code": "WELCOME10",
        },
        headers=headers,
    )
    assert order_res.status_code == 201
    ord_data = order_res.json()
    assert ord_data["coupon_code"] == "WELCOME10"
    assert ord_data["discount_amount"] > 0
    print(f"✓ Order #{ord_data['id']} placed with coupon '{ord_data['coupon_code']}'! Discount: ${ord_data['discount_amount']}")

    # 6. Financial Analytics (Revenue, COGS, Gross Profit Margin)
    print("\n6. Testing Financial & Margin Analytics...")
    fin_res = client.get("/api/admin/analytics/financial", headers=headers)
    assert fin_res.status_code == 200
    fin_data = fin_res.json()
    print(f"  Total Revenue: ${fin_data['total_gross_revenue']}")
    print(f"  Total COGS: ${fin_data['total_cogs']}")
    print(f"  Gross Profit: ${fin_data['total_gross_profit']}")
    print(f"  Gross Margin: {fin_data['gross_margin_percent']}%")
    assert fin_data["total_gross_revenue"] > 0
    assert len(fin_data["category_breakdown"]) > 0
    print("✓ Financial analytics computed successfully with category breakdown!")

    # 7. Dead Stock & Inventory Turnover Detection
    print("\n7. Testing Dead Stock & Inactive Inventory Analytics...")
    dead_res = client.get("/api/admin/analytics/dead-stock", headers=headers)
    assert dead_res.status_code == 200
    dead_items = dead_res.json()
    print(f"✓ Retrieved {len(dead_items)} slow-moving/dead stock title(s)")
    if dead_items:
        print(f"  Sample recommendation: '{dead_items[0]['title_en']}' -> {dead_items[0]['recommendation']}")

    # 8. Barcode Scanner Lookup for Storage Bins & Books
    print("\n8. Testing Barcode Scanner Lookup...")
    # Lookup by bin code
    bin_lookup = client.get("/api/warehouse/scanner/lookup?code=WH-CENTRAL-A01-S01-B01", headers=headers)
    assert bin_lookup.status_code == 200
    assert bin_lookup.json()["entity_type"] == "LOCATION"
    assert bin_lookup.json()["location_details"]["location_code"] == "WH-CENTRAL-A01-S01-B01"
    print("✓ Scanner successfully resolved bin location WH-CENTRAL-A01-S01-B01")

    # Lookup by book ID
    book_lookup = client.get("/api/warehouse/scanner/lookup?code=1", headers=headers)
    assert book_lookup.status_code == 200
    assert book_lookup.json()["entity_type"] == "PRODUCT"
    assert book_lookup.json()["product_details"]["id"] == 1
    print("✓ Scanner successfully resolved book #1 with location bin mappings")

    # 9. Printable Bin Sticker Label HTML
    print("\n9. Testing Printable Bin Label HTML...")
    label_res = client.get("/api/warehouse/locations/1/bin-label-html")
    assert label_res.status_code == 200
    assert "<svg" in label_res.text
    print("✓ Thermal bin barcode sticker label HTML rendered successfully")

    print("\n=======================================================")
    print("ALL ADVANCED FEATURES TESTS PASSED SUCCESSFULLY!")
    print("=======================================================")

if __name__ == "__main__":
    test_advanced_suite()
