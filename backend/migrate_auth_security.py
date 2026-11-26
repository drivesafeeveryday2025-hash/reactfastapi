import os
import sys
from datetime import datetime, timezone
from sqlalchemy import text
from app.database import engine, SessionLocal

def migrate():
    print("=== Creating S00_ Login Bot Protection & Password Reset Tables ===")
    with engine.begin() as conn:
        conn.execute(text("""
            -- 1. Login Attempts & Bot Rate Limiting
            CREATE TABLE IF NOT EXISTS "S00_login_attempts" (
                id SERIAL PRIMARY KEY,
                ip_address VARCHAR(50) NOT NULL,
                email VARCHAR(255),
                attempt_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                is_successful BOOLEAN DEFAULT FALSE,
                user_agent VARCHAR(300)
            );
            CREATE INDEX IF NOT EXISTS idx_login_attempt_ip ON "S00_login_attempts"(ip_address);
            CREATE INDEX IF NOT EXISTS idx_login_attempt_email ON "S00_login_attempts"(email);
            CREATE INDEX IF NOT EXISTS idx_login_attempt_time ON "S00_login_attempts"(attempt_time);

            -- 2. Password Reset Tokens & Expirations
            CREATE TABLE IF NOT EXISTS "S00_password_resets" (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES "S00_users"(id) ON DELETE CASCADE,
                email VARCHAR(255) NOT NULL,
                token VARCHAR(100) UNIQUE NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                is_used BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                used_at TIMESTAMP WITH TIME ZONE
            );
            CREATE INDEX IF NOT EXISTS idx_pwd_reset_token ON "S00_password_resets"(token);
            CREATE INDEX IF NOT EXISTS idx_pwd_reset_email ON "S00_password_resets"(email);
            CREATE INDEX IF NOT EXISTS idx_pwd_reset_exp ON "S00_password_resets"(expires_at);
        """))
    print("✓ S00_login_attempts and S00_password_resets tables created successfully!")

if __name__ == "__main__":
    migrate()
