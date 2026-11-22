-- Varias fechas de salida por viaje.
-- "departures" guarda todas las fechas; "departure" se mantiene como la primera (la más cercana en el tiempo)
-- para que todo lo que ya lee esa columna siga funcionando.
ALTER TABLE trips ADD COLUMN departures date[] NOT NULL DEFAULT '{}';
UPDATE trips SET departures = ARRAY[departure];

-- Si alguien inserta un viaje sin "departures" (scripts viejos, carga manual), se completa con "departure".
CREATE FUNCTION trips_fill_departures() RETURNS trigger AS $$
BEGIN
  IF NEW.departures IS NULL OR cardinality(NEW.departures) = 0 THEN
    NEW.departures := ARRAY[NEW.departure];
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trips_fill_departures_trg BEFORE INSERT OR UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION trips_fill_departures();

ALTER TABLE trips ADD CONSTRAINT trips_departures_check CHECK (cardinality(departures) BETWEEN 1 AND 24);
