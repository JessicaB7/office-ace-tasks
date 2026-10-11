#!/usr/bin/env bash
# Instala (ou remove com --remover) o vigia da Fila TOConline no launchd do Mac.
# As tarefas que já estão pendentes no momento da instalação não são relançadas.
set -euo pipefail
cd "$(dirname "$0")/.."
LABEL=pt.contabilistaexplica.toconline-vigia
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
STATE_DIR="$HOME/Library/Application Support/toconline-vigia"

if [[ "${1:-}" == "--remover" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  rm -f "$PLIST"
  echo "Vigia removido."
  exit 0
fi

mkdir -p "$STATE_DIR" "$HOME/Library/LaunchAgents"
REF=unwzlmdwvpxhigmsqvam
export PGPASSWORD=$(grep '^GESTAO_DB_PASSWORD=' supabase/.env.migracao | cut -d= -f2-)
/opt/homebrew/opt/postgresql@17/bin/psql "host=aws-0-eu-central-1.pooler.supabase.com port=5432 user=postgres.$REF dbname=postgres sslmode=require" \
  -tAc "select coalesce(string_agg(id::text, ',' order by id), '') from public.toconline_jobs where status = 'pendente';" > "$STATE_DIR/ultimas-tarefas"

cat > "$PLIST" <<PL
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>/bin/bash</string><string>$PWD/scripts/toconline-vigia.sh</string></array>
  <key>StartInterval</key><integer>120</integer>
  <key>RunAtLoad</key><true/>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$HOME/.local/bin:/opt/homebrew/bin:/usr/bin:/bin</string></dict>
  <key>StandardErrorPath</key><string>$STATE_DIR/launchd.err</string>
</dict></plist>
PL
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "Vigia instalado: verifica a Fila de 2 em 2 minutos. Registo: $STATE_DIR/vigia.log"
