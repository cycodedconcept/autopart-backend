ALTER TABLE payouts
  ADD COLUMN approved_by BIGINT UNSIGNED NULL AFTER status,
  ADD COLUMN approved_at TIMESTAMP NULL DEFAULT NULL AFTER approved_by,
  ADD COLUMN rejection_reason VARCHAR(255) NULL AFTER approved_at,
  ADD KEY idx_payouts_status_requested_at (status, requested_at),
  ADD KEY idx_payouts_approved_by (approved_by),
  ADD CONSTRAINT fk_payouts_approved_by
    FOREIGN KEY (approved_by) REFERENCES admins (id)
    ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS platform_config (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(120) NOT NULL,
  value JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_platform_config_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_id BIGINT UNSIGNED NOT NULL,
  action VARCHAR(120) NOT NULL,
  target_type VARCHAR(120) NOT NULL,
  target_id BIGINT UNSIGNED NULL,
  detail JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_logs_admin_id (admin_id),
  KEY idx_audit_logs_target (target_type, target_id),
  KEY idx_audit_logs_created_at (created_at),
  CONSTRAINT fk_audit_logs_admin
    FOREIGN KEY (admin_id) REFERENCES admins (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO platform_config (`key`, value)
VALUES
  ('commission_rate_default', '10'),
  ('commission_rates_by_category', '[]'),
  ('commission_rates_by_seller_tier', '[]'),
  ('platform_settings', '{}')
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;
