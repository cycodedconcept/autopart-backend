INSERT INTO categories (id, name, slug, parent_id)
VALUES
  (1001, 'Engine Components', 'engine-components', NULL),
  (1002, 'Brake System', 'brake-system', NULL),
  (1003, 'Suspension & Steering', 'suspension-steering', NULL),
  (1004, 'Electrical & Lighting', 'electrical-lighting', NULL),
  (1005, 'Filters', 'filters', 1001)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  slug = VALUES(slug),
  parent_id = VALUES(parent_id),
  updated_at = CURRENT_TIMESTAMP;
