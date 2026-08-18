CREATE TABLE IF NOT EXISTS disputes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  seller_id BIGINT UNSIGNED NULL,
  raised_by ENUM('buyer', 'seller') NOT NULL,
  reason TEXT NOT NULL,
  status ENUM('open', 'resolved', 'rejected') NOT NULL DEFAULT 'open',
  resolution_note TEXT NULL,
  refund_reference VARCHAR(255) NULL,
  refund_amount_kobo BIGINT UNSIGNED NULL,
  resolved_by BIGINT UNSIGNED NULL,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_disputes_order_id (order_id),
  KEY idx_disputes_status_created_at (status, created_at),
  KEY idx_disputes_seller_id (seller_id),
  KEY idx_disputes_resolved_by (resolved_by),
  CONSTRAINT fk_disputes_order
    FOREIGN KEY (order_id) REFERENCES orders (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_disputes_seller
    FOREIGN KEY (seller_id) REFERENCES seller_profiles (id)
    ON DELETE SET NULL,
  CONSTRAINT fk_disputes_resolved_by
    FOREIGN KEY (resolved_by) REFERENCES admins (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
