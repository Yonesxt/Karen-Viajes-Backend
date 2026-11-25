-- Estado de cada solicitud de arrepentimiento, para marcarla como atendida desde el panel.
ALTER TABLE withdrawals ADD COLUMN status text NOT NULL DEFAULT 'nueva' CHECK (status IN ('nueva', 'atendida'));
