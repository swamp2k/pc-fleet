-- Fleet migration 0003: parts installed in machines PCWatch does not track (e.g. an Unraid server).
-- Available spare = device_id IS NULL AND installed_in IS NULL.
ALTER TABLE fleet_spare_parts ADD COLUMN installed_in TEXT;
