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
4. Executa o procedimento conforme o manual (o `procedure_id` → secção do manual):
   - `empresas_importar_vendas` → `docs/toconline/empresas.md`, secção 1 "Importar as vendas".
5. Regista o resultado na Fila:
   - **Resultado** (caixa de texto): o que foi feito — mês, tipos/n.º de documentos
     finalizados, avisos. Curto e factual, em pt-PT.
   - **Estado**:
     - **Concluída** — procedimento terminado.
     - **Bloqueada** — o manual manda parar (ex.: SAF-T do mês não importado, programa de
       faturação vazio). Explica no Resultado o que falta.
     - **Erro** — algo inesperado no TOConline. Descreve o que aconteceu.
6. **Não** carregues em "Marcar …" (Gestão Mensal) — a utilizadora revê e marca.

## 2. No fim
Resumo no chat: por cliente/mês — concluídas, bloqueadas (com o motivo) e erros.

## Regras
- Uma tarefa de cada vez; nunca deixes uma tarefa "Em curso" ao parar — volta a pô-la em
  **Pendente** se não a acabaste.
- Não acionar diálogos `confirm()`/`alert()` do browser.
- Se a página da app ou do TOConline não responder após 2–3 tentativas, pára e pergunta.
- Procedimento sem manual (`procedure_id` desconhecido) → **Bloqueada** com "Sem manual".
