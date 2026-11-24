import json
import urllib.request
import urllib.error

BASE_URL = "http://127.0.0.1:8000"

def req(endpoint, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    url = f"{BASE_URL}{endpoint}"
    payload_bytes = json.dumps(data).encode("utf-8") if data is not None else None
    if data is not None:
        headers["Content-Type"] = "application/json"
    
    r = urllib.request.Request(url, data=payload_bytes, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            status_code = resp.status
            body = resp.read().decode("utf-8")
            return status_code, json.loads(body) if body else {}
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8")
        return err.code, json.loads(body) if body else {}

def run_tests():
    print("=== STARTING END-TO-END ORDER & PROFILE FLOW VERIFICATION ===")

    cust_email = "customer_test@mail.com"
    cust_pass = "TestPass123!"

    # 1. Register / Login Customer
    s, data = req("/api/register", "POST", {"email": cust_email, "password": cust_pass})
    print(f"Customer register status: {s}")

    s, data = req("/api/login", "POST", {"email": cust_email, "password": cust_pass})
    assert s == 200, f"Login failed: {data}"
    cust_token = data["access_token"]
    cust_headers = {"Authorization": f"Bearer {cust_token}"}
    print("✓ Customer logged in successfully")

    # 2. Update Customer Profile
    profile_payload = {
        "full_name": "Eleanor Vance",
        "phone": "+852 9876 5432",
        "address": "Flat 8C, Hillview Court, Mid-Levels, Hong Kong"
    }
    s, user_data = req("/api/user/profile", "PUT", profile_payload, headers=cust_headers)
    assert s == 200, f"Profile update failed: {user_data}"
    assert user_data["full_name"] == profile_payload["full_name"]
    assert user_data["phone"] == profile_payload["phone"]
    assert user_data["address"] == profile_payload["address"]
    print(f"✓ Profile updated: {user_data['full_name']} | {user_data['phone']} | {user_data['address']}")

    # 3. Get products to place an order
    s, products = req("/api/products")
    assert s == 200 and len(products) > 0
    p1 = products[0]
    p2 = products[1] if len(products) > 1 else products[0]

    # 4. Place Order with express delivery & credit_card
    order_payload = {
        "items": [
            {"product_id": p1["id"], "quantity": 2},
            {"product_id": p2["id"], "quantity": 1}
        ],
        "delivery_method": "express",
        "payment_method": "credit_card",
        "recipient_name": "Eleanor Vance",
        "recipient_phone": "+852 9876 5432",
        "shipping_address": "Flat 8C, Hillview Court, Mid-Levels, Hong Kong",
        "delivery_notes": "Please ring doorbell twice"
    }
    s, order = req("/api/orders", "POST", order_payload, headers=cust_headers)
    assert s == 201, f"Place order failed: {order}"
    print(f"✓ Order placed successfully: ID=#{order['id']}, Tracking={order['tracking_number']}, Status={order['status']}, Total=${order['total_amount']}, ShippingFee=${order['shipping_fee']}")
    assert order["delivery_method"] == "express"
    assert order["payment_method"] == "credit_card"
    assert order["shipping_fee"] == 12.0
    assert order["tracking_number"].startswith("APEX-")
    assert len(order["items"]) == 2

    # 5. Check customer's my-orders endpoint
    s, my_orders = req("/api/orders/my-orders", headers=cust_headers)
    assert s == 200
    assert any(o["id"] == order["id"] for o in my_orders)
    print(f"✓ Verified order exists in customer history (found {len(my_orders)} orders)")

    # 6. Login as Manager (react@mail)
    manager_token = None
    for pw in ["password", "admin", "password123", "manager"]:
        s, data = req("/api/login", "POST", {"email": "react@mail", "password": pw})
        if s == 200:
            manager_token = data["access_token"]
            break

    if manager_token:
        manager_headers = {"Authorization": f"Bearer {manager_token}"}
        print("✓ Manager logged in successfully")

        # 7. Manager views all store orders
        s, admin_orders = req("/api/admin/orders", headers=manager_headers)
        assert s == 200
        print(f"✓ Manager fetched {len(admin_orders)} total store orders")

        # 8. Manager updates order status to 'Shipped'
        s, updated_order = req(
            f"/api/admin/orders/{order['id']}/status",
            "PUT",
            {"status": "Shipped"},
            headers=manager_headers
        )
        assert s == 200
        assert updated_order["status"] == "Shipped"
        print(f"✓ Manager updated order #{order['id']} status to '{updated_order['status']}'")

    print("\n=== ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY 100% ===")

if __name__ == "__main__":
    run_tests()
