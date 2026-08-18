ALTER TABLE products
  MODIFY COLUMN `condition` ENUM('new', 'used', 'refurbished', 'OEM') NOT NULL;

UPDATE products
SET `condition` = 'OEM'
WHERE `condition` = 'refurbished';

ALTER TABLE products
  MODIFY COLUMN `condition` ENUM('new', 'used', 'OEM') NOT NULL;
