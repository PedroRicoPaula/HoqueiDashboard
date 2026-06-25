# HoqueiManager

Plataforma SaaS multi-tenant para gestão de clubes de hóquei em patins.

**Landing page:** https://hoqueimanager.com  
**Dashboard:** https://app.hoqueimanager.com  
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
| i18n | next-intl (PT / ES / EN / FR / IT) |
| Billing | Stripe (checkout + webhooks) |
| Email | Resend (boas-vindas + reset de password) |
| Storage | Cloudflare R2 (logos de clubes e patrocinadores) |
| Testes | Vitest |

---

## Funcionalidades

### Público / Marketing
| Módulo | Descrição |
|--------|-----------|
| **Landing page** | Site marketing em 5 idiomas, pricing, FAQ, screenshots reais do produto |
| **Registo** | Wizard 2 passos (dados do clube + Stripe Checkout); onboarding por email |
| **GDPR** | Política de privacidade, termos de utilização, cookie consent banner |

### Dashboard (por clube)
| Módulo | Descrição |
|--------|-----------|
| **Dashboard** | KPIs, gráfico de receitas, alertas clicáveis (atrasos, contratos a expirar) |
| **Atletas** | CRUD completo, filtro por escalão, perfil com histórico de pagamentos e assiduidade |
| **Mensalidades** | Grelha época × atleta, marcação individual ou em batch por coluna |
| **Sócios** | CRUD, QuotaCalendar 12 meses, badge de estado (em dia / X em atraso) |
| **Materiais** | Inventário com estados STOCK / ASSIGNED / DAMAGED / LOST, atribuição a atleta |
| **Têxteis** | Equipamentos e fardas, controlo de custo por atleta vs clube |
| **Patrocinadores** | Cards com logo R2, filtro por zona e estado de contrato |
| **Viagens** | Planeamento com condutores, convocados, orçamento e checklist |
| **Assiduidades** | Calendário semanal de sessões, registo de presenças por atleta |
| **Direção** | Membros com cargos múltiplos, histórico de pagamentos de salário |
| **Treinos** | Lista + quadro tático digital interativo (drag, frames, playback) |
| **Relatórios** | Export XLSX: atletas, sócios, mensalidades, materiais, têxteis, assiduidade |
| **Admin** | Permissões por utilizador (20 flags RBAC), audit log completo |
| **Definições** | Nome, idioma, país, paleta de cores e logo do clube |

### Platform (super admin)
| Módulo | Descrição |
|--------|-----------|
| **Platform** | Lista de todos os clubes, MRR/ARR real, breakdown por país e estado de subscrição |

---

## Desenvolvimento Local

### Pré-requisitos
- Node.js 18+
- PostgreSQL local

### Setup

```bash
npm install

# Criar DB e aplicar schema
createdb hoqueimanager
npx prisma db push

# Criar super admin
npx prisma db seed

# Iniciar servidor
npm run dev
```

**URL:** http://localhost:3000  
**Super Admin:** `superadmin@hoqueimanager.com` / `superadmin123`

Para testar com clubes de demonstração:
```bash
npx tsx scripts/seed-test-clubs.ts
```

Para testar o webhook Stripe localmente:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### Variáveis de ambiente (dev)

```env
DATABASE_URL=postgresql://postgres:postgresql123@localhost:5432/hoqueimanager
JWT_SECRET=<32+ chars — gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Stripe (opcional em dev — necessário para testar registo)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...

# Resend (opcional em dev — necessário para emails de boas-vindas)
RESEND_API_KEY=re_...

# Cloudflare R2 (opcional em dev — uploads guardados localmente sem estas vars)
R2_BUCKET_NAME=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_URL=...
```

---

## Comandos Úteis

```bash
npm run dev              # servidor dev → localhost:3000
npm run build            # build produção (migrate deploy + prisma generate + next build)
npm test                 # vitest run (58 testes)
npx prisma studio        # GUI da base de dados
npx prisma migrate dev   # nova migration (dev)
npx prisma db seed       # recriar super admin
```

---

## Arquitectura Multi-Tenant

Cada clube é um tenant isolado. O isolamento é garantido a três níveis:

1. **JWT** — `clubId` no payload; `getDbForRequest(req)` rejeita tokens sem `clubId`
2. **Prisma Extension** — `getTenantClient(clubId)` injeta `WHERE clubId = ?` automaticamente em todas as queries de modelos tenanted
3. **Testes** — `src/tests/tenant-isolation.test.ts` verifica que dados de um clube não são acessíveis por outro

Super admins (`isSuperAdmin: true`) não têm `clubId` e só acedem a `/platform`.

---

## Estrutura

```
src/
├── app/
│   ├── [locale]/        # Landing page pública (PT/ES/EN/FR/IT)
│   │   └── register/    # Wizard de registo + Stripe Checkout
│   ├── (dashboard)/     # Páginas autenticadas (layout com sidebar)
│   ├── platform/        # Backoffice super admin
│   ├── api/             # Route handlers
│   ├── login/
│   ├── forgot-password/
│   ├── reset-password/
│   └── setup/           # Criação do primeiro super admin
├── components/
│   ├── ui/              # shadcn/ui
│   ├── layout/          # Sidebar, TopNav
│   ├── landing/         # LanguageSwitcher, CookieBanner, ProductScreenshots
│   └── training/        # Quadro tático interativo
├── lib/                 # auth, prisma, prisma-tenant, db, audit, rateLimit, email…
├── hooks/               # usePermissions, useDashT, useDashLabels
├── store/               # Zustand (auth, tactical, sidebar)
├── tests/               # tenant-isolation.test.ts
└── middleware.ts        # Edge: i18n + CSRF + JWT + RBAC + super admin guard
```

---

## Segurança

- **Passwords:** PBKDF2-SHA256 (100k iterações, salt 16 bytes). Nunca bcrypt.
- **Sessões:** JWT 24h em cookie `hm_token` (httpOnly, SameSite=strict), invalidação por `tokenVersion`
- **CSRF:** verificação origin/referer no middleware para todas as rotas API
- **Rate limiting:** PostgreSQL atómico (`INSERT ... ON CONFLICT DO UPDATE`) — funciona em serverless multi-instância. Aplicado em login, change-password, forgot-password, reset-password e register.
- **Onboarding seguro:** utilizador criado com password placeholder; link de definição de password enviado por email após pagamento Stripe. Zero credenciais em metadata Stripe ou email em claro.
- **CSP, HSTS, X-Frame-Options, X-Content-Type-Options** configurados em `next.config.mjs`
- **Audit log** em todas as operações de escrita e eventos de autenticação

---

## Documentação

| Ficheiro | Conteúdo |
|----------|---------|
| [CLAUDE.md](CLAUDE.md) | Regras críticas, stack, comandos, estado atual |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Setup Vercel, Neon, Cloudflare DNS, variáveis de ambiente |
| [docs/MODULES.md](docs/MODULES.md) | Todos os módulos documentados (APIs, funcionalidades, notas) |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema Prisma, migrações, índices |
| [docs/AUTH-SECURITY.md](docs/AUTH-SECURITY.md) | JWT, PBKDF2, CSRF, rate limit, CSP, fluxo de registo |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Fluxo de request, camadas, padrões |
| [docs/CONVENTIONS.md](docs/CONVENTIONS.md) | Como adicionar módulos, padrões de código |
| [docs/ISSUES-BACKLOG.md](docs/ISSUES-BACKLOG.md) | Bugs, débito técnico, roadmap |
