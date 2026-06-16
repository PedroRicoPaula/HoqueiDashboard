# Gestão HCPDL

Sistema de gestão do **Hóquei Clube Ponta Delgada** — painel web completo para gerir atletas, sócios, mensalidades, materiais, patrocinadores, viagens, direção e treinos.

**URL produção:** https://dashboard.hoqueiclubepdl.com  
**Deploy:** Vercel (automático ao push para `main`)

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript 5 |
| ORM | Prisma 7 + `@prisma/adapter-pg` |
| Base de dados | PostgreSQL (Neon em produção) |
| Auth | JWT via `jose` (HS256, 24h) + PBKDF2 Web Crypto |
| UI | shadcn/ui (new-york, tema verde) + TailwindCSS |
| State | Zustand |
| Validação | Zod v4 |
| Testes | Vitest |
| Storage | Cloudflare R2 (logos de patrocinadores) |

---

## Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | KPIs, gráfico de receitas por fonte, alertas clicáveis (atrasos, contratos) |
| **Atletas** | CRUD completo, filtro por escalão, perfil detalhado com histórico de pagamentos |
| **Mensalidades** | Grelha época × atleta, marcação individual, por coluna inteira, ou em batch |
| **Sócios** | CRUD, QuotaCalendar 12 meses por ano, badge de estado em dia / X em atraso |
| **Materiais** | Inventário com estados FREE / ASSIGNED / DAMAGED, atribuição a atleta |
| **Patrocinadores** | Cards com logo, filtro por estado do contrato, total de contribuição ativo |
| **Viagens** | Planeamento de deslocações com condutores dinâmicos, próximas vs passadas |
| **Direção** | Tabela com cargos múltiplos, total de salários, link para atleta sénior |
| **Treinos** | Lista de treinos + quadro tático digital interativo (drag, frames, playback) |
| **Relatórios** | Export CSV: atletas, sócios (com quotas por mês), mensalidades, materiais |
| **Admin** | Gestão de permissões por utilizador (16 flags RBAC) + audit log completo |

---

## Desenvolvimento Local

### Pré-requisitos
- Node.js 18+
- PostgreSQL local

### Setup
```bash
# Instalar dependências
npm install

# Aplicar migrações e criar admin
npx prisma migrate dev
npx prisma db seed

# Iniciar servidor de desenvolvimento
npm run dev
```

**URL:** http://localhost:3000  
**Login dev:** `admin@hcpdl.pt` / `admin123`

### Variáveis de ambiente (dev)
```env
DATABASE_URL=postgresql://postgres:postgresql123@localhost:5432/hcpdl
JWT_SECRET=hcpdl-local-dev-key-757a3f92b1e04cd8a6f2e3d5c8b91047
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Comandos Úteis

```bash
npm run dev              # servidor dev → localhost:3000
npm run build            # build produção (migrate deploy + prisma generate + next build)
npm test                 # vitest run
npx prisma studio        # GUI da base de dados
npx prisma migrate dev   # nova migration (dev)
npx prisma db seed       # recriar admin
```

---

## Estrutura

```
src/
├── app/
│   ├── (dashboard)/     # Páginas autenticadas (layout com sidebar)
│   ├── api/             # Route handlers (Next.js)
│   ├── login/
│   └── setup/           # Criação do primeiro admin
├── components/
│   ├── ui/              # shadcn/ui
│   ├── layout/          # Sidebar, TopNav
│   └── training/        # Quadro tático
├── lib/                 # Utilitários server-side (auth, prisma, validations…)
├── hooks/               # usePermissions, useDebounce, use-toast
├── store/               # Zustand (auth, tactical, sidebar)
└── middleware.ts        # Edge: CSRF + JWT + RBAC
```

---

## Segurança

- Passwords: **PBKDF2-SHA256** (100k iterações). Nunca bcrypt.
- Sessões: JWT 24h em cookie `httpOnly`, invalidação por `tokenVersion` no logout
- CSRF: verificação origin/referer no middleware para todas as rotas
- RBAC: middleware (páginas) + `hasPermission()` (APIs) + `usePermissions()` (cliente)
- Rate limiting: 5 req/15min em login e change-password
- CSP, X-Frame-Options, X-Content-Type-Options configurados em `next.config.mjs`

---

## Documentação

| Ficheiro | Conteúdo |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | Regras críticas, stack, comandos, estado atual |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Setup Vercel, Neon, Cloudflare DNS, variáveis de ambiente |
| [docs/MODULES.md](docs/MODULES.md) | Todos os módulos documentados (APIs, funcionalidades, notas) |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema Prisma, migrações, índices |
| [docs/AUTH-SECURITY.md](docs/AUTH-SECURITY.md) | JWT, PBKDF2, CSRF, rate limit, CSP |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Fluxo de request, camadas, padrões |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Como adicionar módulos, padrões de código |
| [docs/ISSUES-BACKLOG.md](docs/ISSUES-BACKLOG.md) | Bugs, débito técnico, roadmap |