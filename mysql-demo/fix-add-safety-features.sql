-- Safe to re-run: uses IF NOT EXISTS everywhere so partial/previous runs
-- won't error out (requires MySQL 8.0.29+).

-- Rate limiting for login attempts
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS failed_login_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until DATETIME NULL;

-- Booking cancellation / refund tracking
ALTER TABLE bookings
  MODIFY status ENUM('pending','paid','active','completed','cancelled','refunded') NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS cancelled_at DATETIME NULL,
  ADD COLUMN IF NOT EXISTS cancelled_by CHAR(36) NULL,
  ADD COLUMN IF NOT EXISTS refund_notes TEXT NULL;

-- Audit log for staff actions (role changes, verifications, cancellations, refunds, completions)
CREATE TABLE IF NOT EXISTS audit_log (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  actor_id CHAR(36) NOT NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id CHAR(36) NULL,
  details TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_target (target_type, target_id),
  INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;