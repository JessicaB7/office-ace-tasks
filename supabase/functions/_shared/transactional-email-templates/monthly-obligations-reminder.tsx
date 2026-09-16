import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Contabilista Explica"

interface MonthlyObligationsProps {
  collaboratorName?: string
  items?: Array<{ clientName: string; regime: string }>
  daysLeft?: number
}

const MonthlyObligationsReminderEmail = ({ collaboratorName, items = [], daysLeft }: MonthlyObligationsProps) => (
  <Html lang="pt" dir="ltr">
    <Head />
    <Preview>{items.length} cliente{items.length !== 1 ? 's' : ''} por concluir — fim do mês próximo</Preview>
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
          O fim do mês está a aproximar-se{daysLeft != null ? ` (faltam ${daysLeft} dia${daysLeft !== 1 ? 's' : ''})` : ''} e ainda tem
          contabilidades por concluir para os seguintes clientes:
        </Text>
        <Section style={detailsBox}>
          {items.map((item, i) => (
            <Text key={i} style={taskRow}>
              • <strong>{item.clientName}</strong> — {item.regime}
            </Text>
          ))}
        </Section>
        <Text style={text}>
          Total: <strong>{items.length}</strong> cliente{items.length !== 1 ? 's' : ''} por concluir.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>Equipa {SITE_NAME}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: MonthlyObligationsReminderEmail,
  subject: (data: Record<string, any>) => `${(data.items || []).length} cliente(s) por concluir — fim do mês próximo`,
  displayName: 'Lembrete de obrigações mensais',
  previewData: {
    collaboratorName: 'João Silva',
    daysLeft: 2,
    items: [
      { clientName: 'Empresa ABC', regime: 'TI Contabilidade Organizada' },
      { clientName: 'Empresa XYZ', regime: 'Empresas' },
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
const taskRow = { fontSize: '13px', color: '#1e3054', lineHeight: '2', margin: '0' }
const hr = { borderColor: '#e5e2dc', margin: '20px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '0' }
