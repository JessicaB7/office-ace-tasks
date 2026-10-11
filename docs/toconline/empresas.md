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
   - Na lista de sugestões, filtrar pelos meses tratados (filtro **Mês**) e pelo tipo de documento
     (pesquisa "FS", "FT", "FR", "NC"…) e usar **Finalizar filtrados**.
   - Não usar "Finalizar todos" se a lista tiver recibos (RC) ou meses fora do período.
   - Depois de finalizar, a lista pode não atualizar sozinha — voltar a filtrar para confirmar.

**Notas práticas**
- O menu **Contabilidade** abre ao passar o rato por cima do separador (clicar leva a "Exercícios").
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
   - Filtrar por **Não associado**.
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

**Confirmação:** não é preciso pedir confirmação — pode gravar as compras sem perguntar (passos 1 e 2),
desde que **não finalize**. Nunca criar fornecedores.

**Na app (Gestão Mensal → Empresas):** não marcar diretamente. No fim, deixar no
Resultado da Fila o que foi feito (mês, n.º de compras lançadas, o que ficou por associar) e a utilizadora
marca a coluna **Compras**.
