# Emissão de faturas no Portal das Finanças (em nome dos clientes)

Emitir as faturas / faturas-recibo dos clientes TI no Portal das Finanças, a partir do Excel
**Gestor de Negócio** do cliente. Pode **finalizar (emitir)** sem pedir confirmação, desde que os
dados batam certo com o Excel.

**Origem dos dados — Gestor de Negócio**
- Ficheiro no OneDrive: `Clientes/<cliente>/…/Gestor de Negócio*.xlsx` (pode estar aberto no Excel online).
- Uma folha por mês (`01` … `12`). Bloco **Faturação**: Data · Cliente · NIF · Serviço ·
  (nos clientes de saúde: Subsistema de Saúde · Nº Seguro) · **Nº Fatura** · Prestação · Base · IVA · Retenção · Total.
- **A emitir** = linhas com Data, Cliente e Base preenchidos e **Nº Fatura vazio**.
- Atenção ao nome da pasta: confirmar que o Transmitente no Portal (nome + NIF) é o cliente certo
  (ex.: "Mariana Nunes" = MARIANA DA CONCEIÇÃO FERREIRA NUNES, 244596670 — não confundir com "Mariana Pereira").

**Passos**
1. **TOConline** → escolher a empresa do cliente → **Empresa → Sumário → Acesso Direto** →
   linha "Portal das Finanças – Autoridade Tributária e Aduaneira" → **Aceder**.
   Abre o Portal já autenticado com o cliente. No Portal: **Faturas e Recibos**.
2. **Faturas e Recibos → Consultar** → **NIF do Adquirente** = NIF da linha do Excel → **Pesquisar**
   (alargar a "Data de emissão" — o Portal só aceita até ~1 ano, ex. `2025-11-01` a hoje; mais do que isso dá erro).
3. **Se houver fatura anterior** para esse adquirente: seta ao lado de **VER** → **Emitir novo** →
   **Data da transação** = data da linha do Excel (formato `AAAA-MM-DD`) → **OK**.
   O formulário vem preenchido com o tipo (FR/FT), adquirente, subsistema, linha de serviço, IVA e IRS da anterior.
   **Se não houver**: fazer **Emitir novo** de uma fatura de outro adquirente **sem subsistema** do mesmo cliente,
   trocar o **NIF** do adquirente, apagar o Nome e carregar em **PROCURAR** → **Selecionar** (o Portal devolve o nome
   registado). O Subsistema de Saúde fica vazio — repor **Não aplicável** (ou o da coluna do Excel).
   Se o nome devolvido não corresponder ao do Excel, ou se o mesmo nome aparecer no Excel com **outro NIF**, não emitir — avisar.
4. **Conferir com o Excel** antes de emitir:
   - Data da transação, Tipo (igual às anteriores), NIF e Nome do adquirente;
   - **Subsistema de Saúde** + n.º de beneficiário = colunas Subsistema / Nº Seguro (ou "Não aplicável" se `n.a`);
   - Valor da linha = **Base**; IVA = coluna IVA; retenção IRS = coluna Retenção;
   - "Totais" (Total a pagar) = coluna **Total**.
5. **EMITIR** → no resumo "Confirmar Emissão" voltar a conferir valores → **EMITIR**.
   O Portal mostra o número (ex.: `FR ATSIRE01FR/813`).
6. **Descarregar o PDF**: no detalhe do documento → **IMPRIMIR** (descarrega `documento - <data>.pdf` para Transferências).
   Confirmar no PDF o n.º e o adquirente.
7. **Guardar** em `Clientes/<cliente>/<ano>/Fatura Vendas/<MM_Mês>/` (seguir a estrutura que já existe na pasta
   do cliente — alguns usam `Faturas de Venda`) com o nome do número **sem a barra**:
   `FR ATSIRE01FR813.pdf`. Não sobrescrever se já existir.
8. **Excel**: escrever o número na coluna **Nº Fatura** da linha, no formato `FR ATSIRE01FR/813`.

**Parar e avisar** (não emitir) quando:
- o Transmitente no Portal não é o cliente do Excel;
- falta NIF, data ou valor na linha, ou o Total ≠ Base + IVA − Retenção;
- não há fatura anterior e não há nenhuma fatura do cliente para copiar o tipo/IVA/IRS;
- o resumo de confirmação não bate com o Excel.

**Exceções por cliente**
- **Inês Coutinho** (251515818): **não** entrar pelo TOConline — a utilizadora abre ela própria o Portal das Finanças
  e põe o separador no grupo do Claude. Excel `Gestor Final_2026 VF.xlsx` (Nº Fatura na coluna G, valor na coluna L)
  + `Livro.xlsx` (lista de consultas enviada pela cliente); PDFs em `Faturas de Venda/<MM_Mês>/`.
