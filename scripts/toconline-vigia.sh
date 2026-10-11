#!/usr/bin/env bash
# Vigia a Fila TOConline: corre de 2 em 2 minutos (launchd) e, quando aparecem
# tarefas novas em "Pendente", lança o Claude Code com /toconline-fila no Chrome.
# - Só arranca quando o conjunto de tarefas pendentes muda (tarefas novas). Tarefas que
#   ficaram em Pendente "prontas a finalizar" não voltam a correr sozinhas.
# - Se a última execução parou no login do TOConline, volta a tentar de hora a hora.
# - Se o TOConline pedir login, mostra um aviso no Mac (o Claude nunca escreve senhas).
# Instalar/desinstalar: bash scripts/toconline-vigia-instalar.sh [--remover]
set -uo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
STATE_DIR="$HOME/Library/Application Support/toconline-vigia"
mkdir -p "$STATE_DIR"
LOCK="$STATE_DIR/lock"
LAST_IDS="$STATE_DIR/ultimas-tarefas"
LAST_RUN="$STATE_DIR/ultima-execucao"
LOGIN_FLAG="$STATE_DIR/falta-login"
LOG="$STATE_DIR/vigia.log"
RETRY_SECONDS=3600

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }
avisar() { osascript -e "display notification \"$1\" with title \"Fila TOConline\" sound name \"Glass\"" >/dev/null 2>&1; }

# Uma execução de cada vez.
if ! mkdir "$LOCK" 2>/dev/null; then
  # Lock com mais de 2 h é considerado abandonado.
  if [[ -n "$(find "$LOCK" -maxdepth 0 -mmin +120 2>/dev/null)" ]]; then rm -rf "$LOCK"; mkdir "$LOCK" || exit 0; else exit 0; fi
fi
trap 'rm -rf "$LOCK"' EXIT

REF=unwzlmdwvpxhigmsqvam
PSQL=/opt/homebrew/opt/postgresql@17/bin/psql
CONN="host=aws-0-eu-central-1.pooler.supabase.com port=5432 user=postgres.$REF dbname=postgres sslmode=require connect_timeout=15"
export PGPASSWORD=$(grep '^GESTAO_DB_PASSWORD=' supabase/.env.migracao | cut -d= -f2-)

IDS=$("$PSQL" "$CONN" -tAc "select coalesce(string_agg(id::text, ',' order by id), '') from public.toconline_jobs where status = 'pendente';" 2>>"$LOG") || { log "erro a ler a fila"; exit 0; }
[[ -z "$IDS" ]] && { : > "$LAST_IDS"; exit 0; }

PREV=$(cat "$LAST_IDS" 2>/dev/null || true)
LAST=$(cat "$LAST_RUN" 2>/dev/null || echo 0)
NOW=$(date +%s)
if [[ "$IDS" == "$PREV" ]]; then
  [[ -f "$LOGIN_FLAG" && $((NOW - LAST)) -ge $RETRY_SECONDS ]] || exit 0
fi

N=$(awk -F, '{print NF}' <<< "$IDS")
log "a processar $N tarefa(s) pendente(s)"
echo "$IDS" > "$LAST_IDS"
echo "$NOW" > "$LAST_RUN"

OUT="$STATE_DIR/ultima-execucao.txt"
PROMPT='/toconline-fila

Execução automática (ninguém está a acompanhar no chat). Processa as tarefas pendentes da Fila.
Se o TOConline estiver na página de login, não toques em nada, deixa as tarefas em Pendente e termina
a resposta com a linha exata: LOGIN_NECESSARIO
Se uma ação for bloqueada por permissões (ex.: Finalizar), não insistas: deixa a tarefa em Pendente com o
Resultado a dizer o que ficou pronto e o que falta (ex.: "pronto a finalizar"), e segue para a próxima.
No fim, uma linha de resumo por tarefa.'

/Users/jessicabrandao/.local/bin/claude -p "$PROMPT" --chrome --permission-mode auto \
  --allowedTools "mcp__claude-in-chrome__*" Read Skill ToolSearch \
  > "$OUT" 2>&1
STATUS=$?
cat "$OUT" >> "$LOG"

rm -f "$LOGIN_FLAG"
if grep -q "LOGIN_NECESSARIO" "$OUT"; then
  touch "$LOGIN_FLAG"
  avisar "Entra no TOConline no Chrome — há $N tarefa(s) à espera."
  log "login necessário"
elif [[ $STATUS -ne 0 ]]; then
  avisar "A execução automática falhou. Vê o registo em $LOG"
  log "falhou ($STATUS)"
else
  avisar "Fila processada ($N tarefa(s)). Vê os resultados na app."
  log "concluído"
fi
