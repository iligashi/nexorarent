CREATE TABLE refresh_token_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  replaced_by_session_id CHAR(36) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_refresh_sessions_user_revoked (user_id, revoked_at),
  INDEX idx_refresh_sessions_expiry (expires_at),
  CONSTRAINT fk_refresh_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE admin_audit_log
  ADD COLUMN action VARCHAR(120) NOT NULL DEFAULT 'admin_action',
  ADD COLUMN target_id VARCHAR(100) NULL;

CREATE INDEX idx_res_car_status_dates
  ON reservations (car_id, status, pickup_date, dropoff_date);
