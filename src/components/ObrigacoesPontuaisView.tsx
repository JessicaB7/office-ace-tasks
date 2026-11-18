import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useClients, useCollaborators, useMonthlyObligations, useUpsertObligation } from "@/hooks/useSupabaseQuery";
import {
  PONTUAL_TABS,
  clienteConcluido,
  contarPontuais,
  elegivel,
  isFeito,
  mapaObrigacoes,
  pontualNotaType,
  pontualReferenceMonth,
  pontualTab,
  prazoLabel,
  prazoUltrapassado,
  type PontualColuna,
  type PontualTabId,
} from "@/lib/obrigacoesPontuais";

type Cli = { id: string; name: string; nif?: string | null; tipo_contabilidade?: string | null; responsavel_id?: string | null; active?: boolean | null; ultimo_mes_responsabilidade?: string | null; inicio_contrato?: string | null };
type Collab = { id: string; name: string; email?: string | null; user_id?: string | null };
type Obl = { id: string; client_id: string; obligation_type: string; status: string; completed_at?: string | null; completed_by?: string | null; notes?: string | null };

const REGIME_BADGE: Record<string, string> = {
  SQ: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "TI CO": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "TI RS": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
};

const fmtWhen = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

const hojeYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

function NotaCell({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v.trim() !== value.trim() && onSave(v.trim())}
      placeholder="Nota…"
      className="w-full min-w-[160px] py-1 px-2 rounded-md border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
    />
  );
}

const ObrigacoesPontuaisView = () => {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { user } = useAuth();
  const upsert = useUpsertObligation();

  const [ano, setAno] = useState(new Date().getFullYear());
  const [tabId, setTabId] = useState<PontualTabId>("ppc_ti");
  const [collabFilter, setCollabFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [soPendentes, setSoPendentes] = useState(false);

  const tab = pontualTab(tabId);
  const referenceMonth = pontualReferenceMonth(ano);
  const { data: obligations = [], isLoading: loadingObl } = useMonthlyObligations(referenceMonth);
  const mapa = useMemo(
    () => mapaObrigacoes((obligations as unknown as Obl[]).filter((o) => String(o.obligation_type).startsWith("pontual_"))),
    [obligations],
  );
  const hoje = hojeYmd();

  const currentCollaborator = useMemo(() => {
    if (!user?.email) return null;
    return (collaborators as unknown as Collab[]).find((c) => c.email?.toLowerCase() === user.email!.toLowerCase()) || null;
  }, [user, collaborators]);
  const collabName = (id: string) => (collaborators as unknown as Collab[]).find((c) => c.id === id)?.name || "—";

  const elegiveis = useMemo(
    () => (clients as unknown as Cli[]).filter((c) => elegivel(c, tab, ano)).sort((a, b) => a.name.localeCompare(b.name, "pt")),
    [clients, tab, ano],
  );

  const byResponsavel = useMemo(() => {
    const counts = new Map<string, number>();
    elegiveis.forEach((c) => counts.set(c.responsavel_id || "none", (counts.get(c.responsavel_id || "none") || 0) + 1));
    return [...counts.entries()]
      .map(([id, count]) => ({ id, count, name: id === "none" ? "Sem responsável" : collabName(id) }))
      .sort((a, b) => {
        const rank = (id: string) => (id === currentCollaborator?.id ? 0 : id === "none" ? 2 : 1);
        return rank(a.id) - rank(b.id) || a.name.localeCompare(b.name, "pt");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elegiveis, collaborators, currentCollaborator]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return elegiveis.filter((c) => {
      if (collabFilter !== "all" && (c.responsavel_id || "none") !== collabFilter) return false;
      if (q && !c.name?.toLowerCase().includes(q) && !String(c.nif || "").includes(q)) return false;
      if (soPendentes && clienteConcluido(c.id, tab, mapa)) return false;
      return true;
    });
  }, [elegiveis, collabFilter, search, soPendentes, tab, mapa]);

  // Contagem respeita responsável e pesquisa, mas não o «só pendentes».
  const contagem = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ids = elegiveis
      .filter((c) => collabFilter === "all" || (c.responsavel_id || "none") === collabFilter)
      .filter((c) => !q || c.name?.toLowerCase().includes(q) || String(c.nif || "").includes(q))
      .map((c) => c.id);
    return contarPontuais(ids, tab, mapa);
  }, [elegiveis, collabFilter, search, tab, mapa]);

  const whoDid = (obl: Obl | undefined) => {
    if (!obl?.completed_at) return "";
    const name = (collaborators as unknown as Collab[]).find((c) => c.user_id && c.user_id === obl.completed_by)?.name;
    return `Feito${name ? ` por ${name}` : ""} em ${fmtWhen(obl.completed_at)}`;
  };

  const toggle = (client: Cli, col: PontualColuna) => {
    const obl: Obl | undefined = mapa[col.type]?.[client.id];
    const done = isFeito(obl);
    const prev = obl ? { status: obl.status, completed_at: obl.completed_at ?? null, completed_by: obl.completed_by ?? null } : null;
    upsert.mutate(
      {
        ...(obl?.id ? { id: obl.id } : {}),
        client_id: client.id,
        obligation_type: col.type,
        reference_month: referenceMonth,
        status: done ? "pendente" : "concluida",
        completed_at: done ? null : new Date().toISOString(),
        completed_by: done ? null : user?.id || null,
      },
      {
        onSuccess: (saved: { id?: string } | null) => {
          toast(`${tab.label} · ${col.label} ${done ? "desmarcado" : "marcado"} — ${client.name}`, {
            action: {
              label: "Desfazer",
              onClick: () =>
                upsert.mutate({
                  id: saved?.id ?? obl?.id,
                  client_id: client.id,
                  obligation_type: col.type,
                  reference_month: referenceMonth,
                  status: prev?.status ?? "pendente",
                  completed_at: prev?.completed_at ?? null,
                  completed_by: prev?.completed_by ?? null,
                }),
            },
          });
        },
        onError: () => toast.error("Não foi possível guardar."),
      },
    );
  };

  const saveNota = (client: Cli, nota: string) => {
    const type = pontualNotaType(tab);
    const obl: Obl | undefined = mapa[type]?.[client.id];
    upsert.mutate(
      {
        ...(obl?.id ? { id: obl.id } : {}),
        client_id: client.id,
        obligation_type: type,
        reference_month: referenceMonth,
        status: obl?.status ?? "pendente",
        notes: nota || null,
      },
      { onError: () => toast.error("Não foi possível guardar a nota.") },
    );
  };

  const loading = loadingClients || loadingObl;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Obrigações pontuais</h1>
          <p className="text-sm text-muted-foreground">{tab.descricao}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAno((a) => a - 1)} className="p-2 rounded-lg border hover:bg-muted" aria-label="Ano anterior">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-lg font-semibold tabular-nums w-16 text-center">{ano}</span>
          <button onClick={() => setAno((a) => a + 1)} className="p-2 rounded-lg border hover:bg-muted" aria-label="Ano seguinte">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 flex-wrap border-b">
        {PONTUAL_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => { setTabId(t.id); setCollabFilter("all"); }}
            className={cn(
              "px-3 py-2 text-sm -mb-px border-b-2 transition-colors",
              t.id === tab.id ? "border-primary text-primary font-medium" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Clientes concluídos</div>
          <div className="text-2xl font-bold tabular-nums">{contagem.concluidos} de {contagem.clientes}</div>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="text-xs text-muted-foreground">Tarefas feitas</div>
          <div className="text-2xl font-bold tabular-nums">{contagem.feitas} de {contagem.tarefas}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 col-span-2 md:col-span-1">
          <div className="text-xs text-muted-foreground">Por fazer</div>
          <div className="text-2xl font-bold tabular-nums">{contagem.tarefas - contagem.feitas}</div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setCollabFilter("all")}
          className={cn("px-3 py-1.5 rounded-full text-xs border", collabFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
        >
          Todos ({elegiveis.length})
        </button>
        {byResponsavel.map((r) => (
          <button
            key={r.id}
            onClick={() => setCollabFilter(r.id)}
            className={cn("px-3 py-1.5 rounded-full text-xs border", collabFilter === r.id ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted")}
          >
            {r.name} ({r.count})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar cliente ou NIF…"
            className="w-full pl-9 pr-3 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} className="h-4 w-4 accent-primary" />
          Só pendentes
        </label>
      </div>

      <div className="rounded-xl border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Responsável</th>
              {tab.colunas.map((col) => (
                <th key={col.type} className="px-3 py-3 font-medium text-center">
                  <div>{col.label}</div>
                  <div className={cn("text-[10px] font-normal", prazoUltrapassado(col, ano, hoje) && "text-destructive")}>{prazoLabel(col)}</div>
                </th>
              ))}
              <th className="px-4 py-3 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={tab.colunas.length + 3} className="px-4 py-8 text-center text-muted-foreground">A carregar…</td></tr>
            )}
            {!loading && filtrados.length === 0 && (
              <tr><td colSpan={tab.colunas.length + 3} className="px-4 py-8 text-center text-muted-foreground">Sem clientes para mostrar.</td></tr>
            )}
            {!loading && filtrados.map((c) => (
              <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-4 py-2.5">
                  <div className="font-medium">{c.name}</div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>NIF {c.nif || "—"}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", REGIME_BADGE[c.tipo_contabilidade ?? ""] || "bg-muted")}>
                      {c.tipo_contabilidade}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.responsavel_id ? collabName(c.responsavel_id) : "—"}</td>
                {tab.colunas.map((col) => {
                  const obl: Obl | undefined = mapa[col.type]?.[c.id];
                  const done = isFeito(obl);
                  const atrasado = !done && prazoUltrapassado(col, ano, hoje);
                  return (
                    <td key={col.type} className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => toggle(c, col)}
                        disabled={upsert.isPending}
                        title={done ? whoDid(obl) : atrasado ? "Prazo ultrapassado — clica para marcar como feito" : "Clica para marcar como feito"}
                        className={cn(
                          "inline-flex items-center justify-center w-9 h-9 rounded-lg border transition-colors",
                          done && "bg-primary text-primary-foreground border-primary",
                          !done && !atrasado && "hover:bg-muted",
                          atrasado && "border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/20",
                        )}
                      >
                        {done ? <Check className="w-4 h-4" /> : atrasado ? "!" : ""}
                      </button>
                    </td>
                  );
                })}
                <td className="px-4 py-2.5">
                  <NotaCell value={mapa[pontualNotaType(tab)]?.[c.id]?.notes || ""} onSave={(v) => saveNota(c, v)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ObrigacoesPontuaisView;
