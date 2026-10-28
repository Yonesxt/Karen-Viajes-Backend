-- Fotos del hotel y sección "Tour" (con fotos) en los viajes. Todo opcional.
-- Los viajes que ya existen quedan con listas vacías y sin tour.

ALTER TABLE trips
  ADD COLUMN hotel_images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN tour         text,
  ADD COLUMN tour_images  text[] NOT NULL DEFAULT '{}';

-- Un vuelo no lleva hotel ni tour.
ALTER TABLE trips ADD CONSTRAINT trips_flight_no_extras CHECK (
  category <> 'vuelo'
  OR (hotel IS NULL AND tour IS NULL AND cardinality(hotel_images) = 0 AND cardinality(tour_images) = 0)
);
