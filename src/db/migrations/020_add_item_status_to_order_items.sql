ALTER TABLE order_items
  MODIFY seller_id BIGINT UNSIGNED NOT NULL COMMENT 'Seller profile reference',
  ADD COLUMN item_status ENUM(
    'pending',
    'ready_for_pickup',
    'picked_up',
    'delivered',
    'cancelled'
  ) NOT NULL DEFAULT 'pending' AFTER line_total_kobo,
  ADD INDEX idx_order_items_seller_status (seller_id, item_status);
