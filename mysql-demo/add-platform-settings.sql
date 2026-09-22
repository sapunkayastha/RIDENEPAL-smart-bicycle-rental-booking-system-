USE ridenepal;

-- Platform-wide settings (currently just the commission rate).
-- Referenced by commission.functions.ts, payments.functions.ts,
-- and vendor.functions.ts — those queries fail with no such table
-- until this exists.
CREATE TABLE IF NOT EXISTS platform_settings (
  id INT PRIMARY KEY,
  commission_rate DECIMAL(5,2) NOT NULL DEFAULT 15.00
);

INSERT IGNORE INTO platform_settings (id, commission_rate) VALUES (1, 15.00);
