INSERT INTO seller_profiles (
  id,
  user_id,
  business_name,
  rating,
  contact_phone,
  contact_email,
  address,
  cac_number,
  verification_status,
  rejection_reason
)
SELECT
  legacy_sellers.seller_id AS id,
  u.id AS user_id,
  legacy_sellers.seller_business_name AS business_name,
  legacy_sellers.seller_rating AS rating,
  NULL AS contact_phone,
  CONCAT('legacy-seller-', legacy_sellers.seller_id, '@autoparts.local') AS contact_email,
  CONCAT('Legacy imported seller profile for seller ', legacy_sellers.seller_id) AS address,
  CONCAT('LEGACY-SELLER-', legacy_sellers.seller_id) AS cac_number,
  'verified' AS verification_status,
  NULL AS rejection_reason
FROM (
  SELECT
    p.seller_id,
    MAX(p.seller_business_name) AS seller_business_name,
    MAX(p.seller_rating) AS seller_rating
  FROM products p
  GROUP BY p.seller_id
) AS legacy_sellers
INNER JOIN users u
  ON u.email = CONCAT('legacy-seller-', legacy_sellers.seller_id, '@autoparts.local')
LEFT JOIN seller_profiles sp
  ON sp.id = legacy_sellers.seller_id
WHERE sp.id IS NULL;
