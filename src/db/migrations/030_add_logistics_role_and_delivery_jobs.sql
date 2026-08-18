ALTER TABLE users
MODIFY COLUMN role ENUM('buyer', 'seller', 'admin', 'logistics') NOT NULL DEFAULT 'buyer';

CREATE TABLE IF NOT EXISTS logistics_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  provider_name VARCHAR(160) NOT NULL,
  vehicle_type VARCHAR(120) NOT NULL,
  plate_number VARCHAR(64) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_logistics_profiles_user_id (user_id),
  KEY idx_logistics_profiles_provider_name (provider_name),
  CONSTRAINT fk_logistics_profiles_user_id
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NOT NULL,
  logistics_profile_id BIGINT UNSIGNED NULL,
  status ENUM('ready_for_pickup', 'picked_up', 'in_transit', 'delivered') NOT NULL DEFAULT 'ready_for_pickup',
  pickup_address VARCHAR(500) NOT NULL,
  assigned_at TIMESTAMP NULL DEFAULT NULL,
  picked_up_at TIMESTAMP NULL DEFAULT NULL,
  in_transit_at TIMESTAMP NULL DEFAULT NULL,
  delivered_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_jobs_order_item_id (order_item_id),
  KEY idx_delivery_jobs_status (status),
  KEY idx_delivery_jobs_logistics_profile_id (logistics_profile_id),
  KEY idx_delivery_jobs_order_id (order_id),
  CONSTRAINT fk_delivery_jobs_order_id
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_delivery_jobs_order_item_id
    FOREIGN KEY (order_item_id) REFERENCES order_items (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_delivery_jobs_seller_id
    FOREIGN KEY (seller_id) REFERENCES seller_profiles (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_delivery_jobs_logistics_profile_id
    FOREIGN KEY (logistics_profile_id) REFERENCES logistics_profiles (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS delivery_job_status_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  delivery_job_id BIGINT UNSIGNED NOT NULL,
  status ENUM('ready_for_pickup', 'picked_up', 'in_transit', 'delivered') NOT NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_delivery_job_status_history_job_id (delivery_job_id),
  CONSTRAINT fk_delivery_job_status_history_job_id
    FOREIGN KEY (delivery_job_id) REFERENCES delivery_jobs (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
