# CLAUDE.md — HoqueiManager
> Lido automaticamente em cada sessão. Contém tudo o que precisas de saber antes de tocar no código.

## Identidade do Projeto
**Nome:** HoqueiManager — plataforma SaaS multi-tenant para clubes de hóquei em patins  
**URL produção:** https://hoqueimanager.com (landing) + https://app.hoqueimanager.com (dashboard)  
**Repositório:** branch `main` → Vercel (deploy automático no push)  
**Data última auditoria:** 2026-06-16

> ⚠️ ARQUITECTURA MULTI-TENANT — cada clube é um tenant isolado. Ver regras críticas abaixo.

---

## Stack Obrigatória
| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js App Router | ^15.3.2 |
| Linguagem | TypeScript | ^5 |
| ORM | Prisma | ^7.4.2 |
| DB adapter | `@prisma/adapter-pg` + `pg` | ^7.4.2 |
| Auth | `jose` (JWT HS256) | ^6.1.3 |
| Passwords | **PBKDF2 Web Crypto** (nunca bcrypt) | nativo |
| UI | shadcn/ui (new-york, green theme) | — |
| State | Zustand | ^5.0.11 |
| Validações | Zod v4 | ^4.3.6 |
| i18n | `next-intl` | ^3.26.5 |
| Billing | `stripe` | ^17.7.0 |
| Testes | Vitest | ^4.1.5 |

---

## Credenciais Dev Local
```
DB:  postgresql://postgres:postgresql123@localhost:5432/hoqueimanager
JWT: <gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
URL: http://localhost:3000
Super Admin: superadmin@hoqueimanager.com / superadmin123
```

## Env Vars Produção (Vercel)
```
DATABASE_URL                    → Neon PostgreSQL connection string
JWT_SECRET                      → min 32 chars, sem "change-in-production"
NEXT_PUBLIC_APP_URL             → https://app.hoqueimanager.com
STRIPE_SECRET_KEY               → sk_live_...
STRIPE_WEBHOOK_SECRET           → whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY → pk_live_...
STRIPE_PRICE_MONTHLY            → price_... (€59/mês)
STRIPE_PRICE_YEARLY             → price_... (€590/ano)
R2_BUCKET_NAME                  → Cloudflare R2 bucket (logos patrocinadores)
R2_ACCOUNT_ID                   → Cloudflare account ID
R2_ACCESS_KEY_ID                → R2 access key
R2_SECRET_ACCESS_KEY            → R2 secret key
R2_PUBLIC_URL                   → public URL do bucket R2
```

---

## Regras Críticas — NUNCA VIOLAR

1. **Passwords → apenas PBKDF2** (`hashPassword`/`comparePassword` em `src/lib/auth.ts`). Formato: `pbkdf2:salt_hex:hash_hex`. Não usar bcrypt.
2. **Next.js 15 async params** — todos os route handlers usam `{ params }: { params: Promise<{ id: string }> }` e `const { id } = await params`. Nunca `params.id` direto.
3. **JWT expira em 24h** — definido em `signToken()`. Não aumentar.
4. **`getSecret()` valida o JWT_SECRET** — rejeita se vazio, <32 chars, ou contém "change-in-production". Vai crashar em build se errado.
5. **CSRF no middleware** — já feito para rotas de página. API routes não precisam chamar `validateCsrf` manualmente (middleware trata).
6. **Audit log em toda operação de escrita** — chamar `logAudit(req, user.id, user.email, action, entity, entityId, details)` em todos os POST/PUT/DELETE. Inclui logins (sucesso e falha).
7. **CSP headers em `next.config.mjs`** — qualquer novo domínio externo precisa ser adicionado às diretivas corretas. Stripe já adicionado: `js.stripe.com` (script-src), `api.stripe.com` (connect-src), `js.stripe.com`+`hooks.stripe.com` (frame-src).
8. **Cookie de auth: `hm_token`** — nome fixo, usado em middleware e `getTokenFromCookies`. Nunca usar `hcpdl_token`.
9. **`isAdmin` bypassa todas as permissões** — ver `hasPermission()` em `src/lib/permissions.ts`.
10. **MULTI-TENANT OBRIGATÓRIO — usar `getDbForRequest(req)`** em vez de `prisma` direto em todas as API routes do dashboard. Retorna `{ user, db, clubId }`. O `db` é um Prisma Extension que injeta `clubId` automaticamente em todas as queries de modelos tenanted. Ver `src/lib/db.ts` e `src/lib/prisma-tenant.ts`.
11. **Stripe webhook — sem CSRF** — `/api/stripe/webhook` está excluído do CSRF check (tem verificação de assinatura própria via `stripe.webhooks.constructEvent`). Não adicionar CSRF a este endpoint.
12. **`isSuperAdmin` → acesso a `/platform` apenas** — super admin não tem `clubId`, não pode aceder ao dashboard de nenhum clube. Redireccionado para `/platform` no login.

---

## Comandos Úteis
```bash
npm install                    # instalar dependências (obrigatório no primeiro clone)
npm run dev                    # dev server → localhost:3000
npm run build                  # build + migrate deploy + prisma generate
npx prisma db seed             # criar super admin (superadmin@hoqueimanager.com / superadmin123)
npx prisma migrate dev         # nova migration (dev only)
npx prisma studio              # GUI do DB
npm test                       # vitest run
stripe listen --forward-to localhost:3000/api/stripe/webhook  # webhook local
```

---

## Estrutura de Dirs (resumo)
```
src/
├── app/
│   ├── [locale]/              # Landing page pública (PT/ES/EN/FR/IT)
│   │   ├── layout.tsx         # NextIntlClientProvider
│   │   ├── page.tsx           # Landing page marketing
│   │   └── register/          # Registo 2 passos (dados clube + Stripe)
│   ├── (dashboard)/           # Páginas autenticadas (layout com sidebar)
│   │   ├── page.tsx           # Dashboard
│   │   ├── athletes/          # Atletas + /[id] perfil
│   │   ├── fees/              # Mensalidades
│   │   ├── members/           # Sócios
│   │   ├── materials/         # Materiais/Inventário
│   │   ├── sponsors/          # Patrocinadores
│   │   ├── travel/            # Viagens
│   │   ├── direction/         # Direção
│   │   ├── training/          # Treinos + /[id] quadro tático
│   │   ├── reports/           # Relatórios CSV
│   │   ├── settings/          # Definições do clube (nome, idioma, país)
│   │   └── admin/             # Permissões + Audit log
│   ├── platform/              # Backoffice super admin (lista clubes, MRR)
│   ├── api/
│   │   ├── register/          # POST → cria Club + User + Stripe Checkout
│   │   ├── settings/          # GET/PATCH → definições do clube
│   │   ├── stripe/webhook/    # POST → lifecycle Stripe (ACTIVE/PAST_DUE/CANCELLED)
│   │   └── ...                # Todos os outros módulos
│   ├── login/                 # Página de login (redireciona super admin → /platform)
│   └── setup/                 # Setup inicial (sem clube registado)
├── i18n/
│   ├── routing.ts             # Locales suportados: pt, es, en, fr, it
│   └── request.ts             # getRequestConfig para next-intl
├── lib/
│   ├── auth.ts                # JWT + PBKDF2 (cookie: hm_token)
│   ├── prisma.ts              # Singleton PrismaClient com adapter pg
│   ├── prisma-tenant.ts       # getTenantClient(clubId) — Prisma Extension
│   ├── db.ts                  # getDbForRequest(req) → { user, db, clubId }
│   ├── permissions.ts         # hasPermission()
│   ├── validations.ts         # Todos os schemas Zod
│   ├── audit.ts               # logAudit()
│   ├── rateLimit.ts           # checkRateLimit() + getClientIp()
│   ├── logger.ts              # logger.error/warn/info
│   └── utils.ts               # cn() (clsx + tailwind-merge)
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── layout/                # Sidebar, TopNav
│   ├── landing/               # LanguageSwitcher, PricingToggle, FaqAccordion
│   ├── auth/                  # ChangePasswordDialog
│   ├── admin/                 # PermissionsModal, UserPermissionsTable
│   ├── training/tactical/     # TacticalBoard, HockeyField, etc.
│   └── ErrorBoundary.tsx
├── store/                     # Zustand stores
├── hooks/                     # usePermissions, useDebounce, use-toast
├── types/                     # training.types.ts
├── tests/
│   └── tenant-isolation.test.ts  # Vitest: verifica isolamento cross-tenant
└── middleware.ts              # Edge: locale routing + CSRF + JWT + RBAC + super admin
messages/                      # Traduções next-intl
├── pt.json, es.json, en.json, fr.json, it.json
```

---

## Documentação Detalhada
- [Deployment](docs/DEPLOYMENT.md) — Vercel, Neon, Cloudflare DNS, variáveis de ambiente
- [Architecture](docs/ARCHITECTURE.md) — fluxo de request, padrões
- [Modules](docs/MODULES.md) — todos os 12 módulos documentados
- [Database](docs/DATABASE.md) — schema, migrações, problemas conhecidos
- [Auth & Security](docs/AUTH-SECURITY.md) — JWT, PBKDF2, CSRF, rate limit, CSP
- [Conventions](docs/CONVENTIONS.md) — como adicionar módulos, padrões de código
- [Issues & Backlog](docs/ISSUES-BACKLOG.md) — bugs, débito técnico, roadmap
- [Multi-Tenant](Multi-Tenant.md) — plano completo de migração SaaS multi-tenant (pré-implementação)

---

## Estado Atual (2026-06-16)

### Infraestrutura Base (herdada do HCPDL)
- ✅ Next.js 15 App Router + TypeScript + Prisma 7 + shadcn/ui + Zustand + Zod v4
- ✅ 12 módulos funcionais: Dashboard, Atletas, Sócios, Mensalidades, Materiais, Patrocinadores, Viagens, Direção, Treinos, Assiduidades, Têxteis, Admin
- ✅ PBKDF2 Web Crypto, JWT HS256, CSRF, rate limiting PostgreSQL, audit log
- ✅ Cloudflare R2 para uploads de logos

### Multi-Tenant SaaS (implementado 2026-06-16)
- ✅ **Schema multi-tenant**: modelo `Club` + `clubId` em todos os modelos tenanted + `isSuperAdmin` em `User`
- ✅ **Prisma Extension**: `getTenantClient(clubId)` em `src/lib/prisma-tenant.ts` — auto-injeta `clubId` em findMany/create/update/delete/count/aggregate
- ✅ **42 API routes** atualizadas para usar `getDbForRequest(req)` → `{ user, db, clubId }`
- ✅ **Middleware** atualizado: locale routing público (`/pt`, `/en`, etc.), guard super admin (`/platform`), validação `clubId` em sessão
- ✅ **JWT payload** extendido: `clubId`, `isSuperAdmin` adicionados a todos os tokens
- ✅ **Cookie renomeado**: `hcpdl_token` → `hm_token`
- ✅ **Landing page** i18n: `src/app/[locale]/page.tsx` com next-intl (PT/ES/EN/FR/IT)
- ✅ **Registo de clubes**: wizard 2 passos (`/[locale]/register`) → `POST /api/register` → Stripe Checkout
- ✅ **Stripe billing**: webhook em `/api/stripe/webhook` gere lifecycle (PENDING_PAYMENT → ACTIVE → PAST_DUE → CANCELLED)
- ✅ **Platform backoffice**: `/platform` para super admin — lista clubes, stats MRR
- ✅ **Club settings**: `/settings` — alterar nome, idioma, país do clube
- ✅ **Testes de isolamento**: `src/tests/tenant-isolation.test.ts`

### Tarefas manuais pendentes (não podem ser automatizadas)
- ⏳ `npm install` + criar DB `hoqueimanager` + `npx prisma migrate dev --name init` + seed
- ⏳ Criar produtos Stripe (preços mensais €59 e anuais €590) e preencher Price IDs no `.env`
- ⏳ Deploy Vercel + env vars produção + webhook Stripe produção
- ⏳ Registar `hoqueimanager.com` + apontar DNS para Vercel
- ⏳ Criar `public/logo.png` (ícone PWA)
- ⏳ Integrar email transacional (Resend/SendGrid) para enviar credenciais após registo
