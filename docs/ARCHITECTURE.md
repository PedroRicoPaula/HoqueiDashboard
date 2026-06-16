# Architecture — Gestão HCPDL

## Fluxo de Request

```
Browser
  │
  ├─[página]──► middleware.ts (Edge Runtime)
  │               ├─ CSRF check (origin/referer vs host)
  │               ├─ JWT verify (jose, HS256)
  │               ├─ Permission check (PROTECTED_ROUTES map)
  │               └─ redirect /login ou /?error=forbidden se falhar
  │
  ├─[API]──────► /api/** route handler
  │               ├─ CSRF check (middleware, transparente)
  │               ├─ getUserFromRequest(req)
  │               │    ├─ extrai cookie hcpdl_token
  │               │    ├─ verifyToken() → jose jwtVerify
  │               │    ├─ prisma.user.findUnique({ include: permissions })
  │               │    └─ valida tokenVersion (anti-replay após logout)
  │               ├─ hasPermission(user.permissions, 'flag')
  │               ├─ Zod safeParse(body)
  │               ├─ prisma query
  │               ├─ logAudit() (escrita silenciosa, nunca quebra request)
  │               └─ NextResponse.json()
  │
  └─[auth]─────► /api/auth/login
                  ├─ loginSchema.safeParse
                  ├─ checkRateLimit(ip, 5req/15min)
                  ├─ prisma.user.findUnique
                  ├─ comparePassword() → PBKDF2 timing-safe compare
                  ├─ signToken({ userId, email, permissions, tokenVersion })
                  ├─ logAudit LOGIN
                  └─ Set-Cookie: hcpdl_token (httpOnly, SameSite=Lax, 24h)
```

---

## Arquitetura da Aplicação

### Next.js App Router — Grupos de Rotas

```
app/
├── (dashboard)/     ← grupo autenticado, layout com Sidebar + TopNav
│   └── layout.tsx   ← ErrorBoundary wraps children
├── login/           ← pública, sem layout dashboard
└── setup/           ← pública, cria primeiro utilizador (desativa após usar)
```

O middleware.ts exclui do check: `login`, `setup`, `api/setup`, `_next/static`, `_next/image`, `favicon.ico`, `uploads`.

### Layers

```
┌─────────────────────────────────────────────────┐
│  React (Client Components, 'use client')        │
│  Zustand stores (authStore, tacticalStore,      │
│                  sidebarStore)                  │
│  shadcn/ui + TailwindCSS                        │
├─────────────────────────────────────────────────┤
│  Next.js Route Handlers (API)                   │
│  Server-side only, Node.js runtime              │
│  Sem edge runtime nas APIs (apenas middleware)  │
├─────────────────────────────────────────────────┤
│  Prisma Client (v7, adapter-pg)                 │
│  Singleton em globalThis (dev HMR safe)         │
├─────────────────────────────────────────────────┤
│  PostgreSQL (Neon em produção, local em dev)    │
└─────────────────────────────────────────────────┘
```

---

## Padrões de Dados

### Autenticação Client-Side
1. Login → API devolve cookie `hcpdl_token` (httpOnly)
2. API `/api/auth/me` devolve user + permissions
3. `authStore` (Zustand + persist localStorage) guarda `{ user, permissions }`
4. `usePermissions()` lê do store → `can('viewAthletes')`, `isAdmin`
5. Sidebar filtra navItems com `can(permission)`

### Sessão invalidada após logout
- `tokenVersion` incrementa em logout
- `getUserFromRequest` compara `user.tokenVersion !== payload.tokenVersion`
- Tokens antigos rejeitados mesmo que não expirados

---

## Segurança em Camadas

| Camada | Mecanismo |
|--------|-----------|
| Rotas de página | middleware.ts: JWT verify + permission flag |
| Rotas de API | `getUserFromRequest` + `hasPermission` por route |
| Mutações cross-origin | CSRF check (origin/referer) no middleware |
| Brute-force login | Rate limit 5 req/15min (in-memory) |
| Passwords | PBKDF2-SHA256, 100k iterations, 16-byte salt |
| XSS/Clickjacking | CSP + X-Frame-Options + X-Content-Type-Options |
| Uploads | MIME whitelist (PNG/JPG), max 2MB, filename aleatório |
| Audit | Toda escrita gera AuditLog com IP, user, entity, details |

---

## Upload de Ficheiros

**Lógica dual** em `src/app/api/upload/route.ts`:
- Se `R2_BUCKET_NAME` existe → upload para Cloudflare R2 → URL pública
- Se não existe → salva em `public/uploads/sponsors/` (dev local)

CSP `img-src` tem `https://*.r2.dev` para permitir imagens do R2.

---

## Quadro Tático Digital

Módulo mais complexo do sistema. Stack própria:

```
tacticalStore (Zustand, não persistido)
  ├── elements[] → { id, type: 'player'|'opponent'|'ball'|'cone', label }
  ├── frames[] → { frameIndex, positions: { [elementId]: {x,y} } }
  ├── currentFrameIndex
  └── playback → setTimeout(1200ms/frame)

HockeyField.tsx → SVG/DOM drag-and-drop (CSS transforms)
TacticalBoard.tsx → orquestração geral
BoardToolbar.tsx → adicionar elementos, save, reset
FrameTimeline.tsx → navegar/gerir frames
PlaybackOverlay.tsx → animação de playback

API: GET/PUT /api/training/[id]/playbook
DB: Playbook { trainingId, frames JSON }
```

Limite: 50 elementos, 100 frames, labels máx 20 chars (validado no PUT).
