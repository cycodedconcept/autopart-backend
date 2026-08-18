INSERT INTO permissions (`key`, description)
VALUES (
  'dashboard.read',
  'Read the super admin dashboard overview and operational widgets.'
)
ON DUPLICATE KEY UPDATE
  description = VALUES(description),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
INNER JOIN permissions p ON p.`key` = 'dashboard.read'
WHERE r.name = 'super_admin'
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;
