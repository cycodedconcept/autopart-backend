ALTER TABLE orders
  MODIFY COLUMN payment_status ENUM(
    'pending',
    'paid',
    'failed',
    'cancelled',
    'expired',
    'flagged'
  ) NOT NULL DEFAULT 'pending';

ALTER TABLE payments
  MODIFY COLUMN status ENUM(
    'pending',
    'paid',
    'failed',
    'cancelled',
    'expired',
    'flagged'
  ) NOT NULL DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  provider VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_key VARCHAR(255) NOT NULL,
  reference VARCHAR(255) NULL,
  processing_status ENUM('received', 'processed', 'ignored', 'failed') NOT NULL DEFAULT 'received',
  processing_notes VARCHAR(500) NULL,
  raw_payload JSON NULL,
  attempt_count INT UNSIGNED NOT NULL DEFAULT 1,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_webhook_events_provider_type_key (provider, event_type, event_key),
  KEY idx_payment_webhook_events_reference (reference),
  KEY idx_payment_webhook_events_status (processing_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
