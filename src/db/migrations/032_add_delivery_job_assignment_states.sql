ALTER TABLE delivery_jobs
  ADD COLUMN zone_id BIGINT UNSIGNED NULL AFTER seller_id,
  ADD KEY idx_delivery_jobs_zone_id (zone_id),
  ADD CONSTRAINT fk_delivery_jobs_zone_id
    FOREIGN KEY (zone_id) REFERENCES delivery_zones (id)
    ON DELETE SET NULL;

ALTER TABLE delivery_jobs
  MODIFY COLUMN status ENUM('ready_for_pickup', 'pending', 'assigned', 'picked_up', 'in_transit', 'delivered')
    NOT NULL DEFAULT 'pending';

ALTER TABLE delivery_job_status_history
  MODIFY COLUMN status ENUM('ready_for_pickup', 'pending', 'assigned', 'picked_up', 'in_transit', 'delivered')
    NOT NULL;

UPDATE delivery_jobs
SET status = 'pending'
WHERE status = 'ready_for_pickup';

UPDATE delivery_job_status_history
SET status = 'pending'
WHERE status = 'ready_for_pickup';

UPDATE delivery_jobs dj
INNER JOIN orders o ON o.id = dj.order_id
LEFT JOIN delivery_zones dz
  ON LOWER(dz.city) = LOWER(o.delivery_city)
  AND LOWER(dz.state) = LOWER(o.delivery_state)
SET dj.zone_id = dz.id
WHERE dj.zone_id IS NULL;

ALTER TABLE delivery_jobs
  MODIFY COLUMN status ENUM('pending', 'assigned', 'picked_up', 'in_transit', 'delivered')
    NOT NULL DEFAULT 'pending';

ALTER TABLE delivery_job_status_history
  MODIFY COLUMN status ENUM('pending', 'assigned', 'picked_up', 'in_transit', 'delivered')
    NOT NULL;
