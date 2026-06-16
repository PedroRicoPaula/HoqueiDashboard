# Auth & Security — HoqueiManager

## Sistema de Autenticação

### JWT
- Biblioteca: `jose` v6 (não `jsonwebtoken`)
- Algoritmo: HS256
- Expiração: **24h** (alterado de 7d por segurança)
- Cookie: `hm_token` (httpOnly, SameSite=strict) — renomeado de `hcpdl_token` em 2026-06-16
- Payload completo:
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
  return { user, db: getTenantClient(user.clubId), clubId: user.clubId }
}
```
O `getTenantClient(clubId)` é um Prisma `$extends` que injeta `{ clubId }` automaticamente em:
- `findMany`, `findFirst`, `count`, `aggregate`, `groupBy` → adiciona a `where`
- `create`, `createMany` → adiciona a `data`
- `updateMany`, `deleteMany` → adiciona a `where`

Modelos tenanted: Athlete, Member, Sponsor, Material, Travel, DirectionMember, Training, TrainingSchedule, TrainingSession, TextileItem, AuditLog.

Modelos NÃO tenanted (usam `prisma` global): User, Permission, Playbook, AthletePayment, Quota, DirectionSalaryPayment, AttendanceRecord, RateLimit.

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
return true // sem origin/referer = chamada server-to-server
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
  script-src  'self' 'unsafe-inline' 'unsafe-eval'  ← Next.js requer
  style-src   'self' 'unsafe-inline'                ← Tailwind inline styles
  img-src     'self' data: blob: https://*.r2.dev   ← logos R2 + base64
  connect-src 'self'
  font-src    'self' data:                           ← base64 fonts (Geist)
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

## Vulnerabilidades Conhecidas (Auditoria 2026-06-02)

> Estado de cada item em [ISSUES-BACKLOG.md](ISSUES-BACKLOG.md) (SEC-001 a SEC-008).

| ID | Severidade | Resumo | Ficheiro |
|----|-----------|--------|---------|
| SEC-001 | ~~CRÍTICO~~ ✅ | Login não audita tentativas falhadas nem sucessos | `api/auth/login/route.ts` — resolvido 2026-06-02 |
| SEC-002 | ALTO | Mudança de permissões não invalida JWT (tokenVersion não incrementado) | `api/admin/permissions/[userId]/route.ts` |
| SEC-003 | ALTO | Upload valida só `file.type` — magic bytes não verificados | `api/upload/route.ts` |
| SEC-004 | ALTO | CSRF fallback `return true` quando sem Origin/Referer | `middleware.ts:38-39` |
| SEC-005 | MÉDIO | CSP tem `unsafe-eval` em `script-src` (desnecessário em produção) | `next.config.mjs` |
| SEC-006 | MÉDIO | `Content-Disposition: inline` em uploads (risco se ficheiro não-imagem chegasse à pasta) | `next.config.mjs` |
| SEC-007 | BAIXO | `pavilionUrl` aceita qualquer string — deve ser `z.string().url()` | `lib/validations.ts` |
| SEC-008 | BAIXO | Sem `Strict-Transport-Security` header explícito na app | `next.config.mjs` |

**Nota CSRF (SEC-004):** O risco real é baixo porque o cookie tem `SameSite: strict` — browsers não enviam o cookie em pedidos cross-origin, o que já bloqueia CSRF ao nível do cookie. A verificação de Origin é defense-in-depth.

**Nota Rate Limiting:** Já documentada como DEBT-002 — ver secção acima.

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
