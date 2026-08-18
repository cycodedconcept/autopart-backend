ALTER TABLE users
  ADD COLUMN account_status ENUM('active', 'suspended', 'banned') NOT NULL DEFAULT 'active' AFTER is_verified,
  ADD KEY idx_users_account_status (account_status),
  ADD KEY idx_users_role_account_status (role, account_status);
