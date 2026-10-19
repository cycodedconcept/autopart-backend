CREATE TABLE IF NOT EXISTS api_keys (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(160) NOT NULL,
  key_prefix CHAR(8) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  key_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  scopes JSON NOT NULL,
  last_used_at TIMESTAMP NULL DEFAULT NULL,
  expires_at TIMESTAMP NULL DEFAULT NULL,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_api_keys_prefix (key_prefix),
  UNIQUE KEY uq_api_keys_hash (key_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
