import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, CalendarCheck, CheckCircle2, ClipboardCheck, FileCheck2, Phone, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { contactTipoLabel } from "@/lib/clientContacts";
import {
  addDiasYmd, buildResumoDiario, lisbonDay,
  type RDGrupoCliente, type RDLinhaColaborador, type RDResumo,
} from "@/lib/resumoDiario";

const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const diaLabel = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  const w = DIAS_SEMANA[d.getUTCDay()];
  return `${w.charAt(0).toUpperCase()}${w.slice(1)}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
};
const isYmd = (s?: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: any; error: any }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Carrega os dados do dia (com margem de um dia em UTC) e calcula o resumo com a lógica pura partilhada. */
async function carregarResumo(dia: string): Promise<RDResumo> {
  const desde = `${addDiasYmd(dia, -1)}T00:00:00Z`;
  const ate = `${addDiasYmd(dia, 1)}T23:59:59Z`;
  const taskCols = "id,title,status,due_date,collaborator_id,client_id,updated_at";
  const [collaborators, clients, tarefasConcluidas, tarefasAbertas, obrigacoes, contactos, roles] = await Promise.all([
    fetchAll<{ id: string; name: string; user_id: string | null; active: boolean }>((f, t) =>
      supabase.from("collaborators").select("id,name,user_id,active").range(f, t)),
    fetchAll<{ id: string; name: string }>((f, t) => supabase.from("clients").select("id,name").range(f, t)),
    fetchAll((f, t) => supabase.from("tasks").select(taskCols).eq("status", "concluida")
      .gte("updated_at", desde).lte("updated_at", ate).range(f, t)),
    fetchAll((f, t) => supabase.from("tasks").select(taskCols).in("status", ["pendente", "em_progresso"])
      .lte("due_date", dia).range(f, t)),
    fetchAll((f, t) => supabase.from("monthly_obligations")
      .select("client_id,obligation_type,reference_month,completed_at,completed_by").eq("status", "concluida")
      .gte("completed_at", desde).lte("completed_at", ate).range(f, t)),
    fetchAll((f, t) => supabase.from("client_contacts").select("client_id,collaborator_id,created_by,tipo,created_at")
      .gte("created_at", desde).lte("created_at", ate).range(f, t)),
    fetchAll<{ user_id: string }>((f, t) => supabase.from("user_roles").select("user_id").eq("role", "admin").range(f, t)),
  ]);
  return buildResumoDiario({
    dia,
    collaborators: collaborators.map((c) => ({ ...c, active: !!c.active })),
    adminUserIds: roles.map((r) => r.user_id),
    clients,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tarefasConcluidas: tarefasConcluidas as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tarefasAbertas: tarefasAbertas as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    obrigacoes: obrigacoes as any[],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    contactos: contactos as any[],
  });
}

const Total = ({ label, value, icon: Icon, tone }: { label: string; value: number; icon: typeof CheckCircle2; tone?: "warn" }) => (
  <div className="rounded-xl border bg-card px-4 py-3">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className={cn("w-4 h-4", tone === "warn" ? "text-destructive" : "text-primary")} />
      {label}
    </div>
    <div className={cn("mt-1 text-2xl font-bold tabular-nums", tone === "warn" && value > 0 && "text-destructive")}>{value}</div>
  </div>
);

const Seccao = ({ titulo, n, children }: { titulo: string; n: number; children: React.ReactNode }) => (
  <div>
    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{titulo} ({n})</div>
    {children}
  </div>
);

const Grupos = ({ grupos }: { grupos: RDGrupoCliente[] }) => (
  <ul className="space-y-1 text-sm">
    {grupos.map((g) => (
      <li key={g.cliente}>
        <span className="font-medium">{g.cliente}</span>
        <span className="text-muted-foreground"> — {g.itens.join(", ")}</span>
      </li>
    ))}
  </ul>
);

const nItens = (g: RDGrupoCliente[]) => g.reduce((s, x) => s + x.itens.length, 0);

const CartaoColaborador = ({ c }: { c: RDLinhaColaborador }) => (
  <div className="rounded-xl border bg-card p-4 space-y-3">
    <div className="flex items-center gap-2">
      <span className="font-semibold flex-1 truncate">{c.nome}</span>
      <span className="text-xs font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">{c.totalFeito} registos</span>
      {c.totalEmAtraso > 0 && (
        <span className="text-xs font-semibold bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">{c.totalEmAtraso} em atraso</span>
      )}
    </div>
    {c.totalFeito === 0 && <p className="text-sm text-muted-foreground italic">Sem registos neste dia.</p>}
    {c.tarefas.length > 0 && (
      <Seccao titulo="Tarefas concluídas" n={c.tarefas.length}>
        <ul className="space-y-1 text-sm">
          {c.tarefas.map((t, i) => (
            <li key={i}>{t.titulo}{t.cliente && <span className="text-muted-foreground"> — {t.cliente}</span>}</li>
          ))}
        </ul>
      </Seccao>
    )}
    {c.gestaoMensal.length > 0 && (
      <Seccao titulo="Gestão mensal" n={nItens(c.gestaoMensal)}><Grupos grupos={c.gestaoMensal} /></Seccao>
    )}
    {c.obrigacoes.length > 0 && (
      <Seccao titulo="Obrigações" n={nItens(c.obrigacoes)}><Grupos grupos={c.obrigacoes} /></Seccao>
    )}
    {c.contactos.length > 0 && (
      <Seccao titulo="Contactos" n={c.contactos.length}>
        <ul className="space-y-1 text-sm">
          {c.contactos.map((k, i) => (
            <li key={i}><span className="font-medium">{k.cliente}</span><span className="text-muted-foreground"> — {contactTipoLabel(k.tipo)}</span></li>
          ))}
        </ul>
      </Seccao>
    )}
    {c.totalEmAtraso > 0 && (
      <Seccao titulo="Com prazo ultrapassado" n={c.totalEmAtraso}>
        <ul className="space-y-1 text-sm">
          {c.emAtraso.map((t, i) => (
            <li key={i}>
              <span className={cn("tabular-nums mr-1", t.hoje ? "text-warning" : "text-destructive")}>{t.hoje ? "hoje" : t.prazo}</span>
              {t.titulo}{t.cliente && <span className="text-muted-foreground"> — {t.cliente}</span>}
            </li>
          ))}
          {c.totalEmAtraso > c.emAtraso.length && (
            <li className="text-muted-foreground text-xs">e mais {c.totalEmAtraso - c.emAtraso.length}…</li>
          )}
        </ul>
      </Seccao>
    )}
  </div>
);

/** Resumo do dia da equipa (admin): o que cada colaborador registou numa data. */
const ResumoDiaView = ({ initialDate }: { initialDate?: string }) => {
  const hoje = lisbonDay(new Date());
  const [dia, setDia] = useState(isYmd(initialDate) ? initialDate : hoje);
  useEffect(() => { if (isYmd(initialDate)) setDia(initialDate); }, [initialDate]);

  const { data: resumo, isLoading, error } = useQuery({
    queryKey: ["resumo_dia", dia],
    queryFn: () => carregarResumo(dia),
  });
  const t = resumo?.totais;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold">Resumo do dia</h1>
          <p className="text-sm text-muted-foreground">O que cada colaborador registou na app neste dia (hora de Lisboa).</p>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setDia(addDiasYmd(dia, -1))} aria-label="Dia anterior"
            className="p-2 rounded-lg border bg-card hover:bg-muted"><ChevronLeft className="w-4 h-4" /></button>
          <input type="date" value={dia} max={hoje} onChange={(e) => isYmd(e.target.value) && setDia(e.target.value)}
            className="h-9 rounded-lg border bg-card px-2 text-sm" aria-label="Data" />
          <button type="button" onClick={() => setDia(addDiasYmd(dia, 1))} disabled={dia >= hoje} aria-label="Dia seguinte"
            className="p-2 rounded-lg border bg-card hover:bg-muted disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
          {dia !== hoje && (
            <button type="button" onClick={() => setDia(hoje)} className="ml-1 h-9 px-3 rounded-lg border bg-card text-sm hover:bg-muted">Hoje</button>
          )}
        </div>
      </div>
      <p className="text-sm font-medium">{diaLabel(dia)}</p>

      {error && <p className="text-sm text-destructive">Não foi possível carregar o resumo: {(error as Error).message}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}

      {t && resumo && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Total label="Tarefas concluídas" value={t.tarefas} icon={CheckCircle2} />
            <Total label="Gestão mensal" value={t.gestaoMensal} icon={ClipboardCheck} />
            <Total label="Obrigações" value={t.obrigacoes} icon={FileCheck2} />
            <Total label="Contactos" value={t.contactos} icon={Phone} />
            <Total label="Com prazo ultrapassado" value={t.emAtraso} icon={AlertTriangle} tone="warn" />
          </div>
          {dia !== hoje && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <CalendarCheck className="w-3.5 h-3.5" />
              As tarefas com prazo ultrapassado refletem o estado atual (tarefas ainda em aberto com prazo até este dia).
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {resumo.colaboradores.map((c) => <CartaoColaborador key={c.id} c={c} />)}
          </div>
        </>
      )}
    </div>
  );
};

export default ResumoDiaView;
