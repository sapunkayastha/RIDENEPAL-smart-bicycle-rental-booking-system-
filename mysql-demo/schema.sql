-- RideNepal: Feedback / Support Messages (MySQL)
--
-- This is a small, self-contained piece of RideNepal's backend that uses
-- MySQL instead of the main Supabase/PostgreSQL database. It stores
-- rider feedback and support messages submitted from the site.
--
-- Everything else in RideNepal (bikes, bookings, auth, rewards, payments)
-- lives in Supabase/PostgreSQL. This table intentionally does NOT touch
-- or duplicate that data — it's a standalone feature.

CREATE DATABASE IF NOT EXISTS ridenepal_mysql;
USE ridenepal_mysql;

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