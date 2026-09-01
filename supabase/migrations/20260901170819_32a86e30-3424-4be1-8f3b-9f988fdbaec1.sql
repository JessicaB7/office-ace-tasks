ALTER TABLE public.client_financial_settings
  ADD COLUMN IF NOT EXISTS mapa_q1_enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mapa_q2_enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mapa_q3_enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mapa_q4_enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS mapa_q1_data date,
  ADD COLUMN IF NOT EXISTS mapa_q2_data date,
  ADD COLUMN IF NOT EXISTS mapa_q3_data date,
  ADD COLUMN IF NOT EXISTS mapa_q4_data date;