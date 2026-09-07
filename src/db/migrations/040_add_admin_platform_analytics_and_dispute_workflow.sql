ALTER TABLE orders
  ADD KEY idx_orders_status_payment_created (status, payment_status, created_at);

ALTER TABLE order_items
  ADD KEY idx_order_items_seller_order (seller_id, order_id);

ALTER TABLE disputes
  MODIFY COLUMN status ENUM('open', 'resolved', 'rejected', 'in_review', 'escalated', 'closed')
    NOT NULL DEFAULT 'open',
  ADD COLUMN description TEXT NULL,
  ADD COLUMN buyer_evidence_summary TEXT NULL,
  ADD COLUMN seller_evidence_summary TEXT NULL,
  ADD COLUMN closed_at TIMESTAMP NULL DEFAULT NULL,
  ADD KEY idx_disputes_created_at (created_at),
  ADD KEY idx_disputes_seller_created (seller_id, created_at);

CREATE TABLE IF NOT EXISTS dispute_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dispute_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('opened', 'info_requested', 'escalated', 'ruled', 'closed') NOT NULL,
  admin_id BIGINT UNSIGNED NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  detail JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dispute_events_dispute_created (dispute_id, created_at, id),
  CONSTRAINT fk_dispute_events_dispute FOREIGN KEY (dispute_id) REFERENCES disputes (id) ON DELETE CASCADE,
  CONSTRAINT fk_dispute_events_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE SET NULL,
  CONSTRAINT fk_dispute_events_user FOREIGN KEY (actor_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dispute_rulings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dispute_id BIGINT UNSIGNED NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  decision ENUM('refund_buyer_full', 'refund_seller', 'partial_refund', 'no_action') NOT NULL,
  notes TEXT NOT NULL,
  partial_amount_kobo BIGINT UNSIGNED NULL,
  require_reverse_logistics BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_dispute_rulings_dispute (dispute_id),
  CONSTRAINT fk_dispute_rulings_dispute FOREIGN KEY (dispute_id) REFERENCES disputes (id) ON DELETE CASCADE,
  CONSTRAINT fk_dispute_rulings_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE RESTRICT,
  CONSTRAINT chk_dispute_ruling_partial CHECK (
    (decision = 'partial_refund' AND partial_amount_kobo IS NOT NULL AND partial_amount_kobo > 0)
    OR (decision <> 'partial_refund' AND partial_amount_kobo IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS dispute_attachments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  dispute_id BIGINT UNSIGNED NOT NULL,
  submitted_by ENUM('buyer', 'seller') NOT NULL,
  url VARCHAR(2048) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_dispute_attachments_dispute_party (dispute_id, submitted_by, uploaded_at),
  CONSTRAINT fk_dispute_attachments_dispute FOREIGN KEY (dispute_id) REFERENCES disputes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve known historical actors/timestamps without inventing evidence or rulings.
INSERT INTO dispute_events (dispute_id, event_type, actor_user_id, detail, created_at)
SELECT d.id, 'opened',
  CASE WHEN d.raised_by = 'buyer' THEN o.buyer_id ELSE sp.user_id END,
  JSON_OBJECT('raisedBy', d.raised_by), d.created_at
FROM disputes d
INNER JOIN orders o ON o.id = d.order_id
LEFT JOIN seller_profiles sp ON sp.id = d.seller_id;

INSERT INTO dispute_events (dispute_id, event_type, admin_id, detail, created_at)
SELECT id, 'ruled', resolved_by,
  JSON_OBJECT('legacyStatus', status, 'notes', resolution_note), resolved_at
FROM disputes WHERE resolved_at IS NOT NULL;

UPDATE platform_config
SET value = JSON_SET(value, '$.disputeReviewSlaHours', 24)
WHERE `key` = 'platform_settings'
  AND JSON_CONTAINS_PATH(value, 'one', '$.disputeReviewSlaHours') = 0;
