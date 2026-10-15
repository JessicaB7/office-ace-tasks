---
name: toconline-fila
description: Processa a Fila TOConline da app (secção TOConline → Fila de tarefas) — executa no TOConline, pelo Claude in Chrome, as tarefas pendentes e regista o resultado de cada uma na app. Usar quando a utilizadora disser "processa a fila TOConline", "/toconline-fila" ou pedir para fazer as tarefas TOConline ativadas.
---

# Processar a Fila TOConline

As tarefas são ativadas pela equipa na app (secção **TOConline → Fila de tarefas**,
tabela `toconline_jobs`). Cada tarefa = procedimento × cliente × mês. Tu executas cada
uma no TOConline pelo **Claude in Chrome** (carrega primeiro o skill de Chrome) e
registas o resultado **na própria app, pela página da Fila no Chrome**.

## 0. Preparar
1. Lê o manual do regime em `docs/toconline/` (ex.: `empresas.md`) — segue-o à letra,
   incluindo a secção **Confirmação** de cada procedimento.
2. No Chrome, abre a app (`https://gestao.contabilistaexplica.pt`, ou `http://localhost:8080`
   se a utilizadora estiver a correr local) → **TOConline → Fila de tarefas** → separador
   **Por tratar**. Esta é a lista de trabalho (mais antigas primeiro).
3. Confirma que o TOConline está aberto e com sessão iniciada noutro separador.
   **Nunca escrevas senhas** — se não houver sessão, pára e pede à utilizadora para entrar.

## 1. Para cada tarefa "Pendente"
1. Na Fila, muda o **Estado** da tarefa para **Em curso**.
2. Dados do cliente que precisares (ex.: programa de faturação, NIF): coluna da própria
   Fila na área "Ativar tarefas", ou **Clientes → Dados de clientes**.
3. No TOConline, muda para a empresa do cliente e confirma o **exercício** do ano certo.
   A empresa escolhida vale para toda a conta: antes de cada gravar/gerar/finalizar confirma que o nome no
   canto superior esquerdo é o do cliente. Se mudar sozinho (alguém a usar o TOConline ao mesmo tempo), **pára**,
   repõe a tarefa em Pendente e avisa.
4. Executa o procedimento conforme o manual (o `procedure_id` → secção do manual):
   - `empresas_importar_vendas` → `docs/toconline/empresas.md`, secção 1 "Importar as vendas".
   - `ti_rs_iva_lancar_compras` → `docs/toconline/ti-rs.md`, secção 1 "Lançar as compras".
   - `empresas_lancar_compras` → `docs/toconline/empresas.md`, secção 2 "Lançar as compras".
   - `ti_co_lancar_compras` → `docs/toconline/ti-co.md`, secção 1 "Lançar as compras".
   - `ti_rs_vendas` → `docs/toconline/ti-rs.md`, secção 2 "Lançar as vendas" (A programa / B recibos verdes).
   - `ti_co_vendas` → `docs/toconline/ti-co.md`, secção 2 "Lançar as vendas" (A programa / B recibos verdes).
   - `ti_rs_nao_considerar` / `ti_co_nao_considerar` → secção 4 "Não considerar da atividade" de `ti-rs.md` /
     `ti-co.md`: todas as linhas do e-Fatura do mês; dúvidas ficam por marcar e vão para o Resultado.
   - `ti_rs_salarios` / `ti_co_salarios` / `empresas_salarios` → secção 3 "Lançar os salários" do manual do
     regime (`ti-rs.md`, `ti-co.md`, `empresas.md`). Só gerar sugestões — **não finalizar**.
   - `ti_rs_mapa_analise` / `ti_co_mapa_analise` / `empresas_mapa_analise` → secção "Mapa de análise" do manual
     do regime (secção 5 em `ti-rs.md` / `ti-co.md`, secção 4 em `empresas.md`). Trimestral: mês da tarefa = fim do
     trimestre. Exportar Mapa de Exploração + Balancete em PDF do TOConline e importar na app
     (Clientes → Análise financeira → cliente → Dados). Os PDFs ficam nas Transferências — o upload na app faz-se
     com a ferramenta de upload de ficheiros do Chrome. Depois, preencher à mão o **IVA por trimestre** no Dashboard
     anual (Contabilidade → Declarações → Declaração periódica → Rosto → campo 93; sem valor → campo 94 negativo).
   - `ti_rs_classificacao_efatura` / `ti_co_classificacao_efatura` → secção 6 "Classificação e-Fatura" de
     `ti-rs.md` / `ti-co.md`. Entrar no e-Fatura por **Empresa → Acesso Direto → Portal do e-fatura → Verificar faturas
     → Aceder** (nunca escrever senhas). Com n.º de diário: "Sim, despesa totalmente afeta"; sem n.º de diário: "Não"
     sem preencher o setor. Dúvidas ficam por classificar e vão para o Resultado.
   - `iva_guias_flexibilizacao` → `docs/toconline/iva-flexibilizacao.md`, secção 1 "Guias flexibilização IVA" (todos os
     regimes). Mês da tarefa = mês em que a parcela vence; parcela e método na área "Ativar tarefas" (separador IVA).
     Acesso Direto → "Portal das Finanças" → Aceder; depois abrir `sitfiscal.portaldasfinancas.gov.pt/flexibiliza/consultar/pesquisa`
     no separador do Claude (fazer "Sair" no Portal antes de mudar de cliente). Guia: seta de PAGAR → IMPRIMIR; renomear.
     Referência: descarregar a guia; Débito direto: só o valor. No fim, lista Cliente · N.º da parcela · Valor · Método.
   - `dmr_guia_at` → `docs/toconline/dmr.md`, secção 1 "Guia DMR AT" (todos os regimes). Mês da tarefa = mês de
     referência da DMR. TOConline → Acesso Direto → Pesquisa geral "DMR" → "Consultar DMR-AT" → Aceder (abre o
     Portal já em Consultar Declaração; se abrir fora do grupo, ir a
     `oa.portaldasfinancas.gov.pt/dmr/consultar#?imposto=MR&ano=<AAAA>&mes=<M>`). Confirmar NIF e mês → seta de OPÇÕES →
     OBTER DOCUMENTO DE PAGAMENTO → anotar o montante → OBTER DOCUMENTO → renomear o PDF
     `Guia_DMR_AT_<Nome_do_Cliente>_<MM>_<AAAA>.pdf` (sempre guia). "Sair" no Portal antes de mudar de cliente.
     No fim, lista Cliente · Mês · Montante · Guia · Observações.
   - `dmr_guia_ss` → `docs/toconline/dmr.md`, secção 2 "Guia DMR SS + controlo de dívidas". Acesso Direto → "Segurança
     Social" → Aceder; no separador do Claude abrir `seg-social.pt/ptss/ci/posicao-atual/posicao-atual` → mostrar valores
     a pagar e acordos. Correntes > 0: Fazer pagamentos → Pagar → Multibanco → Continuar → Descarregar referências (PDF)
     → confirmar NIF no PDF e renomear `Guia_DMR_SS_<Cliente>_<MM>_<AAAA>.pdf` (pasta DMR SS). Registar sempre atraso,
     coimas, outros valores e execução fiscal. Terminar sessão na SS antes do cliente seguinte.
