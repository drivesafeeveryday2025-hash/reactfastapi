from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Checking/adding role column to S00_users...")
        conn.execute(text('ALTER TABLE "S00_users" ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT \'customer\';'))
        conn.execute(text("UPDATE \"S00_users\" SET role='manager' WHERE email IN ('react@mail', 'admin@apex.local');"))
        conn.execute(text("UPDATE \"S00_users\" SET role='customer' WHERE email NOT IN ('react@mail', 'admin@apex.local');"))
        conn.commit()

        print("\nCurrent Users & Roles:")
        rows = conn.execute(text('SELECT id, email, role FROM "S00_users" ORDER BY id')).fetchall()
        for r in rows:
            print(f"  User #{r[0]}: {r[1]} -> role='{r[2]}'")

if __name__ == "__main__":
    migrate()
