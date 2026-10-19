import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Contabilista Explica"

interface ConsultoriaFormSubmittedProps {
  nome?: string
  sessao?: string
  dadaPor?: string
  /** Pares pergunta / resposta, pela ordem do formulário */
  respostas?: { pergunta: string; resposta: string }[]
}

const ConsultoriaFormSubmittedEmail = ({ nome, sessao, dadaPor, respostas = [] }: ConsultoriaFormSubmittedProps) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Formulário de consultoria preenchido: {nome || 'Consultoria'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>{SITE_NAME}</Heading>
        </Section>
        <Hr style={hr} />
        <Heading style={h2}>⚡ Formulário de consultoria preenchido</Heading>
        <Text style={text}>
          {nome || 'Um cliente'} respondeu ao formulário de preparação da consultoria
          {sessao ? ` (sessão a ${sessao}${dadaPor ? `, dada por ${dadaPor}` : ''})` : ''}.
        </Text>
        <Section style={detailsBox}>
          {respostas.map((r) => (
            <Text key={r.pergunta} style={detailRow}>
              <strong>{r.pergunta}</strong>
              <br />
              {r.resposta}
            </Text>
          ))}
        </Section>
        <Text style={text}>As respostas ficam na lead de consultoria e na ficha do cliente.</Text>
        <Hr style={hr} />
        <Text style={footer}>Equipa {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ConsultoriaFormSubmittedEmail,
  subject: (data: Record<string, any>) => `Formulário de consultoria preenchido: ${data.nome || 'Consultoria'}`,
  displayName: 'Formulário de consultoria preenchido',
  previewData: {
    nome: 'Maria Martins',
    sessao: '28/10/2026',
    dadaPor: 'Jéssica',
    respostas: [
      { pergunta: 'Qual a atividade ou serviço que vais exercer?', resposta: 'Wedding planner' },
      { pergunta: 'Quais as tuas principais dúvidas?', resposta: 'Qual o CAE adequado e obrigações fiscais' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'DM Sans', Arial, sans-serif" }
const container = { padding: '20px 30px', maxWidth: '560px', margin: '0 auto' }
const headerSection = { padding: '10px 0' }
const h1 = { fontSize: '20px', fontWeight: '700', color: '#1e3054', margin: '0' }
const h2 = { fontSize: '18px', fontWeight: '600', color: '#1e3054', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const detailsBox = { backgroundColor: '#f7f5f0', borderRadius: '10px', padding: '16px 20px', margin: '0 0 20px' }
const detailRow = { fontSize: '14px', color: '#1e3054', lineHeight: '1.6', margin: '0 0 12px', whiteSpace: 'pre-wrap' as const }
const hr = { borderColor: '#e5e2dc', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
