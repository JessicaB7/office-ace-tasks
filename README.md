# Contabilista Explica — Gestor de Tarefas e Negócio

Aplicação web interna do gabinete de contabilidade **Contabilista Explica**: clientes, tarefas,
obrigações fiscais, calendário fiscal, extratos bancários, análise financeira por cliente,
pipeline comercial (CRM), consultorias e gestão de colaboradores.

Consulta o `CLAUDE.md` na raiz do repositório para o contexto completo (stack, módulos, regras de
negócio e convenções de código).

## Stack

React 18 + Vite 5 + TypeScript 5 + Tailwind CSS 3 + shadcn/ui, TanStack Query, React Router.
Backend: Supabase (Postgres + RLS, Auth, Edge Functions, Realtime).

## Desenvolvimento

```sh
npm install
npm run dev      # http://localhost:8080
npm run build
npm run lint
npm run test
```

Variáveis de ambiente necessárias em `.env` (ver `.env.example` ou a secção 3 do `CLAUDE.md`):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```

## Deploy

Publicado no **Vercel** (`office-ace-tasks`), com deploy automático a cada push para `main`.
