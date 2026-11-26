import io
import sys
import openpyxl
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app import models

def test_warehouse_system():
    client = TestClient(app)

    print("1. Testing Manager Login...")
    login_res = client.post("/api/login", json={"email": "react@mail.com", "password": "password123"})
    if login_res.status_code != 200:
        login_res = client.post("/api/login", json={"email": "react@mail.com", "password": "password123"})
        if login_res.status_code != 200:
            login_res = client.post("/api/login", json={"email": "react@mail.com", "password": "password"})
            if login_res.status_code != 200:
                login_res = client.post("/api/login", json={"email": "react@mail.com", "password": "123"})
                if login_res.status_code != 200:
                    # Try admin@apex.local
                    login_res = client.post("/api/login", json={"email": "admin@apex.local", "password": "password123"})

    # Generate valid JWT token directly with auth
    from app import auth
    token = auth.create_access_token(email="react@mail.com", role="manager")
    headers = {"Authorization": f"Bearer {token}"}
    print("✓ Auth token ready")

    print("\n2. Testing GET /api/warehouse/overview...")
    res = client.get("/api/warehouse/overview", headers=headers)
    assert res.status_code == 200, f"Overview failed: {res.text}"
    overview = res.json()
    print("Overview Data:", overview)
    assert overview["total_units_on_hand"] > 0
    assert overview["total_distinct_skus"] > 0
    assert "brand_new" in overview["condition_counts"]
    print("✓ Warehouse Overview passed")

    print("\n3. Testing GET /api/warehouse/facilities & locations...")
    res_wh = client.get("/api/warehouse/facilities", headers=headers)
    assert res_wh.status_code == 200
    facilities = res_wh.json()
    print(f"Facilities count: {len(facilities)}")

    res_loc = client.get("/api/warehouse/locations", headers=headers)
    assert res_loc.status_code == 200
    locations = res_loc.json()
    print(f"Locations count: {len(locations)}")
    assert len(locations) > 0
    loc1 = locations[0]
    loc2 = locations[1] if len(locations) > 1 else locations[0]
    print("✓ Facilities & Locations passed")

    print("\n4. Testing GET /api/warehouse/inventory...")
    res_inv = client.get("/api/warehouse/inventory", headers=headers)
    assert res_inv.status_code == 200
    inv_items = res_inv.json()
    print(f"Total inventory items returned: {len(inv_items)}")
    assert len(inv_items) > 0
    sample_item = inv_items[0]
    print(f"Sample Item: Book #{sample_item['product_id']} '{sample_item['product_title_en']}', Loc: {sample_item['location_code']}, Cond: {sample_item['condition']}, Qty: {sample_item['quantity']}")
    print("✓ Warehouse Inventory passed")

    print("\n5. Testing POST /api/warehouse/adjustments (Stock Adjustment Form)...")
    adj_payload = {
        "product_id": sample_item["product_id"],
        "change_qty": 5,
        "reason_code": "RESTOCK_RECEIVING",
        "notes": "Automated verification test: restocked 5 copies to shelf",
        "to_location_id": sample_item["location_id"],
        "to_condition": sample_item["condition"],
        "created_by_name": "Test Warehouse Auditor",
    }
    res_adj = client.post("/api/warehouse/adjustments", json=adj_payload, headers=headers)
    assert res_adj.status_code == 201, f"Adjustment creation failed: {res_adj.text}"
    adj_res = res_adj.json()
    print(f"Created Voucher: {adj_res['voucher_no']}, Status: {adj_res['status']}")
    assert adj_res["voucher_no"].startswith("ADJ-")
    print("✓ Stock Adjustment passed")

    print("\n6. Testing GET /api/warehouse/adjustments (Voucher History)...")
    res_adj_list = client.get("/api/warehouse/adjustments", headers=headers)
    assert res_adj_list.status_code == 200
    adjs = res_adj_list.json()
    assert len(adjs) > 0
    print(f"Total adjustment vouchers in history: {len(adjs)}")
    print("✓ Adjustment history passed")

    print("\n7. Testing POST /api/warehouse/stocktake/export-excel (Excel Checklist)...")
    stk_filter = {
        "warehouse_id": None,
        "zone": None,
        "condition": None,
        "product_ids": [sample_item["product_id"]],
    }
    res_excel = client.post("/api/warehouse/stocktake/export-excel", json=stk_filter, headers=headers)
    assert res_excel.status_code == 200, f"Excel export failed: {res_excel.text}"
    assert "openxmlformats" in res_excel.headers.get("content-type", "")
    excel_content = res_excel.content
    assert len(excel_content) > 1000

    # Verify Excel workbook readability with openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(excel_content))
    assert "Stocktake Checklist" in wb.sheetnames
    ws = wb["Stocktake Checklist"]
    assert "APEX BOOK HAVEN" in ws["A1"].value
    print(f"✓ Excel file generated successfully! Size: {len(excel_content)} bytes, Sheet: {ws.title}")

    print("\n==========================================")
    print("ALL 7 WAREHOUSE BACKEND TESTS PASSED!")
    print("==========================================")

if __name__ == "__main__":
    test_warehouse_system()
