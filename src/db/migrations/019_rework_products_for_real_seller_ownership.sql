ALTER TABLE products
DROP INDEX idx_products_seller_business_name,
DROP INDEX idx_products_seller_rating,
DROP COLUMN seller_business_name,
DROP COLUMN seller_rating,
ADD KEY idx_products_seller_id (seller_id),
ADD CONSTRAINT fk_products_seller
  FOREIGN KEY (seller_id) REFERENCES seller_profiles (id)
  ON DELETE RESTRICT;
