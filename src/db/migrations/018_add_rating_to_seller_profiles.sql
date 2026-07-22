ALTER TABLE seller_profiles
ADD COLUMN rating DECIMAL(2, 1) NOT NULL DEFAULT 0.0 AFTER business_name,
ADD KEY idx_seller_profiles_rating (rating);
