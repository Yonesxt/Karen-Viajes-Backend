-- Estadísticas: solo contadores por día y por viaje. No se guarda ningún dato de las personas
-- (ni IP, ni navegador, ni cookies).
CREATE TABLE trip_stats_daily (
  day      date    NOT NULL,
  trip_id  integer NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
  kind     text    NOT NULL CHECK (kind IN ('view', 'whatsapp')),
  count    integer NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day, trip_id, kind)
);
CREATE INDEX trip_stats_daily_trip_idx ON trip_stats_daily (trip_id);
