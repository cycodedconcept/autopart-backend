INSERT INTO delivery_zones (name, state, city)
VALUES
  ('Ikeja Central', 'Lagos', 'Ikeja'),
  ('Victoria Island', 'Lagos', 'Victoria Island'),
  ('Surulere Hub', 'Lagos', 'Surulere'),
  ('Wuse Central', 'FCT', 'Abuja')
ON DUPLICATE KEY UPDATE
  updated_at = CURRENT_TIMESTAMP;
