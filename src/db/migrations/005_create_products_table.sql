CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id BIGINT UNSIGNED NOT NULL COMMENT 'SELLER-STUB public seller reference',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  part_number VARCHAR(100) NOT NULL,
  `condition` ENUM('new', 'used', 'refurbished') NOT NULL,
  price_kobo BIGINT UNSIGNED NOT NULL,
  stock_qty INT UNSIGNED NOT NULL DEFAULT 0,
  location VARCHAR(120) NOT NULL,
  seller_business_name VARCHAR(160) NOT NULL COMMENT 'SELLER-STUB public seller business name',
  seller_rating DECIMAL(2, 1) NOT NULL DEFAULT 0.0 COMMENT 'SELLER-STUB public seller rating',
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_products_category_id (category_id),
  KEY idx_products_title (title),
  KEY idx_products_part_number (part_number),
  KEY idx_products_price_kobo (price_kobo),
  KEY idx_products_location (location),
  KEY idx_products_seller_business_name (seller_business_name),
  KEY idx_products_seller_rating (seller_rating),
  KEY idx_products_status (status),
  CONSTRAINT fk_products_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
