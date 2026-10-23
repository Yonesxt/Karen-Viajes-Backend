-- Esquema inicial de Viajes con Karen.

CREATE TABLE destinations (
  id          serial PRIMARY KEY,
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  country     text        NOT NULL CHECK (char_length(country) BETWEEN 1 AND 120),
  scope       text        NOT NULL CHECK (scope IN ('nacional', 'internacional')),
  -- links de las imágenes en orden: la primera es la portada de la tarjeta
  images      text[]      NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX destinations_name_unique ON destinations (lower(name));

CREATE TABLE trips (
  id              serial PRIMARY KEY,
  category        text        NOT NULL CHECK (category IN ('paquete', 'crucero', 'hotel', 'vuelo')),
  -- RESTRICT: un destino con viajes no se puede borrar (se desactivan los viajes y se reutiliza)
  destination_id  integer     NOT NULL REFERENCES destinations (id) ON DELETE RESTRICT,
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 120),
  summary         text        NOT NULL CHECK (char_length(summary) BETWEEN 10 AND 2000),
  currency        text        NOT NULL CHECK (currency IN ('USD', 'ARS')),
  price           integer     NOT NULL CHECK (price > 0),
  -- null | {"type":"discount","price":n,"until":"YYYY-MM-DD"?} | {"type":"promo","label":"2x1","note"?:"..","until"?:"YYYY-MM-DD"}
  offer           jsonb,
  nights          integer     CHECK (nights IS NULL OR nights > 0),
  departure       date        NOT NULL,
  origin          text        NOT NULL,
  includes        text[]      NOT NULL DEFAULT '{}',
  hotel           text,
  airline         text,
  trip_kind       text,
  -- desactivar en vez de borrar: el viaje deja de verse en la web pero se conserva
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_flight_shape CHECK (
    (category = 'vuelo' AND nights IS NULL AND airline IS NOT NULL AND trip_kind IS NOT NULL)
    OR (category <> 'vuelo' AND nights IS NOT NULL)
  )
);
CREATE INDEX trips_destination_idx ON trips (destination_id);
CREATE INDEX trips_active_idx ON trips (active);

CREATE TABLE inquiries (
  id          serial PRIMARY KEY,
  name        text        NOT NULL,
  email       text        NOT NULL DEFAULT '',
  phone       text        NOT NULL DEFAULT '',
  subject     text        NOT NULL DEFAULT '',
  message     text        NOT NULL,
  trip_id     integer     REFERENCES trips (id) ON DELETE SET NULL,
  trip_title  text,
  source      text        NOT NULL DEFAULT 'web' CHECK (source IN ('detalle', 'modal', 'web')),
  channel     text        NOT NULL DEFAULT 'formulario' CHECK (channel IN ('formulario', 'whatsapp', 'mail')),
  status      text        NOT NULL DEFAULT 'nueva' CHECK (status IN ('nueva', 'atendida')),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inquiries_status_idx ON inquiries (status, created_at DESC);

CREATE TABLE admins (
  id             serial PRIMARY KEY,
  email          text        NOT NULL UNIQUE,   -- siempre en minúsculas
  name           text        NOT NULL DEFAULT 'Administrador',
  password_hash  text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
