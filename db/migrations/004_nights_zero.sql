-- Permite 0 noches (viaje en el día). Antes el mínimo era 1.
ALTER TABLE trips DROP CONSTRAINT trips_nights_check;
ALTER TABLE trips ADD CONSTRAINT trips_nights_check CHECK (nights IS NULL OR nights >= 0);
