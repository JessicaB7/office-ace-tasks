# TOConline — Procedimentos: IVA — Flexibilização (todos os regimes)

Aplica-se a clientes de **IVA trimestral** que flexibilizaram o pagamento do IVA de um trimestre, em qualquer regime
(TI RS, TI CO, Empresas).

## 1. Guias flexibilização IVA

**Aplica-se a:** clientes da listagem **Obrigações → IVA Periódica → Flexibilização** da app (visto "Flexibilização"
marcado no trimestre), com uma parcela a vencer no **mês da tarefa**.

**Parcelas e datas limite (dia 25):**

| Trimestre | Parcela 1 | Parcela 2 | Parcela 3 |
|---|---|---|---|
| 2º (Abr–Jun) | 25/09 | 25/10 | 25/11 |
| 3º (Jul–Set) | 25/11 | 25/12 | — |
| 4º (Out–Dez) | 25/02 | 25/03 | 25/04 (ano seguinte) |

O **mês da tarefa** na Fila é o mês em que a parcela vence. Trata-se **só a(s) parcela(s) que vencem nesse mês** (a
próxima a vencer). Em novembro pode haver duas para o mesmo cliente (3.ª do 2º trimestre e 1.ª do 3º trimestre).
A parcela e o método de pagamento aparecem na Fila, na área **Ativar tarefas** (separador "IVA (todos os regimes)" →
"Guias flexibilização IVA", no mês da tarefa), coluna **Parcela · Método de pagamento**.

**Método de pagamento** (coluna "Método de Pagamento" da Flexibilização, na app):
- **Referência** → descarregar a guia (documento de pagamento) da parcela para o computador.
- **Débito direto** → só consultar o valor da parcela (não há guia a tirar).
- **Método por definir** → consultar o valor e, se houver referência disponível, descarregar também a guia; indicar
  no Resultado que o método não está escolhido na app.

**Passos** (confirmados na 1.ª execução, 14/10/2026)
1. **TOConline — escolher a empresa:** seletor do canto superior esquerdo → escrever parte do nome (ex.: "Belem",
   "Aniceto") → Enter (ou clicar no nome, se aparecerem vários). O seletor não pesquisa por NIF — a confirmação do NIF
   faz-se no Portal (passo 3).
2. **Entrar no Portal das Finanças pelo acesso direto do TOConline** (nunca escrever senhas)
   - **Empresa → Sumário → Acesso Direto** → linha **"Portal das Finanças - Autoridade Tributária e Aduaneira"** →
     **Aceder** (à direita; o link só aparece ao passar o rato).
   - Abre um separador novo fora do grupo do Claude — não é preciso usá-lo: a sessão fica partilhada no browser. No
     separador do Claude abrir diretamente `https://sitfiscal.portaldasfinancas.gov.pt/flexibiliza/consultar/pesquisa`
     (Flexibilização de Pagamentos → Consultar Plano/Pagar).
   - Se aparecer o formulário de login, esperar uns segundos e voltar a abrir o endereço.
   - **Antes de mudar de cliente, fazer "Sair" no Portal.** Com a sessão do cliente anterior aberta, o Aceder do
     TOConline dá "Erro a efetuar ligação… Não foi possível estabelecer uma ligação no tempo esperado".
   - Se em vez de "Aceder" aparecer **"Definir senhas"**, o cliente não tem a senha do Portal guardada no TOConline →
     tarefa **Bloqueada**.
3. **Portal → Consultar Plano de Flexibilização de Pagamentos**
   - Confirmar o **NIF** no cabeçalho ("NIF: …") — tem de ser o do cliente.
   - Pôr **50 elementos por página** (a lista vem ordenada pelo n.º do plano e o trimestre recente pode estar na página 2).
   - Linha do **trimestre em causa** (ex.: "2º Trimestre 2026") com situação **DEFERIDO** — ignorar as **ANULADO**
     (pedidos repetidos) → **+ INFO**.
   - No detalhe: **N.º Prestações** (pode ser 2 ou 3, mesmo em trimestres com 3 parcelas na app), **Autorização de
     Débito Direto** (preenchida = débito direto; "-" = sem débito direto) e a tabela de prestações (valor, ref. de
     pagamento, situação, data limite).
   - A parcela do mês aparece "EM REGULARIZAÇÃO"; as seguintes "CRIADA"; as pagas "PAGA".
   - Quando o dia 25 calha a um fim de semana, a data limite passa para o dia útil seguinte (ex.: 26/10/2026).
4. **Referência → descarregar a guia:** na linha da parcela, **seta ao lado de PAGAR → IMPRIMIR**. O PDF vai para as
   Transferências com o nome `Pag_IVA_Flexi_<últimos 11 dígitos da referência>.pdf` → **renomear para
   `Pag_IVA_Flexi_<Nome_do_Cliente>_<T>T<AAAA>_P<n>.pdf`** (ex.: `Pag_IVA_Flexi_Helena_Pereira_2T2026_P2.pdf`).
   **Nunca** carregar em **PAGAR** nem em **ANULAR PLANO**.
   - O Chrome bloqueia downloads seguidos do mesmo site: na 1.ª vez é preciso escolher "Permitir sempre que
     sitfiscal.portaldasfinancas.gov.pt transfira vários ficheiros" (pedir à utilizadora).
5. **Débito direto:** só anotar o valor. Confirmar que o plano tem mesmo "Autorização de Débito Direto" preenchida.
6. Registar o Resultado na Fila e passar ao cliente seguinte (começando por "Sair" no Portal).

**Casos encontrados (1.ª execução):**
- **Plano "NÃO CONCRETIZADO"** — motivo "PAG. INSUFICIENTE PARA A 1ª PRESTAÇÃO": a 1.ª prestação não foi paga a
  tempo; as seguintes não têm referência. Tarefa **Bloqueada** e avisar a utilizadora.
- **Sem plano do trimestre** no Portal (cliente marcado na Flexibilização da app) — **Bloqueada**; pode ter pago de uma vez
  ou a marcação na app estar errada.
- **Na app "Débito direto" mas o plano sem autorização de débito direto** — vai ter de pagar por referência:
  descarregar a guia na mesma e avisar no Resultado.
- **Plano de 2 prestações** num trimestre de 3 — a parcela do mês é a 2/2 (última); indicar no Resultado.

**Resultado** (por tarefa): "Parcela N/T do Xº trim. AAAA — valor € — Referência <n.º> (guia descarregada: <nome do ficheiro>)"
ou "… — Débito direto (até DD/MM/AAAA)". O Resultado pode ser gravado diretamente na tabela `toconline_jobs`
(status + result_notes) pela ferramenta SQL do Supabase, em vez de tarefa a tarefa na página da Fila.

**No fim**, dar à utilizadora **uma lista** com todos os clientes tratados:

| Cliente | N.º da parcela | Valor | Método |
|---|---|---|---|
