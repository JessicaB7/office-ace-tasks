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
