-- ============================================================================
-- SANDWICH DIYARI - POSTGRESQL 16+ COMPLETE SCHEMA, JSONB & SEED SCRIPT
-- Encoding: UTF8 | MVCC Concurrency | JSONB + GIN Indexes
-- ============================================================================

-- Veritabanı oluşturma (psql üzerinden bağlanıldığında):
-- CREATE DATABASE sandwich_diyari WITH ENCODING 'UTF8';

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Otomatik updated_at güncelleyici Trigger Fonksiyonu
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 1. ROLES (RBAC Yetki Modelleri - JSONB Permissions)
CREATE TABLE IF NOT EXISTS "roles" (
  "id" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(120) NOT NULL,
  "code" VARCHAR(64) NOT NULL UNIQUE,
  "color" VARCHAR(32) NOT NULL DEFAULT 'blue',
  "description" TEXT NOT NULL,
  "is_system" BOOLEAN NOT NULL DEFAULT FALSE,
  "permissions" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_roles_code" ON "roles" ("code");
CREATE INDEX IF NOT EXISTS "idx_roles_permissions_gin" ON "roles" USING GIN ("permissions");

-- 2. ADMIN USERS (Yönetim Paneli & Mutfak/Kasa Personeli)
CREATE TABLE IF NOT EXISTS "admin_users" (
  "id" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(150) NOT NULL,
  "email" VARCHAR(191) NOT NULL UNIQUE,
  "phone" VARCHAR(32) NOT NULL DEFAULT '',
  "pass_hash" VARCHAR(255) NOT NULL,
  "role_id" VARCHAR(64) NOT NULL REFERENCES "roles" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "role_name" VARCHAR(120) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_admin_users_email" ON "admin_users" ("email");
CREATE INDEX IF NOT EXISTS "idx_admin_users_role_id" ON "admin_users" ("role_id");

-- 3. CUSTOMERS / USERS (Müşteri Üyelikleri)
CREATE TABLE IF NOT EXISTS "users" (
  "id" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(150) NOT NULL,
  "email" VARCHAR(191) NOT NULL UNIQUE,
  "phone" VARCHAR(32) NOT NULL DEFAULT '',
  "address" TEXT NOT NULL,
  "pass_hash" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" ("email");
CREATE INDEX IF NOT EXISTS "idx_users_phone" ON "users" ("phone");

-- 4. PRODUCTS (Menü & Sandviç Ürünleri - JSONB Options & Recipe)
CREATE TABLE IF NOT EXISTS "products" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(191) NOT NULL,
  "desc" TEXT NOT NULL,
  "price" NUMERIC(10,2) NOT NULL CHECK ("price" > 0),
  "category" VARCHAR(64) NOT NULL DEFAULT 'sandwich',
  "badge" VARCHAR(64) DEFAULT NULL,
  "image" VARCHAR(500) NOT NULL,
  "calories" VARCHAR(64) DEFAULT NULL,
  "prep_time" VARCHAR(64) DEFAULT NULL,
  "rating" NUMERIC(3,2) NOT NULL DEFAULT 4.80,
  "stock" INTEGER NOT NULL DEFAULT 25 CHECK ("stock" >= 0),
  "track_stock" BOOLEAN NOT NULL DEFAULT TRUE,
  "is_available" BOOLEAN NOT NULL DEFAULT TRUE,
  "critical_threshold" INTEGER NOT NULL DEFAULT 5,
  "options" JSONB DEFAULT '[]'::jsonb,
  "recipe" JSONB DEFAULT '[]'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_products_category" ON "products" ("category");
CREATE INDEX IF NOT EXISTS "idx_products_availability" ON "products" ("is_available", "stock");

-- 5. INGREDIENTS (Reçete & Hammadde Stokları)
CREATE TABLE IF NOT EXISTS "ingredients" (
  "id" VARCHAR(64) PRIMARY KEY,
  "name" VARCHAR(150) NOT NULL,
  "category" VARCHAR(64) NOT NULL DEFAULT 'Genel',
  "unit" VARCHAR(32) NOT NULL DEFAULT 'Adet',
  "stock" NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK ("stock" >= 0),
  "critical_threshold" NUMERIC(10,2) NOT NULL DEFAULT 5.00,
  "icon" VARCHAR(16) NOT NULL DEFAULT '📦',
  "description" TEXT DEFAULT NULL,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_ingredients_category" ON "ingredients" ("category");

-- 6. ORDERS (Siparişler)
CREATE TABLE IF NOT EXISTS "orders" (
  "id" VARCHAR(32) PRIMARY KEY,
  "order_number" VARCHAR(32) NOT NULL UNIQUE,
  "customer_name" VARCHAR(150) NOT NULL,
  "customer_phone" VARCHAR(32) NOT NULL,
  "customer_address" TEXT NOT NULL,
  "order_note" TEXT DEFAULT NULL,
  "payment_method" VARCHAR(64) NOT NULL,
  "payment_status" VARCHAR(32) NOT NULL DEFAULT 'Bekleniyor',
  "subtotal" NUMERIC(10,2) NOT NULL CHECK ("subtotal" >= 0),
  "delivery_fee" NUMERIC(10,2) NOT NULL DEFAULT 0.00 CHECK ("delivery_fee" >= 0),
  "total" NUMERIC(10,2) NOT NULL CHECK ("total" >= 0),
  "user_email" VARCHAR(191) DEFAULT NULL,
  "user_id" VARCHAR(64) DEFAULT NULL REFERENCES "users" ("id") ON DELETE SET NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'Yeni',
  "is_viewed" BOOLEAN NOT NULL DEFAULT FALSE,
  "viewed_at" TIMESTAMPTZ DEFAULT NULL,
  "viewed_by" VARCHAR(120) DEFAULT NULL,
  "courier_name" VARCHAR(120) DEFAULT NULL,
  "delivered_by" VARCHAR(120) DEFAULT NULL,
  "delivered_at" TIMESTAMPTZ DEFAULT NULL,
  "cancellation_reason" TEXT DEFAULT NULL,
  "date_label" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "orders" ("status");
CREATE INDEX IF NOT EXISTS "idx_orders_phone" ON "orders" ("customer_phone");
CREATE INDEX IF NOT EXISTS "idx_orders_user_email" ON "orders" ("user_email");
CREATE INDEX IF NOT EXISTS "idx_orders_created_at" ON "orders" ("created_at" DESC);

-- 7. ORDER ITEMS (Sipariş Kalemleri - JSONB Selected Options)
CREATE TABLE IF NOT EXISTS "order_items" (
  "id" SERIAL PRIMARY KEY,
  "order_id" VARCHAR(32) NOT NULL REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "product_id" INTEGER DEFAULT NULL REFERENCES "products" ("id") ON DELETE SET NULL,
  "name" VARCHAR(191) NOT NULL,
  "price" NUMERIC(10,2) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1 CHECK ("quantity" > 0),
  "selected_options" JSONB DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS "idx_order_items_order_id" ON "order_items" ("order_id");
CREATE INDEX IF NOT EXISTS "idx_order_items_product_id" ON "order_items" ("product_id");

-- 8. ORDER STATUS HISTORY (Sipariş Durum & Denetim Geçmişi)
CREATE TABLE IF NOT EXISTS "order_status_history" (
  "id" SERIAL PRIMARY KEY,
  "order_id" VARCHAR(32) NOT NULL REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "status" VARCHAR(32) NOT NULL,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "user" VARCHAR(120) NOT NULL,
  "note" TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_order_history_order_id" ON "order_status_history" ("order_id");

-- 9. REVIEWS (Müşteri Değerlendirmeleri)
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(150) NOT NULL,
  "initials" VARCHAR(8) NOT NULL,
  "location" VARCHAR(100) NOT NULL DEFAULT 'İstanbul',
  "rating" INTEGER NOT NULL DEFAULT 5 CHECK ("rating" BETWEEN 1 AND 5),
  "comment" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_reviews_rating" ON "reviews" ("rating");
CREATE INDEX IF NOT EXISTS "idx_reviews_created_at" ON "reviews" ("created_at" DESC);

-- 10. FEEDBACK (İletişim & Şikayet/Öneri Bildirimleri)
CREATE TABLE IF NOT EXISTS "feedback" (
  "id" SERIAL PRIMARY KEY,
  "name" VARCHAR(150) NOT NULL,
  "email" VARCHAR(191) NOT NULL,
  "type" VARCHAR(64) NOT NULL DEFAULT 'Öneri / İstek',
  "message" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_feedback_type" ON "feedback" ("type");

-- 11. SECURITY AUDIT LOGS (Güvenlik & Hata Denetim Kayıtları - JSONB Details)
CREATE TABLE IF NOT EXISTS "security_audit_logs" (
  "id" VARCHAR(64) PRIMARY KEY,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "level" VARCHAR(16) NOT NULL,
  "category" VARCHAR(32) NOT NULL,
  "endpoint" VARCHAR(191) NOT NULL,
  "ip" VARCHAR(64) NOT NULL,
  "message" TEXT NOT NULL,
  "details" JSONB DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS "idx_audit_category_level" ON "security_audit_logs" ("category", "level");
CREATE INDEX IF NOT EXISTS "idx_audit_timestamp" ON "security_audit_logs" ("timestamp" DESC);

-- ============================================================================
-- INITIAL SEED DATA (RBAC ROLLERİ)
-- ============================================================================

INSERT INTO "roles" ("id", "name", "code", "color", "description", "is_system", "permissions") VALUES
('role_super_admin', 'Süper Yönetici', 'super_admin', 'rose', 'Tüm sistem ayarları, kullanıcı/rol yönetimi, finansal raporlar ve operasyon üzerinde tam yetki.', TRUE, '["overview", "orders", "inventory", "products", "users", "reviews", "api", "delete_order", "manage_prices"]'::jsonb),
('role_manager', 'Şube Müdürü', 'branch_manager', 'indigo', 'Ciro takibi, sipariş operasyonu, stok güncelleme, menü yönetimi ve müşteri yorumları yetkisi.', TRUE, '["overview", "orders", "inventory", "products", "reviews", "manage_prices"]'::jsonb),
('role_cashier', 'Kasiyer & Sipariş Sorumlusu', 'cashier', 'amber', 'Yeni siparişleri onaylama, fiş yazdırma, kurye atama ve anlık stok takibi yetkisi.', TRUE, '["overview", "orders", "inventory"]'::jsonb),
('role_kitchen', 'Mutfak Şefi / Usta', 'kitchen', 'emerald', 'Mutfak sipariş ekranı (hazırlanıyor/hazır) ve ürün stok durumu yönetimi.', TRUE, '["orders", "inventory"]'::jsonb)
ON CONFLICT ("id") DO NOTHING;

