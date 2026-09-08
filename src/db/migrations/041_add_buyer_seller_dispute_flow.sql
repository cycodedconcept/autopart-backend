ALTER TABLE dispute_events
  MODIFY COLUMN event_type ENUM('opened', 'info_requested', 'escalated', 'ruled', 'closed', 'buyer_responded', 'seller_responded') NOT NULL;

-- Keep the existing admin URL contract while storing the private disk path separately.
-- Legacy attachments have no managed local file and retain NULL here.
ALTER TABLE dispute_attachments
  ADD COLUMN file_path VARCHAR(512) NULL,
  ADD UNIQUE KEY uq_dispute_attachments_file_path (file_path);
