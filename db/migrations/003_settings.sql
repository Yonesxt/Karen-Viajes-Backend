-- Ajustes generales del sitio (clave/valor). Por ahora: viajes por página.
CREATE TABLE settings (
  key         text PRIMARY KEY,
  value       jsonb       NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value) VALUES ('tripsPerPage', '20'::jsonb);
