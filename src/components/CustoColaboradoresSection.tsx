import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useControloAudit, useControloClients } from "@/hooks/useControlo";
import { useOffboardings } from "@/hooks/useOffboardings";
import { todayYmd } from "@/lib/obrigacoesControlo";
import { avencasPorColaborador, calcularCarteira, comUltimoMes, mesDe } from "@/lib/carteira";
import { custoMensal, lucroPorColaborador, totalLucro, TSU_EMPREGADOR, type CustoColaboradorInput } from "@/lib/custoColaborador";
import type { Collaborator } from "@/types/database";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const eur = (v: number) => new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(v || 0);
const pct = (v: number | null) => (v === null ? "—" : `${Math.round(v * 100)}%`);
const NADA: never[] = [];

type CustoRow = { collaborator_id: string; salario_bruto: number; subsidio_alimentacao: number };

function CampoEur({ valor, onSave }: { valor: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(valor || ""));
  useEffect(() => setV(String(valor || "")), [valor]);
  return (
    <input
      type="number"
      step="0.01"
      min="0"
      value={v}
      placeholder="0"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = Math.max(0, Number(v.replace(",", ".")) || 0);
        if (n !== valor) onSave(n);
      }}
      className="w-24 py-1 px-2 rounded-md border bg-background text-sm tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}

/** Colaboradores (admin): custo de cada colaborador (salário) e lucro = avenças que gere no mês − custo. */
export default function CustoColaboradoresSection({ collaborators }: { collaborators: Collaborator[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const today = todayYmd();
  const mes = mesDe(today);
  const qClients = useControloClients();
  const qAudit = useControloAudit(mes);
  const qSaidas = useOffboardings();
  const qCustos = useQuery({
    queryKey: ["collaborator_custos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("collaborator_custos").select("collaborator_id, salario_bruto, subsidio_alimentacao");
      if (error) throw error;
      return (data ?? []) as CustoRow[];
    },
  });
  const guardar = useMutation({
    mutationFn: async (row: CustoRow) => {
      const { error } = await supabase.from("collaborator_custos").upsert(row, { onConflict: "collaborator_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["collaborator_custos"] }),
    onError: (e: Error) => toast({ title: "Erro ao guardar", description: e.message, variant: "destructive" }),
  });

  const custos = useMemo(() => new Map<string, CustoColaboradorInput>((qCustos.data ?? NADA).map((c) => [c.collaborator_id, c])), [qCustos.data]);
  const ativosIds = useMemo(() => collaborators.filter((c) => c.active !== false).map((c) => c.id), [collaborators]);
  const linhas = useMemo(() => {
    const carteira = comUltimoMes(qClients.data ?? NADA, qSaidas.data ?? NADA);
    const audit = (qAudit.data ?? NADA).filter((a) => a.campo === "mensalidade");
    const m = calcularCarteira(carteira, audit, mes);
    return lucroPorColaborador(avencasPorColaborador(m), custos, ativosIds);
  }, [qClients.data, qSaidas.data, qAudit.data, mes, custos, ativosIds]);
  const total = totalLucro(linhas);
  const nome = (id: string) => (id === "none" ? "Sem responsável" : collaborators.find((c) => c.id === id)?.name ?? "—");
  const loading = qClients.isLoading || qCustos.isLoading || qAudit.isLoading;

  const save = (id: string, patch: Partial<CustoRow>) => {
    const atual = qCustos.data?.find((c) => c.collaborator_id === id);
    guardar.mutate({
      collaborator_id: id,
      salario_bruto: Number(atual?.salario_bruto ?? 0),
      subsidio_alimentacao: Number(atual?.subsidio_alimentacao ?? 0),
      ...patch,
    });
  };

  return (
    <div className="bg-card rounded-xl border p-5">
      <div className="mb-3">
        <h3 className="font-semibold">Custo e lucro por colaborador</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Avenças dos clientes de que é responsável em {MESES[Number(mes.slice(5, 7)) - 1]} (as mesmas do «Negócio»). Custo mensal = salário bruto × 14 ÷ 12
          × (1 + TSU {Math.round(TSU_EMPREGADOR * 10000) / 100}%) + subsídio de alimentação mensal. Lucro = avenças − custo.
        </p>
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground py-4">A carregar...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b">
                <th className="py-2 pr-3 font-medium">Colaborador</th>
                <th className="py-2 px-3 font-medium text-right">Clientes</th>
                <th className="py-2 px-3 font-medium text-right">Avenças / mês</th>
                <th className="py-2 px-3 font-medium text-right">Salário bruto</th>
                <th className="py-2 px-3 font-medium text-right">Subs. alimentação / mês</th>
                <th className="py-2 px-3 font-medium text-right">Custo / mês</th>
                <th className="py-2 px-3 font-medium text-right">Lucro / mês</th>
                <th className="py-2 pl-3 font-medium text-right">Margem</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => {
                const c = qCustos.data?.find((x) => x.collaborator_id === l.key);
                return (
                  <tr key={l.key} className="border-b last:border-0">
                    <td className="py-2 pr-3">{nome(l.key)}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{l.clientes}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{eur(l.avencas)}</td>
                    <td className="py-2 px-3 text-right">
                      {l.key === "none" ? "—" : <CampoEur valor={Number(c?.salario_bruto ?? 0)} onSave={(v) => save(l.key, { salario_bruto: v })} />}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {l.key === "none" ? "—" : <CampoEur valor={Number(c?.subsidio_alimentacao ?? 0)} onSave={(v) => save(l.key, { subsidio_alimentacao: v })} />}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">{l.key === "none" ? "—" : l.semCusto ? <span className="text-muted-foreground">sem salário</span> : eur(custoMensal(c))}</td>
                    <td className={cn("py-2 px-3 text-right tabular-nums font-semibold", l.lucro < 0 ? "text-destructive" : "text-success")}>{eur(l.lucro)}</td>
                    <td className="py-2 pl-3 text-right tabular-nums">{pct(l.margem)}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 font-semibold">
                <td className="py-2 pr-3">Total</td>
                <td className="py-2 px-3 text-right tabular-nums">{total.clientes}</td>
                <td className="py-2 px-3 text-right tabular-nums">{eur(total.avencas)}</td>
                <td className="py-2 px-3" />
                <td className="py-2 px-3" />
                <td className="py-2 px-3 text-right tabular-nums">{eur(total.custo)}</td>
                <td className={cn("py-2 px-3 text-right tabular-nums", total.lucro < 0 ? "text-destructive" : "text-success")}>{eur(total.lucro)}</td>
                <td className="py-2 pl-3 text-right tabular-nums">{pct(total.margem)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
