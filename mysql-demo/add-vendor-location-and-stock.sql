USE ridenepal;

-- Vendor's shop/pickup location, shown on the homepage feed and the
-- vendor storefront page so customers know where to collect the bike.
ALTER TABLE vendor_profiles
  ADD COLUMN IF NOT EXISTS location VARCHAR(190) NULL AFTER business_name;

-- Per-listing inventory. `stock_quantity` is how many units of this
-- bike the vendor/admin has in total; `available_stock` is how many
-- are currently free to book (decremented on booking, restored on
-- cancel/return). A listing is "in stock" while available_stock > 0,
-- independent of the existing `available` on/off switch.
ALTER TABLE bikes
  ADD COLUMN IF NOT EXISTS stock_quantity INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS available_stock INT NOT NULL DEFAULT 1;

-- Backfill: any bike that already exists gets 1 unit in stock, unless
-- it was already marked unavailable — then it starts at 0 in stock.
UPDATE bikes
   SET stock_quantity = GREATEST(stock_quantity, 1),
       available_stock = IF(available = 1, GREATEST(stock_quantity, 1), 0)
 WHERE stock_quantity <= 1;
