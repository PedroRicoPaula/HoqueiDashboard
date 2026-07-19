# Auth & Security — HoqueiManager

## Sistema de Autenticação

### JWT
- Biblioteca: `jose` v6 (não `jsonwebtoken`)
- Algoritmo: HS256
- Expiração: **24h** (alterado de 7d por segurança)
- Cookie: `hm_token` (httpOnly, SameSite=strict) — renomeado de `hcpdl_token` em 2026-06-16
- Payload completo (nota: `clubPrimaryColor` NÃO está no JWT — é devolvido na resposta JSON do login e guardado no auth store Zustand):
```typescript
{
  userId: string,
  email: string,
  name: string,
  clubId: string | null,       // null para super admin
  isSuperAdmin: boolean,       // true → acesso só a /platform
  tokenVersion: number,
  permissions: {               // null para super admin
    viewAthletes, editAthletes,
    viewFees, editFees,
    viewMembers, editMembers,
    viewMaterials, editMaterials,
    viewSponsors, manageSponsors,
    viewTraining, editTraining,
    viewTravel, editTravel,
    viewDirection, editDirection,
    viewAttendance, editAttendance,
    viewTextiles, editTextiles,
    isAdmin
  } | null
}
```

```typescript
// src/lib/auth.ts — getSecret() valida rigorosamente
if (!s) throw new Error('JWT_SECRET env var is not set')
if (s.length < 32) throw new Error('JWT_SECRET too short')
if (s.includes('change-in-production')) throw new Error('...')
```

### PBKDF2 (passwords)
- Web Crypto API (nativo, edge-compatible)
- 100.000 iterações, SHA-256, salt 16 bytes aleatórios
- Formato armazenado: `pbkdf2:<salt_hex>:<hash_hex>`
- Comparação timing-safe: `diff |= derived[i] ^ storedHash[i]` (constant-time XOR)

**NUNCA usar bcrypt** — Web Crypto não suporta, e seria inconsistente com dados existentes.

### Auth Store (Zustand — client side)
`src/store/authStore.ts` persiste no `localStorage` com a chave `hm-auth`. Campos:
- `user.clubName`, `user.clubLanguage`, `user.clubLogoUrl` — meta do clube
- `user.clubPrimaryColor` — HSL triplet (ex: `"142 71% 45%"`) da cor do dashboard; **não está no JWT**, vem da resposta JSON do login e é atualizado em `PATCH /api/settings`
- `clubLanguage` — espelho de `user.clubLanguage` para acesso rápido
- `clubPrimaryColor` — espelho de `user.clubPrimaryColor`

O dashboard layout (`src/app/(dashboard)/layout.tsx`) lê `clubPrimaryColor` do store e aplica como CSS variable inline `--club-primary` + `--club-primary-fg` (calculado automaticamente: L < 55% → texto branco).

### Token Versioning (anti-replay)
- `User.tokenVersion` incrementado em cada logout **e** quando admin redefine password via `PUT /api/admin/users/[id]`
- `getUserFromRequest` rejeita tokens com `tokenVersion` diferente do DB
- Garante invalidação imediata mesmo antes de expirar 24h
- Também incrementado em `PUT /api/admin/permissions/[userId]` (mudança de permissões invalida sessão)

---

## RBAC — Role Based Access Control

### Middleware (Edge Runtime)
O middleware tem 5 camadas em sequência:
1. `/api/stripe/webhook` → bypass CSRF (tem verificação de assinatura Stripe)
2. `/api/*` → CSRF check only (auth feito per-route)
3. Paths públicos (`/{locale}`, `/{locale}/register`) → allow
4. `/platform/*` → requer `isSuperAdmin: true` no JWT
5. Dashboard (`/*`) → requer JWT válido + `clubId` não-nulo + permission check

```typescript
PROTECTED_ROUTES = [
  { pattern: /^\/athletes/,   flag: 'viewAthletes' },
  { pattern: /^\/fees/,       flag: 'viewFees' },
  { pattern: /^\/members/,    flag: 'viewMembers' },
  { pattern: /^\/sponsors/,   flag: 'viewSponsors' },
  { pattern: /^\/materials/,  flag: 'viewMaterials' },
  { pattern: /^\/attendance/, flag: 'viewAttendance' },
  { pattern: /^\/textiles/,   flag: 'viewTextiles' },
  { pattern: /^\/training/,   flag: 'viewTraining' },
  { pattern: /^\/travel/,     flag: 'viewTravel' },
  { pattern: /^\/direction/,  flag: 'viewDirection' },
  { pattern: /^\/reports/,    flag: 'viewAthletes' },
  { pattern: /^\/admin/,      flag: 'isAdmin' },
  { pattern: /^\/settings/,   flag: 'isAdmin' },  // adicionado 2026-07-18, ver SEC-032
]
// isAdmin bypassa qualquer flag
```
Rotas excluídas: `login`, `setup`, `api/setup`, `_next/*`, `favicon.ico`, `manifest.json`, `logo.png`, `uploads`

### Super Admin — Regras de Permissão para Gestão de Clubes
O super admin (`isSuperAdmin: true`) pode gerir clubes via `/api/platform/clubs/*`. Regras de negócio:

**Criar clube grátis** (`POST /api/platform/clubs`):
- Cria `Club` com `isFreeClub: true`, `status: ACTIVE`, `statusChangedAt: now()`
- Cria `User` admin com `isAdmin: true` + todas as permissões granulares `true`
- Password do admin definida imediatamente (PBKDF2) — sem fluxo de email

**Alterar estado** (`PATCH /api/platform/clubs/[id]/status`):
- Clube grátis: ACTIVE ↔ SUSPENDED livremente; `statusChangedAt` atualizado
- Clube pago → SUSPENDED: só se `status === 'PAST_DUE'` (proteção contra suspender clubes pagos em dia)
- Clube pago → ACTIVE: só se `status === 'SUSPENDED'` (reativação manual de suporte)

**Eliminar clube** (`DELETE /api/platform/clubs/[id]`):
- Clube grátis: requer `status === 'SUSPENDED'`
- Clube pago: requer `status === 'SUSPENDED'` + `statusChangedAt < NOW() - 365 dias` (protege de eliminação prematura por atraso recente)
- `statusChangedAt` pode ser nulo em registos antigos → fallback para `updatedAt`
- Elimina por cascade Prisma (todos os modelos tenanted com `onDelete: Cascade`)

**`statusChangedAt`** é atualizado em:
- `invoice.payment_failed` → PAST_DUE (webhook)
- `customer.subscription.deleted` → CANCELLED (webhook)
- `PATCH /api/platform/clubs/[id]/status` → qualquer mudança manual pelo super admin

### Multi-Tenant Tenant Isolation
Todas as API routes do dashboard usam `getDbForRequest(req)`:
```typescript
// src/lib/db.ts
export async function getDbForRequest(req: Request) {
  const user = await getUserFromRequest(req)
  if (!user || !user.clubId) return null
  // Bloqueia clubes CANCELLED ou SUSPENDED mesmo com JWT válido
  const club = await prisma.club.findUnique({ where: { id: user.clubId }, select: { status: true } })
  if (!club || club.status === 'CANCELLED' || club.status === 'SUSPENDED') return null
  return { user, db: getTenantClient(user.clubId), clubId: user.clubId }
}
```
O `getTenantClient(clubId)` é um Prisma `$extends` que injeta `{ clubId }` automaticamente em **todas** as operações de modelos tenanted:
- `findMany`, `findFirst`, `findUnique` → adiciona a `where`
- `create`, `createMany` → adiciona a `data`
- `update`, `updateMany`, `delete`, `deleteMany` → adiciona a `where`
- `count`, `aggregate`, `groupBy` → adiciona a `where`

Modelos tenanted (auto-filtrados, 16): **Season**, Athlete, Member, Sponsor, Material, Travel, DirectionMember, Training, TrainingSchedule, TrainingSession, TextileItem, AuditLog, AthletePayment, Quota, DirectionSalaryPayment, AttendanceRecord.

> `Season` foi adicionado ao TENANTED set em 2026-07-16 — o Prisma Extension injeta `clubId` automaticamente em todas as operações de Season. Em `db.season.create()`, ainda é necessário passar `clubId: ctx.clubId` explicitamente porque o TS type gerado pelo Prisma exige `clubId` ou `club` no `data` (o Extension injeta em runtime mas o TS não o sabe).

Modelos NÃO tenanted (sem `clubId` no schema — usar `prisma` global): User, Permission, Playbook, RateLimit.

A extensão também cobre `upsert`: injeta `clubId` no bloco `create`. O `where` de um upsert usa sempre uma unique constraint composta (ex. `athleteId_month_year`) que o `WhereUniqueInput` gerado pelo Prisma não permite estender com `clubId` — por isso a extensão faz um `findFirst` (com o `where` achatado via `flattenUniqueWhere`) antes de correr o upsert, e lança erro se o registo encontrado pertencer a outro clube. Sem este check, um upsert por chave composta partilhada entre clubes (ex. mesmo `athleteId` de outro clube, caso a rota não valide o `athleteId` primeiro) sobreporia dados de outro clube silenciosamente. Ver `src/lib/prisma-tenant.ts`.

### API Route Level
```typescript
const user = await getUserFromRequest(req)
if (!user) return 401
if (!hasPermission(user.permissions, 'editAthletes')) return 403
```

### Client Level
```typescript
const { can, isAdmin } = usePermissions()
if (can('editAthletes')) { /* mostrar botão editar */ }
```

### hasPermission() — Regra de Ouro
```typescript
// src/lib/permissions.ts
export function hasPermission(permissions, flag): boolean {
  if (!permissions) return false
  if (permissions.isAdmin) return true  ← admin bypassa tudo
  return Boolean(permissions[flag])
}
```

---

## CSRF Protection

### Middleware (rotas de página e API)
```typescript
// Verifica origin/referer contra host
allowedOrigins = [`http://${host}`, `https://${host}`, NEXT_PUBLIC_APP_URL]
if (origin) return allowedOrigins.some(o => o === origin)
if (referer) return allowedOrigins.some(o => referer.startsWith(o))
return false // sem origin/referer = rejeitar (fix SEC-004)
```

### `src/lib/csrf.ts`
⚠️ **Atenção:** `validateCsrf()` neste ficheiro é usado apenas em testes unitários.
As rotas API **não importam** este ficheiro — dependem do middleware para CSRF.
Ver [Issues](ISSUES-BACKLOG.md) para eventual limpeza.

---

## Rate Limiting

### Implementação (PostgreSQL atómico)
```typescript
// src/lib/rateLimit.ts — DB-backed, funciona em serverless multi-instância
export async function checkRateLimit(identifier, { windowMs, max }) {
  const rows = await prisma.$queryRaw`
    INSERT INTO "RateLimit" (key, count, "resetAt", "updatedAt")
    VALUES (${identifier}, 1, ${resetAt}, NOW())
    ON CONFLICT (key) DO UPDATE SET
      count     = CASE WHEN "RateLimit"."resetAt" < NOW() THEN 1 ELSE "RateLimit".count + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" < NOW() THEN ${resetAt} ELSE "RateLimit"."resetAt" END,
      "updatedAt" = NOW()
    RETURNING count, "resetAt"
  `
  // ...
}
```
O `INSERT ... ON CONFLICT DO UPDATE` é **atómico ao nível da base de dados** — sem race conditions mesmo com múltiplas instâncias serverless simultâneas. Substitui a implementação anterior `in-memory Map` (DEBT-002).

### Onde está aplicado
- `POST /api/auth/login` → 10 req / 15 min por IP
- `POST /api/auth/change-password` → 5 req / 15 min por IP
- `POST /api/auth/forgot-password` → 5 req / 15 min por IP
- `POST /api/auth/reset-password` → 5 req / 15 min por IP
- `POST /api/register` → 5 req / 60 min por IP
- `POST /api/platform/clubs` → 20 req / 60 min por super admin (`platform:create-club:{userId}`)

### Extração de IP (ordem de prioridade)
1. `CF-Connecting-IP` — Cloudflare (não pode ser falsificado atrás do CF)
2. `x-real-ip` — Vercel/nginx
3. `x-forwarded-for` — primeiro IP da lista
4. `'unknown'` — fallback

### Modelo de dados
Ver `RateLimit` em `prisma/schema.prisma` e migration `20260602000005_rate_limit`.

---

## Security Headers (next.config.mjs)

```javascript
Content-Security-Policy:
  default-src 'self'
  script-src  'self' 'unsafe-inline' https://js.stripe.com     ← produção (unsafe-eval REMOVIDO — SEC-005)
              'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com  ← dev only
  style-src   'self' 'unsafe-inline'                            ← Tailwind inline styles
  img-src     'self' data: blob: <R2_ORIGIN>                    ← dinâmico: origin de R2_PUBLIC_URL ou https://*.r2.dev como fallback
  connect-src 'self' https://api.stripe.com
  font-src    'self' data:                                      ← base64 fonts (Geist)
  frame-src   https://js.stripe.com https://hooks.stripe.com
  frame-ancestors 'none'

X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**Regra ao adicionar recursos externos:**
- API externa → adicionar a `connect-src`
- Imagens externas → adicionar a `img-src`
- Fonts externas → adicionar a `font-src`
- Scripts externos → adicionar a `script-src` (evitar sempre que possível)

### Cache de uploads
```javascript
// /uploads/:path* tem headers separados:
Cache-Control: public, max-age=31536000, immutable
Content-Disposition: inline
```

---

## Upload de Ficheiros

```
Allowed MIME: image/png, image/jpeg, image/jpg
⚠️  SVG removido da allowlist (XSS via SVG inline scripts)
Max size: 2MB
Filename: 16 bytes crypto.getRandomValues() → hex string + ext
```

Mensagem de erro e `accept` do input corrigidos para "PNG e JPG" (SVG foi removido da allowlist por risco XSS — 2026-05-27).

---

## Riscos Conhecidos (ver ISSUES-BACKLOG.md)

> Todos os riscos críticos identificados nas auditorias de 2026-06-02, 2026-06-23, 2026-06-25, 2026-06-26 e 2026-06-29 foram resolvidos. Ver [ISSUES-BACKLOG.md](ISSUES-BACKLOG.md) para detalhes.

---

## ErrorBoundary + ChunkLoadError

```typescript
// src/components/ErrorBoundary.tsx
static getDerivedStateFromError(error: Error): State {
  if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
    window.location.reload()  ← recuperação automática
    return { hasError: false, message: '' }
  }
  return { hasError: true, message: error.message }
}
```

ChunkLoadError ocorre quando o browser tem chunks cacheados de um deploy anterior. O reload força carregar os novos chunks.

---

## Vulnerabilidades Conhecidas (Auditoria 2026-06-02 — todas resolvidas)

> Ver histórico completo em [ISSUES-BACKLOG.md](ISSUES-BACKLOG.md).

| ID | Severidade | Resumo | Estado |
|----|-----------|--------|--------|
| SEC-001 | ~~CRÍTICO~~ | Login não audita tentativas falhadas nem sucessos | ✅ Resolvido 2026-06-02 |
| SEC-002 | ~~ALTO~~ | Mudança de permissões não invalida JWT existente | ✅ Resolvido 2026-06-02 |
| SEC-003 | ~~ALTO~~ | Upload valida só `file.type` — magic bytes não verificados | ✅ Resolvido 2026-06-02 |
| SEC-004 | ~~ALTO~~ | CSRF fallback `return true` quando sem Origin/Referer | ✅ Resolvido 2026-06-02 |
| SEC-005 | ~~MÉDIO~~ | CSP tem `unsafe-eval` em `script-src` em produção | ✅ Resolvido 2026-06-02 |
| SEC-006 | ~~BAIXO~~ | `pavilionUrl` aceita qualquer string sem validação de URL | ✅ Resolvido 2026-06-02 |
| SEC-007 | ~~BAIXO~~ | Sem `Strict-Transport-Security` header explícito | ✅ Resolvido 2026-06-02 |
| SEC-008 | ~~BAIXO~~ | Export de audit log sem limite de registos | ✅ Resolvido 2026-06-02 |
| SEC-009 | ~~ALTO~~ | Cross-tenant data leak em dashboard stats | ✅ Resolvido 2026-06-22 |
| SEC-010 | ~~MÉDIO~~ | `/privacy` e `/terms` atrás de auth | ✅ Resolvido 2026-06-22 |
| SEC-011 | ~~ALTO~~ | Attendance aggregate cross-tenant no dashboard | ✅ Resolvido 2026-06-23 |
| SEC-012 | ~~CRÍTICO~~ | `tempPassword` em metadata Stripe + `Math.random()` | ✅ Resolvido 2026-06-25 (set-password flow via PasswordResetToken) |

## Vulnerabilidades Auditoria 2026-06-26

| ID | Severidade | Resumo | Estado |
|----|-----------|--------|--------|
| SEC-013 | ~~ALTO~~ | Admin permissions GET expunha users de todos os clubes | ✅ Resolvido 2026-06-26 |
| SEC-014 | ~~ALTO~~ | AthletePayment GET sem filtro de clube — cross-tenant IDOR | ✅ Resolvido 2026-06-26 |
| SEC-015 | ~~ALTO~~ | Quota GET sem filtro de clube — cross-tenant IDOR | ✅ Resolvido 2026-06-26 |
| SEC-016 | ~~ALTO~~ | DirectionSalaryPayment GET sem filtro de clube — cross-tenant IDOR | ✅ Resolvido 2026-06-26 |
| SEC-017 | ~~CRÍTICO~~ | Prisma Extension não cobria `findUnique`/`update`/`delete` — IDOR sistémico | ✅ Resolvido 2026-06-26 |
| SEC-018 | ~~ALTO~~ | Admin reset-password sem verificação de clube | ✅ Resolvido 2026-06-26 |
| SEC-019 | ~~MÉDIO~~ | Playbook upsert sem verificar ownership do treino | ✅ Resolvido 2026-06-26 |
| SEC-020 | ~~ALTO~~ | Admin criar utilizador sem clubId — user sem clube | ✅ Resolvido 2026-06-26 |
| SEC-021 | ~~ALTO~~ | Admin alterar permissões de user de outro clube — IDOR | ✅ Resolvido 2026-06-26 |
| SEC-022 | ~~MÉDIO~~ | Club CANCELLED/SUSPENDED não bloqueava API pós-login | ✅ Resolvido 2026-06-26 |
| SEC-023 | ~~BAIXO~~ | Upload de logo sem audit log | ✅ Resolvido 2026-06-26 |
| SEC-025 | ~~BAIXO~~ | Templates de email sem HTML escaping — XSS em clientes sem sandbox | ✅ Resolvido 2026-06-26 |
| SEC-026 | ~~ALTO~~ | Prisma Extension `upsert` só injectava `clubId` no `create`, nunca no `where` — upsert por chave composta partilhada (athleteId+month+year, etc.) podia sobrepor registo de outro clube se a rota não validasse o `athleteId`/`memberId` primeiro | ✅ Resolvido 2026-07-06 |

**Sem débito de segurança ativo relevante.** Ver ISSUES-BACKLOG.md para issues menores.

## Vulnerabilidades Auditoria 2026-07-16

| ID | Severidade | Resumo | Estado |
|----|-----------|--------|--------|
| SEC-027 | ~~ALTO~~ | `POST /api/attendance/[id]/records` — athleteIds submetidos não validados contra clube atual; IDOR permitia associar atletas de outro clube a sessões | ✅ Resolvido 2026-07-16 (validação explícita de ownership antes de upsert) |
| SEC-028 | ~~MÉDIO~~ | `DELETE /api/admin/audit` — body sem Zod validation; tipo inferido por `as any` permitia body malformado sem erro | ✅ Resolvido 2026-07-16 (discriminatedUnion Zod schema) |
| SEC-029 | ~~MÉDIO~~ | `PUT /api/admin/permissions/[userId]` — body destructurado diretamente sem validação; campos extra ou mal-tipados passavam silenciosamente para o Prisma | ✅ Resolvido 2026-07-16 (permissionsSchema com 21 campos boolean) |
| SEC-030 | ~~BAIXO~~ | `POST /api/platform/clubs` — sem rate limiting; super admin podia criar volume elevado de clubes por erro ou script | ✅ Resolvido 2026-07-16 (20/hora por super admin via `checkRateLimit`) |
| SEC-031 | ~~BAIXO~~ | Platform APIs (criar/suspender/eliminar clube) sem audit log — operações críticas invisíveis | ✅ Resolvido 2026-07-16 (CREATE_FREE_CLUB, CHANGE_CLUB_STATUS, DELETE_CLUB) |

---

## Vulnerabilidades 2026-07-18

| ID | Severidade | Resumo | Estado |
|----|-----------|--------|--------|
| SEC-032 | ~~ALTO~~ | `GET`/`PATCH /api/settings` não verificavam `isAdmin` nem usavam `getDbForRequest` correctamente — qualquer utilizador autenticado (não só admin) conseguia ler e alterar as definições do clube (nome, idioma, país, cor). Rota também não estava em `PROTECTED_ROUTES` do middleware | ✅ Resolvido 2026-07-18 (`getDbForRequest` + `isAdmin` check nos dois handlers; `CLUB_SELECT` allowlist explícita no GET; rota adicionada a `PROTECTED_ROUTES`) |
| SEC-033 | ~~MÉDIO~~ | `POST /api/register/complete` — reabrir o mesmo `success_url` do Stripe Checkout (link antigo, refresh do browser) emitia um token de sessão novo de cada vez; nada impedia reusar o mesmo `session_id` indefinidamente | ✅ Resolvido 2026-07-18 (`Club.registerCompletedAt` gravado atomicamente via `updateMany` com o próprio campo `null` no `where` — funciona como claim de utilização única; se `count === 0`, pedido rejeitado sem emitir token. Claim acontece antes de qualquer token ser emitido) |
| SEC-034 | ~~BAIXO~~ | `PUT /api/admin/users/[id]` (redefinir password) não impedia um admin de redefinir a própria password através do painel de administração — via cliente conseguia auto-destrancar-se sem passar pelo fluxo normal de "Mudar palavra-passe" | ✅ Resolvido 2026-07-18 (botão desactivado no cliente para a própria conta; servidor rejeita o pedido quando `id === utilizador autenticado`, independentemente do payload) |

---

## Ciclo de Vida de Subscrição — Cancelamento, Suspensão, Reactivação (2026-07-18)

`SUSPENDED` é o único estado operacional "sem acesso, sem eliminar dados" — cancelamento self-serve e falha de pagamento definitiva convergem nele. `CANCELLED` continua no enum `ClubStatus` por compatibilidade histórica mas deixou de ser atribuído por qualquer fluxo novo.

- **`POST /api/billing/cancel`** (autenticado, exige `isAdmin` via `getDbForRequest` + `hasPermission`) — cancela a subscrição no Stripe **imediatamente** (`stripe.subscriptions.cancel`, sem esperar pelo fim do período já pago), marca o clube `SUSPENDED` + `statusChangedAt`, invalida a sessão de **todos** os utilizadores do clube numa só operação (`prisma.user.updateMany({ where: { clubId }, data: { tokenVersion: { increment: 1 } } })` — não só o `tokenVersion` de quem clicou), limpa o cookie `hm_token` da resposta. Se `club.stripeSubscriptionId` já não existir no Stripe (ex: cancelado por fora), o erro é apanhado e ignorado — a suspensão local acontece sempre.
- **`POST /api/billing/reactivate`** (público — chamado a partir do próprio ecrã de login bloqueado, onde por definição ainda não há sessão) — rate limited 10/hora/IP. Só aceita clubes **não-grátis** em `SUSPENDED`/`PAST_DUE` com `stripeCustomerId` definido; devolve erro claro ("contacte o suporte") nos outros casos, sem crashar. Reabre Stripe Checkout com o `stripeCustomerId` existente — `success_url`/`cancel_url` apontam sempre para `/login` (nunca faz login automático, ao contrário do fluxo de registo).
- **`POST /api/platform/clubs/[id]/send-payment-link`** (super admin apenas) — só para clubes `isFreeClub`. Cria/reutiliza `stripeCustomerId`, gera Stripe Checkout (plano `monthly`/`STRIPE_PRICE_MONTHLY` ou `test`/`STRIPE_PRICE_TEST`) e envia por email — **o clube paga com o próprio cartão**, não o do super admin. A activação (`ACTIVE` + `isFreeClub: false`) é feita pelo webhook `checkout.session.completed` via `clubActivation.ts`, exactamente como no registo normal — a rota em si só cria a sessão e envia o email, não activa nada directamente.
- **`POST /api/auth/login`** devolve `{error, status, canReactivate}` em 403 quando o clube não está `ACTIVE`. `canReactivate` só é `true` para clubes pagos em `SUSPENDED`/`PAST_DUE` — nunca para clubes grátis (que não têm `stripeCustomerId` utilizável para reactivação self-serve).
- Nenhuma das 3 rotas novas chama `validateCsrf` manualmente — cobertas automaticamente pelo middleware (`/api/*` não excluído do matcher). `/api/billing/reactivate` é a única rota pública deste grupo; a proteção contra abuso é o rate limit por IP, não autenticação.
- `src/lib/stripe.ts` centraliza `getStripe()` — antes duplicado (`new Stripe(...)` inline) em vários ficheiros; consolidado por completo em 2026-07-19 (`register/complete/route.ts` e `platform/page.tsx` ainda tinham instâncias próprias, encontradas ao alinhar a `apiVersion` — ver `docs/CONVENTIONS.md`).

### Achados de segurança — Auditoria 2026-07-18 (ainda por corrigir, ver `docs/ISSUES-BACKLOG.md`)

| ID | Severidade | Resumo | Estado |
|----|-----------|--------|--------|
| SEC-035 | ~~ALTO~~ | `LOGIN` (sucesso) e `REGISTER` ficam sempre com `clubId: null` no audit log — nenhum admin de clube vê os seus próprios logins | ✅ Resolvido 2026-07-18 — ver secção "clubId em logAudit" acima |
| SEC-036 | ~~BAIXO~~ | `PATCH`/`DELETE /api/platform/clubs/[id]` sem rate limit (ao contrário do `POST` irmão) — impacto limitado, já exige `isSuperAdmin` | ✅ Resolvido 2026-07-18 (mesmo limite do `POST`, 20/hora por super admin) |

---

## Fluxo de Registo (password definida no formulário)

**Reescrito 2026-07-17** — o fluxo anterior (tempPassword + email de boas-vindas com link de definição de password) foi substituído:

1. `POST /api/register` → recebe `password`+`confirmPassword` no próprio formulário de registo (`min(8)` + `refine` de igualdade) → cria `Club` (`PENDING_PAYMENT`) + `User` admin já com a hash da password definida (sem placeholder). Rate limited (5/hora/IP). Audit log `REGISTER`
2. Stripe Checkout → pagamento → `success_url` aponta para `/register/complete?session_id={CHECKOUT_SESSION_ID}`
3. `POST /api/register/complete` confirma `payment_status === 'paid'` **directo no Stripe** (não espera pelo webhook), activa o clube via `src/lib/clubActivation.ts`, e devolve o mesmo contrato JSON de `/api/auth/login` (`{user, permissions, redirectTo}` + cookie `hm_token`) — login automático, sem passar pelo ecrã de login
4. Webhook `checkout.session.completed` chama o mesmo `activateClubFromSession()` como backstop idempotente, para o caso de o browser nunca voltar ao `success_url`

**Sem** `tempPassword` em metadata Stripe — a password já existe desde o passo 1. **Sem** email de boas-vindas (`welcomeEmailHtml` removido de `src/lib/email.ts` — código morto). `RESEND_API_KEY` **já não é crítico** para o onboarding — só é usado por `/forgot-password`.

**Anti-replay (2026-07-18, SEC-033):** ver tabela acima — `Club.registerCompletedAt` fecha a possibilidade de reabrir `success_url` para gerar sessões novas indefinidamente.

---

## AuditAction — Tipos Completos

```typescript
// src/lib/audit.ts
export type AuditAction =
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'LOGIN' | 'LOGIN_FAIL' | 'LOGOUT'
  | 'CHANGE_PASSWORD' | 'CHANGE_PERMISSIONS'
  | 'PASSWORD_RESET' | 'PASSWORD_RESET_REQUEST'
  | 'UPDATE_CLUB_LOGO' | 'REMOVE_CLUB_LOGO'
  | 'REGISTER'
  | 'SUBSCRIPTION_ACTIVATED' | 'PAYMENT_SUCCEEDED' | 'PAYMENT_FAILED' | 'SUBSCRIPTION_CANCELLED'
  | 'CREATE_FREE_CLUB' | 'CHANGE_CLUB_STATUS' | 'DELETE_CLUB' | 'PAYMENT_LINK_SENT'
```

Ao adicionar novas ações de audit, **sempre** adicionar ao union type acima primeiro — caso contrário o TypeScript rejeita a chamada a `logAudit()`.

### clubId em logAudit (fix 2026-06-29; gap encontrado e corrigido 2026-07-18, ver SEC-035)

`logAudit()` em `src/lib/audit.ts` extrai automaticamente o `clubId` do JWT via `getUserFromRequest(req)`, lendo o cookie do **pedido actual**. Isto é correcto para eventos genuinamente não autenticados (`LOGIN_FAIL`, `PASSWORD_RESET_REQUEST`) — `clubId = null` é o resultado certo, não pertencem a nenhum clube.

**Fix SEC-035**: `LOGIN` (sucesso) e `REGISTER` ficavam com `clubId = null` por acidente, não por design — no momento em que `logAudit()` corria, o cookie `hm_token` ainda não tinha sido emitido (é a própria criação da sessão), por isso `getUserFromRequest` não encontrava nada. `logAudit()` ganhou um 8º parâmetro opcional `clubIdOverride` — quando presente, é usado directamente em vez da resolução automática via cookie. `login/route.ts`, `register/route.ts` e `register/complete/route.ts` passam agora `user.clubId`/`club.id` explicitamente nas chamadas de `LOGIN`/`REGISTER`, já que nesse momento já conhecem o clube (acabaram de autenticar/criar). Confirmado ao vivo: login novo → `AuditLog.clubId` preenchido corretamente (antes: sempre `null`).

---

## Testes de Segurança (Vitest)

```
src/__tests__/auth.test.ts         ← hashPassword, comparePassword, JWT sign/verify, timing-safe
src/__tests__/csrf.test.ts         ← validateCsrf() origin/referer validation
src/__tests__/rateLimit.test.ts    ← checkRateLimit (mock prisma), getClientIp (CF/real-ip/forwarded)
src/__tests__/permissions.test.ts  ← hasPermission: null/undefined, todos os 20 flags, isAdmin bypass
src/__tests__/validations.test.ts  ← Zod schemas: athlete, material, textile, travel, attendance bulk
```

**Total: 58 testes** (5 ficheiros). Executar: `npm test` ou `npm run test:coverage`
