import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BookOpenCheck, Briefcase, Building2, ChevronDown, ChevronRight, User, ExternalLink, FolderOpen, Pencil, Plus, Search, Trash2, Users2, Repeat, Video, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useDeleteProcesso, useProcessos, useSaveProcesso, type Processo, type ProcessoArea, type ProcessoInput, type ProcessoRegime } from "@/hooks/useProcessos";
import { renderMarkdown } from "@/lib/markdown";
import { TOCONLINE_DOCS } from "@/lib/toconlineProcedures";
import { isSafeUrl, videoEmbedUrl } from "@/lib/videoEmbed";
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
  comercial: [
    { id: "comercial", label: "Serviço mensal" },
    { id: "consultorias", label: "Consultorias" },
  ],
  operacional: [
    { id: "obrigacoes", label: "Obrigações mensais" },
    { id: "gestao_mensal", label: "Gestão mensal" },
  ],
};

/** Tipos de cliente — as mesmas cores da lista de clientes (SQ azul, TI CO âmbar, TI RS verde). */
const REGIMES: { id: ProcessoRegime; label: string; longLabel: string; icon: typeof User; cls: string }[] = [
  { id: "TI RS", label: "TI RS", longLabel: "Trabalhador independente — Regime simplificado", icon: User,
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { id: "TI CO", label: "TI CO", longLabel: "Trabalhador independente — Contabilidade organizada", icon: Briefcase,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
  { id: "SQ", label: "Empresas", longLabel: "Sociedades", icon: Building2,
    cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
];
const regimeInfo = (id: ProcessoRegime) => REGIMES.find((r) => r.id === id)!;

/** Manual TOConline de cada tipo de cliente: com um tipo escolhido, um processo ligado a um
 * manual de regime mostra o manual desse tipo. */
const REGIME_DOCS: Record<ProcessoRegime, string> = {
  "TI RS": "docs/toconline/ti-rs.md",
  "TI CO": "docs/toconline/ti-co.md",
  SQ: "docs/toconline/empresas.md",
};

const appliesTo = (p: Processo, regime: ProcessoRegime | null) =>
  !regime || !p.regimes?.length || p.regimes.includes(regime);

const RegimeChips = ({ regimes, small }: { regimes: ProcessoRegime[]; small?: boolean }) =>
  !regimes?.length ? (
    <span className={cn("rounded-full bg-muted text-muted-foreground", small ? "text-[10px] px-1.5" : "text-xs px-2.5 py-1")}>Todos os tipos</span>
  ) : (
    <>
      {regimes.map((r) => (
        <span key={r} className={cn("rounded-full font-medium", regimeInfo(r).cls, small ? "text-[10px] px-1.5" : "text-xs px-2.5 py-1")}>
          {regimeInfo(r).label}
        </span>
      ))}
    </>
  );

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
  const [regime, setRegime] = useState<ProcessoRegime | null>(null);

  // Mudar de secção no menu repõe o separador
  useEffect(() => { setArea(AREA_TABS[section][0].id); setRegime(null); setDraft(null); setSelectedId(null); }, [section]);

  const inArea = useMemo(() => processos.filter((p) => p.area === area), [processos, area]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byRegime = inArea.filter((p) => appliesTo(p, regime));
    if (!q) return byRegime;
    return byRegime.filter((p) => [p.title, p.grupo, p.body, p.aplica_se, p.frequencia].some((v) => (v || "").toLowerCase().includes(q)));
  }, [inArea, search, regime]);

  const groups = useMemo(() => {
    const map = new Map<string, Processo[]>();
    filtered.forEach((p) => map.set(p.grupo, [...(map.get(p.grupo) || []), p]));
    return Array.from(map.entries());
  }, [filtered]);

  const selected = filtered.find((p) => p.id === selectedId) ?? filtered[0] ?? null;
  useEffect(() => setShowToconline(false), [selected?.id]);

  const docPath = selected?.toconline_doc && regime && Object.values(REGIME_DOCS).includes(selected.toconline_doc)
    ? REGIME_DOCS[regime]
    : selected?.toconline_doc;
  const toconlineDoc = docPath ? TOCONLINE_DOCS.find((d) => d.path === docPath) : null;
  const porPreencher = (p: Processo) => p.body.includes("Por preencher");

  const startNew = () => {
    const lastGroup = groups.length ? groups[groups.length - 1][0] : "Geral";
    const maxPos = inArea.reduce((m, p) => Math.max(m, p.position), 0);
    setDraft({ area, grupo: lastGroup, title: "", frequencia: "", aplica_se: "", toconline_doc: null, regimes: regime ? [regime] : [], body: TEMPLATE, video_url: null, links: [], position: maxPos + 10 });
  };

  const startEdit = (p: Processo) => {
    const { updated_at: _u, ...rest } = p;
    setDraft({ ...rest, links: Array.isArray(p.links) ? p.links : [], regimes: p.regimes ?? [] });
  };

  const submit = async () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.grupo.trim()) {
      toast.error("Indique o título e o grupo do processo.");
      return;
    }
    const video = draft.video_url?.trim() || null;
    const links = (draft.links || [])
      .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
      .filter((l) => l.url);
    if ((video && !isSafeUrl(video)) || links.some((l) => !isSafeUrl(l.url))) {
      toast.error("As ligações têm de começar por https://");
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
        video_url: video,
        regimes: REGIMES.map((r) => r.id).filter((r) => draft.regimes.includes(r)),
        links: links.map((l) => ({ ...l, label: l.label || "Abrir" })),
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

      <div className="flex flex-col md:flex-row gap-5">
        {/* Separadores laterais */}
        <nav className="md:w-52 shrink-0 flex md:flex-col gap-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setArea(t.id); setRegime(null); setSelectedId(null); setDraft(null); setSearch(""); }}
              className={cn("text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between gap-2",
                area === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted")}>
              <span>{t.label}</span>
              <span className="text-xs opacity-70">{processos.filter((p) => p.area === t.id).length}</span>
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-4">
      {!regime && !draft ? (
        /* Galeria por tipo de cliente */
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Escolha o tipo de cliente.</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {REGIMES.map((r) => {
              const list = inArea.filter((p) => appliesTo(p, r.id));
              const videos = list.filter((p) => p.video_url).length;
              const rascunhos = list.filter(porPreencher).length;
              return (
                <button key={r.id} onClick={() => { setRegime(r.id); setSelectedId(null); }}
                  className="text-left bg-card rounded-xl border p-5 hover:shadow-md hover:border-primary/40 transition-all group">
                  <div className={cn("w-11 h-11 rounded-lg flex items-center justify-center", r.cls)}>
                    <r.icon className="w-5 h-5" />
                  </div>
                  <div className="mt-4 text-lg font-semibold group-hover:text-primary">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.longLabel}</div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full bg-muted">{list.length} processos</span>
                    {videos > 0 && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary">{videos} com vídeo</span>}
                    {rascunhos > 0 && <span className="px-2 py-0.5 rounded-full bg-warning/20 text-warning-foreground">{rascunhos} por preencher</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
      <>
      {regime && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setRegime(null); setDraft(null); setSelectedId(null); }}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Tipos de cliente
          </Button>
          {REGIMES.map((r) => (
            <button key={r.id} onClick={() => { setRegime(r.id); setSelectedId(null); setDraft(null); }}
              className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors",
                regime === r.id ? cn(r.cls, "border-current") : "bg-card text-muted-foreground hover:bg-muted")}>
              {r.label}
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
                  <span className="truncate flex items-center gap-1.5">
                    {p.title}
                    {p.video_url && <Video className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-label="Tem vídeo" />}
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {porPreencher(p) && <span className="text-[10px] px-1.5 rounded bg-warning/20 text-warning-foreground">rascunho</span>}
                  </span>
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
              <div className="space-y-1 text-sm">
                <span className="text-muted-foreground">Tipo de cliente (nenhum marcado = todos)</span>
                <div className="flex flex-wrap gap-2">
                  {REGIMES.map((r) => {
                    const on = draft.regimes.includes(r.id);
                    return (
                      <button key={r.id} type="button" aria-pressed={on}
                        onClick={() => setDraft({ ...draft, regimes: on ? draft.regimes.filter((x) => x !== r.id) : [...draft.regimes, r.id] })}
                        className={cn("px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                          on ? cn(r.cls, "border-current") : "bg-card text-muted-foreground hover:bg-muted")}>
                        {r.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block space-y-1 text-sm">
                <span className="text-muted-foreground">Vídeo da gravação — link partilhado do Google Drive, Loom, YouTube ou "Incorporar" do OneDrive</span>
                <input className={fieldClass} placeholder="https://drive.google.com/file/d/…/view" value={draft.video_url ?? ""}
                  onChange={(e) => setDraft({ ...draft, video_url: e.target.value })} />
              </label>
              <div className="space-y-2 text-sm">
                <span className="text-muted-foreground">Ligações à Drive (pastas, modelos, exemplos)</span>
                {draft.links.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={cn(fieldClass, "sm:max-w-[220px]")} placeholder="Nome (ex.: Pasta do cliente)" value={l.label}
                      onChange={(e) => setDraft({ ...draft, links: draft.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
                    <input className={fieldClass} placeholder="https://…" value={l.url}
                      onChange={(e) => setDraft({ ...draft, links: draft.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
                    <Button type="button" size="icon" variant="ghost" aria-label="Remover ligação"
                      onClick={() => setDraft({ ...draft, links: draft.links.filter((_, j) => j !== i) })}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" size="sm" variant="outline" onClick={() => setDraft({ ...draft, links: [...draft.links, { label: "", url: "" }] })}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar ligação
                </Button>
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
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <RegimeChips regimes={selected.regimes} />
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
              {selected.video_url && (
                videoEmbedUrl(selected.video_url) ? (
                  <div className="rounded-lg overflow-hidden border aspect-video bg-muted">
                    <iframe src={videoEmbedUrl(selected.video_url)!} title={`Vídeo — ${selected.title}`} className="w-full h-full"
                      allow="autoplay; fullscreen" allowFullScreen />
                  </div>
                ) : (
                  <a href={selected.video_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium hover:bg-muted">
                    <Video className="w-4 h-4 text-primary" /> Ver vídeo do processo <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )
              )}
              {selected.links?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selected.links.filter((l) => isSafeUrl(l.url)).map((l, i) => (
                    <a key={i} href={l.url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm hover:bg-muted">
                      <FolderOpen className="w-4 h-4 text-primary" /> {l.label} <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </a>
                  ))}
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

      </>
      )}
        </div>
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
