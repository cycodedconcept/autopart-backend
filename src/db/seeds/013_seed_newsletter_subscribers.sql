INSERT INTO newsletter_subscribers (
  id,
  email,
  unsubscribe_token,
  status,
  ip_address,
  subscribed_at,
  unsubscribed_at,
  created_at,
  updated_at
)
VALUES
  (
    8501,
    'fleet-updates@example.com',
    '6e1fcb75cbe75b95c0db4ae3f2d1b2d7d4af2d12a1d4f09c73031df4d8b6a4a1',
    'subscribed',
    '102.89.12.40',
    '2026-06-02 08:15:00',
    NULL,
    '2026-06-02 08:15:00',
    '2026-06-02 08:15:00'
  ),
  (
    8502,
    'workshop-digest@example.com',
    '8b0f1ab8f3315ce8067d245fba2f0cf918f40e611f0f79e5037798f44d0ee0c2',
    'subscribed',
    '105.112.77.81',
    '2026-07-11 17:40:00',
    NULL,
    '2026-07-11 17:40:00',
    '2026-07-11 17:40:00'
  ),
  (
    8503,
    'market-watch@example.com',
    '04aa49a0378d21b1cb0ff3fe8ec1fe15eb57d484cdfe413d2e55e378955f0b0d',
    'unsubscribed',
    '154.120.88.15',
    '2026-05-19 09:05:00',
    '2026-08-08 12:00:00',
    '2026-05-19 09:05:00',
    '2026-08-08 12:00:00'
  )
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  unsubscribe_token = VALUES(unsubscribe_token),
  status = VALUES(status),
  ip_address = VALUES(ip_address),
  subscribed_at = VALUES(subscribed_at),
  unsubscribed_at = VALUES(unsubscribed_at),
  created_at = VALUES(created_at),
  updated_at = VALUES(updated_at);
