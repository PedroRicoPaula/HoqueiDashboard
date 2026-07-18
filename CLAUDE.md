# CLAUDE.md — HoqueiManager
> Lido automaticamente em cada sessão. Contém tudo o que precisas de saber antes de tocar no código.

## Identidade do Projeto
**Nome:** HoqueiManager — plataforma SaaS multi-tenant para clubes de hóquei em patins  
**URL produção:** https://hoqueimanager.com (landing) + https://app.hoqueimanager.com (dashboard)  
**Repositório:** branch `main` → Vercel (deploy automático no push)  
**Data última auditoria:** 2026-07-17

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
NEXT_PUBLIC_LANDING_URL         → https://hoqueimanager.com (cancel_url do Stripe Checkout; fallback hardcoded se ausente)
R2_BUCKET_NAME                  → Cloudflare R2 bucket (logos patrocinadores)
R2_ACCOUNT_ID                   → Cloudflare account ID
R2_ACCESS_KEY_ID                → R2 access key
R2_SECRET_ACCESS_KEY            → R2 secret key
R2_PUBLIC_URL                   → public URL do bucket R2
RESEND_API_KEY                  → re_... (email transacional — boas-vindas + reset password)
EMAIL_FROM                      → "HoqueiManager <noreply@hoqueimanager.com>" (opcional; fallback: onboarding@resend.dev — requer domínio verificado no Resend para usar endereço custom)
```

---

## Regras Críticas — NUNCA VIOLAR

1. **Passwords → apenas PBKDF2** (`hashPassword`/`comparePassword` em `src/lib/auth.ts`). Formato: `pbkdf2:salt_hex:hash_hex`. Não usar bcrypt.
2. **Next.js 15 async params** — todos os route handlers usam `{ params }: { params: Promise<{ id: string }> }` e `const { id } = await params`. Nunca `params.id` direto.
3. **JWT expira em 24h** — definido em `signToken()`. Não aumentar.
4. **`getSecret()` valida o JWT_SECRET** — rejeita se vazio, <32 chars, ou contém "change-in-production". Vai crashar em build se errado.
5. **CSRF no middleware** — já feito para rotas de página. API routes não precisam chamar `validateCsrf` manualmente (middleware trata). **Excepção: `/api/setup`** está excluído do matcher do middleware (`matcher` negation list) — tem `validateCsrf(req)` inline no POST handler.
6. **Audit log em toda operação de escrita** — chamar `logAudit(req, user.id, user.email, action, entity, entityId, details)` em todos os POST/PUT/DELETE. Inclui logins (sucesso e falha).
7. **CSP headers em `next.config.mjs`** — qualquer novo domínio externo precisa ser adicionado às diretivas corretas. Stripe já adicionado: `js.stripe.com` (script-src), `api.stripe.com` (connect-src), `js.stripe.com`+`hooks.stripe.com` (frame-src). Google Analytics (2026-07-17, só carrega em `[locale]/layout.tsx` — páginas públicas, nunca no dashboard): `www.googletagmanager.com` (script-src), `*.google-analytics.com`+`www.googletagmanager.com` (connect-src — o gtag.js envia os eventos para um subdomínio regional tipo `regionN.google-analytics.com`, escolhido em runtime; **connect-src tem de ser wildcard**, um domínio exacto não chega). **CSP `img-src` não chega para `next/image`** — qualquer host externo usado num `<Image src="https://...">` (ex: logos R2) precisa TAMBÉM de estar em `images.remotePatterns` no `next.config.mjs`, secção separada do CSP; sem isso `/_next/image` devolve 400 (BUG-028, 2026-07-17).
8. **Cookie de auth: `hm_token`** — nome fixo, usado em middleware e `getTokenFromCookies`. Nunca usar `hcpdl_token`.
9. **`isAdmin` bypassa todas as permissões** — ver `hasPermission()` em `src/lib/permissions.ts`.
10. **MULTI-TENANT OBRIGATÓRIO — usar `getDbForRequest(req)`** em vez de `prisma` direto em todas as API routes do dashboard. Retorna `{ user, db, clubId }` ou `null` se não autenticado, sem `clubId`, ou clube com status `CANCELLED`/`SUSPENDED`. O `db` é um Prisma Extension que injeta `clubId` automaticamente em **todas** as operações de modelos tenanted (`findUnique`, `findMany`, `findFirst`, `create`, `createMany`, `update`, `updateMany`, `delete`, `deleteMany`, `count`, `aggregate`, `groupBy`). Em `upsert`, injecta `clubId` no `create` **e** valida ownership via `findFirst` antes de correr (o `where` de compound key não aceita `clubId` extra no tipo gerado pelo Prisma — ver SEC-026 em `docs/AUTH-SECURITY.md`). **Modelos tenanted (16):** Season, Athlete, Member, Sponsor, Material, Travel, DirectionMember, Training, TrainingSchedule, TrainingSession, TextileItem, AuditLog, AthletePayment, Quota, DirectionSalaryPayment, AttendanceRecord. **Modelos NÃO tenanted (usar `prisma` global):** User, Permission, Playbook, RateLimit. Ver `src/lib/db.ts` e `src/lib/prisma-tenant.ts`.
11. **Stripe webhook — sem CSRF** — `/api/stripe/webhook` está excluído do CSRF check (tem verificação de assinatura própria via `stripe.webhooks.constructEvent`). Não adicionar CSRF a este endpoint.
12. **`isSuperAdmin` → acesso a `/platform` apenas** — super admin não tem `clubId`, não pode aceder ao dashboard de nenhum clube. Redireccionado para `/platform` no login.
13. **Fluxo de registo de clubes — password definida no formulário, login automático** (mudou 2026-07-17) — `POST /api/register` recebe `password`+`confirmPassword` e grava a hash logo aí; `Club` nasce em `PENDING_PAYMENT`, login continua bloqueado até `ACTIVE` independentemente de a password já existir. `success_url` do Stripe Checkout aponta para `/register/complete?session_id={CHECKOUT_SESSION_ID}` — essa rota confirma o pagamento **directo no Stripe** (`payment_status === 'paid'`, não depende do webhook ter chegado), ativa o clube via `src/lib/clubActivation.ts` e faz login automático (mesmo contrato JSON de `/api/auth/login`: `{user, permissions, redirectTo}` + cookie `hm_token`). O webhook `checkout.session.completed` chama o mesmo helper como backstop idempotente (caso o browser nunca volte ao `success_url`). `RESEND_API_KEY` **já não é crítico para o onboarding** — só é usado por `/forgot-password`.
14. **`AuditAction` type em `src/lib/audit.ts`** — ao chamar `logAudit()` com uma nova ação, **sempre** adicionar ao union type primeiro. O compilador TS rejeita ações não declaradas. Ações actuais: `CREATE | UPDATE | DELETE | LOGIN | LOGIN_FAIL | LOGOUT | CHANGE_PASSWORD | CHANGE_PERMISSIONS | PASSWORD_RESET | PASSWORD_RESET_REQUEST | UPDATE_CLUB_LOGO | REMOVE_CLUB_LOGO | REGISTER | SUBSCRIPTION_ACTIVATED | PAYMENT_SUCCEEDED | PAYMENT_FAILED | SUBSCRIPTION_CANCELLED`.

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
│   ├── season/                # SeasonSelector (dropdown na Sidebar)
│   ├── training/tactical/     # TacticalBoard, HockeyField, etc.
│   └── ErrorBoundary.tsx
├── store/                     # Zustand stores (authStore, sidebarStore, seasonStore)
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

## Estado Atual (2026-07-15)

### Infraestrutura Base (herdada do HCPDL)
- ✅ Next.js 15 App Router + TypeScript + Prisma 7 + shadcn/ui + Zustand + Zod v4
- ✅ 12 módulos funcionais: Dashboard, Atletas, Sócios, Mensalidades, Materiais, Patrocinadores, Viagens, Direção, Treinos, Assiduidades, Têxteis, Admin
- ✅ PBKDF2 Web Crypto, JWT HS256, CSRF, rate limiting PostgreSQL, audit log
- ✅ Cloudflare R2 para uploads de logos

### Multi-Tenant SaaS (implementado 2026-06-16)
- ✅ **Schema multi-tenant**: modelo `Club` + `clubId` em todos os modelos tenanted + `isSuperAdmin` em `User`
- ✅ **Prisma Extension**: `getTenantClient(clubId)` em `src/lib/prisma-tenant.ts`
- ✅ **42 API routes** atualizadas para usar `getDbForRequest(req)` → `{ user, db, clubId }`
- ✅ **Middleware** atualizado: locale routing, guard super admin, validação `clubId`
- ✅ **JWT payload** extendido: `clubId`, `isSuperAdmin`, cookie `hm_token`
- ✅ **Landing page** i18n: `src/app/[locale]/page.tsx` com next-intl (PT/ES/EN/FR/IT)
- ✅ **Registo de clubes**: wizard 2 passos + Stripe Checkout
- ✅ **Stripe billing**: webhook lifecycle (PENDING_PAYMENT → ACTIVE → PAST_DUE → CANCELLED)
- ✅ **Platform backoffice**: `/platform` — lista clubes, MRR/ARR, breakdown por país/estado
- ✅ **Club settings**: `/settings` — nome, idioma, país, logo upload
- ✅ **Testes de isolamento**: `src/tests/tenant-isolation.test.ts`

### SaaS Melhorias (2026-06-19)
- ✅ **Dashboard i18n**: `useDashT` hook + `useDashLabels` hook + 5 ficheiros JSON em `messages/dashboard/`
- ✅ **Sidebar/TopNav dinâmicos**: nome do clube, logo upload, monograma fallback, labels i18n
- ✅ **html lang dinâmico**: `HtmlLang.tsx` component atualiza `document.lang` via auth store
- ✅ **Forgot password flow**: `/forgot-password` + `/reset-password` + `PasswordResetToken` DB model
- ✅ **Email transacional**: `src/lib/email.ts` via Resend REST API — boas-vindas + reset password
- ✅ **Club logo**: campo `logoUrl` no schema + API `/api/club/logo` (R2/local)
- ✅ **GDPR**: `/[locale]/privacy` + `/[locale]/terms` + cookie banner (`CookieBanner.tsx`)
- ✅ **Landing page melhorada**: How it works, social proof, FAQ expandida, CTA corrigida, links corrigidos
- ✅ **Labels i18n nas páginas**: dashboard, atletas, mensalidades, membros, materiais, têxteis, direção, assiduidades usam `useDashLabels()`
- ✅ **date-fns locale dinâmico**: `getDateLocale()` baseado no idioma do clube

### Auditoria de Segurança e Build (2026-06-25) — commit c83ac59
- ✅ **Fluxo de registo seguro**: sem `tempPassword` — utilizador define password via email com link `PasswordResetToken`
- ✅ **Rate limit**: adicionado a `/api/register` (5/hora) e `/api/auth/reset-password` (5/15min)
- ✅ **Setup route**: CSRF inline + `isSuperAdmin: true` para o super admin criado
- ✅ **Audit completo**: `logAudit` adicionado a forgot-password, webhook Stripe (4 eventos), register
- ✅ **AuditAction type**: alargado com REGISTER, SUBSCRIPTION_ACTIVATED, PAYMENT_SUCCEEDED, PAYMENT_FAILED, SUBSCRIPTION_CANCELLED, PASSWORD_RESET_REQUEST, CREATE_FREE_CLUB, CHANGE_CLUB_STATUS, DELETE_CLUB
- ✅ **CSP img-src dinâmico**: lê `R2_PUBLIC_URL` em build time para permitir custom domains R2
- ✅ **Build limpo**: 0 erros TypeScript, 58 páginas geradas

### Auditoria de Segurança Avançada (2026-07-16) — commit b231b18
- ✅ **IDOR fix**: `/api/attendance/[id]/records` valida todos os `athleteId` submetidos contra o club atual antes de upsert
- ✅ **Zod hardening**: `admin/audit` DELETE usa `discriminatedUnion` schema; `admin/permissions/[userId]` PUT usa schema com todos os 21 campos boolean
- ✅ **Platform rate limiting**: `POST /api/platform/clubs` limitado a 20 criações/hora por super admin
- ✅ **Audit log platform**: CREATE_FREE_CLUB, CHANGE_CLUB_STATUS (captura previousStatus), DELETE_CLUB (snapshot antes de cascade delete)
- ✅ **Vitest config fix**: `loadEnv` do Vite no config resolve DATABASE_URL de `.env.local` em ambiente de testes
- ✅ **20 ataques testados**: CSRF, JWT manipulation, privilege escalation, XSS, SQL injection, path traversal, IDOR, tenant isolation, rate limit bypass, payload flood, open redirect — todos bloqueados
- ✅ **Build limpo**: 0 erros TypeScript, 59 páginas geradas, 67/67 testes Vitest passam

### Épocas Desportivas / Season Feature (2026-07-16) — 3 commits
- ✅ **Modelo Season**: `id, clubId, name, startDate, endDate, isActive` — `@@unique([clubId, name])`
- ✅ **seasonId nullable** em Member, Sponsor, AthletePayment, Quota (backward compat; NULL = época indeterminada)
- ✅ **Member unique**: `[clubId, number]` → `[clubId, number, seasonId]` — mesmo número em épocas diferentes
- ✅ **Season no TENANTED set**: Prisma Extension injeta `clubId` em todas as operações
- ✅ **API /api/seasons**: CRUD completo — lista, criar, editar, ativar, eliminar (bloqueado se tem registos)
- ✅ **seasonStore Zustand**: `seasons[], selectedSeasonId` persistido como `hm-season`
- ✅ **SeasonSelector** na Sidebar: dropdown com badge "Ativa"; link "Gerir épocas" → /seasons
- ✅ **/seasons page**: página de gestão de épocas (admin only) com CRUD inline
- ✅ **/members**: filtra por época global; form inclui dropdown de época; QuotaCalendar usa ano final da época
- ✅ **/sponsors**: filtra por época global; form inclui época; badge de época na toolbar
- ✅ **/fees**: meses dinâmicos derivados de Season.startDate/endDate (não hardcoded Sep-Jun); cabeçalho com época
- ✅ **Dashboard**: passa `?seasonId` ao stats API — counts e receitas filtrados pela época selecionada
- ✅ **i18n**: `nav.seasons` em pt/en/es/fr/it (Épocas/Seasons/Temporadas/Saisons/Stagioni)
- ✅ **Build**: 0 erros TypeScript, 60 páginas, 67/67 testes passam

### QA + UX (2026-07-15)
- ✅ **BUG-020**: Loop infinito em Patrocinadores (Radix `react-presence`) — `<Checkbox>` substituído por `<CheckMark>` custom
- ✅ **BUG-021**: i18n keys `colorTheme`/`colorThemeNote` em falta em Definições — adicionadas aos 5 locales
- ✅ **BUG-022**: Contador de têxteis "itemns" (typo) corrigido para "itens"
- ✅ **CSV FPP Atletas**: `parseCsv` strip quotes nos headers; `parseAgeGroup` mapeia valores FPP ("Sénior Masculino" → SENIORS, "Sub-19 Masculino" → SUB19); `rowToAthlete` usa `num_fpp` e `escal_o`
- ✅ **CSV FPP Direção**: `parseDirectionCsv()` agrupa por Num FPP + mescla cargos; API `/api/direction` aceita array; botão "Importar CSV FPP" + dialog na página Direção
- ✅ **Onboarding card**: card "Primeiros Passos" no dashboard quando clube tem 0 atletas (4 ações com links, i18n 5 línguas)

### Correções pós-lançamento Épocas (2026-07-17)
- ✅ **BUG-025**: Erro de hidratação React #418 (Têxteis/Sócios/Patrocinadores/Sidebar, hard-reload com época selecionada) — `authStore`/`seasonStore` liam localStorage antes de montar; `skipHydration`+`rehydrate()` (padrão standard do Zustand) **não chegou** por causa de boundaries internas do Next App Router. Fix definitivo: hook `useMounted()` (novo, `src/hooks/useMounted.ts`) — ver padrão em `docs/CONVENTIONS.md`
- ✅ **BUG-026**: `<Select.Item value="">` no picker de época de Têxteis — Radix rejeita string vazia; sentinela `"none"` usado em vez disso
- ✅ **BUG-027**: Regex de `season` em Têxteis (`^\d{4}\/\d{2}$`) rejeitava o próprio formato "2025/2026" sugerido pela página de Épocas — relaxado para `min(3).max(20)`, igual ao `createSeasonSchema.name`
- ✅ **UX**: `POST /api/seasons` cria época já com `defaultAthleteMonthlyFee`/`defaultMemberMonthlyQuota` = `5` (evita Definições com inputs vazios)
- ✅ **[INFRA-003] corrigido**: confirmado em produção — `POST /api/register` estava a dar 500 real (`tx.club.create()` batia na mesma falta de coluna). Migration `20260717121034_club_free_status_columns` criada (`ADD COLUMN IF NOT EXISTS`, segura mesmo se a Neon já tivesse as colunas via `db push`), testada localmente (`migrate deploy` + `club.create()` real + `npm test` 67/67) antes do deploy
- ✅ README.md atualizado (contagem de testes, comandos em falta, estrutura de dirs desatualizada)

### Registo de clubes — password no formulário + login automático pós-pagamento (2026-07-17)
- ✅ **Password definida no registo**: `[locale]/register` (step 1) tem campos `password`+`confirmPassword`; `POST /api/register` valida (`min(8)` + `refine` de igualdade) e grava a hash logo na criação do `User` — sem placeholder
- ✅ **Login automático ao voltar do Stripe Checkout**: `success_url` aponta para `/register/complete?session_id={CHECKOUT_SESSION_ID}` (nova página, fora do `(dashboard)` e do `[locale]`, excluída do matcher do middleware). `POST /api/register/complete` confirma `payment_status === 'paid'` **directo no Stripe** (não espera pelo webhook), activa o clube, emite JWT + cookie `hm_token` — mesmo contrato JSON de `/api/auth/login`. Página cliente chama `setAuth()` e faz `router.push('/')`
- ✅ **`src/lib/clubActivation.ts`** (novo): `activateClubFromSession()` — lógica de activação partilhada entre `/api/register/complete` e o webhook `checkout.session.completed`; idempotente, qualquer um dos dois pode chegar primeiro
- ✅ **Webhook simplificado**: `checkout.session.completed` passa a ser só o backstop (browser nunca voltou ao `success_url`); removida a criação de `PasswordResetToken` + envio de email de boas-vindas (obsoleto — password já existe desde o registo)
- ✅ **`welcomeEmailHtml` removido** de `src/lib/email.ts` (dead code); `resetPasswordEmailHtml` inalterado, continua a servir `/forgot-password`
- ✅ **`middleware.ts`**: `register` adicionado à lista de exclusões do `matcher` (cobre `/register/complete`; não afecta `/api/register`, que já passava pelo ramo `/api/*`)
- ✅ i18n: chaves `password`, `passwordPlaceholder`, `confirmPassword`, `confirmPasswordPlaceholder`, `passwordTooShort`, `passwordMismatch` em `messages/{pt,es,en,fr,it}.json` → `register.*`

### Auditoria completa ao dashboard + correção de 24 problemas (2026-07-17)
> Auditoria de 16 módulos (3 agentes + revisão própria), seguida de correção e teste de tudo o que foi encontrado. Detalhe de cada item em `docs/ISSUES-BACKLOG.md`. Único ponto ainda em aberto: [UX-004] (Assiduidade só permite 1 horário/escalão — decisão de produto pendente).
- ✅ **[BUG-029]** Perfil do atleta mostrava mensalidades Jan-Jun como não pagas — `payments/route.ts` só pedia o ano de início da época; cliente agora pede os dois anos civis e junta
- ✅ **[BUG-030]** CSV FPP da Direção: `"treinador adjunto"` era apanhado por `.includes('treinador')` antes de chegar à condição certa — reordenado. Reimportar o mesmo CSV duplicava pessoas — `POST /api/direction` agora faz `findFirst` por nome e funde cargos via `Set` em vez de duplicar
- ✅ **[SEC-030]** Admin conseguia auto-remover `isAdmin` (risco de lockout do clube) — bloqueado no client (switch disabled) e reforçado no servidor (`data.isAdmin = true` se `userId === user.id`, independente do payload)
- ✅ **[DEBT-025]** Estatísticas de Assiduidade eram N+1 sem filtro de data — extraído `src/lib/attendanceStats.ts` (`computeAttendanceStats`, 1 query), usado por `GET /api/attendance/stats` (novo) e pelo export CSV
- ✅ **[BUG-031] — achado só em teste live, não na auditoria estática**: `usePermissions()` devolvia `can` sem `useCallback` → loop infinito em qualquer componente que metesse `can`/derivados na dependency array de `useEffect`. Confirmado em produção-like: `net::ERR_INSUFFICIENT_RESOURCES` no perfil do atleta (22 erros de consola → 0 após fix). Hook usado em quase todo o dashboard — foi o achado mais sério desta ronda
- ✅ **[DEBT-026] — achado só em teste live**: fix de hidratação de [BUG-025] (`useMounted()`) não cobria `materials/page.tsx`, `fees/page.tsx`, `athletes/[id]/page.tsx` — reproduzido o mesmo erro #418 em `/materials`; aplicado o mesmo padrão aos 3 ficheiros
- ✅ **[BUG-032]** Materiais em lote ("Adicionar múltiplos") não gravava `seasonId` — desapareciam ao filtrar por época; `POST /api/materials` agora reconcilia `state`/`athleteId`/campos de pagamento entre si
- ✅ **[BUG-033]** Viagens "próximas/passadas" comparava só a data, ignorava a hora — novo helper `getTravelDateTime()` combina data+hora sem desvio de fuso
- ✅ **[SEC-031]** Export de Audit Log usava regra de visibilidade diferente da tabela — incluía logins de admin que a UI esconde; alinhado
- ✅ **[DEBT-027]** Fetches sem `try/catch`/`res.ok` em Atletas/Mensalidades/Viagens (falhas silenciosas); parsing CSV de Atletas com `.split(',')` ingénuo (quebrava com vírgulas dentro de aspas) → tokenizador `splitCsvLine`; Quadro Táctico (`BoardToolbar.tsx`) sem feedback em falhas de importar/exportar → toasts adicionados
- ✅ **Simplificação**: `PlaybackOverlay.tsx` (código morto, zero imports) removido; Dashboard home — coluna de 3 cards de receita redundante com o gráfico ao lado removida (Despesas mantém os cards — têm dado extra que o gráfico não mostra)
- ✅ **Verificação**: `npm test` 67/67, `npm run build` limpo, fluxos alterados testados em browser real via Playwright (não só typecheck) — incluindo o lote de Materiais e o reimport de CSV da Direção

### Membership de época para Atletas + correção de 42 problemas do backlog (2026-07-18)
> Pedido do utilizador: corrigir todo o backlog de forma organizada e desenhar a lógica de "atleta que deixa o clube entre épocas" — visível/correcto na época em que esteve presente, ausente nas seguintes, sempre acessível pelo perfil com histórico completo. Detalhe de cada item novo em `docs/ISSUES-BACKLOG.md`.
- ✅ **Season membership (feature principal)**: `Athlete.joinedAt`/`leftAt` (`DateTime?`, sem defaults, zero backfill) — janela temporal em vez de duplicar o atleta por época. `src/lib/athleteMembership.ts` (`athleteMembershipWhere()`) aplicado em Athletes/Fees/Dashboard/Relatórios. Atleta com `leftAt` antes do início de uma época fica fora dessa época (lista, mensalidades, contagens) mas continua 100% visível nas épocas em que esteve presente e sempre acessível directamente pelo perfil (`/athletes/[id]` nunca filtra por época). Perfil ganhou card "Histórico de Épocas" com chips por época. Botão "Marcar saída do clube"/"Reativar" na lista e no perfil
- ✅ **BLOCKER corrigido**: atletas Seniores estavam excluídos de Mensalidades, Dashboard e Relatório Financeiro por um filtro `ageGroup: {not: 'SENIORS'}` — removido dos 3 sítios (`fees/route.ts`, `dashboard/stats/route.ts`, `reports/financial/route.ts`)
- ✅ **BLOCKER corrigido**: Relatório Financeiro reescrito — período era hardcoded, ignorava a época seleccionada; `src/lib/feeCalc.ts` (novo, partilhado) centraliza `computeEffectiveFee`/`isMonthPast`/`computeSeasonMonths`, eliminando 3 implementações divergentes
- ✅ **BLOCKER corrigido**: Sócios — Estado mostrava sempre "Em dia" independentemente de quotas em atraso (campo `lateMonths` nunca calculado em `members/route.ts`)
- ✅ **Root cause do bug "registos desaparecem ao criar a 1ª época" (ronda anterior)**: não era um problema de migração de dados — `seasonStore` auto-seleccionava a primeira época da lista (por defeito `isActive:false`) sem o utilizador pedir, escondendo tudo o que não tinha essa época atribuída. Fix definitivo: `hasUserSelected` no store distingue "nunca escolhi" de "escolhi propositadamente Todas as épocas"; sem escolha válida segue a época activa, nunca a primeira da lista. `SeasonSelector` ganhou opção explícita "Todas as épocas"
- ✅ **Zod `.partial()` + `.default()` (achado sistémico)**: `.partial()` não remove `.default()` dos campos herdados — um PATCH que omite um campo com default reescrevia-o silenciosamente para o valor por omissão. Corrigido em 8 módulos (`src/lib/validations.ts`) separando cada entidade em schema base (sem defaults) + create (`base.extend({...defaults})`) + update (`base.partial()`, nunca derivado do create)
- ✅ **Segurança**: replay de `POST /api/register/complete` fechado — `Club.registerCompletedAt` (novo campo) gravado atomicamente via `updateMany` com o próprio `where` como guarda, antes de emitir qualquer token (evita duas sessões válidas do mesmo `session_id` do Stripe). `GET/PATCH /api/settings` reescrito para `getDbForRequest` + `isAdmin` (antes não verificava permissão nem multi-tenant correctamente); rota adicionada ao `PROTECTED_ROUTES` do middleware
- ✅ **~30 correcções adicionais** (Sem época em Materiais/Sócios, delete-block de Épocas a considerar Material/TextileItem, Patrocinadores a comparar só a data do contrato, Têxteis/Treinos/Assiduidade/Direcção com tratamento de erro em falta, etc.) — lista completa em `docs/ISSUES-BACKLOG.md`
- ✅ **5 achados só em teste ao vivo, não na revisão estática** (mesmo padrão da ronda anterior — bugs de estado/timing só aparecem a interagir de verdade):
  - pager "Histórico de Pagamentos" (perfil do atleta e Mensalidades em "Todas as épocas") tinha um ano mínimo hardcoded (`2025`) em vez de derivado das épocas reais do clube — um clube com dados anteriores a esse ano ficava permanentemente trancado
  - `AthletePayment.seasonId` nunca era gravado ao registar um pagamento (lido da query string só para calcular o valor, nunca persistido) — o guard que impede eliminar uma época com pagamentos associados estava sempre inerte; consegui eliminar ao vivo uma época com 8 atletas de histórico de pagamentos sem qualquer aviso
  - troca rápida de época em Mensalidades/Atletas/Dashboard tinha corrida entre pedidos (`fetch` sem guarda de sequência) — uma resposta antiga e mais lenta podia chegar depois da nova e sobrepor dados correctos com os da época anterior
  - `PUT /api/materials/[id]` apagava silenciosamente `state`+`paidAmount` de qualquer material "Atribuído ao clube" (sem atleta — ex: equipamento partilhado) ao gravar **qualquer** edição, mesmo sem tocar nesses campos — reconciliação assumia incorrectamente que "Atribuído" exige sempre um atleta
- ✅ **Verificação**: `npm test` 67/67, `npx tsc --noEmit` + `eslint` limpos, cenário exacto do utilizador testado ao vivo via Playwright com múltiplas épocas reais (atleta presente numa época e ausente na seguinte — confirmado em Atletas, Mensalidades e Dashboard, nas duas direcções) + guard de eliminação de época testado ponta-a-ponta (bloqueia com registos, permite sem eles)

### Tarefas manuais pendentes (não podem ser automatizadas)
- ⏳ `npm install` + criar DB `hoqueimanager` + `npx prisma migrate dev --name init` + seed
- ⏳ Criar produtos Stripe (preços mensais €59 e anuais €590) e preencher Price IDs no `.env`
- ⏳ Preencher `RESEND_API_KEY` no `.env` (Resend.com → API Keys)
- ⏳ Deploy Vercel + env vars produção + webhook Stripe produção
- ⏳ Registar `hoqueimanager.com` + apontar DNS para Vercel
- ✅ `public/logoHD.svg` + `public/logoHD.png` + `public/logo.png` criados (logo HD, ícone PWA 512×512)
