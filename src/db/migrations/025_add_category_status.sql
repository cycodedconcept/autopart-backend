ALTER TABLE categories
  ADD COLUMN status ENUM('active', 'archived') NOT NULL DEFAULT 'active' AFTER parent_id,
  ADD KEY idx_categories_status (status);
