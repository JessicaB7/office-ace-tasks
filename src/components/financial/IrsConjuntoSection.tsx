import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { fmtEur } from "./financialMath";
import { calcIrsConjunto, type ConjugeTipoRendimento, type IrsConjuntoResult } from "@/lib/irs";
import type { FinancialSettings } from "@/hooks/useClientFinancials";

export type IrsConjuntoRegime = {
  /** Ex.: "Regime simplificado" */
  label: string;
  /** Rendimento coletável do titular neste regime. */
  rcTitular: number;
};

export type IrsConjuntoDados = {
  ativo: boolean;
  conjuge: { rendimento: number; tipo: ConjugeTipoRendimento; deducoes: number; retencoes: number };
};

/** Lê das definições do ano os dados do IRS em conjunto. */
export function irsConjuntoDados(settings: Partial<FinancialSettings> | null | undefined): IrsConjuntoDados {
  return {
    ativo: Boolean(settings?.irs_conjunto),
    conjuge: {
      rendimento: Number(settings?.conjuge_rendimento ?? 0),
      tipo: settings?.conjuge_rendimento_tipo === "coletavel" ? "coletavel" : "bruto_a",
      deducoes: Number(settings?.conjuge_deducoes ?? 250),
      retencoes: Number(settings?.conjuge_retencoes ?? 0),
    },
  };
}

/** Cálculo do IRS em conjunto para um regime (mesmas deduções/retenções do titular que o ecrã usa). */
export function irsConjuntoParaRegime(
  dados: IrsConjuntoDados,
  rcTitular: number,
  deducoesTitular: number,
  retencoesTitular: number,
): IrsConjuntoResult {
  return calcIrsConjunto({ rcTitular, deducoesTitular, retencoesTitular, conjuge: dados.conjuge });
}

/** Linhas para o Robot (texto ao cliente) — só quando o IRS em conjunto está ativo. */
export function irsConjuntoLinhasRobot(label: string, r: IrsConjuntoResult) {
  return [
    { descricao: `${label} — rendimento coletável do cônjuge`, valor: r.rcConjuge },
    { descricao: `${label} — rendimento coletável do casal`, valor: r.rcTotal },
    { descricao: `${label} — IRS em conjunto (2 × IRS de metade do rendimento)`, valor: r.coleta },
    { descricao: `${label} — deduções à coleta do casal`, valor: r.deducoes },
    { descricao: `${label} — retenções na fonte e pagamentos por conta do casal`, valor: r.retencoes },
    { descricao: `${label} — ${r.liquido >= 0 ? "IRS a pagar em conjunto" : "IRS a receber em conjunto"}`, valor: Math.abs(r.liquido) },
    { descricao: `${label} — tributação separada (os dois somados)`, valor: r.separado.total },
    {
      descricao: `${label} — ${r.poupancaConjunto >= 0 ? "poupança com o IRS em conjunto" : "poupança com a tributação separada"}`,
      valor: Math.abs(r.poupancaConjunto),
    },
  ];
}

const inputCls =
  "w-32 py-1.5 px-2 rounded-lg border bg-background text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-primary/30";
const card = "rounded-lg border bg-background p-3 min-h-[78px] h-full flex flex-col justify-center";

function Kpi({ label, value, tone, sub }: { label: string; value: string; tone?: "good" | "warn"; sub?: string }) {
  return (
    <div className={cn(card, tone && "ring-1", tone === "good" && "ring-emerald-200 dark:ring-emerald-900/40", tone === "warn" && "ring-amber-200 dark:ring-amber-900/40")}>
      <div className={cn("text-[11px]", tone === "good" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-muted-foreground")}>{label}</div>
      <div className={cn("text-lg font-bold tabular-nums", tone === "good" && "text-emerald-700", tone === "warn" && "text-amber-700")}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function IrsConjuntoSection({
  settings,
  onSave,
  exporting,
  regimes,
  deducoesTitular,
  retencoesTitular,
}: {
  settings: Partial<FinancialSettings> | null | undefined;
  onSave: (patch: Partial<FinancialSettings>) => void;
  exporting: boolean;
  regimes: IrsConjuntoRegime[];
  deducoesTitular: number;
  retencoesTitular: number;
}) {
  const dados = irsConjuntoDados(settings);
  const [rend, setRend] = useState(dados.conjuge.rendimento);
  const [ret, setRet] = useState(dados.conjuge.retencoes);
  const [ded, setDed] = useState(dados.conjuge.deducoes);
  useEffect(() => setRend(dados.conjuge.rendimento), [dados.conjuge.rendimento]);
  useEffect(() => setRet(dados.conjuge.retencoes), [dados.conjuge.retencoes]);
  useEffect(() => setDed(dados.conjuge.deducoes), [dados.conjuge.deducoes]);

  // No PDF só aparece quando a opção está ativa.
  if (exporting && !dados.ativo) return null;

  const saveNum = (field: "conjuge_rendimento" | "conjuge_retencoes" | "conjuge_deducoes", v: number, atual: number) => {
    const safe = Math.max(0, Number(v) || 0);
    if (safe !== atual) onSave({ [field]: safe } as Partial<FinancialSettings>);
  };

  return (
    <div className="col-span-12 rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h4 className="font-semibold text-sm">IRS em conjunto</h4>
          {!exporting && (
            <p className="text-[11px] text-muted-foreground max-w-3xl">
              Tributação conjunta (art. 69.º CIRS): soma-se o rendimento coletável dos dois, aplicam-se os escalões a metade
              e multiplica-se o imposto por 2. Abatem-se as deduções à coleta e as retenções dos dois.
            </p>
          )}
        </div>
        {!exporting && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={dados.ativo}
              disabled={!settings}
              onChange={(e) => onSave({ irs_conjunto: e.target.checked })}
              className="h-4 w-4 accent-primary"
            />
            <span>Simular IRS em conjunto</span>
          </label>
        )}
      </div>

      {dados.ativo && !exporting && (
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Rendimentos do cônjuge</span>
            <select
              value={dados.conjuge.tipo}
              onChange={(e) => onSave({ conjuge_rendimento_tipo: e.target.value as ConjugeTipoRendimento })}
              className="py-1.5 px-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="bruto_a">Trabalho dependente (bruto)</option>
              <option value="coletavel">Já coletável (ex.: TI)</option>
            </select>
            <input
              type="number"
              step="0.01"
              min="0"
              value={Number.isFinite(rend) ? rend : 0}
              onChange={(e) => setRend(Number(e.target.value))}
              onBlur={() => saveNum("conjuge_rendimento", rend, dados.conjuge.rendimento)}
              className={inputCls}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Retenção na fonte do cônjuge</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={Number.isFinite(ret) ? ret : 0}
              onChange={(e) => setRet(Number(e.target.value))}
              onBlur={() => saveNum("conjuge_retencoes", ret, dados.conjuge.retencoes)}
              className={inputCls}
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Deduções à coleta do cônjuge</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={Number.isFinite(ded) ? ded : 0}
              onChange={(e) => setDed(Number(e.target.value))}
              onBlur={() => saveNum("conjuge_deducoes", ded, dados.conjuge.deducoes)}
              className={inputCls}
            />
          </label>
        </div>
      )}

      {dados.ativo &&
        regimes.map((reg) => {
          const r = irsConjuntoParaRegime(dados, reg.rcTitular, deducoesTitular, retencoesTitular);
          return (
            <div key={reg.label} className="mt-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">{reg.label}</div>
              <div className="grid grid-cols-2 md:grid-cols-7 gap-3 auto-rows-fr">
                <Kpi label="Rendimento coletável (titular)" value={fmtEur(Math.max(0, reg.rcTitular))} />
                <Kpi
                  label="Rendimento coletável (cônjuge)"
                  value={`+${fmtEur(r.rcConjuge)}`}
                  sub={r.deducaoEspecificaConjuge > 0 ? `após dedução específica de ${fmtEur(r.deducaoEspecificaConjuge)}` : undefined}
                />
                <Kpi label="Rendimento coletável do casal" value={fmtEur(r.rcTotal)} sub={`escalões aplicados a ${fmtEur(r.quociente)}`} />
                <Kpi label="IRS em conjunto" value={fmtEur(r.coleta)} sub="2 × IRS de metade do rendimento" />
                <Kpi label="Deduções à coleta (casal)" value={`−${fmtEur(r.deducoes)}`} tone="good" />
                <Kpi label="Retenções e pagamentos por conta (casal)" value={`−${fmtEur(r.retencoes)}`} tone="good" />
                <Kpi
                  label={r.liquido >= 0 ? "IRS a pagar (conjunto)" : "IRS a receber (conjunto)"}
                  value={fmtEur(Math.abs(r.liquido))}
                  tone={r.liquido >= 0 ? "warn" : "good"}
                />
              </div>
              <div className="mt-3 rounded-lg border bg-muted/40 p-3 flex items-baseline justify-between gap-3 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  Tributação separada: titular {r.separado.titular >= 0 ? "paga" : "recebe"} {fmtEur(Math.abs(r.separado.titular))},
                  cônjuge {r.separado.conjuge >= 0 ? "paga" : "recebe"} {fmtEur(Math.abs(r.separado.conjuge))}
                  {" — "}
                  {Math.abs(r.poupancaConjunto) < 0.005
                    ? "o resultado é igual em conjunto e em separado"
                    : r.poupancaConjunto > 0
                      ? "o IRS em conjunto é mais favorável — poupança estimada"
                      : "a tributação separada é mais favorável — poupança estimada"}
                </span>
                {Math.abs(r.poupancaConjunto) >= 0.005 && (
                  <span className="text-base font-bold tabular-nums">{fmtEur(Math.abs(r.poupancaConjunto))}</span>
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
