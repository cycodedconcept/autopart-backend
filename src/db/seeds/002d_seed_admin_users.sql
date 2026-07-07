INSERT INTO users (
  id,
  role,
  full_name,
  email,
  phone,
  password_hash,
  is_verified
)
VALUES
  (
    9201,
    'admin',
    'Platform Admin',
    'admin@autoparts.local',
    '+2348012345699',
    '$2b$10$0iJDZfD1nvs6fCDIJ//aee3Wy7FPzkRoO9g9ABoeC25nlJ5hBPkRK',
    1
  )
ON DUPLICATE KEY UPDATE
  role = VALUES(role),
  full_name = VALUES(full_name),
  email = VALUES(email),
  phone = VALUES(phone),
  password_hash = VALUES(password_hash),
  is_verified = VALUES(is_verified),
  updated_at = CURRENT_TIMESTAMP;
