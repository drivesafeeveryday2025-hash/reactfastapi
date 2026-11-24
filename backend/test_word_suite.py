import io
from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_access_token
from app.word_service import generate_word_template

client = TestClient(app)

# Generate tokens for testing
token_react = create_access_token("react@mail")
token_customer = create_access_token("customer@apex.local")
token_other_admin = create_access_token("admin@apex.local")

headers_react = {"Authorization": f"Bearer {token_react}"}
headers_customer = {"Authorization": f"Bearer {token_customer}"}
headers_other = {"Authorization": f"Bearer {token_other_admin}"}

print("=== 1. Testing GET /api/products/word-template Security ===")
# Unauthenticated
res1 = client.get("/api/products/word-template")
print("Unauthenticated status:", res1.status_code)
assert res1.status_code == 401, "Expected 401 when no token is provided"

# Non-authorized user (customer)
res2 = client.get("/api/products/word-template", headers=headers_customer)
print("Customer access status:", res2.status_code, res2.json())
assert res2.status_code == 403, "Expected 403 for non-react@mail user"

# Authorized user (react@mail)
res3 = client.get("/api/products/word-template", headers=headers_react)
print("react@mail access status:", res3.status_code)
assert res3.status_code == 200, "Expected 200 for react@mail user"
assert "wordprocessingml" in res3.headers.get("content-type")
print("PASS: Word template endpoint is strictly restricted to react@mail!\n")


print("=== 2. Testing POST /api/products/import-word Security ===")
sample_bytes = res3.content

# Unauthenticated
res_unauth = client.post(
    "/api/products/import-word",
    files={"file": ("books.docx", io.BytesIO(sample_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
)
print("Unauthenticated import status:", res_unauth.status_code)
assert res_unauth.status_code == 401

# Customer / Non-react@mail
res_forbidden = client.post(
    "/api/products/import-word",
    headers=headers_customer,
    files={"file": ("books.docx", io.BytesIO(sample_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
)
print("Customer import status:", res_forbidden.status_code, res_forbidden.json())
assert res_forbidden.status_code == 403
assert "Manager privileges required" in res_forbidden.json().get("detail", "")

# Other manager (admin@apex.local) - should succeed
res_other = client.post(
    "/api/products/import-word",
    headers=headers_other,
    files={"file": ("books.docx", io.BytesIO(sample_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
)
print("Other manager import status:", res_other.status_code)
assert res_other.status_code == 200, "Managers should be allowed"

# Authorized react@mail import
res_success = client.post(
    "/api/products/import-word",
    headers=headers_react,
    files={"file": ("books.docx", io.BytesIO(sample_bytes), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
)
print("react@mail import status:", res_success.status_code)
assert res_success.status_code == 200
data = res_success.json()
print("Import Summary:", {
    "total_rows": data.get("total_rows"),
    "inserted": data.get("inserted"),
    "updated": data.get("updated"),
    "failed": data.get("failed"),
})
assert data.get("total_rows", 0) > 0
assert data.get("failed", 0) == 0
print("PASS: Authorized import successfully processed Word document!\n")

print("=== ALL WORD SECURITY & IMPORT TESTS PASSED ===")
