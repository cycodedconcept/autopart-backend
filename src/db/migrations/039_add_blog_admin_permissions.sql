INSERT INTO permissions (`key`, description)
VALUES
  ('blog_posts.manage', 'Create, update, publish, unpublish, and archive blog posts.'),
  ('blog_categories.manage', 'Create, update, and archive blog categories.'),
  ('blog_tags.manage', 'Create, update, and archive blog tags.'),
  ('blog_comments.manage', 'Moderate blog comments and manage comment status.'),
  ('newsletter_subscribers.read', 'Read and export newsletter subscriber records.')
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.`key` IN (
  'blog_posts.manage',
  'blog_categories.manage',
  'blog_tags.manage',
  'blog_comments.manage',
  'newsletter_subscribers.read'
)
WHERE r.name = 'super_admin'
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;
