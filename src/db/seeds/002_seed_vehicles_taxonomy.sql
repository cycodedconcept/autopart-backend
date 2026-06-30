INSERT INTO vehicles_taxonomy (id, make, model, year_from, year_to)
VALUES
  (3001, 'Toyota', 'Camry', 2007, 2011),
  (3002, 'Toyota', 'Corolla', 2014, 2019),
  (3003, 'Honda', 'Accord', 2008, 2012),
  (3004, 'Lexus', 'RX 330', 2004, 2006),
  (3005, 'Toyota', 'Hilux', 2012, 2015),
  (3006, 'Toyota', 'Highlander', 2003, 2007)
ON DUPLICATE KEY UPDATE
  make = VALUES(make),
  model = VALUES(model),
  year_from = VALUES(year_from),
  year_to = VALUES(year_to),
  updated_at = CURRENT_TIMESTAMP;
