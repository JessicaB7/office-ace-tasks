INSERT INTO public.financial_accounts (code, name, section, display_order, sign)
VALUES ('2414', 'Retenção de impostos sobre rendimentos', 'impostos', 2414, 1)
ON CONFLICT (code) DO NOTHING;