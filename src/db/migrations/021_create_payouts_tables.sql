CREATE TABLE IF NOT EXISTS payouts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  seller_id BIGINT UNSIGNED NOT NULL,
  gross_amount_kobo BIGINT UNSIGNED NOT NULL,
  commission_amount_kobo BIGINT UNSIGNED NOT NULL,
  amount_kobo BIGINT UNSIGNED NOT NULL,
  status ENUM('requested', 'approved', 'paid', 'rejected') NOT NULL DEFAULT 'requested',
  bank_account_ref VARCHAR(255) NOT NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  settled_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payouts_seller_status (seller_id, status),
  KEY idx_payouts_requested_at (requested_at),
  CONSTRAINT fk_payouts_seller
    FOREIGN KEY (seller_id) REFERENCES seller_profiles (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payout_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  payout_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  gross_amount_kobo BIGINT UNSIGNED NOT NULL,
  commission_amount_kobo BIGINT UNSIGNED NOT NULL,
  net_amount_kobo BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payout_items_payout_id (payout_id),
  KEY idx_payout_items_order_item_id (order_item_id),
  CONSTRAINT fk_payout_items_payout
    FOREIGN KEY (payout_id) REFERENCES payouts (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payout_items_order_item
    FOREIGN KEY (order_item_id) REFERENCES order_items (id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
