import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, ChevronDown, ChevronRight, Pencil, Plus, Search, Trash2, Users2, Repeat } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useDeleteProcesso, useProcessos, useSaveProcesso, type Processo, type ProcessoArea, type ProcessoInput } from "@/hooks/useProcessos";
import { renderMarkdown } from "@/lib/markdown";
import { TOCONLINE_DOCS } from "@/lib/toconlineProcedures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Modelo de um processo novo — a mesma estrutura em todos, para a formação. */
const TEMPLATE = `## Objetivo


## Passos
1.

## Parar e avisar
-

## Erros comuns
-

## Checklist de validação
- [ ] `;

const AREA_TABS: Record<"comercial" | "operacional", { id: ProcessoArea; label: string }[]> = {
  comercial: [{ id: "comercial", label: "Comercial" }],
  operacional: [
    { id: "servico_mensal", label: "Serviço mensal" },
    { id: "consultorias", label: "Consultorias" },
  ],
};

const fieldClass = "text-sm px-3 py-2 rounded-md border bg-background w-full focus:outline-none focus:ring-2 focus:ring-ring";

interface Props {
  section: "comercial" | "operacional";
}

const ProcessosView = ({ section }: Props) => {
  const { isAdmin, user } = useAuth();
  const { data: processos = [], isLoading } = useProcessos();
  const save = useSaveProcesso();
  const remove = useDeleteProcesso();

  const tabs = AREA_TABS[section];
  const [area, setArea] = useState<ProcessoArea>(tabs[0].id);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProcessoInput | null>(null);
  const [showToconline, setShowToconline] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Mudar de secção no menu repõe o separador
  useEffect(() => { setArea(AREA_TABS[section][0].id); setDraft(null); setSelectedId(null); }, [section]);

  const inArea = useMemo(() => processos.filter((p) => p.area === area), [processos, area]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return inArea;
    return inArea.filter((p) => [p.title, p.grupo, p.body, p.aplica_se, p.frequencia].some((v) => (v || "").toLowerCase().includes(q)));
  }, [inArea, search]);

  const groups = useMemo(() => {
    const map = new Map<string, Processo[]>();
    filtered.forEach((p) => map.set(p.grupo, [...(map.get(p.grupo) || []), p]));
    return Array.from(map.entries());
  }, [filtered]);

  const selected = filtered.find((p) => p.id === selectedId) ?? filtered[0] ?? null;
  useEffect(() => setShowToconline(false), [selected?.id]);

  const toconlineDoc = selected?.toconline_doc ? TOCONLINE_DOCS.find((d) => d.path === selected.toconline_doc) : null;
  const porPreencher = (p: Processo) => p.body.includes("Por preencher");

  const startNew = () => {
    const lastGroup = groups.length ? groups[groups.length - 1][0] : "Geral";
    const maxPos = inArea.reduce((m, p) => Math.max(m, p.position), 0);
    setDraft({ area, grupo: lastGroup, title: "", frequencia: "", aplica_se: "", toconline_doc: null, body: TEMPLATE, position: maxPos + 10 });
  };

  const startEdit = (p: Processo) => {
    const { updated_at: _u, ...rest } = p;
    setDraft(rest);
  };

  const submit = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.grupo.trim()) {
      toast.error("Indique o título e o grupo do processo.");
      return;
    }
    try {
      const saved = await save.mutateAsync({
        ...draft,
        title: draft.title.trim(),
        grupo: draft.grupo.trim(),
        frequencia: draft.frequencia?.trim() || null,
        aplica_se: draft.aplica_se?.trim() || null,
        toconline_doc: draft.toconline_doc || null,
        updated_by: user?.id ?? null,
      });
      setSelectedId(saved.id);
      setDraft(null);
      toast.success("Processo guardado");
    } catch (e: any) {
      toast.error("Erro ao guardar o processo: " + e.message);
    }
  };

  const doDelete = async () => {
    if (!selected) return;
    try {
      await remove.mutateAsync(selected.id);
      setSelectedId(null);
      toast.success("Processo eliminado");
    } catch (e: any) {
      toast.error("Erro ao eliminar: " + e.message);
    } finally {
      setConfirmDelete(false);
    }
  };

  const existingGroups = Array.from(new Set(inArea.map((p) => p.grupo)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">Processos — {section === "comercial" ? "Comercial" : "Operacional"}</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Manual de formação: o que se faz, quando, como e o que validar em cada processo.
          </p>
        </div>
        {isAdmin && !draft && (
          <Button size="sm" onClick={startNew}><Plus className="w-4 h-4 mr-1" /> Novo processo</Button>
        )}
      </div>

      {tabs.length > 1 && (
        <div className="flex gap-1 border-b">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setArea(t.id); setSelectedId(null); setDraft(null); }}
              className={cn("px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors",
                area === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
              {t.label} <span className="opacity-70">({processos.filter((p) => p.area === t.id).length})</span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Índice */}
        <aside className="space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pesquisar processo…" className="pl-9" />
          </div>
          {isLoading && <p className="text-sm text-muted-foreground">A carregar…</p>}
          {!isLoading && groups.length === 0 && <p className="text-sm text-muted-foreground">Sem processos.</p>}
          {groups.map(([grupo, items]) => (
            <div key={grupo} className="bg-card rounded-xl border p-2">
              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{grupo}</div>
              {items.map((p) => (
                <button key={p.id} onClick={() => { setSelectedId(p.id); setDraft(null); }}
                  className={cn("w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center justify-between gap-2 transition-colors",
                    selected?.id === p.id && !draft ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted")}>
                  <span className="truncate">{p.title}</span>
                  {porPreencher(p) && <span className="text-[10px] px-1.5 rounded bg-warning/20 text-warning-foreground shrink-0">rascunho</span>}
                </button>
              ))}
            </div>
          ))}
        </aside>

        {/* Conteúdo / edição */}
        <section>
          {draft ? (
            <div className="bg-card rounded-xl border p-6 space-y-4">
              <h3 className="text-lg font-semibold">{draft.id ? "Editar processo" : "Novo processo"}</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Título</span>
                  <input className={fieldClass} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Grupo</span>
                  <input className={fieldClass} list="processos-grupos" value={draft.grupo} onChange={(e) => setDraft({ ...draft, grupo: e.target.value })} />
                  <datalist id="processos-grupos">{existingGroups.map((g) => <option key={g} value={g} />)}</datalist>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Quando / prazo</span>
                  <input className={fieldClass} value={draft.frequencia ?? ""} onChange={(e) => setDraft({ ...draft, frequencia: e.target.value })} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Aplica-se a</span>
                  <input className={fieldClass} value={draft.aplica_se ?? ""} onChange={(e) => setDraft({ ...draft, aplica_se: e.target.value })} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Procedimento TOConline ligado</span>
                  <select className={fieldClass} value={draft.toconline_doc ?? ""} onChange={(e) => setDraft({ ...draft, toconline_doc: e.target.value || null })}>
                    <option value="">Nenhum</option>
                    {TOCONLINE_DOCS.map((d) => <option key={d.path} value={d.path}>{d.regimeLabel}</option>)}
                  </select>
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Ordem</span>
                  <input type="number" className={fieldClass} value={draft.position} onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) || 0 })} />
                </label>
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Conteúdo — ## título, 1. passo, - ponto, - [ ] checklist, **negrito**</span>
                  <Textarea className="font-mono text-xs min-h-[420px]" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} />
                </label>
                <div className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Pré-visualização</span>
                  <div className="rounded-md border p-4 min-h-[420px] space-y-1 bg-background">{renderMarkdown(draft.body)}</div>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
                <Button onClick={submit} disabled={save.isPending}>{save.isPending ? "A guardar…" : "Guardar"}</Button>
              </div>
            </div>
          ) : selected ? (
            <article className="bg-card rounded-xl border p-6 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{selected.grupo}</div>
                  <h3 className="text-xl font-bold mt-0.5">{selected.title}</h3>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(selected)}><Pencil className="w-4 h-4 mr-1" /> Editar</Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmDelete(true)} aria-label="Eliminar processo">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
              {(selected.frequencia || selected.aplica_se) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {selected.frequencia && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                      <Repeat className="w-3.5 h-3.5" /> {selected.frequencia}
                    </span>
                  )}
                  {selected.aplica_se && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                      <Users2 className="w-3.5 h-3.5" /> {selected.aplica_se}
                    </span>
                  )}
                </div>
              )}
              <div className="space-y-1">{renderMarkdown(selected.body)}</div>
              {toconlineDoc && (
                <div className="rounded-lg border">
                  <button onClick={() => setShowToconline((v) => !v)}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium hover:bg-muted rounded-lg">
                    {showToconline ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <BookOpenCheck className="w-4 h-4 text-primary" /> Procedimento TOConline detalhado — {toconlineDoc.regimeLabel}
                  </button>
                  {showToconline && <div className="px-5 pb-5 space-y-1 border-t pt-3">{renderMarkdown(toconlineDoc.content)}</div>}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Atualizado a {new Date(selected.updated_at).toLocaleDateString("pt-PT")}
              </p>
            </article>
          ) : null}
        </section>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar processo?</AlertDialogTitle>
            <AlertDialogDescription>"{selected?.title}" deixa de aparecer no manual. Esta ação não pode ser anulada.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProcessosView;
