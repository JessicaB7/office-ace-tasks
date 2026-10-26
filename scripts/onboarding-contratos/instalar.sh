#!/usr/bin/env bash
# Instala (ou atualiza) o serviço que prepara automaticamente a pasta e o contrato dos novos clientes.
# Corre de 10 em 10 minutos (launchd). Uso: bash scripts/onboarding-contratos/instalar.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/Library/Application Support/ContabilistaExplica/onboarding"
CONFIG="$HOME/Library/Application Support/ContabilistaExplica/config.env"
LABEL="pt.contabilistaexplica.contratos"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
LOG="$HOME/Library/Logs/ContabilistaExplica-contratos.log"

mkdir -p "$DEST" "$HOME/Library/LaunchAgents" "$HOME/Library/Logs"
cp "$SRC"/preparar_contratos.py "$SRC"/docx_fill.py "$SRC"/genero.py "$DEST"/

if [[ ! -f "$CONFIG" ]]; then
  grep '^GESTAO_DB_PASSWORD=' "$SRC/../../supabase/.env.migracao" > "$CONFIG"
  chmod 600 "$CONFIG"
fi

cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>$DEST/preparar_contratos.py</string>
  </array>
  <key>StartInterval</key><integer>600</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$LOG</string>
  <key>StandardErrorPath</key><string>$LOG</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
echo "✅ Serviço $LABEL instalado (de 10 em 10 minutos). Registo: $LOG"
