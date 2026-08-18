ALTER TABLE riders
  DROP KEY idx_riders_status,
  CHANGE COLUMN status availability_status
    ENUM('available', 'on_delivery', 'unavailable', 'inactive')
    NOT NULL DEFAULT 'unavailable',
  ADD COLUMN status ENUM('active', 'suspended') NOT NULL DEFAULT 'active' AFTER availability_status,
  ADD KEY idx_riders_availability_status (availability_status),
  ADD KEY idx_riders_account_status (status);
