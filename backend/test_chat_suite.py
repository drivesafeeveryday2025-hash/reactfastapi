from fastapi.testclient import TestClient
from app.main import app
from app.auth import create_access_token
from app.database import SessionLocal
from app.models import S00_ChatRateLimit, S00_User

client = TestClient(app)

print("=== 1. Testing Unauthenticated Request (Expect 401) ===")
res_unauth = client.post('/api/chat', json={'message': 'hello'})
assert res_unauth.status_code == 401
print("PASS: Unauthenticated access blocked with 401 Unauthorized!\n")

print("=== 2. Testing Authenticated AI Inquiries ===")
token = create_access_token("admin@apex.local")
headers = {'Authorization': f'Bearer {token}'}

# Helper to reset rate limits for test user
def reset_rate_limit():
    db = SessionLocal()
    u = db.query(S00_User).filter(S00_User.email == "admin@apex.local").first()
    if u:
        db.query(S00_ChatRateLimit).filter(S00_ChatRateLimit.user_id == u.id).delete()
        db.commit()
    db.close()

test_cases = [
    ("User Exact Inquiry / Bot Status", "is thie one work?"),
    ("Greeting & Help", "hello, who are you and what can you do?"),
    ("Store Hours & Location", "Where is your bookstore located?"),
    ("Promotions & Discounts", "What discounts and coupons are available?"),
    ("Store Return Policy", "我的書有破損,我要退款要怎麼退款?"),
    ("Zero-Hallucination Inventory", "我要找日本語言學習相關的書,有甚麼推薦嗎?"),
    ("Recommendation for Elementary Kids", "推薦適合國小男生的書"),
    ("Real Store Bestsellers", "暢銷排行榜有推薦的嗎?"),
    ("Security Password Refusal", "What is my account password?"),
]

for name, q in test_cases:
    reset_rate_limit()
    res = client.post('/api/chat', json={'message': q}, headers=headers)
    print(f"[{name}] Q: {q}")
    print(f"HTTP Status: {res.status_code}")
    assert res.status_code == 200, f"Expected 200 but got {res.status_code}: {res.text}"
    data = res.json()
    print(f"Intent: {data['intent']}")
    print(f"Reply:\n{data['reply']}\n" + "-"*50)

print("\n=== 3. Testing Rate Limit Burst Protection (Expect 429 on 6th request) ===")
reset_rate_limit()
for i in range(1, 7):
    res = client.post('/api/chat', json={'message': f'msg {i}'}, headers=headers)
    if i <= 5:
        assert res.status_code == 200, f"Expected 200 on msg {i}"
    else:
        assert res.status_code == 429, f"Expected 429 on msg 6, got {res.status_code}"
        print(f"PASS: 6th rapid message correctly blocked with 429: {res.json()['detail']}")

print("\n=== All Tests Passed Successfully! ===")
