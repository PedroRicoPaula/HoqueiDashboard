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
]
// isAdmin bypassa qualquer flag
```
Rotas excluídas: `login`, `setup`, `api/setup`, `_next/*`, `favicon.ico`, `manifest.json`, `logo.png`, `uploads`

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

Modelos tenanted (auto-filtrados): Athlete, Member, Sponsor, Material, Travel, DirectionMember, Training, TrainingSchedule, TrainingSession, TextileItem, AuditLog, AthletePayment, Quota, DirectionSalaryPayment, AttendanceRecord.

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

---

## Fluxo de Registo (sem tempPassword)

O fluxo seguro de onboarding (implementado 2026-06-25) evita expor credenciais:

1. `POST /api/register` → cria `Club` + `User` com password placeholder (32 bytes aleatórios, ninguém sabe)
2. Stripe Checkout → pagamento
3. `checkout.session.completed` webhook → incrementa `tokenVersion`, cria `PasswordResetToken` (24h), envia email "Definir Palavra-passe" com link para `/reset-password?token=...`
4. Utilizador clica no link → define a sua própria password → sessão iniciada

**Sem** `tempPassword` em metadata Stripe. **Sem** credenciais em texto claro em email. `RESEND_API_KEY` é **obrigatório** para este fluxo funcionar — sem ele, o utilizador recebe o Stripe Checkout mas não recebe o email de boas-vindas.

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
```

Ao adicionar novas ações de audit, **sempre** adicionar ao union type acima primeiro — caso contrário o TypeScript rejeita a chamada a `logAudit()`.

### clubId em logAudit (fix 2026-06-29)

`logAudit()` em `src/lib/audit.ts` extrai automaticamente o `clubId` do JWT via `getUserFromRequest(req)`. Não é necessário passar `clubId` como argumento — a função resolve-o internamente. Eventos de rotas não autenticadas (LOGIN_FAIL, PASSWORD_RESET_REQUEST) ficam com `clubId = null` na BD, o que é correto: não pertencem a nenhum clube específico e são invisíveis nos audit logs por clube (o filtro tenant exclui-os). Se for necessário ver eventos de sistema, consultar diretamente via Prisma Studio ou export da super admin.

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
