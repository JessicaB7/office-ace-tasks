INSERT INTO public.financial_accounts (code, name, section, display_order, sign) VALUES
  ('71', 'Vendas', 'vendas', 5, 1),
  ('72', 'Prestações de serviços', 'vendas', 6, 1),
  ('73', 'Variações nos inventários de produção', 'vendas', 7, 1),
  ('74', 'Trabalhos para a própria entidade', 'vendas', 8, 1),
  ('75', 'Subsídios à exploração', 'vendas', 9, 1),
  ('76', 'Reversões', 'vendas', 10, 1),
  ('78', 'Outros rendimentos', 'vendas', 11, 1),
  ('79', 'Juros, dividendos e outros rendimentos similares', 'vendas', 12, 1),
  ('61', 'Custo inventários vendidos e matérias consumidas', 'despesas', 505, 1),
  ('62', 'Fornecimentos e serviços externos', 'despesas', 506, 1),
  ('63', 'Gastos com o pessoal', 'pessoal', 101, 1),
  ('64', 'Gastos de depreciação e de amortização', 'despesas', 507, 1),
  ('65', 'Perdas por imparidade', 'despesas', 508, 1),
  ('67', 'Provisões do exercício', 'despesas', 509, 1),
  ('68', 'Outros gastos', 'despesas', 510, 1),
  ('69', 'Gastos de financiamento', 'despesas', 511, 1)
ON CONFLICT (code) DO NOTHING;