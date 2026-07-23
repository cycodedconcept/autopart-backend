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
  (9101, 'seller', 'Uche Okafor', 'uche@primeautohub.ng', '+2348012345601', '$2b$10$0iJDZfD1nvs6fCDIJ//aee3Wy7FPzkRoO9g9ABoeC25nlJ5hBPkRK', 1),
  (9102, 'seller', 'Binta Musa', 'binta@savannahparts.ng', '+2348012345602', '$2b$10$0iJDZfD1nvs6fCDIJ//aee3Wy7FPzkRoO9g9ABoeC25nlJ5hBPkRK', 1),
  (9103, 'seller', 'Chinedu Eze', 'chinedu@naijaoem.ng', '+2348012345603', '$2b$10$0iJDZfD1nvs6fCDIJ//aee3Wy7FPzkRoO9g9ABoeC25nlJ5hBPkRK', 1),
  (9104, 'seller', 'Tola Akinola', 'tola@elitemobility.ng', '+2348012345604', '$2b$10$0iJDZfD1nvs6fCDIJ//aee3Wy7FPzkRoO9g9ABoeC25nlJ5hBPkRK', 1),
  (9105, 'seller', 'Yusuf Garba', 'yusuf@northerntruckparts.ng', '+2348012345605', '$2b$10$0iJDZfD1nvs6fCDIJ//aee3Wy7FPzkRoO9g9ABoeC25nlJ5hBPkRK', 1)
ON DUPLICATE KEY UPDATE
  role = VALUES(role),
  full_name = VALUES(full_name),
  email = VALUES(email),
  phone = VALUES(phone),
  password_hash = VALUES(password_hash),
  is_verified = VALUES(is_verified),
  updated_at = CURRENT_TIMESTAMP;
