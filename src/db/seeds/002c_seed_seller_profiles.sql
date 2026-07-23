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
VALUES
  (9001, 9101, 'Prime Auto Hub', 4.6, '+2348012345601', 'sales@primeautohub.ng', '12 Sapara Williams Close, Victoria Island, Lagos', 'RC-900001', 'verified', NULL),
  (9002, 9102, 'Savannah Parts Depot', 4.2, '+2348012345602', 'hello@savannahparts.ng', '24 Ademola Adetokunbo Crescent, Wuse II, Abuja', 'RC-900002', 'verified', NULL),
  (9003, 9103, 'Naija OEM Spares', 4.8, '+2348012345603', 'support@naijaoem.ng', '7 Aba Road, GRA Phase 2, Port Harcourt', 'RC-900003', 'verified', NULL),
  (9004, 9104, 'Elite Mobility Parts', 4.9, '+2348012345604', 'orders@elitemobility.ng', '18 Adeola Odeku Street, Victoria Island, Lagos', 'RC-900004', 'verified', NULL),
  (9005, 9105, 'Northern Truck Parts', 4.1, '+2348012345605', 'sales@northerntruckparts.ng', '3 Zoo Road, Kano', 'RC-900005', 'verified', NULL)
ON DUPLICATE KEY UPDATE
  user_id = VALUES(user_id),
  business_name = VALUES(business_name),
  rating = VALUES(rating),
  contact_phone = VALUES(contact_phone),
  contact_email = VALUES(contact_email),
  address = VALUES(address),
  cac_number = VALUES(cac_number),
  verification_status = VALUES(verification_status),
  rejection_reason = VALUES(rejection_reason),
  updated_at = CURRENT_TIMESTAMP;
