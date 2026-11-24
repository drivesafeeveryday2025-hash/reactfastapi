import os
import sys
from sqlalchemy import text
from app.database import engine, SessionLocal
from app import models

def migrate():
    print("=== Creating C00_navigation_menus table ===")
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS "C00_navigation_menus" (
                id SERIAL PRIMARY KEY,
                parent_id INTEGER REFERENCES "C00_navigation_menus"(id) ON DELETE CASCADE,
                title_en VARCHAR(100) NOT NULL,
                title_zh VARCHAR(100) NOT NULL,
                url VARCHAR(250) NOT NULL,
                icon VARCHAR(50),
                badge_en VARCHAR(50),
                badge_zh VARCHAR(50),
                sort_order INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                requires_auth BOOLEAN DEFAULT FALSE,
                requires_role VARCHAR(50)
            );
            CREATE INDEX IF NOT EXISTS idx_nav_parent_id ON "C00_navigation_menus"(parent_id);
            CREATE INDEX IF NOT EXISTS idx_nav_sort_order ON "C00_navigation_menus"(sort_order);
        """))
    print("✓ C00_navigation_menus table created successfully")

    db = SessionLocal()
    try:
        # Check if already seeded
        count = db.execute(text('SELECT COUNT(*) FROM "C00_navigation_menus"')).scalar()
        if count and count > 0:
            print(f"Navigation menu table already contains {count} items. Clearing to refresh seed...")
            db.execute(text('DELETE FROM "C00_navigation_menus"'))
            db.commit()

        # Seed hierarchical navigation menus
        # ROOT 1: Explore Books
        r1 = db.execute(text("""
            INSERT INTO "C00_navigation_menus" (parent_id, title_en, title_zh, url, icon, sort_order, is_active, requires_auth)
            VALUES (NULL, 'Explore Books', '探索書庫', '#catalog', '📚', 1, TRUE, FALSE)
            RETURNING id;
        """)).scalar()

        db.execute(text(f"""
            INSERT INTO "C00_navigation_menus" (parent_id, title_en, title_zh, url, icon, badge_en, badge_zh, sort_order, is_active)
            VALUES 
            ({r1}, 'Full Book Catalog', '全館書籍目錄', '#catalog', '📖', 'All', '全部', 1, TRUE),
            ({r1}, 'Staff Recommended', '編輯精選推薦', '#recommended', '⭐', 'Top Pick', '精選', 2, TRUE),
            ({r1}, 'Promotions & Discounts', '限時特惠活動', '#promotions', '🏷️', 'Sale', '折扣', 3, TRUE),
            ({r1}, 'Store Bestsellers', '門市熱門暢銷榜', '#catalog', '🏆', 'Hot', '熱賣', 4, TRUE);
        """))

        # ROOT 2: About Apex
        r2 = db.execute(text("""
            INSERT INTO "C00_navigation_menus" (parent_id, title_en, title_zh, url, icon, sort_order, is_active, requires_auth)
            VALUES (NULL, 'About Apex', '關於我們', '#about', '🏢', 2, TRUE, FALSE)
            RETURNING id;
        """)).scalar()

        db.execute(text(f"""
            INSERT INTO "C00_navigation_menus" (parent_id, title_en, title_zh, url, icon, sort_order, is_active)
            VALUES 
            ({r2}, 'Store Introduction', '書店簡介與特色', '#hero', 'ℹ️', 1, TRUE),
            ({r2}, 'Brand Story & Vision', '品牌理念與故事', '#about', '📖', 2, TRUE),
            ({r2}, 'Location & Opening Hours', '門市位置與營業時間', '#contact', '📍', 3, TRUE);
        """))

        # ROOT 3: Customer Hub
        r3 = db.execute(text("""
            INSERT INTO "C00_navigation_menus" (parent_id, title_en, title_zh, url, icon, sort_order, is_active, requires_auth)
            VALUES (NULL, 'Customer Hub', '讀者專區', 'action:hub', '👤', 3, TRUE, TRUE)
            RETURNING id;
        """)).scalar()

        db.execute(text(f"""
            INSERT INTO "C00_navigation_menus" (parent_id, title_en, title_zh, url, icon, badge_en, badge_zh, sort_order, is_active, requires_auth)
            VALUES 
            ({r3}, 'Order Tracking & History', '即時物流追蹤與訂單', 'action:orders', '🚚', 'Live', '即時', 1, TRUE, TRUE),
            ({r3}, 'Personal Profile & Shipping', '個人資料與預設配送', 'action:profile', '⚙️', NULL, NULL, 2, TRUE, TRUE),
            ({r3}, 'Purchased Bookshelf', '已購書籍書架', 'action:bought_items', '📚', NULL, NULL, 3, TRUE, TRUE);
        """))

        # ROOT 4: Manager Portal (Managers only)
        r4 = db.execute(text("""
            INSERT INTO "C00_navigation_menus" (parent_id, title_en, title_zh, url, icon, sort_order, is_active, requires_auth, requires_role)
            VALUES (NULL, 'Manager Portal', '管理後台', '/admin', '⚙️', 4, TRUE, TRUE, 'manager')
            RETURNING id;
        """)).scalar()

        db.execute(text(f"""
            INSERT INTO "C00_navigation_menus" (parent_id, title_en, title_zh, url, icon, badge_en, badge_zh, sort_order, is_active, requires_auth, requires_role)
            VALUES 
            ({r4}, 'Operations Overview', '營運數據總覽', '/admin', '📊', NULL, NULL, 1, TRUE, TRUE, 'manager'),
            ({r4}, 'Orders & Fulfillment', '訂單配送物流管理', '/admin', '📦', 'Admin', '管理', 2, TRUE, TRUE, 'manager'),
            ({r4}, 'Excel / Word Bulk Import', 'Excel / Word 批次匯入', '/admin', '📥', NULL, NULL, 3, TRUE, TRUE, 'manager'),
            ({r4}, 'Book Catalog Table', '庫存書單目錄', '/admin', '📚', NULL, NULL, 4, TRUE, TRUE, 'manager'),
            ({r4}, 'System & Security Logs', 'PostgreSQL 系統日誌', '/admin', '🛡️', NULL, NULL, 5, TRUE, TRUE, 'manager');
        """))

        # ROOT 5: Direct Link: Contact & Inquiries
        db.execute(text("""
            INSERT INTO "C00_navigation_menus" (parent_id, title_en, title_zh, url, icon, sort_order, is_active, requires_auth)
            VALUES (NULL, 'Contact & Visit', '聯絡門市', '#contact', '📞', 5, TRUE, FALSE);
        """))

        db.commit()
        print("✓ Navigation menus seeded successfully with parent-child structure!")

        # Verify
        rows = db.execute(text('SELECT id, parent_id, title_en, url, sort_order FROM "C00_navigation_menus" ORDER BY parent_id NULLS FIRST, sort_order')).fetchall()
        for r in rows:
            print(f"Nav Menu: id={r[0]}, parent={r[1]}, title='{r[2]}', url='{r[3]}'")

    finally:
        db.close()

if __name__ == "__main__":
    migrate()
