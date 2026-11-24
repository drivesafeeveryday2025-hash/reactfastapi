from app.database import engine
from sqlalchemy import text

def migrate():
    with engine.connect() as conn:
        print("Migrating S00_users with profile fields...")
        conn.execute(text('ALTER TABLE "S00_users" ADD COLUMN IF NOT EXISTS full_name VARCHAR(150);'))
        conn.execute(text('ALTER TABLE "S00_users" ADD COLUMN IF NOT EXISTS phone VARCHAR(50);'))
        conn.execute(text('ALTER TABLE "S00_users" ADD COLUMN IF NOT EXISTS address VARCHAR(300);'))

        # Set default profile for demo users
        conn.execute(text("UPDATE \"S00_users\" SET full_name='Stanley Customer', phone='+1 (555) 234-5678', address='742 Evergreen Terrace, Springfield, OR 97477' WHERE email='customer@apex.local' AND full_name IS NULL;"))
        conn.execute(text("UPDATE \"S00_users\" SET full_name='Apex Head Manager', phone='+1 (555) 888-9999', address='Apex Book Haven HQ, 100 Literary Ave, Suite 400' WHERE email='admin@apex.local' AND full_name IS NULL;"))
        conn.execute(text("UPDATE \"S00_users\" SET full_name='React Master Admin', phone='+1 (555) 999-0000', address='Silicon Valley Tech Park, Building 3' WHERE email='react@mail' AND full_name IS NULL;"))

        print("Migrating C00_orders with shipping, payment, and tracking fields...")
        conn.execute(text('ALTER TABLE "C00_orders" ADD COLUMN IF NOT EXISTS delivery_method VARCHAR(50) DEFAULT \'standard\';'))
        conn.execute(text('ALTER TABLE "C00_orders" ADD COLUMN IF NOT EXISTS shipping_fee FLOAT DEFAULT 0.0;'))
        conn.execute(text('ALTER TABLE "C00_orders" ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT \'credit_card\';'))
        conn.execute(text('ALTER TABLE "C00_orders" ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(100);'))
        conn.execute(text('ALTER TABLE "C00_orders" ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(50);'))
        conn.execute(text('ALTER TABLE "C00_orders" ADD COLUMN IF NOT EXISTS shipping_address VARCHAR(300);'))
        conn.execute(text('ALTER TABLE "C00_orders" ADD COLUMN IF NOT EXISTS delivery_notes VARCHAR(500);'))
        conn.execute(text('ALTER TABLE "C00_orders" ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100);'))
        conn.execute(text('ALTER TABLE "C00_orders" ADD COLUMN IF NOT EXISTS estimated_delivery VARCHAR(100);'))

        # Backfill any existing orders with tracking numbers and standard status
        conn.execute(text("UPDATE \"C00_orders\" SET tracking_number='APEX-TRK-' || id || '-2026' WHERE tracking_number IS NULL;"))
        conn.execute(text("UPDATE \"C00_orders\" SET delivery_method='standard' WHERE delivery_method IS NULL;"))
        conn.execute(text("UPDATE \"C00_orders\" SET payment_method='credit_card' WHERE payment_method IS NULL;"))
        conn.execute(text("UPDATE \"C00_orders\" SET recipient_name='Valued Customer' WHERE recipient_name IS NULL;"))
        conn.execute(text("UPDATE \"C00_orders\" SET shipping_address='Registered Account Address' WHERE shipping_address IS NULL;"))

        conn.commit()
        print("✅ Migration successful: All tables and demo profiles updated.")

if __name__ == "__main__":
    migrate()
