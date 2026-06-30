CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  buyer_id BIGINT UNSIGNED NOT NULL,
  status ENUM(
    'pending_payment',
    'confirmed',
    'picked_up',
    'in_transit',
    'delivered',
    'cancelled',
    'disputed'
  ) NOT NULL DEFAULT 'pending_payment',
  payment_method ENUM('paystack', 'bank_transfer', 'ussd') NOT NULL,
  subtotal_kobo BIGINT UNSIGNED NOT NULL,
  delivery_fee_kobo BIGINT UNSIGNED NOT NULL DEFAULT 0,
  total_kobo BIGINT UNSIGNED NOT NULL,
  delivery_address_id BIGINT UNSIGNED NULL,
  delivery_label VARCHAR(100) NOT NULL,
  delivery_street VARCHAR(255) NOT NULL,
  delivery_city VARCHAR(120) NOT NULL,
  delivery_state VARCHAR(120) NOT NULL,
  delivery_phone VARCHAR(20) NOT NULL,
  payment_reference VARCHAR(255) NULL,
  payment_status ENUM('pending', 'paid', 'failed', 'cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_orders_buyer_id (buyer_id),
  KEY idx_orders_status (status),
  KEY idx_orders_payment_status (payment_status),
  KEY idx_orders_delivery_address_id (delivery_address_id),
  CONSTRAINT fk_orders_buyer
    FOREIGN KEY (buyer_id) REFERENCES users (id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_orders_delivery_address
    FOREIGN KEY (delivery_address_id) REFERENCES buyer_addresses (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
