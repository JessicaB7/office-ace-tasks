import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link,
} from 'npm:@react-email/components@0.0.22'

const SITE_NAME = "Contabilista Explica"
const APP = 'https://gestao.contabilistaexplica.pt'

interface Grupo { cliente: string; itens: string[] }
interface Colaborador {
  nome: string
  tarefas: { titulo: string; cliente?: string }[]
  gestaoMensal: Grupo[]
  obrigacoes: Grupo[]
  contactos: { cliente: string; tipo: string }[]
  emAtraso: { titulo: string; cliente?: string; prazo: string; hoje: boolean }[]
  totalEmAtraso: number
  totalFeito: number
}
interface DailySummaryProps {
  nome?: string
  date?: string
  colaboradores?: Colaborador[]
  totais?: { tarefas: number; gestaoMensal: number; obrigacoes: number; contactos: number; emAtraso: number }
}

// Sem import do registry: este template é renderizado diretamente pelo send-daily-summary.

const plural = (n: number, s: string, p: string) => `${n} ${n === 1 ? s : p}`

const resumoLinha = (c: Colaborador) => [
  plural(c.tarefas.length, 'tarefa', 'tarefas'),
  plural(c.gestaoMensal.reduce((s, g) => s + g.itens.length, 0), 'célula da gestão mensal', 'células da gestão mensal'),
  plural(c.obrigacoes.reduce((s, g) => s + g.itens.length, 0), 'obrigação', 'obrigações'),
  plural(c.contactos.length, 'contacto', 'contactos'),
].join(' · ')

const Bloco = ({ titulo, children }: { titulo: string; children: React.ReactNode }) => (
  <>
    <Text style={subTitle}>{titulo}</Text>
    {children}
  </>
)

/** Resumo diário da equipa para a admin (dias úteis, 19:00 de Lisboa). */
const DailyCompletedSummaryEmail = ({ nome, date, colaboradores = [], totais }: DailySummaryProps) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Resumo do dia {date || ''} — o que a equipa fez hoje</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>{SITE_NAME}</Heading>
        </Section>
        <Hr style={hr} />
        <Heading style={h2}>{nome ? `Olá, ${nome}.` : 'Olá.'}</Heading>
        <Text style={text}>
          Aqui tens o que cada pessoa registou hoje{date ? ` (${date})` : ''}.
          {totais ? ` No total: ${plural(totais.tarefas, 'tarefa concluída', 'tarefas concluídas')}, ${plural(totais.gestaoMensal, 'célula da gestão mensal', 'células da gestão mensal')}, ${plural(totais.obrigacoes, 'obrigação', 'obrigações')}, ${plural(totais.contactos, 'contacto', 'contactos')}; ${plural(totais.emAtraso, 'tarefa', 'tarefas')} com o prazo ultrapassado.` : ''}
        </Text>
        {colaboradores.map((c, i) => (
          <Section key={i} style={box}>
            <Text style={boxTitle}>{c.nome}</Text>
            {c.totalFeito === 0
              ? <Text style={muted}>Sem registos hoje.</Text>
              : <Text style={meta}>{resumoLinha(c)}</Text>}

            {c.tarefas.length > 0 && (
              <Bloco titulo="Tarefas concluídas">
                {c.tarefas.map((t, j) => <Text key={j} style={row}>• {t.titulo}{t.cliente ? ` — ${t.cliente}` : ''}</Text>)}
              </Bloco>
            )}
            {c.gestaoMensal.length > 0 && (
              <Bloco titulo="Gestão mensal">
                {c.gestaoMensal.map((g, j) => <Text key={j} style={row}>• <strong>{g.cliente}</strong>: {g.itens.join(', ')}</Text>)}
              </Bloco>
            )}
            {c.obrigacoes.length > 0 && (
              <Bloco titulo="Obrigações entregues">
                {c.obrigacoes.map((g, j) => <Text key={j} style={row}>• <strong>{g.cliente}</strong>: {g.itens.join(', ')}</Text>)}
              </Bloco>
            )}
            {c.contactos.length > 0 && (
              <Bloco titulo="Contactos registados">
                {c.contactos.map((k, j) => <Text key={j} style={row}>• {k.cliente} — {k.tipo}</Text>)}
              </Bloco>
            )}
            {c.totalEmAtraso > 0 && (
              <Bloco titulo={`Tarefas com o prazo ultrapassado (${c.totalEmAtraso})`}>
                {c.emAtraso.map((t, j) => (
                  <Text key={j} style={rowLate}>• {t.titulo}{t.cliente ? ` — ${t.cliente}` : ''} · {t.hoje ? 'prazo hoje' : `prazo ${t.prazo}`}</Text>
                ))}
                {c.totalEmAtraso > c.emAtraso.length && (
                  <Text style={muted}>… e mais {c.totalEmAtraso - c.emAtraso.length}.</Text>
                )}
              </Bloco>
            )}
          </Section>
        ))}
        <Text style={text}><Link href={`${APP}/?view=tasks`} style={link}>Abrir a app</Link></Text>
        <Hr style={hr} />
        <Text style={footer}>{SITE_NAME} · resumo automático dos dias úteis</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DailyCompletedSummaryEmail,
  subject: (data: Record<string, any>) => `Resumo do dia ${data.date || ''} — equipa`.trim(),
  displayName: 'Resumo diário da equipa',
  previewData: {
    nome: 'Jéssica',
    date: '12/11/2026',
    totais: { tarefas: 2, gestaoMensal: 3, obrigacoes: 1, contactos: 1, emAtraso: 2 },
    colaboradores: [
      {
        nome: 'Ana Fardilha', totalFeito: 0, totalEmAtraso: 0,
        tarefas: [], gestaoMensal: [], obrigacoes: [], contactos: [], emAtraso: [],
      },
      {
        nome: 'Soraia Almeida', totalFeito: 7, totalEmAtraso: 2,
        tarefas: [{ titulo: 'Enviar declaração de IRS', cliente: 'Cliente Exemplo' }, { titulo: 'Rever extratos' }],
        gestaoMensal: [{ cliente: 'Cliente Exemplo', itens: ['Compras (TI Reg. IVA) out.', 'Vendas (TI Reg. IVA) out.', 'IVA (TI Reg. IVA) out.'] }],
        obrigacoes: [{ cliente: 'Empresa Exemplo', itens: ['SAFT out.'] }],
        contactos: [{ cliente: 'Cliente Exemplo', tipo: 'Chamada' }],
        emAtraso: [{ titulo: 'Pedir faturas', cliente: 'Cliente Exemplo', prazo: '10/11', hoje: false }, { titulo: 'Fechar mês', prazo: '12/11', hoje: true }],
      },
    ],
  },
}

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '20px 30px', maxWidth: '600px', margin: '0 auto' }
const headerSection = { padding: '10px 0' }
const h1 = { fontSize: '20px', fontWeight: '700', color: '#1e3054', margin: '0' }
const h2 = { fontSize: '18px', fontWeight: '600', color: '#1e3054', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const box = { backgroundColor: '#f7f5f0', borderRadius: '10px', padding: '12px 18px', margin: '0 0 14px' }
const boxTitle = { fontSize: '15px', fontWeight: '700', color: '#ab5a3c', margin: '0 0 2px' }
const meta = { fontSize: '12px', color: '#55575d', margin: '0 0 6px' }
const subTitle = { fontSize: '13px', fontWeight: '600', color: '#1e3054', margin: '8px 0 2px' }
const row = { fontSize: '13px', color: '#1e3054', lineHeight: '1.6', margin: '0', paddingLeft: '6px' }
const rowLate = { fontSize: '13px', color: '#8a3b22', lineHeight: '1.6', margin: '0', paddingLeft: '6px' }
const muted = { fontSize: '13px', color: '#888888', margin: '0' }
const link = { color: '#ab5a3c', fontSize: '13px', fontWeight: '500' }
const hr = { borderColor: '#e5e2dc', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
