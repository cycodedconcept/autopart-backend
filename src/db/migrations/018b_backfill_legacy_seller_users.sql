INSERT INTO users (
  role,
  full_name,
  email,
  phone,
  password_hash,
  is_verified
)
SELECT
  'seller' AS role,
  LEFT(legacy_sellers.seller_business_name, 100) AS full_name,
  CONCAT('legacy-seller-', legacy_sellers.seller_id, '@autoparts.local') AS email,
  NULL AS phone,
  'LEGACY_SELLER_MIGRATION_PLACEHOLDER' AS password_hash,
  1 AS is_verified
FROM (
  SELECT
    p.seller_id,
    MAX(p.seller_business_name) AS seller_business_name
  FROM products p
  GROUP BY p.seller_id
) AS legacy_sellers
LEFT JOIN users u
  ON u.email = CONCAT('legacy-seller-', legacy_sellers.seller_id, '@autoparts.local')
WHERE u.id IS NULL;
