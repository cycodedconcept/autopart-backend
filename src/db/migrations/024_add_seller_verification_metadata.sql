ALTER TABLE seller_profiles
  ADD COLUMN cac_verification_status VARCHAR(50) NULL AFTER rejection_reason,
  ADD COLUMN cac_verification_response JSON NULL AFTER cac_verification_status,
  ADD COLUMN cac_verification_checked_at TIMESTAMP NULL AFTER cac_verification_response,
  ADD COLUMN verified_by BIGINT UNSIGNED NULL AFTER cac_verification_checked_at,
  ADD COLUMN verified_at TIMESTAMP NULL AFTER verified_by,
  ADD KEY idx_seller_profiles_verified_by (verified_by),
  ADD CONSTRAINT fk_seller_profiles_verified_by
    FOREIGN KEY (verified_by) REFERENCES admins (id)
    ON DELETE SET NULL;
