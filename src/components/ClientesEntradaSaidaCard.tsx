import { useMemo } from "react";
import { LogOut, UserPlus, BarChart3 } from "lucide-react";
import { useClients, useCollaborators } from "@/hooks/useSupabaseQuery";
import { useOffboardings } from "@/hooks/useOffboardings";
import { useOnboardings } from "@/hooks/useOnboardings";
import { ACOMPANHAMENTO, SAIDA_CHECKLIST, saidaProgresso, saidasPorMotivo, motivoLabel } from "@/lib/clientSaida";
import { cn } from "@/lib/utils";

const fmtMes = (d: string | null) =>
  d ? new Date(`${d.slice(0, 7)}-01T12:00:00`).toLocaleDateString("pt-PT", { month: "short", year: "numeric" }) : "—";

interface Props {
  onOpenClient: (client: any) => void;
}

/** Dashboard da admin: clientes em saída (checklist), saídas por motivo (12 meses) e novos clientes (60 dias). */
const ClientesEntradaSaidaCard = ({ onOpenClient }: Props) => {
  const { data: clients = [] } = useClients();
  const { data: collaborators = [] } = useCollaborators();
  const { data: offboardings = [] } = useOffboardings();
  const { data: onboardings = [] } = useOnboardings();

  const clientById = useMemo(() => new Map(clients.map((c: any) => [c.id, c])), [clients]);
  const collabName = (id: string | null | undefined) => collaborators.find((c: any) => c.id === id)?.name?.split(" ")[0] || "—";

  const emSaida = useMemo(
    () =>
      offboardings
        .filter((o) => !o.completed_at && (clientById.get(o.client_id) as any)?.status === "a_sair")
        .map((o) => ({ o, client: clientById.get(o.client_id) as any }))
        .sort((a, b) => (a.o.ultimo_mes_responsabilidade || "9999").localeCompare(b.o.ultimo_mes_responsabilidade || "9999")),
    [offboardings, clientById],
  );

  const porMotivo = useMemo(() => saidasPorMotivo(offboardings), [offboardings]);
  const totalSaidas = porMotivo.reduce((s, m) => s + m.n, 0);

  const novos = useMemo(() => {
    const limite = new Date();
    limite.setDate(limite.getDate() - 60);
    const lim = limite.toISOString().slice(0, 10);
    return onboardings
      .filter((o) => o.completed_at && (o.data_inicio || o.completed_at.slice(0, 10)) >= lim)
      .sort((a, b) => (b.data_inicio || "").localeCompare(a.data_inicio || ""));
  }, [onboardings]);

  const today = new Date().toISOString().slice(0, 10);
  const prazoDe = (inicio: string | null, dias: number) => {
    if (!inicio) return null;
    const d = new Date(`${inicio}T12:00:00`);
    d.setDate(d.getDate() + dias);
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 animate-fade-in" style={{ animationDelay: "240ms" }}>
      {/* Clientes em saída */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <LogOut className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Clientes em saída</h3>
          <span className="ml-auto text-xs text-muted-foreground">{emSaida.length}</span>
        </div>
        {emSaida.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum cliente a sair.</p>
        ) : (
          <ul className="space-y-2">
            {emSaida.map(({ o, client }) => {
              const done = saidaProgresso(o);
              return (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => client && onOpenClient(client)}
                    className="w-full text-left rounded-lg border p-2.5 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{client?.name || "—"}</span>
                      <span className="text-xs font-semibold tabular-nums">{done}/{SAIDA_CHECKLIST.length}</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden mt-1.5">
                      <div className="h-full bg-primary" style={{ width: `${(done / SAIDA_CHECKLIST.length) * 100}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Último mês {fmtMes(o.ultimo_mes_responsabilidade)} · {motivoLabel(o.motivo_saida)} · {collabName(o.responsavel_id)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Saídas por motivo */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Saídas por motivo</h3>
          <span className="ml-auto text-xs text-muted-foreground">últimos 12 meses · {totalSaidas}</span>
        </div>
        {porMotivo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem saídas concluídas nos últimos 12 meses.</p>
        ) : (
          <ul className="space-y-2">
            {porMotivo.map((m) => (
              <li key={m.motivo}>
                <div className="flex items-center justify-between text-sm">
                  <span>{m.label}</span>
                  <span className="font-semibold tabular-nums">{m.n}</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                  <div className="h-full bg-primary" style={{ width: `${(m.n / porMotivo[0].n) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Clientes novos (últimos 60 dias) */}
      <div className="bg-card rounded-xl border p-5">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-primary" />
          <h3 className="font-semibold">Clientes novos</h3>
          <span className="ml-auto text-xs text-muted-foreground">últimos 60 dias · {novos.length}</span>
        </div>
        {novos.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem clientes novos nos últimos 60 dias.</p>
        ) : (
          <ul className="space-y-2">
            {novos.map((o) => {
              const f = o as unknown as Record<string, unknown>;
              const client = o.client_id ? (clientById.get(o.client_id) as any) : null;
              const nome = client?.name || (o.answers as any)?.nome || o.lead?.name || "Novo cliente";
              return (
                <li key={o.id} className="rounded-lg border p-2.5">
                  <button
                    type="button"
                    onClick={() => client && onOpenClient(client)}
                    className="text-sm font-medium truncate text-left hover:text-primary"
                  >
                    {nome}
                  </button>
                  <p className="text-[11px] text-muted-foreground">
                    Início {o.data_inicio ? new Date(`${o.data_inicio}T12:00:00`).toLocaleDateString("pt-PT") : "—"} · {collabName(o.responsavel_id)}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {ACOMPANHAMENTO.map((a) => {
                      const feito = f[a.key] === true;
                      const prazo = prazoDe(o.data_inicio, a.dias);
                      const atrasado = !feito && !!prazo && prazo < today;
                      return (
                        <span
                          key={a.key}
                          className={cn(
                            "px-1.5 py-0.5 rounded text-[10px] font-medium",
                            feito ? "bg-success/15 text-success" : atrasado ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground",
                          )}
                          title={prazo ? `Prazo ${new Date(`${prazo}T12:00:00`).toLocaleDateString("pt-PT")}` : undefined}
                        >
                          {feito ? "✓ " : ""}{a.label}
                        </span>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default ClientesEntradaSaidaCard;
