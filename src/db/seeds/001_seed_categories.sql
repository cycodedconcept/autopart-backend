INSERT INTO categories (id, name, slug, parent_id, status)
VALUES
  (1001, 'Engine Components', 'engine-components', NULL, 'active'),
  (1002, 'Brake System', 'brake-system', NULL, 'active'),
  (1003, 'Suspension & Steering', 'suspension-steering', NULL, 'active'),
  (1004, 'Electrical & Lighting', 'electrical-lighting', NULL, 'active'),
  (1005, 'Filters', 'filters', 1001, 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  slug = VALUES(slug),
  parent_id = VALUES(parent_id),
  updated_at = CURRENT_TIMESTAMP;
