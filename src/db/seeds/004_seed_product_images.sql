INSERT INTO product_images (id, product_id, url, position)
VALUES
  (5001, 4001, 'https://example.com/products/front-brake-pad-camry-1.jpg', 1),
  (5002, 4001, 'https://example.com/products/front-brake-pad-camry-2.jpg', 2),
  (5003, 4002, 'https://example.com/products/rear-shock-accord-1.jpg', 1),
  (5004, 4002, 'https://example.com/products/rear-shock-accord-2.jpg', 2),
  (5005, 4003, 'https://example.com/products/air-filter-corolla-1.jpg', 1),
  (5006, 4004, 'https://example.com/products/starter-motor-rx330-1.jpg', 1),
  (5007, 4004, 'https://example.com/products/starter-motor-rx330-2.jpg', 2),
  (5008, 4005, 'https://example.com/products/fuel-pump-hilux-1.jpg', 1)
ON DUPLICATE KEY UPDATE
  product_id = VALUES(product_id),
  url = VALUES(url),
  position = VALUES(position),
  updated_at = CURRENT_TIMESTAMP;
