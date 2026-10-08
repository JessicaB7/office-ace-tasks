#!/usr/bin/env bash
# Aplica uma migração à base de dados da Gestão CE (Supabase) e regista-a no histórico.
# Uso: bash scripts/aplicar-migracao.sh supabase/migrations/<versao>_<nome>.sql
set -euo pipefail

REF=unwzlmdwvpxhigmsqvam
PSQL=/opt/homebrew/opt/postgresql@17/bin/psql
CONN="host=aws-0-eu-central-1.pooler.supabase.com port=5432 user=postgres.$REF dbname=postgres sslmode=require"

FILE="$1"
cd "$(dirname "$0")/.."
[[ "$FILE" == supabase/migrations/*.sql && -f "$FILE" ]] || { echo "Ficheiro inválido: $FILE" >&2; exit 1; }
export PGPASSWORD=$(grep '^GESTAO_DB_PASSWORD=' supabase/.env.migracao | cut -d= -f2-)

BASE=$(basename "$FILE" .sql)
VERSION=${BASE%%_*}
NAME=${BASE#*_}

"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -1 -f "$FILE"
"$PSQL" "$CONN" -v ON_ERROR_STOP=1 -c "insert into supabase_migrations.schema_migrations(version,name) values ('$VERSION','$NAME') on conflict do nothing; notify pgrst, 'reload schema';"
echo "✅ Migração $VERSION aplicada."
