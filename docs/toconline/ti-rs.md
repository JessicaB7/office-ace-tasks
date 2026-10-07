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

**Na app (Gestão Mensal → TI Simplificado - Reg. IVA):** não marcar diretamente. No fim, deixar no
Resultado da Fila o que foi feito (mês, n.º de compras lançadas, o que ficou por associar) e a utilizadora
marca a coluna **Compras**.
