# CLAUDE.md — Gestão HCPDL
> Lido automaticamente em cada sessão. Contém tudo o que precisas de saber antes de tocar no código.

## Identidade do Projeto
**Nome:** Sistema de Gestão do Hóquei Clube Ponta Delgada  
**URL produção:** https://dashboard.hoqueiclubepdl.com  
**Repositório:** branch `main` → Vercel (deploy automático no push)  
**Data última auditoria:** 2026-05-27

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
| Testes | Vitest | ^4.1.5 |

---

## Credenciais Dev Local
```
DB:  postgresql://postgres:postgresql123@localhost:5432/hcpdl
JWT: hcpdl-local-dev-key-757a3f92b1e04cd8a6f2e3d5c8b91047
URL: http://localhost:3000
Login: admin@hcpdl.pt / admin123
```

## Env Vars Produção (Vercel)
```
DATABASE_URL          → Neon PostgreSQL connection string
JWT_SECRET            → min 32 chars, sem "change-in-production"
NEXT_PUBLIC_APP_URL   → https://dashboard.hoqueiclubepdl.com
R2_BUCKET_NAME        → Cloudflare R2 bucket (logos patrocinadores)
R2_ACCOUNT_ID         → Cloudflare account ID
R2_ACCESS_KEY_ID      → R2 access key
R2_SECRET_ACCESS_KEY  → R2 secret key
R2_PUBLIC_URL         → public URL do bucket R2
```

---

## Regras Críticas — NUNCA VIOLAR

1. **Passwords → apenas PBKDF2** (`hashPassword`/`comparePassword` em `src/lib/auth.ts`). Formato: `pbkdf2:salt_hex:hash_hex`. Não usar bcrypt.
2. **Next.js 15 async params** — todos os route handlers usam `{ params }: { params: Promise<{ id: string }> }` e `const { id } = await params`. Nunca `params.id` direto.
3. **JWT expira em 24h** — definido em `signToken()`. Não aumentar.
4. **`getSecret()` valida o JWT_SECRET** — rejeita se vazio, <32 chars, ou contém "change-in-production". Vai crashar em build se errado.
5. **CSRF no middleware** — já feito para rotas de página. API routes não precisam chamar `validateCsrf` manualmente (middleware trata).
6. **Audit log em toda operação de escrita** — chamar `logAudit(req, user.id, user.email, action, entity, entityId, details)` em todos os POST/PUT/DELETE. **Inclui logins** — sucesso E falha devem ser auditados em `/api/auth/login` (falha: `userId=null`). Ver SEC-001.
7. **CSP headers em `next.config.mjs`** — qualquer novo domínio externo precisa ser adicionado às diretivas corretas (`connect-src`, `img-src`, etc).
8. **Cookie de auth: `hcpdl_token`** — nome fixo, usado em middleware e `getTokenFromCookies`.
9. **`isAdmin` bypassa todas as permissões** — ver `hasPermission()` em `src/lib/permissions.ts`.

---

## Comandos Úteis
```bash
npm run dev                    # dev server → localhost:3000
npm run build                  # build + migrate deploy + prisma generate
npx prisma db seed             # criar admin (admin@hcpdl.pt / admin123)
npx prisma migrate dev         # nova migration (dev only)
npx prisma studio              # GUI do DB
npm test                       # vitest run
```

---

## Estrutura de Dirs (resumo)
```
src/
├── app/
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
│   │   └── admin/             # Permissões + Audit log
│   ├── api/                   # API routes (Next.js Route Handlers)
│   ├── login/                 # Página de login
│   └── setup/                 # Setup inicial (criar primeiro admin)
├── lib/                       # Utilitários server-side
│   ├── auth.ts                # JWT + PBKDF2
│   ├── prisma.ts              # Singleton PrismaClient com adapter pg
│   ├── permissions.ts         # hasPermission()
│   ├── validations.ts         # Todos os schemas Zod
│   ├── audit.ts               # logAudit()
│   ├── rateLimit.ts           # checkRateLimit() + getClientIp()
│   ├── csrf.ts                # validateCsrf() — ⚠️ usado só em testes, não nas routes
│   ├── logger.ts              # logger.error/warn/info
│   └── utils.ts               # cn() (clsx + tailwind-merge)
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── layout/                # Sidebar, TopNav
│   ├── auth/                  # ChangePasswordDialog
│   ├── admin/                 # PermissionsModal, UserPermissionsTable
│   ├── training/tactical/     # TacticalBoard, HockeyField, etc.
│   └── ErrorBoundary.tsx      # Captura ChunkLoadError → reload automático
├── store/                     # Zustand stores
│   ├── authStore.ts           # user + permissions (persistido localStorage)
│   ├── tacticalStore.ts       # estado do quadro tático
│   └── sidebarStore.ts        # open/close sidebar mobile
├── hooks/
│   ├── usePermissions.ts      # can(), isAdmin, permissions
│   ├── useDebounce.ts         # debounce para search inputs
│   └── use-toast.ts           # shadcn toast hook
├── types/
│   └── training.types.ts      # ElementType, BoardElement, FrameState, PlaybookData
└── middleware.ts              # Edge: CSRF + JWT auth + RBAC page routes
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

## Estado Atual (2026-05-27)
- ✅ Deploy Vercel funcional (40/40 páginas)
- ✅ Neon PostgreSQL conectado
- ✅ Cloudflare R2 para logos de patrocinadores
- ✅ Migrações: 11 migrations (última: `20260527000002_material_payment`)
- ✅ `src/lib/constants.ts` — constantes partilhadas + `MATERIAL_TYPES` por categoria
- ✅ `Quota.amount` adicionado — revenue de sócios precisa
- ✅ `Material.paidByAthlete` + `Material.paidAmount` — tracking de pagamento por item
- ✅ Módulo materiais redesenhado: tipos predefinidos por categoria, marca/modelo, modo batch, pagamento por item
- ✅ `paidAmount` = custo do material (sempre obrigatório, independente de quem pagou); `paidByAthlete` indica se atleta pagou → clube poupou
- ✅ Dashboard materialCosts: `total`, `savedByAthletes`, `clubCost` — poupança calculada em `/api/dashboard/stats`
- ✅ SMALL types expandidos: Rolamentos, Fita para Sticks, Atacadores, Conjunto de Parafusos, Borracha de Suspensão
- ✅ Módulo Assiduidades: calendário mensal gerado de horários semanais, registo de presenças, cancelamento com motivo, stats de temporada
- ✅ `TrainingSchedule`: horários recorrentes por época/escalão/dia — pré-populados 2025/26 (Sub11/Sub13/Sub17)
- ✅ Navegação de épocas por setas (min 2025/26), cópia de época anterior, filtro de escalões disponíveis no form
- ✅ `AGE_GROUP_CALENDAR_COLORS` em `src/lib/constants.ts` — cores por escalão no calendário de assiduidades
- ✅ Sidebar com accordion groups (Desporto / Materiais / Clube / Gestão) — estado persiste em localStorage
- ✅ Perfil atleta: assiduidade com toggle "Total" | "Por época" (bySeason[] na API)
- ✅ Treinos SPECIFIC pagos: criados ad-hoc via "+" no calendário; grelha com coluna de pagamento por atleta; stats no perfil (realizados, pagamentos, total pago)
- ✅ **REGRA CRÍTICA — Navegação temporal mínimo 2025:** todas as páginas com setas de ano/época bloqueiam retroceder antes de 2025/26. Afeta: `/fees` (MIN_SEASON=2025), `/attendance` calendário (set 2025), `/attendance` horários (min 2025/26), `/athletes/[id]` histórico pagamentos (min 2025), `/members` quotas (min 2025). Não adicionar navegação para anos anteriores em novos módulos.
- ✅ Módulo Materiais Têxteis: inventário têxtil com kit de jogo, tamanhos, personalização, custo por item
- ✅ 4 novas permission flags: `viewAttendance`, `editAttendance`, `viewTextiles`, `editTextiles` (20 flags total)
- ✅ Migrações: 14 migrações (última: `20260602000003_training_schedules`)
- ✅ Migration `20260511000004` pendente em prod (colunas `roles`/`trainerAgeGroups`) — aplica no próximo deploy
- ✅ PWA manifest em `public/manifest.json` + metadata em `src/app/layout.tsx`
- ✅ UX melhorias: coluna Idade (atletas), filtro estado (patrocinadores), total salários (direção), empty states com CTA em todas as listas, marcar coluna inteira em fees
- ✅ lateMonths bug corrigido — iteração por range de meses, não só registos existentes
- ✅ Relatório de sócios (`/api/reports/members`) com histórico de quotas por mês
- ⚠️ Rate limiting in-memory (ineficaz em serverless Vercel multi-instância) — ver DEBT-002
