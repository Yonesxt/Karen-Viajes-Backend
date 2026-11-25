-- Botón de arrepentimiento (Res. 424/2020): se guarda cada solicitud como constancia,
-- aunque después falle el envío del mail.
CREATE TABLE withdrawals (
  id           serial PRIMARY KEY,
  first_name   text        NOT NULL,
  last_name    text        NOT NULL,
  dni          text        NOT NULL,
  email        text        NOT NULL,
  phone        text        NOT NULL,
  booking_code text        NOT NULL,
  mail_status  text        NOT NULL DEFAULT 'pendiente' CHECK (mail_status IN ('pendiente', 'enviado', 'fallido')),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX withdrawals_created_idx ON withdrawals (created_at DESC);
