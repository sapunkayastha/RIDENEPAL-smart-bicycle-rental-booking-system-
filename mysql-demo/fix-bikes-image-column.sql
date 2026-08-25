-- Widen bikes.image_url so it can hold a base64-encoded uploaded image
-- (a plain URL fits fine in TEXT, but an embedded photo needs more room).
ALTER TABLE bikes MODIFY image_url MEDIUMTEXT;