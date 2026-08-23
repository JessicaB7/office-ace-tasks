import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Copy, Check, Search, MessageSquareQuote, Pencil, Trash2, Plus, RotateCcw, GripVertical } from "lucide-react";
import { toast } from "sonner";

type Category = "diagnostico" | "consultoria" | "infoprodutos";

type Script = { id: string; title: string; tag: string; category: Category; body: string; group?: string };

const CATEGORIES: { id: Category; label: string }[] = [
  { id: "diagnostico", label: "Sessão de diagnóstico" },
  { id: "consultoria", label: "Consultoria" },
  { id: "infoprodutos", label: "Infoprodutos" },
];

const DEFAULT_SCRIPTS: Script[] = [
  {
    id: "primeiro-contacto",
    title: "Primeiro contacto (telefone)",
    tag: "Prospeção",
    category: "diagnostico",
    body: `Olá {{nome}}, bom dia. Fala {{colaborador}} da Contabilista Explica.
Estou a ligar porque trabalhamos com {{tipo de cliente}} e ajudamos a manter a contabilidade em dia e sem surpresas com o fisco.
Faz sentido marcarmos 15 minutos para eu perceber a sua situação e dizer-lhe com clareza o que precisa e quanto custa?`,
  },
  {
    id: "agendar-reuniao",
    title: "Agendar sessão de diagnóstico",
    tag: "Prospeção",
    category: "diagnostico",
    body: `Perfeito, {{nome}}. Proponho {{data}} às {{hora}}, por videochamada, cerca de 20 minutos.
Antes da reunião só preciso de saber: atividade que exerce, faturação anual estimada e se já tem contabilista.
Envio-lhe o convite por email para {{email}}. Confirma?`,
  },
  {
    id: "reuniao-diagnostico",
    title: "Guião da sessão de diagnóstico",
    tag: "Reunião",
    category: "diagnostico",
    body: `1. Contexto: o que faz, desde quando, como fatura.
2. Números: faturação prevista, despesas, clientes no estrangeiro.
3. Situação atual: regime (simplificado/organizado), IVA, retenções, Segurança Social.
4. Dores: o que corre mal hoje, o que gostaria de delegar.
5. Proposta de valor: o que fazemos, prazos, comunicação, acesso ao dashboard.
6. Próximo passo: envio de proposta até {{prazo}} e follow-up em 3 dias.`,
  },
  {
    id: "apresentar-proposta",
    title: "Apresentar proposta",
    tag: "Proposta",
    category: "diagnostico",
    body: `{{nome}}, conforme falámos, a proposta é {{valor}} € por mês e inclui:
- Contabilidade e obrigações fiscais (IVA, IRS/IRC, Segurança Social);
- Emissão/validação de faturas e apoio no software de faturação;
- Acompanhamento mensal com análise de faturação, despesas e impostos previstos;
- Resposta a dúvidas por email/telefone em 24h úteis.
Inicio previsto: {{data}}. Fico à disposição para ajustar o âmbito.`,
  },
  {
    id: "objecao-preco",
    title: "Objeção: “é caro”",
    tag: "Objeções",
    category: "diagnostico",
    body: `Compreendo, {{nome}}. O preço reflete o acompanhamento e não só o envio de declarações.
O que costuma sair mais caro é uma coima, um IVA mal apurado ou perder deduções.
Se preferir, começamos com o âmbito essencial a {{valor}} € e revemos daqui a 3 meses com números reais na mão. Faz sentido?`,
  },
  {
    id: "objecao-tenho-contabilista",
    title: "Objeção: “já tenho contabilista”",
    tag: "Objeções",
    category: "diagnostico",
    body: `Ótimo sinal, {{nome}}. Não estou a pedir para mudar hoje.
Só duas perguntas: sabe quanto vai pagar de impostos este ano? E recebe informação mensal sobre o seu negócio?
Se a resposta for “não”, vale a pena falarmos — é exatamente aí que somos diferentes.`,
  },
  {
    id: "objecao-vou-pensar",
    title: "Objeção: “vou pensar”",
    tag: "Objeções",
    category: "diagnostico",
    body: `Claro, {{nome}}. Para o ajudar a decidir: há alguma parte da proposta que não ficou clara ou que precisa de ajustar?
Fico a aguardar até {{data}} e, se preferir, ligo-lhe nesse dia para fecharmos ou arquivarmos sem compromisso.`,
  },
  {
    id: "followup-3dias",
    title: "Follow-up 3 dias após a sessão",
    tag: "Follow up",
    category: "diagnostico",
    body: `Olá {{nome}}, tudo bem?
Passo só para saber se teve oportunidade de ver a proposta que enviei e se ficou alguma dúvida.
Se quiser, avançamos com o início em {{data}} — precisamos apenas dos acessos e da senha das Finanças.`,
  },
  {
    id: "followup-ultimo",
    title: "Follow-up final (encerrar)",
    tag: "Follow up",
    category: "diagnostico",
    body: `Olá {{nome}}, não quero ser insistente.
Vou arquivar o processo por agora. Se voltar a fazer sentido, fale comigo e retomamos onde ficámos.
Deixo o meu contacto: {{contacto}}. Boa continuação.`,
  },
  {
    id: "ganho-onboarding",
    title: "Lead ganha: arranque",
    tag: "Onboarding",
    category: "diagnostico",
    body: `Bem-vindo/a, {{nome}}! Para arrancarmos precisamos de:
1. Senha do Portal das Finanças (e NISS/senha da Segurança Social, se aplicável);
2. Acessos ao programa de faturação;
3. Documentos dos últimos {{período}} meses.
Depois disso enviamos o calendário de obrigações e o contacto do responsável: {{colaborador}}.`,
  },
  {
    id: "consultoria-enquadramento",
    title: "Enquadrar pedido de consultoria",
    tag: "Consultoria",
    category: "consultoria",
    body: `Olá {{nome}}. Antes de avançarmos, ajude-me a perceber o objetivo da consultoria:
1. Que decisão precisa de tomar? (abrir atividade, mudar de regime, contratar, investir…)
2. Qual o prazo?
3. Que informação já tem disponível (faturação, contratos, simulações)?
Com isso preparo uma sessão de {{duração}} e um plano de ação escrito.`,
  },
  {
    id: "consultoria-proposta",
    title: "Proposta de consultoria",
    tag: "Consultoria",
    category: "consultoria",
    body: `{{nome}}, proponho uma consultoria de {{duração}} por {{valor}} €, que inclui:
- Análise prévia da informação enviada;
- Sessão de trabalho com cenários e números;
- Relatório final com recomendações e passos concretos;
- {{dias}} dias de esclarecimento de dúvidas por email.
Se avançarmos, agendamos para {{data}}.`,
  },
  {
    id: "consultoria-followup",
    title: "Follow-up pós-consultoria",
    tag: "Consultoria",
    category: "consultoria",
    body: `Olá {{nome}}, como correu a implementação do que definimos na consultoria?
Se ficou alguma dúvida sobre {{tema}}, posso esclarecer.
Se preferir acompanhamento contínuo, tenho o plano {{plano}} a {{valor}} €/mês.`,
  },
  {
    id: "infoproduto-lancamento",
    title: "Lançamento de infoproduto",
    tag: "Infoprodutos",
    category: "infoprodutos",
    group: "Geral",
    body: `Abriram as inscrições para {{produto}}.
Para quem: {{público}}.
O que resolve: {{problema}}.
Inclui: {{módulos}}, modelos prontos a usar e sessões de perguntas e respostas.
Investimento: {{valor}} €. Inscrições até {{data}}: {{link}}`,
  },
  {
    id: "infoproduto-email-carrinho",
    title: "Email de fecho de inscrições",
    tag: "Infoprodutos",
    category: "infoprodutos",
    group: "Geral",
    body: `{{nome}}, as inscrições em {{produto}} fecham {{data}} às {{hora}}.
Se ainda está em dúvida, responda a este email com a sua pergunta — respondo hoje.
Entrar agora: {{link}}`,
  },
  {
    id: "infoproduto-upsell",
    title: "Upsell para consultoria",
    tag: "Infoprodutos",
    category: "infoprodutos",
    group: "Geral",
    body: `{{nome}}, terminou {{produto}} — parabéns.
Se quiser aplicar isto ao seu caso concreto, tenho uma consultoria individual de {{duração}} a {{valor}} €, com desconto de aluno.
Quer que reserve uma vaga em {{data}}?`,
  },
];

const STORAGE_KEY = "comercial_scripts_v1";

const ScriptsView = () => {
  const [scripts, setScripts] = useState<Script[]>(DEFAULT_SCRIPTS);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ title: string; tag: string; body: string; group: string }>({ title: "", tag: "", body: "", group: "" });
  const [tab, setTab] = useState<Category>("diagnostico");
  const [infoGroup, setInfoGroup] = useState<string>("__all__");
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) setScripts(parsed);
      }
    } catch {
      /* ignora */
    }
  }, []);

  const persist = (next: Script[]) => {
    setScripts(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignora */
    }
  };

  const q = search.trim().toLowerCase();

  const infoGroups = useMemo(() => {
    const set = new Set<string>();
    scripts.filter((s) => s.category === "infoprodutos").forEach((s) => set.add((s.group || "Geral").trim()));
    return Array.from(set);
  }, [scripts]);

  const visible = useMemo(
    () =>
      scripts.filter(
        (s) =>
          s.category === tab &&
          (tab !== "infoprodutos" || infoGroup === "__all__" || (s.group || "Geral").trim() === infoGroup) &&
          (!q || s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q) || s.tag.toLowerCase().includes(q))
      ),
    [scripts, tab, q, infoGroup]
  );

  const addInfoGroup = () => {
    const name = prompt("Nome do infoproduto:")?.trim();
    if (!name) return;
    const s: Script = {
      id: `novo-${Date.now()}`,
      title: "Novo script",
      tag: "Infoprodutos",
      category: "infoprodutos",
      group: name,
      body: "Escreve aqui o teu guião…",
    };
    persist([...scripts, s]);
    setInfoGroup(name);
    startEdit(s);
  };

  const renameInfoGroup = (name: string) => {
    const next = prompt("Novo nome do infoproduto:", name)?.trim();
    if (!next || next === name) return;
    persist(scripts.map((s) => (s.category === "infoprodutos" && (s.group || "Geral").trim() === name ? { ...s, group: next } : s)));
    setInfoGroup(next);
  };

  const removeInfoGroup = (name: string) => {
    if (!confirm(`Eliminar o infoproduto "${name}" e todos os seus scripts?`)) return;
    persist(scripts.filter((s) => !(s.category === "infoprodutos" && (s.group || "Geral").trim() === name)));
    setInfoGroup("__all__");
  };


  const copy = async (s: Script) => {
    try {
      await navigator.clipboard.writeText(s.body);
      setCopied(s.id);
      toast.success("Script copiado.");
      setTimeout(() => setCopied((c) => (c === s.id ? null : c)), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  const startEdit = (s: Script) => {
    setEditingId(s.id);
    setDraft({ title: s.title, tag: s.tag, body: s.body, group: s.group || "Geral" });
  };

  const saveEdit = () => {
    if (!draft.title.trim() || !draft.body.trim()) {
      toast.error("Preenche o título e o texto do script.");
      return;
    }
    persist(
      scripts.map((s) =>
        s.id === editingId ? { ...s, title: draft.title.trim(), tag: draft.tag.trim() || "Geral", body: draft.body } : s
      )
    );
    setEditingId(null);
    toast.success("Script guardado.");
  };

  const addScript = () => {
    const s: Script = {
      id: `novo-${Date.now()}`,
      title: "Novo script",
      tag: "Geral",
      category: tab,
      body: "Escreve aqui o teu guião…",
    };
    persist([...scripts, s]);
    startEdit(s);
  };

  const removeScript = (s: Script) => {
    if (!confirm(`Eliminar o script "${s.title}"?`)) return;
    persist(scripts.filter((x) => x.id !== s.id));
    toast.success("Script eliminado.");
  };

  const resetAll = () => {
    if (!confirm("Repor todos os scripts originais? As edições serão perdidas.")) return;
    persist(DEFAULT_SCRIPTS);
    setEditingId(null);
    toast.success("Scripts repostos.");
  };

  const handleDrop = (targetId: string) => {
    const sourceId = dragId;
    setDragId(null);
    setOverId(null);
    if (!sourceId || sourceId === targetId) return;
    const from = scripts.findIndex((s) => s.id === sourceId);
    const to = scripts.findIndex((s) => s.id === targetId);
    if (from < 0 || to < 0) return;
    const next = [...scripts];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    persist(next);
  };



  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Scripts</h1>
          <p className="text-sm text-muted-foreground">
            Guiões editáveis por área. Substitui os campos entre chaves.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetAll}>
            <RotateCcw className="w-4 h-4 mr-2" /> Repor originais
          </Button>
          <Button onClick={addScript}>
            <Plus className="w-4 h-4 mr-2" /> Novo script
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Category)}>
        <TabsList>
          {CATEGORIES.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>
              {c.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {CATEGORIES.map((c) => (
          <TabsContent key={c.id} value={c.id} className="space-y-4 mt-4">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Procurar script…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {visible.map((s) => (
                <Card
                  key={s.id}
                  onDragOver={(e) => {
                    if (!dragId) return;
                    e.preventDefault();
                    setOverId(s.id);
                  }}
                  onDragLeave={() => setOverId((o) => (o === s.id ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleDrop(s.id);
                  }}
                  className={`flex flex-col transition-all ${dragId === s.id ? "opacity-50" : ""} ${
                    overId === s.id && dragId !== s.id ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", s.id);
                            setDragId(s.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverId(null);
                          }}
                          title="Arrastar para reordenar"
                          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                        >
                          <GripVertical className="w-4 h-4" />
                        </span>
                        <MessageSquareQuote className="w-4 h-4 text-primary" />
                        {editingId === s.id ? "A editar" : s.title}
                      </CardTitle>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 shrink-0">
                        {s.tag}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="flex flex-col gap-3 flex-1">
                    {editingId === s.id ? (
                      <>
                        <Input
                          value={draft.title}
                          placeholder="Título"
                          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                        />
                        <Input
                          value={draft.tag}
                          placeholder="Etiqueta"
                          onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))}
                        />
                        <Textarea
                          rows={10}
                          value={draft.body}
                          onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                        />
                        <div className="flex gap-2">
                          <Button size="sm" onClick={saveEdit}>
                            Guardar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-sm whitespace-pre-line text-muted-foreground flex-1">{s.body}</p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => copy(s)}>
                            {copied === s.id ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                            {copied === s.id ? "Copiado" : "Copiar"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => startEdit(s)}>
                            <Pencil className="w-4 h-4 mr-2" /> Editar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeScript(s)}>
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
              {visible.length === 0 && (
                <p className="text-sm text-muted-foreground">Sem scripts nesta área.</p>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};

export default ScriptsView;
