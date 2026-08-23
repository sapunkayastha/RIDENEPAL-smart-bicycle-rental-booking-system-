USE ridenepal;

ALTER TABLE bulk_rent_requests
  CHANGE COLUMN organization_name organization VARCHAR(200) NULL,
  ADD COLUMN IF NOT EXISTS event_date DATE NULL;