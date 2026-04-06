import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Contabilista Explica"

interface TaskAssignmentProps {
  collaboratorName?: string
  taskTitle?: string
  clientName?: string
  dueDate?: string
  priority?: string
  category?: string
}

const TaskAssignmentEmail = ({ collaboratorName, taskTitle, clientName, dueDate, priority, category }: TaskAssignmentProps) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>Nova tarefa atribuída: {taskTitle || 'Tarefa'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerSection}>
          <Heading style={h1}>{SITE_NAME}</Heading>
        </Section>
        <Hr style={hr} />
        <Heading style={h2}>
          {collaboratorName ? `Olá, ${collaboratorName}!` : 'Olá!'}
        </Heading>
        <Text style={text}>
          Foi-lhe atribuída uma nova tarefa:
        </Text>
        <Section style={detailsBox}>
          <Text style={detailRow}><strong>Tarefa:</strong> {taskTitle || '—'}</Text>
          {clientName && <Text style={detailRow}><strong>Cliente:</strong> {clientName}</Text>}
          {dueDate && <Text style={detailRow}><strong>Prazo:</strong> {dueDate}</Text>}
          {priority && <Text style={detailRow}><strong>Prioridade:</strong> {priority}</Text>}
          {category && <Text style={detailRow}><strong>Categoria:</strong> {category}</Text>}
        </Section>
        <Text style={text}>
          Por favor, aceda à plataforma para ver os detalhes e iniciar o trabalho.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Equipa {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TaskAssignmentEmail,
  subject: (data: Record<string, any>) => `Nova tarefa atribuída: ${data.taskTitle || 'Tarefa'}`,
  displayName: 'Atribuição de tarefa',
  previewData: {
    collaboratorName: 'João Silva',
    taskTitle: 'Entrega IVA Mensal',
    clientName: 'Empresa ABC, Lda.',
    dueDate: '20/01/2026',
    priority: 'Alta',
    category: 'IVA',
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
const hr = { borderColor: '#e5e2dc', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
