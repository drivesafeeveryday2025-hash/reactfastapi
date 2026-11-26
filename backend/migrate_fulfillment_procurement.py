"""
Migration script for Option A & Option B & Option C:
- Extends C00_products with safety_stock, reorder_quantity, cost_price.
- Creates W00_suppliers table.
- Creates W00_purchase_orders table.
- Creates W00_purchase_order_items table.
- Seeds default suppliers and baseline procurement thresholds.
"""
import os
import sys
from dotenv import load_dotenv
import psycopg

load_dotenv()
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL not found in .env")
    sys.exit(1)

# Normalise URL for direct psycopg driver connection
DB_URL = DB_URL.replace("postgresql+psycopg://", "postgresql://")

def run_migration():
    print("Connecting to PostgreSQL to apply fulfillment & procurement migrations...")
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            # 1. Add safety_stock, reorder_quantity, cost_price to C00_products if not exists
            cur.execute("""
                ALTER TABLE "C00_products" 
                ADD COLUMN IF NOT EXISTS safety_stock INTEGER DEFAULT 15,
                ADD COLUMN IF NOT EXISTS reorder_quantity INTEGER DEFAULT 50,
                ADD COLUMN IF NOT EXISTS cost_price DOUBLE PRECISION DEFAULT 0.0;
            """)
            print("✓ Updated C00_products columns (safety_stock, reorder_quantity, cost_price)")

            # Populate cost_price as 60% of retail price where cost_price is 0
            cur.execute("""
                UPDATE "C00_products"
                SET cost_price = ROUND(CAST(price * 0.60 AS numeric), 2)
                WHERE cost_price = 0.0 OR cost_price IS NULL;
            """)

            # 2. Create W00_suppliers table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS "W00_suppliers" (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(150) NOT NULL UNIQUE,
                    contact_name VARCHAR(100),
                    email VARCHAR(150),
                    phone VARCHAR(50),
                    lead_time_days INTEGER DEFAULT 5,
                    is_active BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            """)
            print("✓ Created table W00_suppliers")

            # 3. Create W00_purchase_orders table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS "W00_purchase_orders" (
                    id SERIAL PRIMARY KEY,
                    po_number VARCHAR(50) UNIQUE NOT NULL,
                    supplier_id INTEGER NOT NULL REFERENCES "W00_suppliers"(id) ON DELETE RESTRICT,
                    status VARCHAR(30) DEFAULT 'ORDERED',
                    total_cost DOUBLE PRECISION DEFAULT 0.0,
                    notes TEXT,
                    created_by_user_id INTEGER REFERENCES "S00_users"(id) ON DELETE SET NULL,
                    created_by_name VARCHAR(100) DEFAULT 'Warehouse Manager',
                    ordered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    received_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
            """)
            print("✓ Created table W00_purchase_orders")

            # 4. Create W00_purchase_order_items table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS "W00_purchase_order_items" (
                    id SERIAL PRIMARY KEY,
                    po_id INTEGER NOT NULL REFERENCES "W00_purchase_orders"(id) ON DELETE CASCADE,
                    product_id INTEGER NOT NULL REFERENCES "C00_products"(id) ON DELETE RESTRICT,
                    quantity_ordered INTEGER NOT NULL,
                    quantity_received INTEGER DEFAULT 0,
                    unit_cost DOUBLE PRECISION NOT NULL
                );
            """)
            print("✓ Created table W00_purchase_order_items")

            # 5. Seed default suppliers if none exist
            cur.execute("SELECT COUNT(*) FROM \"W00_suppliers\";")
            supplier_count = cur.fetchone()[0]
            if supplier_count == 0:
                cur.execute("""
                    INSERT INTO "W00_suppliers" (name, contact_name, email, phone, lead_time_days)
                    VALUES 
                    ('Penguin Random House Asia', 'David Lin', 'orders@penguinrandomhouse.asia', '+886 2 8765-4321', 4),
                    ('Simon & Schuster International', 'Sarah Jenkins', 'distribution@simonandschuster.com', '+1 212 555-0199', 7),
                    ('O''Reilly Media Publishing', 'Alex Chen', 'fulfillment@oreilly.com', '+1 707 555-0142', 5),
                    ('Taipei Academic Book Importers', 'Grace Wu', 'sales@taipeibooks.tw', '+886 2 2399-8877', 2);
                """)
                print("✓ Seeded 4 default book suppliers")

            conn.commit()
    print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
