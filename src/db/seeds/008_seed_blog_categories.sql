INSERT INTO blog_categories (id, name, slug, description, status)
VALUES
  (
    8101,
    'Maintenance Guides',
    'maintenance-guides',
    'Practical service advice for keeping Nigerian daily drivers and fleet vehicles road ready.',
    'active'
  ),
  (
    8102,
    'Diagnostics',
    'diagnostics',
    'Troubleshooting explainers for warning signs, drivability issues, and workshop checks.',
    'active'
  ),
  (
    8103,
    'Buying Tips',
    'buying-tips',
    'How to compare parts, check fitment, and avoid costly ordering mistakes.',
    'active'
  ),
  (
    8104,
    'Fleet Operations',
    'fleet-operations',
    'Advice for transport businesses, workshops, and commercial vehicle maintenance planning.',
    'active'
  ),
  (
    8105,
    'Industry News',
    'industry-news',
    'Market trends, import updates, and policy changes affecting spare parts buyers and sellers.',
    'active'
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  slug = VALUES(slug),
  description = VALUES(description),
  status = VALUES(status),
  updated_at = CURRENT_TIMESTAMP;
