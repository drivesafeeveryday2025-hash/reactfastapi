"""
Automated End-to-End Test Suite for:
- Option A: Order-to-Warehouse Stock Reservation & Fulfillment Pipeline (Pick/Pack/Ship)
- Option B: Low-Stock Alerts, Suppliers, Purchase Orders & Goods Receiving
- Option C: Printable Customer Invoices & Warehouse Packing Slips
"""
import sys
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_full_pipeline():
    print("=== STARTING FULFILLMENT, PROCUREMENT & PRINTABLE DOCUMENTS SUITE ===")

    # 1. Manager Login
    print("\n1. Testing Manager Login...")
    login_res = client.post("/api/login", json={"email": "react@mail.com", "password": "123456"})
    assert login_res.status_code == 200, f"Manager login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("✓ Manager logged in successfully")

    # 2. Get baseline product stock
    print("\n2. Checking Inventory & Placing Order with Stock Reservation...")
    inv_res = client.get("/api/warehouse/inventory?product_id=1&condition=brand_new", headers=headers)
    assert inv_res.status_code == 200
    inv_data = inv_res.json()
    assert len(inv_data) > 0, "No inventory found for book #1"
    initial_on_hand = sum(i["quantity"] for i in inv_data)
    initial_reserved = sum(i["reserved_quantity"] for i in inv_data)
    print(f"  Book #1 initial stock: on_hand={initial_on_hand}, reserved={initial_reserved}")

    # Place an order for 2 units of Book #1
    order_payload = {
        "delivery_method": "standard",
        "payment_method": "credit_card",
        "recipient_name": "Test Reader",
        "recipient_phone": "+886 912-345-678",
        "shipping_address": "123 Test Avenue, Suite 4B",
        "items": [{"product_id": 1, "quantity": 2}],
    }
    order_res = client.post("/api/orders", json=order_payload, headers=headers)
    assert order_res.status_code == 201, f"Place order failed: {order_res.text}"
    order = order_res.json()
    order_id = order["id"]
    print(f"✓ Order #{order_id} placed successfully with tracking number {order['tracking_number']}")

    # Verify that reserved_quantity increased by 2 across warehouse
    inv_after_res = client.get("/api/warehouse/inventory?product_id=1&condition=brand_new", headers=headers)
    new_reserved = sum(i["reserved_quantity"] for i in inv_after_res.json())
    assert new_reserved == initial_reserved + 2, f"Expected reserved={initial_reserved+2}, got {new_reserved}"
    print(f"✓ Automatic stock reservation verified! Total reserved increased from {initial_reserved} to {new_reserved}")

    # 3. Test Insufficient Stock Handling
    print("\n3. Testing Insufficient Stock Rejection...")
    excess_res = client.post(
        "/api/orders",
        json={"items": [{"product_id": 1, "quantity": 999999}]},
        headers=headers,
    )
    assert excess_res.status_code == 400
    assert "Insufficient brand-new warehouse stock" in excess_res.json()["detail"]
    print("✓ Excessive stock order properly rejected with HTTP 400!")

    # 4. Warehouse Fulfillment: Query orders needing fulfillment
    print("\n4. Testing Warehouse Fulfillment Orders Query...")
    ful_orders_res = client.get("/api/warehouse/fulfillment/orders", headers=headers)
    assert ful_orders_res.status_code == 200
    orders_list = ful_orders_res.json()
    matching_order = next((o for o in orders_list if o["id"] == order_id), None)
    assert matching_order is not None
    assert len(matching_order["items"]) > 0
    item_loc = matching_order["items"][0]
    print(f"✓ Order #{order_id} found in fulfillment list. Item assigned to location: {item_loc['location_code']}")

    # 5. Warehouse Pick List Generation
    print("\n5. Testing Wave / Batch Pick List Generation...")
    picklist_res = client.post(
        "/api/warehouse/fulfillment/generate-picklist",
        json=[order_id],
        headers=headers,
    )
    assert picklist_res.status_code == 200
    picklist = picklist_res.json()
    assert picklist["total_items_to_pick"] >= 2
    assert len(picklist["pick_items"]) > 0
    pick_item = picklist["pick_items"][0]
    print(f"✓ Generated Pick List with {picklist['total_items_to_pick']} item(s). Sorted Location: {pick_item['location_code']} ({pick_item['zone']})")

    # 6. Advance Order Status: Confirmed -> Picking -> Packed -> Shipped
    print("\n6. Testing Fulfillment Pipeline Progression & Physical Stock Deduction...")
    # Advance to Picking
    client.post(
        f"/api/warehouse/fulfillment/orders/{order_id}/advance",
        json={"status": "Picking"},
        headers=headers,
    )
    # Advance to Packed
    client.post(
        f"/api/warehouse/fulfillment/orders/{order_id}/advance",
        json={"status": "Packed"},
        headers=headers,
    )
    # Advance to Shipped (This should deduct physical inventory and release reservation)
    ship_res = client.post(
        f"/api/warehouse/fulfillment/orders/{order_id}/advance",
        json={"status": "Shipped", "tracking_number": "TRACK-TEST-12345"},
        headers=headers,
    )
    assert ship_res.status_code == 200
    print(f"✓ Order #{order_id} advanced to Shipped!")

    # Verify physical stock on_hand decreased by 2 and reserved decreased by 2 across warehouse
    inv_shipped_res = client.get("/api/warehouse/inventory?product_id=1&condition=brand_new", headers=headers)
    shipped_on_hand = sum(i["quantity"] for i in inv_shipped_res.json())
    shipped_reserved = sum(i["reserved_quantity"] for i in inv_shipped_res.json())
    assert shipped_on_hand == initial_on_hand - 2, f"Expected on_hand={initial_on_hand-2}, got {shipped_on_hand}"
    assert shipped_reserved == initial_reserved, f"Expected reserved={initial_reserved}, got {shipped_reserved}"
    print(f"✓ Physical stock deduction confirmed! Total On-hand: {shipped_on_hand}, Total Reserved: {shipped_reserved}")

    # 7. Low-Stock Alerts & Safety Stock Check
    print("\n7. Testing Low-Stock Alerts & Procurement Urgency...")
    alerts_res = client.get("/api/warehouse/procurement/low-stock-alerts", headers=headers)
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) > 0
    print(f"✓ Retrieved {len(alerts)} product alerts. Top alert: '{alerts[0]['title_en']}' (Urgency: {alerts[0]['urgency']})")

    # 8. Suppliers
    print("\n8. Testing Suppliers List & Creation...")
    suppliers_res = client.get("/api/warehouse/procurement/suppliers", headers=headers)
    assert suppliers_res.status_code == 200
    suppliers = suppliers_res.json()
    assert len(suppliers) >= 4
    sup_id = suppliers[0]["id"]
    print(f"✓ Verified {len(suppliers)} book suppliers available. Selected: {suppliers[0]['name']}")

    # 9. Create Purchase Order
    print("\n9. Testing Purchase Order (PO) Creation...")
    po_payload = {
        "supplier_id": sup_id,
        "notes": "Emergency restock order for upcoming seasonal sale",
        "items": [
            {"product_id": 1, "quantity": 50, "unit_cost": 15.50},
        ],
    }
    po_res = client.post("/api/warehouse/procurement/purchase-orders", json=po_payload, headers=headers)
    assert po_res.status_code == 201, f"PO creation failed: {po_res.text}"
    po = po_res.json()
    po_id = po["id"]
    print(f"✓ Created Purchase Order {po['po_number']} with total cost ${po['total_cost']}")

    # 10. Goods Receiving Voucher (Receive PO & Put Away into Location)
    print("\n10. Testing Goods Receiving Voucher & Put-Away...")
    # Get a valid location
    loc_res = client.get("/api/warehouse/locations", headers=headers)
    loc_id = loc_res.json()[0]["id"]
    loc_code = loc_res.json()[0]["location_code"]

    receive_res = client.post(
        f"/api/warehouse/procurement/purchase-orders/{po_id}/receive",
        json={"target_location_id": loc_id, "condition": "brand_new", "notes": "Inspected at Bay 1 dock"},
        headers=headers,
    )
    assert receive_res.status_code == 200, f"PO receiving failed: {receive_res.text}"
    print(f"✓ Received PO {po['po_number']} and put away 50 units into location {loc_code}!")

    # Verify PO is now RECEIVED
    po_check = client.get("/api/warehouse/procurement/purchase-orders", headers=headers)
    matching_po = next((p for p in po_check.json() if p["id"] == po_id), None)
    assert matching_po["status"] == "RECEIVED"
    print("✓ Purchase Order status updated to RECEIVED")

    # 11. Customer Tax Invoice HTML
    print("\n11. Testing Customer Tax Invoice HTML Endpoint...")
    invoice_res = client.get(f"/api/orders/{order_id}/invoice-html")
    assert invoice_res.status_code == 200
    assert "Tax Invoice & Official Receipt" in invoice_res.text
    assert "Apex Book Haven" in invoice_res.text
    assert f"INV-{order_id:06d}" in invoice_res.text
    print(f"✓ Customer Tax Invoice HTML rendered successfully for Order #{order_id}")

    # 12. Warehouse Packing Slip HTML
    print("\n12. Testing Warehouse Packing Slip HTML Endpoint...")
    slip_res = client.get(f"/api/warehouse/fulfillment/orders/{order_id}/packing-slip-html")
    assert slip_res.status_code == 200
    assert "WAREHOUSE PACKING SLIP" in slip_res.text
    assert f"Order #{order_id}" in slip_res.text
    assert "Picked By" in slip_res.text
    print(f"✓ Warehouse Packing Slip HTML rendered successfully for Order #{order_id}")

    print("\n=================================================================")
    print("ALL 12 FULFILLMENT, PROCUREMENT & PRINTABLE SUITE TESTS PASSED!")
    print("=================================================================")

if __name__ == "__main__":
    test_full_pipeline()
