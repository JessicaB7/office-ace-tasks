# TOConline — Procedimentos: Empresas (SQ)

Procedimentos administrativos feitos no TOConline (pelo browser) para clientes com
`tipo_contabilidade = "SQ"`. O login no TOConline é sempre feito pela utilizadora.

## 1. Importar as vendas

**Aplica-se a:** todas as empresas, em princípio.

**Passos**
1. **Verificar o SAF-T** — só se o cliente usa um programa de faturação **externo**
   (campo "Programa de Faturação" da ficha, `clients.programa_faturacao`):
   - **Empresa → Importar ficheiro SAF-T**: verificar se o mês está importado.
   - Se **não** estiver importado: **parar e avisar** a utilizadora (não seguir para a contabilidade).
   - Se o programa de faturação tiver **"TOConline"** ou **"TOC"** no nome, o cliente fatura no próprio TOConline:
     salta este passo e vai direto ao passo 2.
   - Se o campo estiver **vazio**, não assumir — avisar a utilizadora.
2. **Contabilidade → Sugestões de vendas → Gerar sugestões**.
3. Escolher o mês — **um mês de cada vez** (Mês inicial = Mês final, ex.: julho a julho, depois agosto a agosto).
   Confirmar antes que o **exercício** aberto (canto superior direito) é o do ano certo.
4. Marcar **Vendas** e carregar em **OK**.
5. **Finalizar** — sem verificações adicionais às sugestões, **mas nunca recibos (RC)**:
   - Na lista de sugestões, filtrar pelos meses tratados (filtro **Mês**) e pelo **Diário = VND (Vendas)**
     — os recibos (RC) ficam no diário BNC, por isso ficam de fora — e usar **Finalizar filtrados**.
   - Não usar "Finalizar todos" se a lista tiver recibos (RC) ou meses fora do período.
   - Depois de finalizar, a lista pode não atualizar sozinha — voltar a filtrar para confirmar.

**Notas práticas**
- O menu **Contabilidade** abre ao passar o rato por cima do separador (clicar leva a "Exercícios").
- Depois de gerar, a lista pode aparecer vazia: recarregar a página ou aplicar o filtro **Mês**.
- Nos filtros, escolher as opções com clique (não carregar Enter nem escrever com o foco no lançamento):
  escrever num lançamento finalizado abre o pedido de **senha do contabilista** — fechar sem preencher.
- Se o resultado indicar documentos **"Não sugeridos"**, normalmente já estão na contabilidade.
  Confirmar em **Contabilidade → Lançamentos finalizados** (e "Lançamentos em preparação") antes de concluir.

**Confirmação:** não é preciso pedir confirmação — o procedimento pode ser feito do início ao fim
sem perguntar (incluindo "Finalizar todos"). Só se pára quando o SAF-T do mês não está importado.

**Na app (Gestão Mensal → Empresas):** não marcar diretamente. No fim, deixar à utilizadora um resumo
do que foi feito (cliente, mês, documentos, o que ficou pendente) e ela marca a coluna **Vendas** manualmente.

## 2. Lançar as compras

**Aplica-se a:** todas as empresas. Mesmo procedimento do TI RS (`ti-rs.md`, secção 1).

**Passos**
1. **Atualizar o e-Fatura**
   - **Compras → e-Fatura**.
   - Abrir o menu dos **3 traços** → **Atualizar e-Fatura**.
   - Selecionar o **mês** da tarefa e confirmar.
2. **Lançar as compras recebidas por e-mail**
   - **Compras → Recebido por email**.
   - Filtrar por **Doc. Compra → Não associado** (anexos sem compra). Não usar o filtro
     "Estado do anexo" (não associado a fornecedor / ao e-fatura) — esse não mostra o que falta lançar.
   - Para cada documento da lista:
     1. Abrir e **ler o anexo** (fatura do fornecedor).
     2. **Selecionar o fornecedor**.
     3. **Colocar os dados da compra** a partir do anexo (data, n.º do documento, valores e IVA).
     4. **Gravar — mas nunca finalizar.** A compra fica gravada por finalizar; quem finaliza é a utilizadora.

**Fornecedores estrangeiros (IVA em autoliquidação)** — fazer **igual às compras anteriores do mesmo fornecedor**
(Compras → Faturas de compra → pesquisar o fornecedor → abrir a última → ver linha, IVA e "Razão de isenção").
Exemplo (Ana Galvão: Canva, Meta): linha tipo **Categoria de despesa 6221** (Trabalhos especializados / Serviços),
IVA **0.0% ISE**, razão **M40 – Art. 6.º n.º 6 a) CIVA, a contrário (IVA - autoliquidação)**; Vossa Ref. = n.º/referência
da fatura. No formulário (botão **+** da coluna FT Compra) gravar com **"Gravar finalizada"** e a caixa
**"Finalizar a sugestão na contabilidade" desmarcada** — fica "Finalizar CTB" para a utilizadora.

**Parar e avisar** (deixar a tarefa como **Bloqueada**, com o motivo no Resultado) quando:
- o anexo não se consegue ler, ou não é uma fatura de compra;
- o fornecedor não existe no TOConline — **não o criar**: a utilizadora cria-o. Indicar no Resultado
  o nome e o NIF do fornecedor em falta e seguir para o documento seguinte;
- os valores do anexo não batem certo (ex.: total ≠ base + IVA).
- o anexo é um comprovativo de pagamento ou um "detalhe da fatura" sem a fatura em si (sem data de emissão) —
  não lançar; indicar no Resultado o n.º do documento e os valores.

**Confirmação:** não é preciso pedir confirmação — pode gravar as compras sem perguntar (passos 1 e 2),
desde que **não finalize**. Nunca criar fornecedores.

**Na app (Gestão Mensal → Empresas):** não marcar diretamente. No fim, deixar no
Resultado da Fila o que foi feito (mês, n.º de compras lançadas, o que ficou por associar) e a utilizadora
marca a coluna **Compras**.

## 3. Lançar os salários

**Aplica-se a:** clientes com o campo **Salários** da ficha preenchido ("Sim até dia 25" / "Sim até ao fim do mês").
Clientes com "Não tem" ou vazio não aparecem na Fila.

**Passos**
1. **Contabilidade → Sugestões de salários**. Confirmar o **exercício** do ano certo.
2. **Gerar sugestões** → Mês inicial = Mês final = mês da tarefa.
3. Marcar **Salários** (só Salários) → avançar → **Gerar**.
4. Registar no Resultado o quadro final (total de documentos, sugeridos, com erros, não sugeridos).
   Se houver **"Não sugeridos"**, confirmar em **Em preparação e finalizados** (filtro Mês) se já estão lançados.

**Não finalizar** as sugestões de salários — a utilizadora revê e finaliza.

**Parar e avisar** (tarefa **Bloqueada**): 0 documentos no mês (processamento de salários ainda não feito no
TOConline) ou documentos com erros.

**Na app:** não marcar diretamente — a utilizadora marca a coluna **Salários** na Gestão Mensal.

## 4. Mapa de análise (exportar mapas e importar na app)

**Aplica-se a:** todos os clientes do regime. Tarefa **trimestral**: o mês da tarefa na Fila é o **último mês do
trimestre** (Mar / Jun / Set / Dez). Se a tarefa estiver noutro mês, usar o trimestre a que esse mês pertence.

**Passos no TOConline** (confirmar a empresa no canto superior esquerdo e o **exercício** do ano certo)
1. **Mapa de Exploração** — **Contabilidade → Outros mapas → Mapa de exploração**.
   Período: de **Janeiro até ao último mês do trimestre** (na app só existe um Mapa de Exploração por ano, e a
   nova importação substitui a anterior — exportar só o trimestre apagava os trimestres anteriores).
   Exportar em **PDF**.
2. **Balancete** — **Contabilidade → Balancetes** → selecionar **só os 3 meses do trimestre**
   (ex.: 2º trimestre = Abril a Junho). Exportar em **PDF**.

**Passos na app**
1. **Clientes → Análise financeira** → abrir o cliente → separador **Dados** → escolher o **ano** do trimestre.
2. Em "Ficheiros importados": botão de importar do **Mapa de Exploração** → escolher o PDF do mapa.
3. Botão de importar do **Balancete Nº trimestre** certo → escolher o PDF do balancete.
4. Confirmar as mensagens da app: "Importação concluída" e, no balancete, o período lido (ex.: 04–06/2026).
5. **IVA por trimestre (preencher à mão)** — o valor vem da declaração periódica entregue, não do balancete:
   - No TOConline: **Contabilidade → Declarações → Declaração periódica** → aparece a lista das declarações
     entregues. Abrir a do **trimestre** e, no **Rosto**, procurar o **campo 93** (imposto a entregar) — é esse o valor.
   - Se o campo 93 não tiver valor, usar o **campo 94** (imposto a recuperar) com **sinal negativo**.
   - Na app: separador **Dashboard anual** → quadro **IVA por trimestre** → escrever o valor no trimestre e sair do
     campo (grava sozinho). Fazer o trimestre da tarefa e os trimestres anteriores do ano que ainda não tenham valor
     manual (os que mostram o valor automático).
   - Trimestre sem declaração entregue → deixar o automático e indicar no Resultado "IVA <trimestre> por entregar".

**Regras aprendidas (out. 2026)**
- **Aviso à admin:** quando um colaborador marca o IVA Periódica de Mar/Jun/Set/Dez como "Entregue", a admin
  recebe uma notificação "IVA entregue" com o botão **Ativar Mapa de análise** — a tarefa só entra na Fila quando
  é ativada (só clientes ativos e se o balancete desse trimestre ainda não estiver importado).
- **Exercício:** confirmar sempre que o mapa/balancete mostra meses "(2026)". Se o TOConline abrir no exercício
  anterior: **Contabilidade → Exercícios → ENTRAR** na linha de 2026.
- **Mais do que uma declaração no mesmo trimestre** (ex.: "2º trimestre" e "2º trimestre (1)"): usar sempre a
  **segunda** — a que tem "(1)" no nome — mesmo que a primeira esteja "Sub. ext." (submetida externamente).
- Declaração com estado **"Sub. ext."** conta como entregue.
- Trimestre **sem declaração** no TOConline (ex.: início de atividade): deixar o automático e indicar no Resultado.
- Trimestres anteriores que **já têm valor manual** na app: não mexer.
- Cliente que **não aparece** no TOConline (nem por NIF nem por nome): tarefa **Bloqueada** com esse motivo.

**Parar e avisar** (tarefa **Bloqueada**, com o motivo no Resultado):
- a app diz que o **NIF do documento não corresponde** ao do cliente;
- "Não foram encontradas linhas com códigos de conta reconhecidos" ou "valores não pertencem ao período";
- o mapa ou o balancete vem vazio no TOConline (trimestre ainda por lançar).

**Confirmação:** não é preciso pedir — exportar, importar e concluir.
No Resultado: trimestre, ficheiros importados, n.º de valores carregados de cada um (mensagem da app) e o IVA
preenchido por trimestre (campo 93 ou 94).
