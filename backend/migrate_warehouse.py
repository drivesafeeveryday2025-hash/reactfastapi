import os
import sys
from datetime import datetime, timezone
from sqlalchemy import text
from app.database import engine, SessionLocal
from app import models

def migrate():
    print("=== Creating W00_ Warehouse & Inventory Management Tables ===")
    with engine.begin() as conn:
        conn.execute(text("""
            -- 1. Warehouses
            CREATE TABLE IF NOT EXISTS "W00_warehouses" (
                id SERIAL PRIMARY KEY,
                code VARCHAR(50) UNIQUE NOT NULL,
                name_en VARCHAR(100) NOT NULL,
                name_zh VARCHAR(100) NOT NULL,
                address_en VARCHAR(255),
                address_zh VARCHAR(255),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );

            -- 2. Warehouse Locations (Zone, Aisle, Shelf, Bin)
            CREATE TABLE IF NOT EXISTS "W00_locations" (
                id SERIAL PRIMARY KEY,
                warehouse_id INTEGER NOT NULL REFERENCES "W00_warehouses"(id) ON DELETE CASCADE,
                zone VARCHAR(50) NOT NULL,
                zone_name_en VARCHAR(100) NOT NULL,
                zone_name_zh VARCHAR(100) NOT NULL,
                aisle VARCHAR(20) NOT NULL,
                shelf VARCHAR(20) NOT NULL,
                bin VARCHAR(20) NOT NULL,
                location_code VARCHAR(100) UNIQUE NOT NULL,
                category_hint VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE
            );
            CREATE INDEX IF NOT EXISTS idx_loc_warehouse ON "W00_locations"(warehouse_id);
            CREATE INDEX IF NOT EXISTS idx_loc_zone ON "W00_locations"(zone);
            CREATE INDEX IF NOT EXISTS idx_loc_code ON "W00_locations"(location_code);

            -- 3. Inventory On-Hand & Condition Tracking
            CREATE TABLE IF NOT EXISTS "W00_inventory" (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL REFERENCES "C00_products"(id) ON DELETE CASCADE,
                location_id INTEGER NOT NULL REFERENCES "W00_locations"(id) ON DELETE CASCADE,
                condition VARCHAR(50) NOT NULL DEFAULT 'brand_new',
                quantity INTEGER NOT NULL DEFAULT 0,
                reserved_quantity INTEGER NOT NULL DEFAULT 0,
                last_counted_at TIMESTAMP WITH TIME ZONE,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                CONSTRAINT uq_prod_loc_cond UNIQUE (product_id, location_id, condition)
            );
            CREATE INDEX IF NOT EXISTS idx_inv_product ON "W00_inventory"(product_id);
            CREATE INDEX IF NOT EXISTS idx_inv_location ON "W00_inventory"(location_id);
            CREATE INDEX IF NOT EXISTS idx_inv_condition ON "W00_inventory"(condition);

            -- 4. Inventory Adjustments & Movement Audit Log
            CREATE TABLE IF NOT EXISTS "W00_adjustments" (
                id SERIAL PRIMARY KEY,
                voucher_no VARCHAR(50) UNIQUE NOT NULL,
                product_id INTEGER NOT NULL REFERENCES "C00_products"(id) ON DELETE CASCADE,
                from_location_id INTEGER REFERENCES "W00_locations"(id) ON DELETE SET NULL,
                to_location_id INTEGER REFERENCES "W00_locations"(id) ON DELETE SET NULL,
                from_condition VARCHAR(50),
                to_condition VARCHAR(50),
                change_qty INTEGER NOT NULL DEFAULT 0,
                reason_code VARCHAR(50) NOT NULL,
                notes TEXT,
                created_by_user_id INTEGER REFERENCES "S00_users"(id) ON DELETE SET NULL,
                created_by_name VARCHAR(100) DEFAULT 'Warehouse Manager',
                status VARCHAR(30) DEFAULT 'APPROVED',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_adj_voucher ON "W00_adjustments"(voucher_no);
            CREATE INDEX IF NOT EXISTS idx_adj_product ON "W00_adjustments"(product_id);
            CREATE INDEX IF NOT EXISTS idx_adj_created ON "W00_adjustments"(created_at);
        """))
    print("✓ Tables created successfully!")

    db = SessionLocal()
    try:
        # Check if warehouses are already seeded
        wh_count = db.execute(text('SELECT COUNT(*) FROM "W00_warehouses"')).scalar()
        if wh_count and wh_count > 0:
            print(f"Warehouses already present ({wh_count} facilities). Skipping warehouse re-creation.")
        else:
            print("Seeding standard warehouse facilities...")
            db.execute(text("""
                INSERT INTO "W00_warehouses" (code, name_en, name_zh, address_en, address_zh, is_active)
                VALUES 
                ('WH-CENTRAL', 'Apex Central Logistics Hub', '文萃總部中央物流倉', '100 Logistics Parkway, Logistics Park, New Taipei', '新北市物流園區經貿路 100 號', TRUE),
                ('WH-STORE01', 'Apex Downtown Flagship Store', '文萃市中心旗艦門市倉', '88 Literature Blvd, Culture Square, Taipei', '台北市文化特區文藝大道 88 號', TRUE);
            """))
            db.commit()

        wh_central_id = db.execute(text("SELECT id FROM \"W00_warehouses\" WHERE code = 'WH-CENTRAL'")).scalar()
        wh_store_id = db.execute(text("SELECT id FROM \"W00_warehouses\" WHERE code = 'WH-STORE01'")).scalar()

        # Seed Locations if empty
        loc_count = db.execute(text('SELECT COUNT(*) FROM "W00_locations"')).scalar()
        if loc_count and loc_count > 0:
            print(f"Locations already present ({loc_count} locations).")
        else:
            print("Seeding warehouse storage locations and category zones...")
            locations = [
                # Central Warehouse - Zone A: Tech & Programming
                (wh_central_id, 'Zone A', 'Tech & Computer Science Racks', '資訊科技與電腦專區', 'A01', 'S01', 'B01', 'WH-CENTRAL-A01-S01-B01', 'Tech & Programming'),
                (wh_central_id, 'Zone A', 'Tech & Computer Science Racks', '資訊科技與電腦專區', 'A01', 'S01', 'B02', 'WH-CENTRAL-A01-S01-B02', 'Tech & Programming'),
                (wh_central_id, 'Zone A', 'Tech & Computer Science Racks', '資訊科技與電腦專區', 'A02', 'S02', 'B01', 'WH-CENTRAL-A02-S02-B01', 'Tech & Programming'),
                # Central Warehouse - Zone B: World Literature & Fiction
                (wh_central_id, 'Zone B', 'World Literature & Fiction Stacks', '世界文學與小說專區', 'B01', 'S01', 'B01', 'WH-CENTRAL-B01-S01-B01', 'World Literature'),
                (wh_central_id, 'Zone B', 'World Literature & Fiction Stacks', '世界文學與小說專區', 'B01', 'S02', 'B01', 'WH-CENTRAL-B01-S02-B01', 'World Literature'),
                (wh_central_id, 'Zone B', 'World Literature & Fiction Stacks', '世界文學與小說專區', 'B02', 'S01', 'B01', 'WH-CENTRAL-B02-S01-B01', 'Sci-Fi & Fantasy'),
                # Central Warehouse - Zone C: Personal Growth, Business & Arts
                (wh_central_id, 'Zone C', 'Growth, Business & Arts Gallery', '心靈成長、商業與藝術庫', 'C01', 'S01', 'B01', 'WH-CENTRAL-C01-S01-B01', 'Personal Growth'),
                (wh_central_id, 'Zone C', 'Growth, Business & Arts Gallery', '心靈成長、商業與藝術庫', 'C02', 'S01', 'B01', 'WH-CENTRAL-C02-S01-B01', 'Design & Art'),
                # Central Warehouse - Zone D: Inspection & Quarantine
                (wh_central_id, 'Zone D', 'Quarantine & Damaged Goods Inspection', '待驗與瑕疵品隔離區', 'D01', 'S01', 'B01', 'WH-CENTRAL-D01-S01-B01', 'Quarantine'),
                # Store 01 - Front Display & Backroom
                (wh_store_id, 'Zone S-FRONT', 'Retail Sales Floor Displays', '旗艦門市前場展架', 'F01', 'S01', 'B01', 'WH-STORE01-F01-S01-B01', 'Storefront Display'),
                (wh_store_id, 'Zone S-BACK', 'Store Backroom Buffer Stock', '旗艦門市後台備貨區', 'R01', 'S01', 'B01', 'WH-STORE01-R01-S01-B01', 'General Store Stock'),
            ]
            for loc in locations:
                db.execute(text("""
                    INSERT INTO "W00_locations" 
                    (warehouse_id, zone, zone_name_en, zone_name_zh, aisle, shelf, bin, location_code, category_hint, is_active)
                    VALUES (:wh, :z, :zne, :znz, :aisle, :shelf, :bin, :code, :cat, TRUE)
                    ON CONFLICT (location_code) DO NOTHING;
                """), {
                    "wh": loc[0], "z": loc[1], "zne": loc[2], "znz": loc[3],
                    "aisle": loc[4], "shelf": loc[5], "bin": loc[6], "code": loc[7], "cat": loc[8]
                })
            db.commit()

        # Seed Inventory for all products
        inv_count = db.execute(text('SELECT COUNT(*) FROM "W00_inventory"')).scalar()
        if inv_count and inv_count > 0:
            print(f"Inventory already present ({inv_count} stock records).")
        else:
            print("Seeding stock levels across locations and conditions for all products...")
            products = db.execute(text("""
                SELECT p.id, p.title_en, c.name_en AS cat_name 
                FROM "C00_products" p
                JOIN "C00_categories" c ON p.category_id = c.id
            """)).fetchall()

            all_locations = db.execute(text("""
                SELECT id, zone, category_hint, location_code FROM "W00_locations"
            """)).fetchall()

            loc_by_code = {l.location_code: l.id for l in all_locations}

            for p in products:
                cat = p.cat_name.lower()
                # Determine primary zone based on product category
                if "tech" in cat or "program" in cat or "software" in cat:
                    primary_loc_id = loc_by_code.get('WH-CENTRAL-A01-S01-B01')
                    backup_loc_id = loc_by_code.get('WH-CENTRAL-A02-S02-B01')
                elif "literature" in cat or "fiction" in cat or "sci-fi" in cat:
                    primary_loc_id = loc_by_code.get('WH-CENTRAL-B01-S01-B01')
                    backup_loc_id = loc_by_code.get('WH-CENTRAL-B02-S01-B01')
                elif "growth" in cat:
                    primary_loc_id = loc_by_code.get('WH-CENTRAL-C01-S01-B01')
                    backup_loc_id = loc_by_code.get('WH-STORE01-R01-S01-B01')
                else:
                    primary_loc_id = loc_by_code.get('WH-CENTRAL-C02-S01-B01')
                    backup_loc_id = loc_by_code.get('WH-STORE01-F01-S01-B01')

                store_display_id = loc_by_code.get('WH-STORE01-F01-S01-B01')
                quarantine_id = loc_by_code.get('WH-CENTRAL-D01-S01-B01')

                # 1. Main Warehouse: Brand New Stock
                db.execute(text("""
                    INSERT INTO "W00_inventory" (product_id, location_id, condition, quantity, reserved_quantity, last_counted_at)
                    VALUES (:pid, :lid, 'brand_new', :qty, :res, NOW())
                    ON CONFLICT DO NOTHING;
                """), {"pid": p.id, "lid": primary_loc_id, "qty": 45 + (p.id * 7) % 30, "res": 3})

                # 2. Store Front: Brand New & Minor Wear (display copy)
                if store_display_id:
                    db.execute(text("""
                        INSERT INTO "W00_inventory" (product_id, location_id, condition, quantity, reserved_quantity, last_counted_at)
                        VALUES (:pid, :lid, 'brand_new', :qty, :res, NOW())
                        ON CONFLICT DO NOTHING;
                    """), {"pid": p.id, "lid": store_display_id, "qty": 8 + (p.id % 5), "res": 0})

                    # Minor wear / display sample copy for odd ID products
                    if p.id % 2 == 1:
                        db.execute(text("""
                            INSERT INTO "W00_inventory" (product_id, location_id, condition, quantity, reserved_quantity, last_counted_at)
                            VALUES (:pid, :lid, 'minor_wear', :qty, :res, NOW())
                            ON CONFLICT DO NOTHING;
                        """), {"pid": p.id, "lid": store_display_id, "qty": 2, "res": 0})

                # 3. Quarantine / Damaged copy for selected products to show condition diversity
                if p.id in [1, 3, 5] and quarantine_id:
                    db.execute(text("""
                        INSERT INTO "W00_inventory" (product_id, location_id, condition, quantity, reserved_quantity, last_counted_at)
                        VALUES (:pid, :lid, 'damaged', :qty, :res, NOW())
                        ON CONFLICT DO NOTHING;
                    """), {"pid": p.id, "lid": quarantine_id, "qty": 1, "res": 0})

            db.commit()

        # Seed initial adjustment history if empty
        adj_count = db.execute(text('SELECT COUNT(*) FROM "W00_adjustments"')).scalar()
        if adj_count and adj_count > 0:
            print(f"Adjustments already present ({adj_count} vouchers).")
        else:
            print("Seeding initial stock adjustment audit vouchers...")
            p1 = db.execute(text("SELECT id FROM \"C00_products\" ORDER BY id LIMIT 1")).scalar()
            l_tech = db.execute(text("SELECT id FROM \"W00_locations\" WHERE location_code = 'WH-CENTRAL-A01-S01-B01'")).scalar()
            l_quar = db.execute(text("SELECT id FROM \"W00_locations\" WHERE location_code = 'WH-CENTRAL-D01-S01-B01'")).scalar()

            if p1 and l_tech and l_quar:
                db.execute(text("""
                    INSERT INTO "W00_adjustments" 
                    (voucher_no, product_id, from_location_id, to_location_id, from_condition, to_condition, change_qty, reason_code, notes, created_by_name, status, created_at)
                    VALUES 
                    ('ADJ-20261125-0001', :p1, :l_tech, :l_quar, 'brand_new', 'damaged', -1, 'DAMAGE_FOUND', 'Cover dented during transit unboxing; moved to quarantine for vendor RMA claim', 'Warehouse Lead (Alex M.)', 'APPROVED', NOW() - INTERVAL '1 day'),
                    ('ADJ-20261125-0002', :p1, NULL, :l_tech, NULL, 'brand_new', 10, 'RESTOCK_RECEIVING', 'Received supplementary shipment from publisher consignment batch #PB-8821', 'Warehouse Manager', 'APPROVED', NOW() - INTERVAL '3 hours');
                """), {"p1": p1, "l_tech": l_tech, "l_quar": l_quar})
                db.commit()

        # Update Navigation Menu to include Warehouse & Inventory under Manager Portal
        mgr_menu_id = db.execute(text("""
            SELECT id FROM "C00_navigation_menus" WHERE parent_id IS NULL AND requires_role = 'manager' LIMIT 1
        """)).scalar()

        if mgr_menu_id:
            exists = db.execute(text("""
                SELECT id FROM "C00_navigation_menus" WHERE parent_id = :pid AND url LIKE '%warehouse%'
            """), {"pid": mgr_menu_id}).scalar()
            if not exists:
                db.execute(text("""
                    INSERT INTO "C00_navigation_menus" 
                    (parent_id, title_en, title_zh, url, icon, badge_en, badge_zh, sort_order, is_active, requires_auth, requires_role)
                    VALUES 
                    (:pid, 'Warehouse & Stock Control', '倉儲與庫存管理', '/admin?tab=warehouse', '🏬', 'WMS', '倉儲', 3, TRUE, TRUE, 'manager');
                """), {"pid": mgr_menu_id})
                db.commit()
                print("✓ Added Warehouse & Stock Control to Manager navigation menu!")

        print("=== Warehouse migration completed successfully! ===")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
