CREATE TABLE IF NOT EXISTS seller_profiles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  business_name VARCHAR(160) NOT NULL,
  contact_phone VARCHAR(20) NULL,
  contact_email VARCHAR(255) NULL,
  address TEXT NOT NULL,
  cac_number VARCHAR(100) NOT NULL,
  verification_status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_seller_profiles_user_id (user_id),
  UNIQUE KEY uq_seller_profiles_cac_number (cac_number),
  KEY idx_seller_profiles_verification_status (verification_status),
  CONSTRAINT fk_seller_profiles_user
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_seller_profiles_contact
    CHECK (contact_email IS NOT NULL OR contact_phone IS NOT NULL)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
