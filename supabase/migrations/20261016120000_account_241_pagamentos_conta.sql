-- Conta 241 (Imposto sobre o rendimento): apanha as subcontas que não são 2414
-- (ex.: pagamentos por conta) para entrarem na "Retenção na fonte e pagamentos por conta".
INSERT INTO public.financial_accounts (code, name, section, display_order, sign)
VALUES ('241', 'Imposto sobre o rendimento - pagamentos por conta', 'impostos', 2413, 1)
ON CONFLICT (code) DO NOTHING;
