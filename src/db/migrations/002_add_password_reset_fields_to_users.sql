ALTER TABLE users
  ADD COLUMN password_reset_token_hash VARCHAR(64) NULL AFTER password_hash,
  ADD COLUMN password_reset_expires_at DATETIME NULL AFTER password_reset_token_hash,
  ADD KEY idx_users_password_reset_token_hash (password_reset_token_hash);
