import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";

// As edge functions (relatório semanal) usam cópias destes ficheiros em
// supabase/functions/_shared/lib/. Se este teste falhar, copiar de novo:
//   cp src/lib/{deadlineOverrides,obrigacoesControlo,clientSaida,fechoMes,clientContacts}.ts supabase/functions/_shared/lib/
const FILES = ["deadlineOverrides.ts", "obrigacoesControlo.ts", "clientSaida.ts", "fechoMes.ts", "clientContacts.ts"];
const root = path.resolve(__dirname, "../../..");

describe("cópias partilhadas com as edge functions", () => {
  for (const f of FILES) {
    it(`${f} está igual em supabase/functions/_shared/lib`, () => {
      const a = readFileSync(path.join(root, "src/lib", f), "utf8");
      const b = readFileSync(path.join(root, "supabase/functions/_shared/lib", f), "utf8");
      expect(b).toBe(a);
    });
  }
});
