USE ridenepal;

-- Add 'vendor' as a role alongside super_admin/admin/customer
ALTER TABLE user_roles
  MODIFY role ENUM('super_admin','admin','vendor','customer') NOT NULL;

-- Vendor business profile + approval status
CREATE TABLE IF NOT EXISTS vendor_profiles (
  user_id CHAR(36) PRIMARY KEY,
  business_name VARCHAR(190) NOT NULL,
  pan_number VARCHAR(50) NOT NULL,
  vat_number VARCHAR(50) NULL,
  status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  rejection_reason TEXT NULL,
  reviewed_by CHAR(36) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Bikes can now optionally belong to a vendor (NULL = platform-owned, unchanged)
ALTER TABLE bikes
  ADD COLUMN IF NOT EXISTS vendor_id CHAR(36) NULL,
  ADD CONSTRAINT fk_bikes_vendor FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE SET NULL;

-- Post-trip reviews, one per completed booking
CREATE TABLE IF NOT EXISTS vendor_reviews (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  booking_id CHAR(36) NOT NULL UNIQUE,
  vendor_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  rating TINYINT NOT NULL,
  comment TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (vendor_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;