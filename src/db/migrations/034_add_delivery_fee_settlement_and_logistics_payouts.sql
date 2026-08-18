ALTER TABLE order_items
  ADD COLUMN delivery_fee_kobo BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER line_total_kobo;

ALTER TABLE delivery_jobs
  ADD COLUMN delivery_fee_kobo BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER failure_reason,
  ADD COLUMN platform_margin_kobo BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER delivery_fee_kobo,
  ADD COLUMN company_share_kobo BIGINT UNSIGNED NOT NULL DEFAULT 0 AFTER platform_margin_kobo,
  ADD COLUMN settlement_recorded_at TIMESTAMP NULL DEFAULT NULL AFTER delivered_at;

UPDATE delivery_jobs dj
INNER JOIN order_items oi ON oi.id = dj.order_item_id
SET dj.delivery_fee_kobo = oi.delivery_fee_kobo
WHERE dj.delivery_fee_kobo = 0;

ALTER TABLE payouts
  MODIFY COLUMN seller_id BIGINT UNSIGNED NULL,
  ADD COLUMN payee_type ENUM('seller', 'logistics_company') NOT NULL DEFAULT 'seller' AFTER id,
  ADD COLUMN logistics_company_id BIGINT UNSIGNED NULL AFTER seller_id,
  ADD KEY idx_payouts_payee_type_status (payee_type, status),
  ADD KEY idx_payouts_logistics_company_status (logistics_company_id, status),
  ADD CONSTRAINT fk_payouts_logistics_company
    FOREIGN KEY (logistics_company_id) REFERENCES logistics_companies (id)
    ON DELETE CASCADE;

UPDATE payouts
SET payee_type = 'seller'
WHERE payee_type <> 'seller' OR payee_type IS NULL;

ALTER TABLE payout_items
  ADD COLUMN delivery_job_id BIGINT UNSIGNED NULL AFTER order_item_id,
  ADD KEY idx_payout_items_delivery_job_id (delivery_job_id),
  ADD CONSTRAINT fk_payout_items_delivery_job
    FOREIGN KEY (delivery_job_id) REFERENCES delivery_jobs (id)
    ON DELETE RESTRICT;

UPDATE payout_items pi
INNER JOIN delivery_jobs dj ON dj.order_item_id = pi.order_item_id
SET pi.delivery_job_id = dj.id
WHERE pi.delivery_job_id IS NULL;
