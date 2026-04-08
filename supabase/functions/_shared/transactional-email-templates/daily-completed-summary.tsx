import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Contabilista Explica"

interface DailySummaryProps {
  date?: string
  collaborators?: Array<{ name: string; tasks: string[] }>
  totalCompleted?: number
}

const DailyCompletedSummaryEmail = ({ date, collaborators = [], totalCompleted = 0 }: DailySummaryProps) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Resumo diário — {totalCompleted} tarefa{totalCompleted !== 1 ? 's' : ''} concluída{totalCompleted !== 1 ? 's' : ''}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>{SITE_NAME}</Heading>
        </Section>
        <Hr style={hr} />
        <Heading style={h2}>Resumo do dia {date || 'hoje'}</Heading>
        <Text style={text}>
          Foram concluídas <strong>{totalCompleted}</strong> tarefa{totalCompleted !== 1 ? 's' : ''} hoje.
        </Text>
        {collaborators.length === 0 ? (
          <Section style={detailsBox}>
            <Text style={detailRow}>Nenhuma tarefa foi concluída hoje.</Text>
          </Section>
        ) : (
          collaborators.map((collab, i) => (
            <Section key={i} style={collabSection}>
              <Text style={collabName}>👤 {collab.name} ({collab.tasks.length})</Text>
              {collab.tasks.map((task, j) => (
                <Text key={j} style={taskItem}>✓ {task}</Text>
              ))}
            </Section>
          ))
        )}
        <Hr style={hr} />
        <Text style={footer}>Equipa {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DailyCompletedSummaryEmail,
  subject: (data: Record<string, any>) => `Resumo diário — ${data.totalCompleted || 0} tarefas concluídas`,
  displayName: 'Resumo diário de tarefas concluídas',
  previewData: {
    date: '08/04/2026',
    totalCompleted: 5,
    collaborators: [
      { name: 'João Silva', tasks: ['Entrega IVA', 'SAFT - Empresa ABC'] },
      { name: 'Maria Santos', tasks: ['DMR AT', 'Salários', 'Retenção na Fonte'] },
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
const detailRow = { fontSize: '14px', color: '#1e3054', lineHeight: '1.8', margin: '0' }
const collabSection = { backgroundColor: '#f7f5f0', borderRadius: '10px', padding: '12px 20px', margin: '0 0 10px' }
const collabName = { fontSize: '14px', fontWeight: '600', color: '#1e3054', margin: '0 0 4px' }
const taskItem = { fontSize: '13px', color: '#55575d', lineHeight: '1.8', margin: '0', paddingLeft: '8px' }
const hr = { borderColor: '#e5e2dc', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
