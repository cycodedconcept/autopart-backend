INSERT INTO product_compatibility (id, product_id, make, model, year_from, year_to)
VALUES
  (6001, 4001, 'Toyota', 'Camry', 2007, 2011),
  (6002, 4002, 'Honda', 'Accord', 2008, 2012),
  (6003, 4003, 'Toyota', 'Corolla', 2014, 2019),
  (6004, 4004, 'Lexus', 'RX 330', 2004, 2006),
  (6005, 4004, 'Toyota', 'Highlander', 2003, 2007),
  (6006, 4005, 'Toyota', 'Hilux', 2012, 2015)
ON DUPLICATE KEY UPDATE
  product_id = VALUES(product_id),
  make = VALUES(make),
  model = VALUES(model),
  year_from = VALUES(year_from),
  year_to = VALUES(year_to),
  updated_at = CURRENT_TIMESTAMP;
