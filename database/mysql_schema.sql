-- ============================================================================
-- SANDWICH DIYARI - MYSQL 8.0+ COMPLETE SCHEMA & SEED SCRIPT
-- Charset: utf8mb4 | Engine: InnoDB
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `sandwich_diyari`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `sandwich_diyari`;

-- 1. ROLES (RBAC Yetki Modelleri)
CREATE TABLE IF NOT EXISTS `roles` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `color` VARCHAR(32) NOT NULL DEFAULT 'blue',
  `description` TEXT NOT NULL,
  `is_system` TINYINT(1) NOT NULL DEFAULT 0,
  `permissions` JSON NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_roles_code` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. ADMIN USERS (Yönetim Paneli & Mutfak/Kasa Personeli)
CREATE TABLE IF NOT EXISTS `admin_users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(32) NOT NULL DEFAULT '',
  `pass_hash` VARCHAR(255) NOT NULL,
  `role_id` VARCHAR(64) NOT NULL,
  `role_name` VARCHAR(120) NOT NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_admin_users_email` (`email`),
  KEY `idx_admin_users_role_id` (`role_id`),
  CONSTRAINT `fk_admin_users_role` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. CUSTOMERS / USERS (Müşteri Üyelikleri)
CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(32) NOT NULL DEFAULT '',
  `address` TEXT NOT NULL,
  `pass_hash` VARCHAR(255) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_users_email` (`email`),
  KEY `idx_users_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. PRODUCTS (Menü & Sandviç Ürünleri)
CREATE TABLE IF NOT EXISTS `products` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(191) NOT NULL,
  `desc` TEXT NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `category` VARCHAR(64) NOT NULL DEFAULT 'sandwich',
  `badge` VARCHAR(64) DEFAULT NULL,
  `image` VARCHAR(500) NOT NULL,
  `calories` VARCHAR(64) DEFAULT NULL,
  `prep_time` VARCHAR(64) DEFAULT NULL,
  `rating` DECIMAL(3,2) NOT NULL DEFAULT 4.80,
  `stock` INT NOT NULL DEFAULT 25,
  `track_stock` TINYINT(1) NOT NULL DEFAULT 1,
  `is_available` TINYINT(1) NOT NULL DEFAULT 1,
  `critical_threshold` INT NOT NULL DEFAULT 5,
  `options` JSON DEFAULT NULL,
  `recipe` JSON DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_products_category` (`category`),
  KEY `idx_products_availability` (`is_available`, `stock`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. INGREDIENTS (Reçete & Hammadde Stokları)
CREATE TABLE IF NOT EXISTS `ingredients` (
  `id` VARCHAR(64) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `category` VARCHAR(64) NOT NULL DEFAULT 'Genel',
  `unit` VARCHAR(32) NOT NULL DEFAULT 'Adet',
  `stock` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `critical_threshold` DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  `icon` VARCHAR(16) NOT NULL DEFAULT '📦',
  `description` TEXT DEFAULT NULL,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_ingredients_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. ORDERS (Siparişler)
CREATE TABLE IF NOT EXISTS `orders` (
  `id` VARCHAR(32) NOT NULL,
  `order_number` VARCHAR(32) NOT NULL,
  `customer_name` VARCHAR(150) NOT NULL,
  `customer_phone` VARCHAR(32) NOT NULL,
  `customer_address` TEXT NOT NULL,
  `order_note` TEXT DEFAULT NULL,
  `payment_method` VARCHAR(64) NOT NULL,
  `payment_status` VARCHAR(32) NOT NULL DEFAULT 'Bekleniyor',
  `subtotal` DECIMAL(10,2) NOT NULL,
  `delivery_fee` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `total` DECIMAL(10,2) NOT NULL,
  `user_email` VARCHAR(191) DEFAULT NULL,
  `user_id` VARCHAR(64) DEFAULT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'Yeni',
  `is_viewed` TINYINT(1) NOT NULL DEFAULT 0,
  `viewed_at` DATETIME DEFAULT NULL,
  `viewed_by` VARCHAR(120) DEFAULT NULL,
  `courier_name` VARCHAR(120) DEFAULT NULL,
  `delivered_by` VARCHAR(120) DEFAULT NULL,
  `delivered_at` DATETIME DEFAULT NULL,
  `cancellation_reason` TEXT DEFAULT NULL,
  `date_label` VARCHAR(32) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_orders_order_number` (`order_number`),
  KEY `idx_orders_status` (`status`),
  KEY `idx_orders_phone` (`customer_phone`),
  KEY `idx_orders_user_email` (`user_email`),
  KEY `idx_orders_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. ORDER ITEMS (Sipariş Kalemleri)
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(32) NOT NULL,
  `product_id` INT DEFAULT NULL,
  `name` VARCHAR(191) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `quantity` INT NOT NULL DEFAULT 1,
  `selected_options` JSON DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_items_order_id` (`order_id`),
  KEY `idx_order_items_product_id` (`product_id`),
  CONSTRAINT `fk_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. ORDER STATUS HISTORY (Sipariş Durum & Denetim Geçmişi)
CREATE TABLE IF NOT EXISTS `order_status_history` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `order_id` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `user` VARCHAR(120) NOT NULL,
  `note` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_order_history_order_id` (`order_id`),
  CONSTRAINT `fk_order_history_order` FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. REVIEWS (Müşteri Değerlendirmeleri)
CREATE TABLE IF NOT EXISTS `reviews` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `initials` VARCHAR(8) NOT NULL,
  `location` VARCHAR(100) NOT NULL DEFAULT 'İstanbul',
  `rating` INT NOT NULL DEFAULT 5,
  `comment` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_reviews_rating` (`rating`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. FEEDBACK (İletişim & Şikayet/Öneri Bildirimleri)
CREATE TABLE IF NOT EXISTS `feedback` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(150) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `type` VARCHAR(64) NOT NULL DEFAULT 'Öneri / İstek',
  `message` TEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_feedback_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. SECURITY AUDIT LOGS (Güvenlik & Hata Denetim Kayıtları)
CREATE TABLE IF NOT EXISTS `security_audit_logs` (
  `id` VARCHAR(64) NOT NULL,
  `timestamp` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `level` VARCHAR(16) NOT NULL,
  `category` VARCHAR(32) NOT NULL,
  `endpoint` VARCHAR(191) NOT NULL,
  `ip` VARCHAR(64) NOT NULL,
  `message` TEXT NOT NULL,
  `details` JSON DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_category_level` (`category`, `level`),
  KEY `idx_audit_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- INITIAL SEED DATA (RBAC ROLLERİ & VARSAYILAN ADMİN KULLANICILARI)
-- ============================================================================

INSERT IGNORE INTO `roles` (`id`, `name`, `code`, `color`, `description`, `is_system`, `permissions`) VALUES
('role_super_admin', 'Süper Yönetici', 'super_admin', 'rose', 'Tüm sistem ayarları, kullanıcı/rol yönetimi, finansal raporlar ve operasyon üzerinde tam yetki.', 1, JSON_ARRAY('overview', 'orders', 'inventory', 'products', 'users', 'reviews', 'api', 'delete_order', 'manage_prices')),
('role_manager', 'Şube Müdürü', 'branch_manager', 'indigo', 'Ciro takibi, sipariş operasyonu, stok güncelleme, menü yönetimi ve müşteri yorumları yetkisi.', 1, JSON_ARRAY('overview', 'orders', 'inventory', 'products', 'reviews', 'manage_prices')),
('role_cashier', 'Kasiyer & Sipariş Sorumlusu', 'cashier', 'amber', 'Yeni siparişleri onaylama, fiş yazdırma, kurye atama ve anlık stok takibi yetkisi.', 1, JSON_ARRAY('overview', 'orders', 'inventory')),
('role_kitchen', 'Mutfak Şefi / Usta', 'kitchen', 'emerald', 'Mutfak sipariş ekranı (hazırlanıyor/hazır) ve ürün stok durumu yönetimi.', 1, JSON_ARRAY('orders', 'inventory'));

