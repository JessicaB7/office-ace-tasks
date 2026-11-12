import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link,
} from 'npm:@react-email/components@0.0.22'

const SITE_NAME = "Contabilista Explica"

interface Secao {
  titulo: string
  link?: string
  linhas?: string[]
  vazio?: string
}

interface WeeklyBusinessReportProps {
  nome?: string
  titulo?: string
  periodo?: string
  secoes?: Secao[]
}

// Sem import do registry: este template também é renderizado diretamente pelo send-weekly-digest.

/** Relatório semanal (admin: escritório completo; colaborador: versão resumida dos seus clientes). */
const WeeklyBusinessReportEmail = ({ nome, titulo, periodo, secoes = [] }: WeeklyBusinessReportProps) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>{titulo || 'Relatório semanal'}{periodo ? ` — ${periodo}` : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>{SITE_NAME}</Heading>
        </Section>
        <Hr style={hr} />
        <Heading style={h2}>{nome ? `Bom dia, ${nome}!` : 'Bom dia!'}</Heading>
        <Text style={text}>{titulo || 'Relatório semanal'}{periodo ? ` (${periodo})` : ''}.</Text>
        {secoes.map((s, i) => (
          <Section key={i} style={box}>
            <Text style={boxTitle}>
              {s.titulo}
              {s.link ? <> · <Link href={s.link} style={link}>abrir na app</Link></> : null}
            </Text>
            {(s.linhas && s.linhas.length > 0)
              ? s.linhas.map((l, j) => <Text key={j} style={row}>• {l}</Text>)
              : <Text style={muted}>{s.vazio || 'Nada a assinalar.'}</Text>}
          </Section>
        ))}
        <Hr style={hr} />
        <Text style={footer}>Equipa {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WeeklyBusinessReportEmail,
  subject: (data: Record<string, any>) => `${data.titulo || 'Relatório semanal'}${data.periodo ? ` — ${data.periodo}` : ''}`,
  displayName: 'Relatório semanal do escritório',
  previewData: {
    nome: 'Jéssica',
    titulo: 'Relatório semanal do escritório',
    periodo: '9–15 nov 2026',
    secoes: [
      { titulo: 'Clientes', link: 'https://gestao.contabilistaexplica.pt/?view=clients', linhas: ['2 novos na última semana', '1 saída em curso', '120 clientes ativos'] },
      { titulo: 'Fecho do mês', linhas: ['🟢 Ana — 95% (40/42)', '🔴 Rui — 60% (30/50) · próximo prazo 20/11'] },
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
const boxTitle = { fontSize: '15px', fontWeight: '700', color: '#ab5a3c', margin: '0 0 6px' }
const row = { fontSize: '13px', color: '#1e3054', lineHeight: '1.7', margin: '0' }
const muted = { fontSize: '13px', color: '#888888', margin: '0' }
const link = { color: '#ab5a3c', fontSize: '12px', fontWeight: '500' }
const hr = { borderColor: '#e5e2dc', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
