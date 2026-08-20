INSERT INTO roles (name, description)
VALUES
  ('super_admin', 'Full-access administrator for platform operations.'),
  ('verification_admin', 'Scoped administrator for seller verification reviews.')
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO permissions (`key`, description)
VALUES
  ('dashboard.read', 'Read the super admin dashboard overview and operational widgets.'),
  ('blog_posts.manage', 'Create, update, publish, unpublish, and archive blog posts.'),
  ('blog_categories.manage', 'Create, update, and archive blog categories.'),
  ('blog_tags.manage', 'Create, update, and archive blog tags.'),
  ('blog_comments.manage', 'Moderate blog comments and manage comment status.'),
  ('newsletter_subscribers.read', 'Read and export newsletter subscriber records.'),
  ('admins.read_self', 'View the authenticated admin profile and assigned permissions.'),
  ('sellers.verify', 'Review and update seller verification decisions.'),
  ('categories.manage', 'Create, update, and delete catalogue categories.'),
  ('users.manage', 'Review and update buyer or seller account access.'),
  ('logistics.manage', 'Review logistics companies and riders, and manage company access.'),
  ('orders.manage', 'Review and intervene in platform-wide order workflows.'),
  ('payouts.approve', 'Review seller payout requests and advance payout states.'),
  ('config.manage', 'Update global platform configuration values.'),
  ('disputes.resolve', 'Review and resolve buyer or seller disputes.'),
  ('audit_logs.read', 'Read sensitive admin audit log entries.')
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.`key` IN (
  'dashboard.read',
  'blog_posts.manage',
  'blog_categories.manage',
  'blog_tags.manage',
  'blog_comments.manage',
  'newsletter_subscribers.read',
  'admins.read_self',
  'sellers.verify',
  'categories.manage',
  'users.manage',
  'logistics.manage',
  'orders.manage',
  'payouts.approve',
  'config.manage',
  'disputes.resolve',
  'audit_logs.read'
)
WHERE r.name = 'super_admin'
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.`key` IN (
  'admins.read_self',
  'sellers.verify'
)
WHERE r.name = 'verification_admin'
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;
