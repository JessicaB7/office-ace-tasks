## Plano: ContaTask - Sistema Completo

### Fase 1: Backend (Lovable Cloud + Supabase)
1. **Ativar Lovable Cloud** — provisionar BD, auth e storage
2. **Arquitetura de segurança** — desenhar RLS, tabelas e políticas
3. **Tabelas principais:**
   - `clients` — NIF, nome, regime fiscal (simplificado/organizado/isento), contactos, morada
   - `collaborators` — nome, email, cargo, especialidade
   - `tasks` — título, descrição, prazo, estado, prioridade, categoria fiscal, FK para client e collaborator
   - `fiscal_deadlines` — prazos legais recorrentes por regime/categoria

### Fase 2: UI - Gestão de Clientes
- Lista de clientes com pesquisa, filtros por regime e paginação
- Ficha de cliente com dados fiscais e histórico de tarefas
- Formulário de criação/edição de cliente

### Fase 3: UI - Gestão de Colaboradores
- Lista de colaboradores com carga de trabalho
- Distribuição de tarefas por colaborador
- Vista de capacidade

### Fase 4: UI - Calendário Fiscal
- Vista mensal com prazos legais por regime
- Indicadores visuais de urgência
- Prazos automáticos IRS, IRC, IVA, SS

### Fase 5: Refactor
- Migrar tarefas existentes para usar BD real
- Remover mock data
- Adicionar paginação e filtros avançados à lista de tarefas
