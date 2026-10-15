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

**Notas da 1.ª execução completa (15/10/2026, 52 clientes de 09/2026):**
- Cada empresa pode estar num servidor diferente do TOConline (`app2`, `app25`, `app40`…). Navegar sempre a partir do
  endereço onde se está (nunca com um `appNN` fixo), senão o TOConline pede login.
- Na lista "As minhas empresas", a pesquisa só filtra com escrita real no campo (escrever o NIF + Enter); depois entrar
  só se ficar exatamente uma empresa com esse NIF.
- O primeiro **Aceder** depois de um "Sair" dá muitas vezes "Erro a efetuar ligação… Não foi possível estabelecer uma
  ligação no tempo esperado": carregar em OK, esperar uns 10 segundos e repetir o Aceder.
- **Montante a pagar 0,00 €** é frequente (cerca de 40% dos clientes): não há guia e o "OBTER DOCUMENTO" dá
  "funcionalidade temporariamente indisponível" — não carregar; tarefa Bloqueada com o motivo.
- Depois do download, confirmar no PDF o NIF e o n.º da declaração (identificação) antes de o arquivar.

**Casos a tratar como Bloqueada** (avisar no Resultado):
- **Sem declaração do mês** no Portal ("Sem dados disponíveis" — DMR ainda não submetida).
- **Montante a pagar 0,00 €** (sem guia).
- **Empresa que não existe no TOConline** (nem nas inativas).
- Declaração do mês **sem documento de pagamento** (por exemplo, valor a pagar zero) — indicar no Resultado.
- NIF do Portal diferente do cliente.

**Resultado** (por tarefa): "DMR AT <MM/AAAA> — montante a pagar <valor> € — guia descarregada (<nome do ficheiro>)"
ou o motivo do bloqueio.

**No fim**, dar à utilizadora **uma lista** com todos os clientes tratados:

| Cliente | Mês | Montante | Guia descarregada | Observações |
|---|---|---|---|---|

Não marcar a obrigação na app: a equipa marca a coluna **Guia** em Obrigações → DMR AT.

## 2. Guia DMR SS (Segurança Social) + controlo de dívidas

**Aplica-se a:** clientes da listagem **Obrigações → DMR → DMR SS** da app (os mesmos da DMR AT: clientes ativos com o
campo "Salários" preenchido e diferente de "Não tem").

**Mês da tarefa** = mês de referência das remunerações (o mesmo da DMR). Na Segurança Social Direta aparece como
"Contribuições correntes", com a data limite de pagamento (ex.: 26/10/2026 para setembro).

**Passos** (confirmados na 1.ª execução, 15/10/2026)
1. **TOConline — escolher a empresa** (como na DMR AT: pesquisa pelo NIF → ENTRAR).
2. **Acesso Direto:** Empresa → Sumário → Acesso Direto → Pesquisa geral **"Segurança Social"** → linha
   **"Segurança Social"** → **Aceder**. Abre a Segurança Social Direta noutro separador (fora do grupo do Claude): a
   sessão é partilhada, por isso abrir no separador do Claude `https://www.seg-social.pt/ptss/ci/posicao-atual/posicao-atual`.
   - Se aparecer "Verifique e atualize os seus contactos", carregar em **Cancelar** (não alterar contactos).
3. **Pagamentos e dívidas → Posição atual → Consultar:** **Mostrar valores a pagar** e **Mostrar valores em acordo ou
   plano prestacional**. Anotar as cinco linhas: **Contribuições correntes**, **Contribuições em atraso**, **Coimas e
   custas**, **Outros valores a pagar**, **Dívida em execução fiscal**, e se há acordo/plano prestacional.
4. **Contribuições correntes > 0:** abrir a linha → **Fazer pagamentos** → no pacote "Contribuições - Entidade
   Empregadora" (valor e "Pagar até") → **Pagar** → escolher **Multibanco** → **Continuar** → aparece Entidade,
   Referência e Valor → **Descarregar referências (PDF)**.
   - Nunca escolher MB WAY nem Transferência; a referência Multibanco não paga nada, só gera a guia.
   - O PDF vai para as Transferências com nome numérico (`2026…_….pdf`) → confirmar o NIF dentro do PDF e **renomear
     para `Guia_DMR_SS_<Nome_do_Cliente>_<MM>_<AAAA>.pdf`**, na pasta **Transferências/DMR SS**.
5. **Contribuições correntes = 0,00 €:** não há guia (já pago ou ainda sem valores) → tarefa **Bloqueada** com o motivo.
6. **Terminar sessão** na Segurança Social Direta (menu do utilizador → Terminar sessão) antes do cliente seguinte.

**Notas da 1.ª execução completa (15/10/2026, 52 clientes de 09/2026):**
- **Clientes já entregues não se fazem:** em Obrigações → DMR SS, quem já tem a coluna **Pagamento** marcada
  (`monthly_obligations.extra_done`) fica fora — tarefa concluída "já entregue". A coluna **Guia** (`status`) não serve
  para isto.
- Em muitas empresas a pesquisa "Segurança Social" não mostra linhas: usar a linha **"Emitir situação contributiva"**
  do grupo Segurança Social → **Aceder** (qualquer linha deste grupo inicia a sessão da empresa). O link "Aceder" só
  aparece ao passar o rato. Se o grupo mostrar **"Definir senhas"**, não há senha da SS → **Bloqueada**.
- Se o Aceder não iniciar sessão (o endereço da posição atual cai no login), tentar 2 vezes e depois **Bloqueada**
  (aconteceu com Alex Cunha e Marta Lobo).
- Confirmar a entidade: menu do utilizador → **NISS** (nas empresas o NISS contém o NIF: 2 + NIF + 1 dígito; o nome
  do perfil pode ser "Jéssica Contabilista" — é só o nome). No PDF confirmar sempre o NIF.
- Em **Fazer pagamentos** escolher **só** o pacote "Contribuições - Entidade Empregadora" com "Pagar até". Não usar
  os pacotes "Pague agora para regularizar" (atraso), "Dívidas em execução fiscal" nem "Doc. automático contribuições
  trabalhador independente" (TI, até dia 20) — estes ficam só no Resultado.
- Pessoas singulares com trabalhadores podem ter os dois pacotes (TI + entidade empregadora): a guia DMR SS é só a da
  entidade empregadora; assinalar o valor de TI no Resultado. Sem pacote de entidade empregadora → sem guia (Bloqueada).
- Algumas referências saem com a **Entidade 21431** (em vez de 21056): é normal.
- "Terminar sessão" pede confirmação (**Sim, terminar sessão**). A sessão da SS expira em poucos minutos sem uso.
- O TOConline também termina a sessão ao fim de algum tempo (ecrã de login): pedir à utilizadora para entrar.

**Controlo de dívidas** — indicar sempre no Resultado e na lista final os clientes com **Contribuições em atraso**,
**Coimas e custas**, **Outros valores a pagar**, **Dívida em execução fiscal** > 0 ou com acordo/plano prestacional.
Não gerar referências para esses valores (só para as contribuições correntes), salvo indicação da utilizadora.

**Resultado** (por tarefa): "DMR SS <MM/AAAA> — <valor> € até <data> — Ref. MB <entidade>/<referência> (<ficheiro>) —
Atraso <x> € · Execução fiscal <y> €".

**No fim**, lista: Cliente · Contribuições correntes · Data limite · Referência · Em atraso · Execução fiscal · Observações.
