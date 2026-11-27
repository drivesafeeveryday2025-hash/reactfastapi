"""
Database migration for:
- Reviews & Star Ratings (C00_reviews)
- Wishlists / Saved Items (C00_wishlists)
- Promo Codes & Coupons Engine (C00_coupons)
- Coupon tracking on Orders (coupon_code, discount_amount on C00_orders)
- Initial seed data for coupons and verified customer reviews
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

# Format for psycopg connection
DB_URL = DB_URL.replace("postgresql+psycopg://", "postgresql://")

def run_migration():
    print("Connecting to PostgreSQL to apply reviews, wishlists, and coupons migrations...")
    with psycopg.connect(DB_URL) as conn:
        with conn.cursor() as cur:
            # 1. Add coupon columns to C00_orders if not exist
            cur.execute("""
                ALTER TABLE "C00_orders"
                ADD COLUMN IF NOT EXISTS coupon_code VARCHAR(50),
                ADD COLUMN IF NOT EXISTS discount_amount DOUBLE PRECISION DEFAULT 0.0;
            """)
            print("✓ Updated C00_orders with coupon_code and discount_amount")

            # 2. Create C00_reviews table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS "C00_reviews" (
                    id SERIAL PRIMARY KEY,
                    product_id INTEGER NOT NULL REFERENCES "C00_products"(id) ON DELETE CASCADE,
                    user_id INTEGER NOT NULL REFERENCES "S00_users"(id) ON DELETE CASCADE,
                    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                    title VARCHAR(150),
                    comment TEXT NOT NULL,
                    is_verified_purchase BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_reviews_product ON "C00_reviews"(product_id);
                CREATE INDEX IF NOT EXISTS idx_reviews_user ON "C00_reviews"(user_id);
            """)
            print("✓ Created table C00_reviews with constraints and indexes")

            # 3. Create C00_wishlists table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS "C00_wishlists" (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES "S00_users"(id) ON DELETE CASCADE,
                    product_id INTEGER NOT NULL REFERENCES "C00_products"(id) ON DELETE CASCADE,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    CONSTRAINT uq_user_product_wishlist UNIQUE (user_id, product_id)
                );
                CREATE INDEX IF NOT EXISTS idx_wishlists_user ON "C00_wishlists"(user_id);
            """)
            print("✓ Created table C00_wishlists with unique constraint")

            # 4. Create C00_coupons table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS "C00_coupons" (
                    id SERIAL PRIMARY KEY,
                    code VARCHAR(50) UNIQUE NOT NULL,
                    description VARCHAR(255),
                    discount_type VARCHAR(20) NOT NULL DEFAULT 'PERCENT', -- 'PERCENT' or 'FIXED'
                    discount_value DOUBLE PRECISION NOT NULL,
                    min_spend DOUBLE PRECISION DEFAULT 0.0,
                    max_discount DOUBLE PRECISION,
                    expires_at TIMESTAMPTZ,
                    is_active BOOLEAN DEFAULT TRUE,
                    usage_count INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS idx_coupons_code ON "C00_coupons"(code);
            """)
            print("✓ Created table C00_coupons")

            # 5. Seed default promotional coupons if none exist
            cur.execute("SELECT COUNT(*) FROM \"C00_coupons\";")
            coupon_count = cur.fetchone()[0]
            if coupon_count == 0:
                cur.execute("""
                    INSERT INTO "C00_coupons" (code, description, discount_type, discount_value, min_spend, max_discount, expires_at)
                    VALUES
                    ('WELCOME10', '10% discount on all purchases for new readers', 'PERCENT', 10.0, 0.0, 50.0, CURRENT_TIMESTAMP + INTERVAL '180 days'),
                    ('APEX20', '$20 off on curated collection orders over $80', 'FIXED', 20.0, 80.0, NULL, CURRENT_TIMESTAMP + INTERVAL '90 days'),
                    ('BOOKWORM15', '15% off for literary enthusiasts on orders over $40', 'PERCENT', 15.0, 40.0, 30.0, CURRENT_TIMESTAMP + INTERVAL '120 days');
                """)
                print("✓ Seeded promotional coupons (WELCOME10, APEX20, BOOKWORM15)")

            # 6. Seed initial verified reviews for catalog books if none exist
            cur.execute("SELECT COUNT(*) FROM \"C00_reviews\";")
            review_count = cur.fetchone()[0]
            if review_count == 0:
                cur.execute("""
                    INSERT INTO "C00_reviews" (product_id, user_id, rating, title, comment, is_verified_purchase)
                    SELECT 
                        p.id,
                        (SELECT id FROM "S00_users" ORDER BY id LIMIT 1),
                        5,
                        'An absolute masterpiece — profoundly life-changing!',
                        'Exceptional prose and timeless wisdom. The edition arrived in flawless brand-new condition from Apex Books. Highly recommended to all readers!',
                        TRUE
                    FROM "C00_products" p
                    LIMIT 3;
                """)
                print("✓ Seeded baseline verified reviews for catalog books")

            conn.commit()
    print("Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
