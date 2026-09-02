#!/usr/bin/env node
/**
 * Exporta todas as tabelas legíveis pelo teu utilizador (via anon key + RLS,
 * sem precisar de service_role — que o Lovable Cloud não disponibiliza) para
 * ficheiros JSON locais em backups/<timestamp>/.
 *
 * Serve para teres uma cópia de segurança dos dados ANTES de qualquer decisão
 * sobre a subscrição do Lovable.
 *
 * Uso:
 *   node scripts/export-data.mjs
 *   (pede email e código de acesso interativamente — nunca os escrevas em código)
 *
 * Ou, para correr sem prompts (ex. num cron), define no ambiente:
 *   EXPORT_EMAIL=geral@contabilistaexplica.pt EXPORT_CODE=xxxxxx node scripts/export-data.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { mkdir, writeFile } from "node:fs/promises";

try {
  process.loadEnvFile(new URL("../.env", import.meta.url));
} catch {
  // .env pode não existir ou já ter sido carregado por outro meio — segue com process.env atual.
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Faltam VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY no .env");
  process.exit(1);
}

// Tabelas conhecidas do schema (ver CLAUDE.md secção 8). Algumas podem devolver
// erro de RLS consoante o teu papel — o script reporta e continua.
const TABLES = [
  "clients",
  "collaborators",
  "collaborator_secrets",
  "user_roles",
  "tasks",
  "monthly_obligations",
  "fiscal_deadlines",
  "notifications",
  "leads",
  "comercial_scripts",
  "comercial_script_groups",
  "financial_accounts",
  "client_financial_entries",
  "client_financial_settings",
  "client_financial_imports",
  "email_send_log",
  "email_send_state",
  "email_unsubscribe_tokens",
  "suppressed_emails",
];

async function prompt(question, hidden = false) {
  if (!hidden) {
    const rl = createInterface({ input: stdin, output: stdout });
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
  }
  // Leitura simples sem mascarar (Node não tem masking nativo sem libs extra).
  stdout.write(question);
  return new Promise((resolve) => {
    let data = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (char) => {
      if (char === "\n" || char === "\r" || char === "") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.removeListener("data", onData);
        stdout.write("\n");
        resolve(data.trim());
        return;
      }
      if (char === "") process.exit(1); // Ctrl+C
      if (char === "") {
        data = data.slice(0, -1);
        return;
      }
      data += char;
    };
    stdin.on("data", onData);
  });
}

async function main() {
  const email = process.env.EXPORT_EMAIL || (await prompt("Email: "));
  const code = process.env.EXPORT_CODE || (await prompt("Código de acesso: ", true));

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("\nA autenticar...");
  const { error: authError } = await supabase.auth.signInWithPassword({
    email,
    password: code,
  });
  if (authError) {
    console.error("Falha no login:", authError.message);
    process.exit(1);
  }
  console.log("Autenticado.\n");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = new URL(`../backups/${stamp}/`, import.meta.url);
  await mkdir(outDir, { recursive: true });

  const results = [];
  for (const table of TABLES) {
    process.stdout.write(`A exportar ${table}... `);
    let allRows = [];
    let from = 0;
    const pageSize = 1000;
    let pageError = null;
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(from, from + pageSize - 1);
      if (error) {
        pageError = error;
        break;
      }
      allRows = allRows.concat(data ?? []);
      if (!data || data.length < pageSize) break;
      from += pageSize;
    }
    if (pageError) {
      console.log(`FALHOU (${pageError.message})`);
      results.push({ table, ok: false, error: pageError.message });
      continue;
    }
    await writeFile(
      new URL(`${table}.json`, outDir),
      JSON.stringify(allRows, null, 2),
      "utf8"
    );
    console.log(`OK (${allRows.length} linhas)`);
    results.push({ table, ok: true, rows: allRows.length });
  }

  await supabase.auth.signOut();

  console.log(`\nBackup guardado em backups/${stamp}/`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log("\nTabelas que falharam (provavelmente por RLS restrito ao teu papel):");
    failed.forEach((f) => console.log(`  - ${f.table}: ${f.error}`));
  }
}

main();
