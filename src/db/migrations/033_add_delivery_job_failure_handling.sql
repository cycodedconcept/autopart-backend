ALTER TABLE delivery_jobs
  ADD COLUMN failure_reason VARCHAR(255) NULL AFTER status;

ALTER TABLE delivery_jobs
  MODIFY COLUMN status ENUM('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled')
    NOT NULL DEFAULT 'pending';

ALTER TABLE delivery_job_status_history
  MODIFY COLUMN status ENUM('pending', 'assigned', 'picked_up', 'in_transit', 'delivered', 'failed', 'cancelled')
    NOT NULL;
