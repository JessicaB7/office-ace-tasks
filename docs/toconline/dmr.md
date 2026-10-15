# TOConline — Procedimentos: DMR (todos os regimes)

Aplica-se a clientes com salários, em qualquer regime (TI RS, TI CO, Empresas).

## 1. Guia DMR AT

**Aplica-se a:** clientes da listagem **Obrigações → DMR → DMR AT** da app (clientes ativos com o campo "Salários"
preenchido e diferente de "Não tem").

**Mês da tarefa** = mês de referência da DMR (o mês dos salários, o mesmo que está aberto em Obrigações → DMR AT).
A guia desse mês paga-se até ao **dia 20 do mês seguinte**.

**Passos** (confirmados na 1.ª execução, 15/10/2026)
1. **TOConline — escolher a empresa:** Área de contabilista → As minhas empresas → **ENTRAR** na linha do cliente
   (confirmar o NIF na coluna NIF).
2. **Acesso Direto:** Empresa → Sumário → **Acesso Direto** (atalho: `https://app25.toconline.pt/vault-actions`).
   - Na **Pesquisa geral** (barra de pesquisa do Acesso Direto) escrever **"DMR"** → linha **"Consultar DMR-AT"** →
     **Aceder** (à direita; o link só aparece ao passar o rato). Nunca escrever senhas.
   - O Aceder abre o Portal **já na página Consultar Declaração, com o mês anterior selecionado**. Se o separador abrir
     fora do grupo do Claude, abrir no separador do Claude
     `https://oa.portaldasfinancas.gov.pt/dmr/consultar#?imposto=MR&ano=<AAAA>&mes=<M>` (a sessão é partilhada).
   - Se em vez de "Aceder" aparecer **"Definir senhas"**, o cliente não tem a senha do Portal guardada no TOConline →
     tarefa **Bloqueada**.
3. **Consultar Declaração:** confirmar o **NIF** no cabeçalho do Portal (canto superior esquerdo) e o **Ano/Mês** da
   linha (ex.: 2026/09); a situação deve ser **CERTA**. Se o mês não for o da tarefa, mudar Ano/Mês → PESQUISAR.
4. **Obter a guia:** na linha, **seta ao lado de OPÇÕES** → **OBTER DOCUMENTO DE PAGAMENTO** → abre a página com o
   **Montante a pagar** (anotar o valor) → botão **OBTER DOCUMENTO** → o PDF é descarregado.
   - O PDF vai para as Transferências com o nome `documento - <data e hora>.pdf` → **renomear para
     `Guia_DMR_AT_<Nome_do_Cliente>_<MM>_<AAAA>.pdf`**, com o mês de referência da DMR
     (ex.: `Guia_DMR_AT_Alex_Cunha_09_2026.pdf`).
   - Todos os clientes pagam por guia (não há DMR em débito direto): tirar sempre a guia.
   - O Chrome pode bloquear downloads seguidos do mesmo site: se acontecer, pedir à utilizadora para escolher
     "Permitir sempre".
5. **Sair** no Portal (canto superior direito) antes de passar ao cliente seguinte.
6. Registar o Resultado na Fila. O Resultado pode ser gravado diretamente na tabela `toconline_jobs`
   (status + result_notes) pela ferramenta SQL do Supabase.

**Casos a tratar como Bloqueada** (avisar no Resultado):
- **Sem declaração do mês** no Portal (DMR ainda não submetida).
- Declaração do mês **sem documento de pagamento** (por exemplo, valor a pagar zero) — indicar no Resultado.
- NIF do Portal diferente do cliente.

**Resultado** (por tarefa): "DMR AT <MM/AAAA> — montante a pagar <valor> € — guia descarregada (<nome do ficheiro>)"
ou o motivo do bloqueio.

**No fim**, dar à utilizadora **uma lista** com todos os clientes tratados:

| Cliente | Mês | Montante | Guia descarregada | Observações |
|---|---|---|---|---|

Não marcar a obrigação na app: a equipa marca a coluna **Guia** em Obrigações → DMR AT.
