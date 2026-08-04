import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Copy, Check, Search, MessageSquareQuote } from "lucide-react";
import { toast } from "sonner";

type Script = { id: string; title: string; tag: string; body: string };

const SCRIPTS: Script[] = [
  {
    id: "primeiro-contacto",
    title: "Primeiro contacto (telefone)",
    tag: "Prospeção",
    body: `Olá {{nome}}, bom dia. Fala {{colaborador}} da Contabilista Explica.
Estou a ligar porque trabalhamos com {{tipo de cliente}} e ajudamos a manter a contabilidade em dia e sem surpresas com o fisco.
Faz sentido marcarmos 15 minutos para eu perceber a sua situação e dizer-lhe com clareza o que precisa e quanto custa?`,
  },
  {
    id: "agendar-reuniao",
    title: "Agendar reunião",
    tag: "Prospeção",
    body: `Perfeito, {{nome}}. Proponho {{data}} às {{hora}}, por videochamada, cerca de 20 minutos.
Antes da reunião só preciso de saber: atividade que exerce, faturação anual estimada e se já tem contabilista.
Envio-lhe o convite por email para {{email}}. Confirma?`,
  },
  {
    id: "reuniao-diagnostico",
    title: "Reunião de diagnóstico",
    tag: "Reunião",
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
    body: `Compreendo, {{nome}}. O preço reflete o acompanhamento e não só o envio de declarações.
O que costuma sair mais caro é uma coima, um IVA mal apurado ou perder deduções.
Se preferir, começamos com o âmbito essencial a {{valor}} € e revemos daqui a 3 meses com números reais na mão. Faz sentido?`,
  },
  {
    id: "objecao-tenho-contabilista",
    title: "Objeção: “já tenho contabilista”",
    tag: "Objeções",
    body: `Ótimo sinal, {{nome}}. Não estou a pedir para mudar hoje.
Só duas perguntas: sabe quanto vai pagar de impostos este ano? E recebe informação mensal sobre o seu negócio?
Se a resposta for “não”, vale a pena falarmos — é exatamente aí que somos diferentes.`,
  },
  {
    id: "objecao-vou-pensar",
    title: "Objeção: “vou pensar”",
    tag: "Objeções",
    body: `Claro, {{nome}}. Para o ajudar a decidir: há alguma parte da proposta que não ficou clara ou que precisa de ajustar?
Fico a aguardar até {{data}} e, se preferir, ligo-lhe nesse dia para fecharmos ou arquivarmos sem compromisso.`,
  },
  {
    id: "followup-3dias",
    title: "Follow-up 3 dias após reunião",
    tag: "Follow up",
    body: `Olá {{nome}}, tudo bem?
Passo só para saber se teve oportunidade de ver a proposta que enviei e se ficou alguma dúvida.
Se quiser, avançamos com o início em {{data}} — precisamos apenas dos acessos e da senha das Finanças.`,
  },
  {
    id: "followup-ultimo",
    title: "Follow-up final (encerrar)",
    tag: "Follow up",
    body: `Olá {{nome}}, não quero ser insistente.
Vou arquivar o processo por agora. Se voltar a fazer sentido, fale comigo e retomamos onde ficámos.
Deixo o meu contacto: {{contacto}}. Boa continuação.`,
  },
  {
    id: "ganho-onboarding",
    title: "Lead ganha: arranque",
    tag: "Onboarding",
    body: `Bem-vindo/a, {{nome}}! Para arrancarmos precisamos de:
1. Senha do Portal das Finanças (e NISS/senha da Segurança Social, se aplicável);
2. Acessos ao programa de faturação;
3. Documentos dos últimos {{período}} meses.
Depois disso enviamos o calendário de obrigações e o contacto do responsável: {{colaborador}}.`,
  },
];

const ScriptsView = () => {
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const filtered = SCRIPTS.filter(
    (s) => !q || s.title.toLowerCase().includes(q) || s.body.toLowerCase().includes(q) || s.tag.toLowerCase().includes(q)
  );

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scripts</h1>
        <p className="text-sm text-muted-foreground">
          Guiões para chamadas, reuniões, objeções e follow-ups. Substitui os campos entre chaves.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9" placeholder="Procurar script…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {filtered.map((s) => (
          <Card key={s.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquareQuote className="w-4 h-4 text-primary" />
                  {s.title}
                </CardTitle>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 shrink-0">
                  {s.tag}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 flex-1">
              <p className="text-sm whitespace-pre-line text-muted-foreground flex-1">{s.body}</p>
              <Button size="sm" variant="outline" className="self-start" onClick={() => copy(s)}>
                {copied === s.id ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied === s.id ? "Copiado" : "Copiar"}
              </Button>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground">Sem scripts para esta procura.</p>}
      </div>
    </div>
  );
};

export default ScriptsView;
