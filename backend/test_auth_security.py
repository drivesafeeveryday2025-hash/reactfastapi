from fastapi.testclient import TestClient
from app.main import app, _ip_lockouts, _email_lockouts
from app.database import SessionLocal
from app import models, auth

def test_auth_security_suite():
    client = TestClient(app)
    db = SessionLocal()

    print("=== STARTING AUTH SECURITY & PASSWORD RESET TEST SUITE ===")

    # 1. Test Login Bot Protection & Lockout
    print("\n1. Testing Login Bot Protection & Account Lockout...")
    bot_target_email = "bot_target_test@example.com"
    # Ensure user exists for test
    test_user = db.query(models.S00_User).filter(models.S00_User.email == bot_target_email).first()
    if not test_user:
        test_user = models.S00_User(
            email=bot_target_email,
            hashed_password=auth.hash_password("correct_password_123"),
            role="customer",
        )
        db.add(test_user)
        db.commit()

    # Clear any previous test lockouts
    _email_lockouts.pop(bot_target_email, None)
    _ip_lockouts.pop("testclient", None)
    _ip_lockouts.pop("127.0.0.1", None)

    # Perform 5 consecutive failed login attempts
    last_status = None
    for attempt in range(1, 6):
        res = client.post("/api/login", json={"email": bot_target_email, "password": f"wrong_guess_{attempt}"})
        last_status = res.status_code
        print(f"  Attempt {attempt}: status={res.status_code}, response={res.json().get('detail')}")

    # 5th attempt must trigger account lockout (429 Too Many Requests)
    assert last_status == 429, f"Expected 429 Too Many Requests, got {last_status}"

    # 6th attempt must be rejected immediately via in-memory lock cache
    blocked_res = client.post("/api/login", json={"email": bot_target_email, "password": "even_with_correct_password"})
    assert blocked_res.status_code == 429
    assert "temporarily locked" in blocked_res.json()["detail"].lower()
    print("✓ Bot protection & account lockout successfully verified!")

    # 2. Test Forgot Password Request
    print("\n2. Testing POST /api/auth/forgot-password...")
    forgot_res = client.post("/api/auth/forgot-password", json={"email": "react@mail.com"})
    assert forgot_res.status_code == 200
    forgot_data = forgot_res.json()
    assert forgot_data["success"] is True
    print("  Response message:", forgot_data["message"])
    assert forgot_data.get("dev_reset_link") is not None
    dev_link = forgot_data["dev_reset_link"]
    token = dev_link.split("token=")[1]
    print(f"✓ Generated token: {token}")

    # 3. Test Verify Reset Token
    print("\n3. Testing GET /api/auth/verify-reset-token...")
    verify_res = client.get(f"/api/auth/verify-reset-token?token={token}")
    assert verify_res.status_code == 200
    verify_data = verify_res.json()
    assert verify_data["valid"] is True
    print(f"✓ Token verified for masked email: {verify_data['email']}")

    # Invalid token check
    invalid_res = client.get("/api/auth/verify-reset-token?token=invalid_fake_token_123")
    assert invalid_res.status_code == 400
    print("✓ Invalid token rejected correctly")

    # 4. Test Reset Password
    print("\n4. Testing POST /api/auth/reset-password...")
    reset_res = client.post("/api/auth/reset-password", json={
        "token": token,
        "new_password": "NewSecretPassword2026!"
    })
    assert reset_res.status_code == 200
    assert reset_res.json()["success"] is True
    print("✓ Password reset successful!")

    # 5. Test Sign In with New Password
    print("\n5. Testing Login with New Password...")
    new_login_res = client.post("/api/login", json={
        "email": "react@mail.com",
        "password": "NewSecretPassword2026!"
    })
    assert new_login_res.status_code == 200
    assert "access_token" in new_login_res.json()
    print("✓ Successfully logged in with newly reset password!")

    # Old password must now fail
    old_login_res = client.post("/api/login", json={
        "email": "react@mail.com",
        "password": "123456"
    })
    assert old_login_res.status_code == 401
    print("✓ Old password properly rejected")

    # Token cannot be reused (one-time use guarantee)
    reuse_res = client.post("/api/auth/reset-password", json={
        "token": token,
        "new_password": "AnotherPassword!"
    })
    assert reuse_res.status_code == 400
    print("✓ Token reuse prevented (one-time security token)")

    # Restore standard react@mail.com password back to 123456 for continuity
    print("\n6. Restoring standard manager password for react@mail.com...")
    react_user = db.query(models.S00_User).filter(models.S00_User.email == "react@mail.com").first()
    react_user.hashed_password = auth.hash_password("123456")
    db.commit()

    check_restore = client.post("/api/login", json={"email": "react@mail.com", "password": "123456"})
    assert check_restore.status_code == 200
    print("✓ Standard password restored (123456)")

    # Clean up test user
    db.delete(test_user)
    db.commit()
    db.close()

    print("\n=======================================================")
    print("ALL AUTH SECURITY & PASSWORD RESET TESTS PASSED!")
    print("=======================================================")

if __name__ == "__main__":
    test_auth_security_suite()
