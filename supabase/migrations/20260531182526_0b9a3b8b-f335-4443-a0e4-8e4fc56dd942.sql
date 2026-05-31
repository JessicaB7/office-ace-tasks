
-- Simplify pessoal accounts: collapse detailed subaccounts into 4 SNC parent codes
DELETE FROM public.financial_accounts
WHERE code IN ('6311','6312','6313','6314','6316','6321','6322','6323','6324','6329','6351','6352');

-- Consolidate pessoal sections (rename existing values)
UPDATE public.financial_accounts SET section = 'pessoal' WHERE section IN ('pessoal_socios','pessoal_colab');

-- Insert the 4 new parent accounts (skip 636 which already exists; just ensure its section/name)
INSERT INTO public.financial_accounts (code, name, section, sign, display_order, parent_code) VALUES
  ('631', 'Órgãos sociais', 'pessoal', 1, 100, NULL),
  ('632', 'Pessoal', 'pessoal', 1, 110, NULL),
  ('635', 'Segurança social salários', 'pessoal', 1, 120, NULL)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, section = EXCLUDED.section, display_order = EXCLUDED.display_order;

UPDATE public.financial_accounts SET name = 'Seguro Acidentes de Trabalho', section = 'pessoal', display_order = 130 WHERE code = '636';
