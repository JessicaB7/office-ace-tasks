import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Contabilista Explica"

interface DailyTasksProps {
  collaboratorName?: string
  tasks?: Array<{ title: string; clientName?: string; priority: string }>
  dateFormatted?: string
}

const DailyTasksReminderEmail = ({ collaboratorName, tasks = [], dateFormatted }: DailyTasksProps) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Tarefas de hoje — {dateFormatted || 'Hoje'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>{SITE_NAME}</Heading>
        </Section>
        <Hr style={hr} />
        <Heading style={h2}>
          {collaboratorName ? `Bom dia, ${collaboratorName}!` : 'Bom dia!'}
        </Heading>
        <Text style={text}>
          Aqui estão as suas tarefas para hoje{dateFormatted ? ` (${dateFormatted})` : ''}:
        </Text>
        {tasks.length === 0 ? (
          <Section style={detailsBox}>
            <Text style={detailRow}>🎉 Sem tarefas com prazo hoje!</Text>
          </Section>
        ) : (
          <Section style={detailsBox}>
            {tasks.map((task, i) => (
              <Text key={i} style={taskRow}>
                • <strong>{task.title}</strong>
                {task.clientName ? ` — ${task.clientName}` : ''}
                {` | ${task.priority}`}
              </Text>
            ))}
          </Section>
        )}
        <Text style={text}>
          Total: <strong>{tasks.length}</strong> tarefa{tasks.length !== 1 ? 's' : ''} para hoje.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Equipa {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DailyTasksReminderEmail,
  subject: (data: Record<string, any>) => `Tarefas de hoje — ${data.dateFormatted || 'Resumo diário'}`,
  displayName: 'Tarefas do dia',
  previewData: {
    collaboratorName: 'João Silva',
    dateFormatted: '09/09/2026',
    tasks: [
      { title: 'Entrega IVA Mensal', clientName: 'Empresa ABC', priority: 'Alta' },
      { title: 'SAFT', clientName: 'Empresa XYZ', priority: 'Média' },
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
const taskRow = { fontSize: '13px', color: '#1e3054', lineHeight: '2', margin: '0' }
const hr = { borderColor: '#e5e2dc', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
