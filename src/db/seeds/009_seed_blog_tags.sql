INSERT INTO blog_tags (id, name, slug, status)
VALUES
  (8201, 'Brake Care', 'brake-care', 'active'),
  (8202, 'Engine Health', 'engine-health', 'active'),
  (8203, 'Suspension', 'suspension', 'active'),
  (8204, 'Electrical', 'electrical', 'active'),
  (8205, 'Workshop Tips', 'workshop-tips', 'active'),
  (8206, 'Fleet Planning', 'fleet-planning', 'active'),
  (8207, 'Import Watch', 'import-watch', 'active'),
  (8208, 'Buying Guide', 'buying-guide', 'active'),
  (8209, 'Filter Service', 'filter-service', 'active'),
  (8210, 'Fuel System', 'fuel-system', 'active')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  slug = VALUES(slug),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;
