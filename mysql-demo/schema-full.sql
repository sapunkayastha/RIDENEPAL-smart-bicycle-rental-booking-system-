-- RideNepal full MySQL schema (replaces Supabase/Postgres)
CREATE DATABASE IF NOT EXISTS ridenepal;
USE ridenepal;

-- USERS (replaces Supabase auth.users + profiles)
CREATE TABLE users (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NULL,          -- NULL if user only ever used Google sign-in
  google_id VARCHAR(190) NULL UNIQUE,
  full_name VARCHAR(190),
  phone VARCHAR(30),
  otp_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  last_sign_in_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- OTP CODES (temporary codes for email verification)
CREATE TABLE otp_codes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  code VARCHAR(10) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SESSIONS (replaces Supabase JWT session handling)
CREATE TABLE sessions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ROLES
CREATE TABLE user_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  role ENUM('super_admin', 'admin', 'customer') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_role (user_id, role),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- BIKES
CREATE TABLE bikes (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(190) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'electric',
  price_per_day DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  description TEXT,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  specs JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- BOOKINGS
CREATE TABLE bookings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  bike_id CHAR(36) NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  pickup_location VARCHAR(255),
  total_amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid','active','completed','cancelled') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bike_id) REFERENCES bikes(id),
  INDEX idx_user (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- PAYMENTS
CREATE TABLE payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  booking_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  provider VARCHAR(20) NOT NULL DEFAULT 'esewa',
  transaction_uuid VARCHAR(190) NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  raw_response JSON,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- RIDE LOCATIONS (GPS)
CREATE TABLE ride_locations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  booking_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  lat DOUBLE NOT NULL,
  lng DOUBLE NOT NULL,
  accuracy DOUBLE,
  recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_booking_time (booking_id, recorded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- REWARDS
CREATE TABLE rewards (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(190) NOT NULL,
  description TEXT,
  points_cost INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reward_redemptions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  reward_id CHAR(36) NOT NULL,
  redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_id) REFERENCES rewards(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- GALLERY / SOCIAL FEED
CREATE TABLE gallery_posts (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE gallery_likes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  post_id CHAR(36) NOT NULL,
  user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_like (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES gallery_posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- BULK RENT REQUESTS
CREATE TABLE bulk_rent_requests (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NULL,
  organization_name VARCHAR(190),
  contact_email VARCHAR(190) NOT NULL,
  contact_phone VARCHAR(30),
  bike_count INT NOT NULL,
  notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SUPPORT CHAT
CREATE TABLE support_conversations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE support_messages (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  conversation_id CHAR(36) NOT NULL,
  sender_id CHAR(36) NOT NULL,
  sender_role ENUM('customer','staff') NOT NULL,
  body TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES support_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_conv (conversation_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- NOTIFICATIONS (staff alerts)
CREATE TABLE notifications (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  title VARCHAR(190) NOT NULL,
  body TEXT,
  link VARCHAR(255),
  `read` BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- FEEDBACK / SUPPORT MESSAGES (previously its own database, now merged in)
CREATE TABLE IF NOT EXISTS feedback_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  subject VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  category ENUM('general', 'bug', 'payment', 'booking', 'other') NOT NULL DEFAULT 'general',
  status ENUM('new', 'in_review', 'resolved') NOT NULL DEFAULT 'new',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;