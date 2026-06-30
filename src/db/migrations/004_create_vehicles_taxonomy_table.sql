CREATE TABLE IF NOT EXISTS vehicles_taxonomy (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  make VARCHAR(80) NOT NULL,
  model VARCHAR(80) NOT NULL,
  year_from SMALLINT UNSIGNED NOT NULL,
  year_to SMALLINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_vehicles_taxonomy_vehicle_years (make, model, year_from, year_to),
  KEY idx_vehicles_taxonomy_make_model_years (make, model, year_from, year_to),
  CONSTRAINT chk_vehicles_taxonomy_year_range CHECK (year_from <= year_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
