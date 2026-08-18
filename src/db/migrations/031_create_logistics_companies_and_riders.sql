CREATE TABLE IF NOT EXISTS delivery_zones (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  state VARCHAR(120) NOT NULL,
  city VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_delivery_zones_name_state_city (name, state, city),
  KEY idx_delivery_zones_state_city (state, city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS logistics_companies (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  address VARCHAR(500) NOT NULL,
  status ENUM('pending', 'approved', 'suspended') NOT NULL DEFAULT 'pending',
  approved_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_logistics_companies_email (email),
  UNIQUE KEY uq_logistics_companies_phone (phone),
  KEY idx_logistics_companies_status (status),
  CONSTRAINT fk_logistics_companies_approved_by
    FOREIGN KEY (approved_by) REFERENCES admins (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS riders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  company_id BIGINT UNSIGNED NOT NULL,
  zone_id BIGINT UNSIGNED NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(32) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  vehicle_type VARCHAR(120) NOT NULL,
  status ENUM('available', 'on_delivery', 'unavailable', 'inactive') NOT NULL DEFAULT 'unavailable',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_riders_phone (phone),
  UNIQUE KEY uq_riders_email (email),
  KEY idx_riders_company_id (company_id),
  KEY idx_riders_zone_id (zone_id),
  KEY idx_riders_status (status),
  CONSTRAINT fk_riders_company_id
    FOREIGN KEY (company_id) REFERENCES logistics_companies (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_riders_zone_id
    FOREIGN KEY (zone_id) REFERENCES delivery_zones (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE delivery_jobs
  ADD COLUMN company_id BIGINT UNSIGNED NULL AFTER seller_id,
  ADD COLUMN rider_id BIGINT UNSIGNED NULL AFTER company_id,
  ADD KEY idx_delivery_jobs_company_id (company_id),
  ADD KEY idx_delivery_jobs_rider_id (rider_id),
  ADD CONSTRAINT fk_delivery_jobs_company_id
    FOREIGN KEY (company_id) REFERENCES logistics_companies (id)
    ON DELETE SET NULL,
  ADD CONSTRAINT fk_delivery_jobs_rider_id
    FOREIGN KEY (rider_id) REFERENCES riders (id)
    ON DELETE SET NULL;
