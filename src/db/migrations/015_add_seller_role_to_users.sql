ALTER TABLE users
MODIFY COLUMN role ENUM('buyer', 'seller') NOT NULL DEFAULT 'buyer';
