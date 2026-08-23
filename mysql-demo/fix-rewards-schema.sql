USE ridenepal;

-- Original schema used 'rewards' with different columns — rename + fix to match the app's expectations
DROP TABLE IF EXISTS reward_redemptions;
DROP TABLE IF EXISTS rewards;

CREATE TABLE reward_catalog (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(190) NOT NULL,
  points_cost INT NOT NULL,
  icon_key VARCHAR(50) NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE reward_redemptions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  reward_id CHAR(36) NOT NULL,
  points_spent INT NOT NULL,
  redeemed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reward_id) REFERENCES reward_catalog(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed a starter catalog so the rewards page has something to show
INSERT INTO reward_catalog (name, points_cost, icon_key, sort_order) VALUES
('Free Helmet Rental', 100, 'helmet', 1),
('10% Off Next Booking', 250, 'discount', 2),
('Free Day Extension', 500, 'clock', 3),
('Premium Bike Upgrade', 800, 'star', 4);