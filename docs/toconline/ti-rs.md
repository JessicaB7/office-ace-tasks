# TOConline — Procedimentos: TI Regime Simplificado (TI RS)

Procedimentos administrativos feitos no TOConline (pelo browser) para clientes com
`tipo_contabilidade = "TI RS"`. O login no TOConline é sempre feito pela utilizadora.

## 1. Lançar as compras

**Aplica-se a:** clientes TI RS **com regime de IVA** (Gestão Mensal → "TI Simplificado - Reg. IVA";
ou seja, IVA que não seja Art. 53º nem Art. 9º).

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

**Na app (Gestão Mensal → TI Simplificado - Reg. IVA):** não marcar diretamente. No fim, deixar no
Resultado da Fila o que foi feito (mês, n.º de compras lançadas, o que ficou por associar) e a utilizadora
marca a coluna **Compras**.

## 2. Lançar as vendas

**Aplica-se a:** todos os clientes TI RS (TI Simplificado). O procedimento depende de como o cliente fatura
(etiqueta na Fila, calculada a partir do "Programa de Faturação" da ficha):

### A) Programa de faturação (Moloni, Vendus, FIZ, TOConline…)
Igual às Empresas (`empresas.md`, secção 1): verificar o SAF-T do mês (se o programa for externo) →
**Contabilidade → Sugestões de vendas → Gerar sugestões** (mês a mês, só Vendas) → finalizar os
lançamentos do diário **VND** (nunca recibos RC).

### B) Recibos verdes (Portal das Finanças / AT)
1. **Vendas → Recibos Verdes**.
2. Menu dos **3 traços** → **Atualizar Recibos Verdes** → escolher **ano e mês** da tarefa
   (vem o mês corrente por omissão) → confirmar que o NIF é o do cliente → **Atualizar Recibos Verdes**.
3. Para cada recibo verde importado (filtro "Importado"), carregar no **+** da coluna **FT Venda**
   (ou na seta → **Criar e associar**): abre a fatura / fatura-recibo já preenchida a partir do recibo verde.
4. Verificar o documento (cliente, NIF, base + IVA = total) e **Gravar** → fica "Em preparação".
5. Na seta da coluna FT Venda → **Finalizar e pagar** → método de pagamento **Numerário** (data de
   recebimento: a proposta pelo TOConline) → **Finalizar e pagar**.

**Parar e avisar** (tarefa **Bloqueada**, motivo no Resultado):
- IVA 0% com **"Razão de isenção" vazia** (ex.: cliente estrangeiro) — **nunca escolher** o motivo: cancelar
  esse documento sem gravar, indicar no Resultado o n.º do recibo verde, cliente e valor, e seguir para o próximo;
- cliente como "Consumidor Final" quando o recibo verde é para uma empresa.

### Clientes com os dois (recibos verdes + programa)
Fazer A e B.

**Na app:** não marcar diretamente — a utilizadora marca a coluna **Vendas** na Gestão Mensal.

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

## 4. Não considerar da atividade (compras)

**Aplica-se a:** só quando a tarefa "Compras — Não considerar da atividade" é ativada na Fila para o cliente.

**Passos**
1. **Compras → e-Fatura**. Confirmar a empresa (canto superior esquerdo) e o **exercício**.
2. Filtrar pelo **mês da tarefa** (filtros: Mês / Ano do documento).
3. Em **todas as linhas** do mês: na **seta** da coluna "FT Compra" → **Não considerar este documento na atividade**.
4. Voltar a filtrar para confirmar que não ficou nenhuma linha do mês por marcar.

**Dúvidas** (deixar a linha **sem marcar** e indicar no Resultado data, fornecedor, n.º e valor):
- a linha já tem compra associada (coluna "FT Compra" preenchida);
- a opção não aparece na seta ou o TOConline dá erro.

**Confirmação:** não é preciso pedir — fazer todas as linhas do mês quando a tarefa é ativada.
No Resultado: n.º de documentos marcados e os que ficaram por marcar (com o motivo).

## 5. Mapa de análise (exportar mapas e importar na app)

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

**Parar e avisar** (tarefa **Bloqueada**, com o motivo no Resultado):
- a app diz que o **NIF do documento não corresponde** ao do cliente;
- "Não foram encontradas linhas com códigos de conta reconhecidos" ou "valores não pertencem ao período";
- o mapa ou o balancete vem vazio no TOConline (trimestre ainda por lançar).

**Confirmação:** não é preciso pedir — exportar, importar e concluir.
No Resultado: trimestre, ficheiros importados, n.º de valores carregados de cada um (mensagem da app) e o IVA
preenchido por trimestre (campo 93 ou 94).

## 6. Classificação e-Fatura

**Aplica-se a:** todos os clientes do regime. Tarefa **mensal**, feita só para os **meses indicados pela utilizadora**
(o mês da tarefa na Fila). Trabalha-se em dois sítios: o **TOConline** (para saber o que foi lançado) e o
**Portal e-Fatura** (onde se classifica).

**Passos**
1. **TOConline — ver o que foi lançado**
   - Confirmar a empresa (canto superior esquerdo) e o **exercício**.
   - **Compras → e-Fatura** (`/purchases/efatura`) → tirar o filtro "Estado: Importado" → filtro **Mês** = mês da tarefa.
   - Para cada linha: NIF do fornecedor, n.º da fatura, valor e **Nr. Diário** (ex.: CMP 04/1). As linhas
     "Não considerado na atividade" não têm diário.
   - Nas linhas com diário: selecionar a linha → separador **Contabilidade** da pré-visualização → ver a conta do gasto
     (ignorar 24x IVA e 22x fornecedores) — só para confirmar que é 3, 4 ou 6.
2. **Entrar no e-Fatura pelo acesso direto do TOConline** (nunca escrever senhas)
   - **Empresa → Sumário → Acesso Direto** → pesquisar "fatura" → **Portal do e-fatura → Verificar faturas → Aceder**.
   - Abre um separador novo (`faturas.portaldasfinancas.gov.pt`); se ficar fora do grupo do Claude, pedir à utilizadora
     para o arrastar para o grupo. Confirmar o "Bem-vindo(a) <nome do cliente>".
3. **e-Fatura — classificar**
   - **Faturação → Adquirente → Verificar Faturas** → Data Início / Data Fim = mês da tarefa → Pesquisar
     (pôr 50 registos por página). Confirmar que o n.º de faturas e os elementos (NIF + n.º + valor) batem com o TOConline.
   - Abrir cada fatura (link do n.º) → **Alterar** → campo **"Realizado no âmbito da atividade profissional?"**:
     - **Com número de diário** (conta 3, 4 ou 6) → **"Sim, despesa totalmente afeta à atividade"**. O e-Fatura não tem
       escolha Inventários / Investimentos / Outros — "Sim, total" serve para todas. Se a "Atividade de Realização da
       Aquisição" (obrigatória) estiver vazia, escolher **Outros**.
     - **Sem número de diário** → **"Não"**. **Não preencher** a "Atividade de Realização da Aquisição" (deixar como está,
       mesmo vazia — mexe nas deduções de IRS do cliente). Grava na mesma; a fatura continua "Pendente" na lista
       por falta do setor, e isso é normal.
   - **Guardar** → confirmar "Informação guardada com sucesso".
   - (Alternativa: Faturação → Adquirente → botão **Complementar Informação Faturas** — mas só mostra as 50 mais recentes.)
4. Confirmar no fim que todas as faturas do mês têm o campo preenchido (Sim ou Não).

**Cruzamentos obrigatórios** (aprendidos na 1.ª execução):
- A coluna Nr. Diário do e-Fatura do TOConline **não chega**: confirmar também em **Compras → Faturas de compra**
  (filtro de datas do período) — cada fatura de compra finalizada com diário corresponde a uma fatura "Sim" no e-Fatura
  (NIF do fornecedor + n.º em "Vossa Ref." + valor; aceitar 1 cêntimo de diferença). Há compras lançadas que não
  aparecem associadas na lista e-Fatura do TOConline.
- Comparar o **n.º de faturas do mês** no e-Fatura (AT) com o do TOConline. As que estão no e-Fatura mas **não** no
  TOConline (o TOConline ainda não as importou) ficam **por classificar** — podem ser da atividade.
- Compras lançadas no TOConline que não existem no e-Fatura (ex.: fornecedores que não comunicam) — não há nada a
  classificar; só referir no Resultado.

**Outros casos (aprendidos com vários clientes):**
- **Documento anulado** — o e-Fatura responde "O documento não pode ser classificado por estar anulado": não há nada a
  fazer, não conta como pendente.
- **Mês sem compras lançadas** (ou com muito menos do que os outros meses) — o mais provável é as compras desse mês ainda
  não estarem lançadas no TOConline: **não classificar esse mês** (senão tudo ficava "Não") e indicar no Resultado.
- **Compra lançada duas vezes** no TOConline (mesmo fornecedor e n.º) — só existe uma no e-Fatura; indicar no Resultado.
- Compras de fornecedores estrangeiros e de quem não comunica ao e-Fatura não aparecem lá — normal.
- Em Compras → Faturas de compra, a lista com filtro de datas traz no máximo 100 linhas: se o período tiver mais,
  dividir em períodos mais curtos.

**Muitas faturas:** o e-Fatura bloqueia temporariamente ("demasiados pedidos") se se fizerem pedidos muito seguidos —
guardar fatura a fatura com ~1 s de intervalo.

**Na app (Gestão Mensal → coluna E-Fatura):** marcar o mês como concluído **só** quando todas as faturas desse mês
ficaram classificadas; meses com faturas por classificar ficam por marcar e vão para o Resultado.

**Não entram:** documentos da série **PF** (ex.: "FT PF2026/…") que **não** estejam lançados no TOConline são
pagamentos — deixar como estão, sem classificar, e não contam como dúvida (o mês pode ser dado como concluído).

**Dúvidas** (deixar a fatura **por classificar** e indicar no Resultado emitente, NIF, n.º, data e valor):
- a fatura do e-Fatura não aparece no TOConline, ou os elementos não batem certo (NIF, n.º ou valor);
- a linha do TOConline tem compra associada mas **ainda sem número de diário** (compra gravada por finalizar) —
  não pôr "Não", porque pode vir a ser lançada;
- a conta do lançamento não começa por 3, 4 nem 6;
- o e-Fatura dá erro ao guardar.

**Confirmação:** não é preciso pedir — classificar e guardar sem perguntar.
No Resultado: mês, n.º de faturas "Sim, total" e "Não", e as que ficaram por classificar (com o motivo).
