import io
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_access_token

client = TestClient(app)

# Generate tokens for testing
token_react = create_access_token("react@mail")
token_customer = create_access_token("customer@apex.local")
token_other_admin = create_access_token("admin@apex.local")

headers_react = {"Authorization": f"Bearer {token_react}"}
headers_customer = {"Authorization": f"Bearer {token_customer}"}
headers_other = {"Authorization": f"Bearer {token_other_admin}"}

print("=== 1. Testing GET /api/products/excel-template Security ===")
# Unauthenticated
res1 = client.get("/api/products/excel-template")
print("Unauthenticated status:", res1.status_code)
assert res1.status_code == 401, "Expected 401 when no token is provided"

# Non-authorized user (customer)
res2 = client.get("/api/products/excel-template", headers=headers_customer)
print("Customer access status:", res2.status_code, res2.json())
assert res2.status_code == 403, "Expected 403 for non-react@mail user"

# Authorized user (react@mail)
res3 = client.get("/api/products/excel-template", headers=headers_react)
print("react@mail access status:", res3.status_code)
assert res3.status_code == 200, "Expected 200 for react@mail user"
assert "openxmlformats" in res3.headers.get("content-type")
print("PASS: Template endpoint is strictly restricted to react@mail!\n")


print("=== 2. Testing POST /api/products/import-excel Security ===")
sample_bytes = res3.content

# Unauthenticated
res_unauth = client.post(
    "/api/products/import-excel",
    files={"file": ("books.xlsx", io.BytesIO(sample_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
)
print("Unauthenticated import status:", res_unauth.status_code)
assert res_unauth.status_code == 401

# Customer / Non-react@mail
res_forbidden = client.post(
    "/api/products/import-excel",
    headers=headers_customer,
    files={"file": ("books.xlsx", io.BytesIO(sample_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
)
print("Customer import status:", res_forbidden.status_code, res_forbidden.json())
assert res_forbidden.status_code == 403
assert "Manager privileges required" in res_forbidden.json().get("detail", "")

# Other manager (admin@apex.local) - should succeed
res_other = client.post(
    "/api/products/import-excel",
    headers=headers_other,
    files={"file": ("books.xlsx", io.BytesIO(sample_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
)
print("Other manager import status:", res_other.status_code)
assert res_other.status_code == 200, "Managers should be allowed"

# Authorized user (react@mail)
res_ok = client.post(
    "/api/products/import-excel",
    headers=headers_react,
    files={"file": ("books.xlsx", io.BytesIO(sample_bytes), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
)
print("react@mail import status:", res_ok.status_code)
assert res_ok.status_code == 200
data = res_ok.json()
print("Import Summary for react@mail:")
print(f"  • Success: {data.get('success')}")
print(f"  • Total Rows: {data.get('total_rows')}")
print(f"  • Inserted: {data.get('inserted')}")
print(f"  • Updated: {data.get('updated')}")
assert data.get("total_rows") == 2
print("PASS: Import endpoint is strictly restricted to react@mail!\n")

print("=== All Permission and Security Tests Passed! ===")
