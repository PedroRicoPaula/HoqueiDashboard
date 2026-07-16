# Conventions — HoqueiManager
> Padrões obrigatórios. Seguir sempre para manter consistência.

---

## Dados de Teste (Dev Local)

Script `scripts/seed-test-clubs.ts` cria 3 clubes de demonstração com dados realistas (atletas, mensalidades, sócios, patrocinadores, materiais, viagem):

```bash
npx tsx scripts/seed-test-clubs.ts
```

**Credenciais geradas:**
| Clube | Email | Password | Cor |
|-------|-------|----------|-----|
| HC Porto Demo | `admin@hcporto-demo.com` | `porto123` | Azul |
| HC Lisboa Demo | `admin@hclisboa-demo.com` | `lisboa123` | Vermelho |
| HC Braga Demo | `admin@hcbraga-demo.com` | `braga123` | Roxo |
| Super Admin | `superadmin@hoqueimanager.com` | `superadmin123` | — |

O script é **idempotente** — apaga os 3 clubes de teste antes de recriar. Não afecta outros dados. O hash PBKDF2 usa `randomBytes(16)` como buffer raw (não hex string) para compatibilidade com `comparePassword` em `src/lib/auth.ts`.

---

## Como Adicionar um Novo Módulo

### 1. Schema Prisma
```prisma
// prisma/schema.prisma
model NovoModelo {
  id        String   @id @default(uuid())
  name      String
  // ... campos
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  @@index([name])
}
```

### 2. Migration
```bash
npx prisma migrate dev --name add_novo_modelo
```
Usar `IF NOT EXISTS` nas migrações corretivas para ser idempotente.

**Alterar uma `@@unique` em produção — padrão obrigatório:**  
Nunca fazer `db push` para mudar unique constraints em produção (Prisma rejeita sem `--accept-data-loss`). Criar sempre uma migration SQL manual:
```sql
-- DROP da constraint antiga (IF EXISTS é segurança se o nome variar)
DROP INDEX IF EXISTS "Member_clubId_number_key";
-- CREATE da nova (Prisma gera nomes no padrão TableName_col1_col2_key)
CREATE UNIQUE INDEX "Member_clubId_number_seasonId_key" ON "Member"("clubId", "number", "seasonId");
```
**PostgreSQL e NULLs em unique indexes:** dois NULLs numa coluna de um unique index são considerados DISTINTOS (não violam a constraint). Portanto, adicionar uma coluna nullable a uma `@@unique` existente é seguro para rows existentes — todas ficam com NULL e não conflituam entre si.

**Nome das constraints geradas pelo Prisma:**
- `@@unique([a, b])` → `TableName_a_b_key` (unique index)
- `@@index([a, b])` → `TableName_a_b_idx` (regular index)
- `@unique` em campo único → `TableName_field_key`

### 3. Validação Zod
```typescript
// src/lib/validations.ts — adicionar schemas
export const createNovoModeloSchema = z.object({ ... })
export const updateNovoModeloSchema = createNovoModeloSchema.partial()
```

### 4. API Routes
```
src/app/api/novo-modelo/route.ts          ← GET (lista) + POST (criar)
src/app/api/novo-modelo/[id]/route.ts     ← GET + PUT + DELETE
```

**Template de route handler (multi-tenant obrigatório):**
```typescript
import { getDbForRequest } from '@/lib/db'
import { hasPermission } from '@/lib/permissions'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params                              // ← Next.js 15 obrigatório
    const ctx = await getDbForRequest(req)                   // ← SEMPRE usar getDbForRequest
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    const { user, db, clubId } = ctx                         // db = tenant-scoped client; clubId para create()
    if (!hasPermission(user.permissions, 'viewXxx')) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }
    // db.novoModelo.findUnique injeta clubId automaticamente
    const item = await db.novoModelo.findFirst({ where: { id } })
    if (!item) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
    return NextResponse.json(item)
  } catch (error) {
    logger.error('NovoModelo GET error:', error)
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
```

**Regra multi-tenant:**
- Usar `db` (de `getDbForRequest`) para **todos os modelos TENANTED (16)**:
  **Season**, Athlete, Member, Sponsor, Material, Travel, DirectionMember, Training, TrainingSchedule, TrainingSession, TextileItem, AuditLog, **AthletePayment, Quota, DirectionSalaryPayment, AttendanceRecord**
- Usar `prisma` (import global) para modelos NÃO TENANTED: User, Permission, Playbook, RateLimit
- **Nunca adicionar `where: { clubId }` manualmente em modelos TENANTED** — a extension injeta automaticamente em `findMany`, `findFirst`, `findUnique`, `update`, `updateMany`, `delete`, `deleteMany`, `count`, `aggregate`, `groupBy`
- **`upsert` em modelos TENANTED** — a extension injeta `clubId` no bloco `create` **e** valida ownership via `findFirst` antes de correr (lança erro se o registo encontrado pertencer a outro clube). O `where` de compound key (`athleteId_month_year`, etc.) não é alterado — o `WhereUniqueInput` gerado pelo Prisma para estes modelos não aceita `clubId` como filtro extra. Ver SEC-026 em `docs/AUTH-SECURITY.md`.
- **Em `create()` E no `create` de `upsert()`, passar `clubId` explicitamente — SEMPRE, sem exceção.** Prisma 7 usa `Exact<>` strict typing que exige `clubId` no objeto `data`. A Extension injeta em runtime mas o compilador TS não vê isso — omitir `clubId` só não dá erro de compilação se o client Prisma gerado estiver desatualizado (ver BUG-016 em `docs/ISSUES-BACKLOG.md`, causado exactamente por esta confusão). **Não existe excepção para modelos com unique constraint composta** — passa `clubId` sempre, mesmo em `upsert`. Padrão:
  ```typescript
  const { user, db, clubId } = ctx
  const item = await db.athlete.create({ data: { ...parsed.data, clubId } })
  // upsert: clubId também no create
  await db.athletePayment.upsert({
    where: { athleteId_month_year: { athleteId, month, year } },
    create: { clubId, athleteId, month, year, paid },
    update: { paid },
  })
  ```

**Template PUT/POST com audit:**
```typescript
// Após operação de escrita, SEMPRE:
await logAudit(req, user.id, user.email, 'CREATE', 'NovoModelo', item.id, { name: item.name })
```

### 5. Permissões
```typescript
// 1. Adicionar ao schema Prisma:
viewNovoModulo Boolean @default(false)
editNovoModulo Boolean @default(false)

// 2. Migration para adicionar colunas
// 3. Adicionar ao admin/permissions UI (PermissionsModal.tsx)
// 4. Adicionar ao middleware.ts PROTECTED_ROUTES
// 5. Adicionar ao nav (Sidebar.tsx navItems)
// 6. PUT /api/admin/permissions/[userId]/route.ts — adicionar ao body destructure + data object
```

### 6. Página
```
src/app/(dashboard)/novo-modulo/page.tsx
```

**Padrão de página (Client Component):**
```typescript
'use client'
// 1. Estado: useState + loading
// 2. fetchData: useCallback + fetch + setLoading
// 3. useEffect → fetchData
// 4. usePermissions para condicionar edição
// 5. Sheet lateral para criar/editar
// 6. Dialog de confirmação para eliminar
// 7. useToast para feedback
```

### 7. Sidebar
```typescript
// src/components/layout/Sidebar.tsx — adicionar a navItems:
{ href: '/novo-modulo', label: 'Novo Módulo', icon: IconName, permission: 'viewNovoModulo' },
```

### 8. Documentação
Adicionar bloco em `docs/MODULES.md`. Atualizar `docs/DATABASE.md` com novo modelo.

---

## Padrões de Código

### Imports
```typescript
// Ordem: React → Next.js → libs externas → @/components → @/lib → @/hooks → @/store → @/types
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { prisma } from '@/lib/prisma'
import { usePermissions } from '@/hooks/usePermissions'
```

### SDKs externos — nunca instanciar a nível do módulo
Next.js executa o corpo do módulo durante `Collecting page data` no build. SDKs que lançam ao construir sem credenciais (ex: `new Stripe(undefined)`) fazem o build falhar mesmo que o endpoint nunca seja chamado.

**Regra:** instanciar sempre dentro do handler, não no topo do ficheiro.
```typescript
// ❌ — falha no build se STRIPE_SECRET_KEY não estiver definida
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '...' })
export async function POST(req: Request) { ... }

// ✅ — instanciar dentro do handler (ou numa factory chamada dentro do handler)
export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '...' })
  ...
}
```
Aplica-se ao Stripe SDK e a qualquer outro cliente que leia env vars obrigatórias no construtor.

### Error Handling nas APIs
```typescript
// Sempre distinguir erros Prisma conhecidos:
if ((error as { code?: string })?.code === 'P2025') {
  return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })
}
if ((error as { code?: string })?.code === 'P2002') {
  return NextResponse.json({ error: 'Já existe' }, { status: 409 })
}
logger.error('Contexto error:', error)
return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
```

### Enums Prisma em filtros de API — sem `as any`
Quando um query param de string precisa de ser passado como enum Prisma num `where`, **não usar `as any`**. Usar validação com `const` array + type guard:
```typescript
const VALID_AGE_GROUPS = ['SUB11', 'SUB13', 'SUB15', 'SUB17', 'SUB19', 'SENIORS'] as const
type AgeGroupEnum = typeof VALID_AGE_GROUPS[number]

const safeAgeGroup = VALID_AGE_GROUPS.includes(ageGroup as AgeGroupEnum)
  ? ageGroup as AgeGroupEnum
  : undefined

// então: ...(safeAgeGroup ? { primaryAgeGroup: safeAgeGroup } : {})
```
Bónus: rejeita valores inválidos silenciosamente (sem erro 400) em vez de passar strings arbitrárias ao Prisma.

### Validação com Zod
```typescript
const parsed = schema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.flatten() }, { status: 400 })
}
```

**⚠️ Campos string opcionais que podem ser `null`** — forms com estado custom (não react-hook-form) costumam enviar `null` para campos vazios (`field || null`). Em Zod v4, `z.string().optional()` só aceita `string | undefined`, não `null`. Usar sempre `.nullable().optional()` para esses campos:
```typescript
// ❌ falha se frontend enviar null
notes: z.string().optional()
// ✅ aceita string | null | undefined
notes: z.string().nullable().optional()
```
Afeta em especial forms com `buildPayload` manual (ex: Têxteis). Forms com `react-hook-form` enviam `""` (string vazia) → não têm este problema.

**⚠️ `z.record()` em Zod v4 requer 2 argumentos** — em Zod v3, `z.record(valueSchema)` era válido. Em Zod v4, o primeiro argumento é obrigatoriamente o key schema:
```typescript
// ❌ Zod v4 rejeita — TS2554: Expected 2-3 arguments, but got 1
positions: z.record(z.object({ x: z.number(), y: z.number() }))
// ✅ correto em Zod v4
positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() }))
```

### Client Components — Fetch Pattern
```typescript
const fetchData = useCallback(async () => {
  setLoading(true)
  try {
    const res = await fetch('/api/...')
    if (res.ok) setData(await res.json())
    else if (res.status === 401) { /* sessão expirada */ }
    else { /* outro erro */ }
  } catch { /* rede */ }
  finally { setLoading(false) }
}, [deps])

useEffect(() => { fetchData() }, [fetchData])
```

### Toast Feedback
```typescript
const { toast } = useToast()
toast({ title: 'Criado com sucesso' })
toast({ title: 'Erro', description: json.error, variant: 'destructive' })
```

---

## Dashboard i18n

O dashboard (`/(dashboard)/`) **não usa next-intl** — não está sob `[locale]/`. Em vez disso usa dois hooks:

### `useDashT(key, vars?)` — traduções de texto
```typescript
import { useDashT } from '@/hooks/useDashT'
const t = useDashT()
// t('nav.athletes'), t('common.save'), t('dashboard.noAlerts')
```
Lê `clubLanguage` do Zustand auth store. Fallback para PT. Chaves em `messages/dashboard/{pt,en,es,fr,it}.json`.

### `useDashLabels()` — labels de enums
```typescript
import { useDashLabels } from '@/hooks/useDashLabels'
const labels = useDashLabels()
// labels.ageGroups['SUB11'], labels.materialStates['FREE']
// labels.monthsShort?.[9] → "Set"  (índice = número do mês, 1-12; índice 0 vazio)
// labels.monthsFull?.[9] → "Setembro"
```
Devolve: `ageGroups`, `materialStates`, `textileStates`, `textileCategories`, `textileTypes`, `materialCategories`, `directionRoles`, `sessionTypes`, `monthsShort`, `monthsFull`, `sponsorTypes`, `auditActions`, `auditEntities`.

**Padrão com fallback** (evitar quebrar se chave em falta):
```typescript
labels.materialStates[item.state] ?? MATERIAL_STATE_LABELS[item.state] ?? item.state
```

**Arrays de meses** (slice(1) para remover índice 0 vazio → array Jan..Dez de 12 itens):
```typescript
const MONTHS = labels.monthsFull?.slice(1) ?? MONTHS_FALLBACK
```

### `getDateLocale(lang)` — locale para date-fns
```typescript
import { getDateLocale } from '@/lib/date-locale'
format(date, "d MMMM yyyy", { locale: getDateLocale(clubLanguage) })
```
**Nunca usar `{ locale: pt }` hardcoded nas páginas do dashboard.**

### `getNumberLocale(lang)` — locale para formatação de números
```typescript
import { getNumberLocale } from '@/lib/date-locale'
const numLocale = getNumberLocale(clubLanguage)  // ex: 'en-GB', 'fr-FR', 'pt-PT'
value.toLocaleString(numLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
```
**Nunca usar `toLocaleString('pt-PT', ...)` hardcoded** — clubes ES/FR/IT usam separadores de milhar diferentes.

### Adicionar novas chaves
Adicionar a chave nos **5 ficheiros** `messages/dashboard/*.json` em simultâneo.

### Collision com variável `t` em `.map((t) => ...)`
Se a página usa `.map((t) => ...)` (ex: training, travel), a variável de iteração `t` sombreia o return de `useDashT()`. Usar alias:
```typescript
const tr = useDashT()   // ← alias para evitar collision com t de .map((t) => ...)
```

### Sub-componentes sem acesso a hooks
Sub-componentes definidos fora do componente de página (ex: `TravelCard`, `ContractBadge`, `SponsorTypeBadge`, `buildDetailLines`) não podem chamar hooks. Passar `tr` e `dateLocale` como props:
```typescript
function TravelCard({ travel, tr, dateLocale }: { tr: (k: string) => string; dateLocale: Locale }) { ... }
```

**Excepção — sub-componentes que SÃO funções React (Client Components):** podem e devem chamar os seus próprios hooks. Nunca definir `useDashLabels()` no pai e tentar usá-lo num filho separado — cada componente chama o seu hook:
```typescript
// ✅ correto — QuotaCalendar chama o seu próprio useDashLabels
function QuotaCalendar({ memberId, year }: ...) {
  const dashLabels = useDashLabels()
  const MONTHS = dashLabels.monthsFull?.slice(1) ?? MONTHS_FALLBACK
  // ...
}
// ❌ errado — definir MONTHS no MembersPage e esperar que QuotaCalendar o veja
```

---

## Constantes Partilhadas

Todas as constantes de UI partilhadas estão em `src/lib/constants.ts`. Importar sempre daqui:

```typescript
import { AGE_GROUPS, AGE_GROUP_LABELS, MATERIAL_STATE_LABELS, MATERIAL_STATE_COLORS,
         SEASON_MONTHS, MONTH_LABELS, DIRECTION_ROLES, DIRECTION_ROLE_LABELS,
         DIRECTION_ROLE_COLORS } from '@/lib/constants'
```

Estas constantes são PT-only — usar como fallback em páginas com `useDashLabels()`. Ao criar novos módulos, adicionar constantes a este ficheiro **e** as traduções aos 5 JSON files do dashboard.

---

## CSS Variables — Paleta por Clube

`--club-primary` (e `--club-primary-fg`) são CSS vars que controlam a cor de destaque do dashboard por clube.

**Scoping:**
- `globals.css` define o valor padrão global: `142 71% 45%` (verde shadcn). Serve de fallback.
- `(dashboard)/layout.tsx` injeta o override via `style={{ '--club-primary': hsl }}` no `<div>` raiz do dashboard — **escopo limitado a esse elemento e descendentes**.
- A **landing page** (`[locale]/`) usa um layout separado e **não consome `--club-primary` em nenhum componente**. Não é afetada pela cor do clube. ✅ Verificado 2026-06-23.

**Consumidores atuais:** `Sidebar.tsx` (item ativo), `(dashboard)/layout.tsx` (override).

**Regra:** nunca usar `--club-primary` em componentes partilhados entre landing e dashboard (ex: `src/components/ui/`). Só em componentes exclusivos do dashboard.

---

## shadcn/ui — Regras

- Estilo: `new-york`
- Tema: green (variáveis em `globals.css`)
- Sidebar tem variáveis próprias: `--sidebar-bg`, `--sidebar-fg`, `--club-yellow`
- Não alterar componentes em `src/components/ui/` diretamente — são gerados pelo shadcn CLI
- Para customizar: usar `className` override ou criar wrapper

---

## Formulários

Usar sempre `react-hook-form` + `zodResolver`:
```typescript
const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormType>({
  resolver: zodResolver(schema) as any,  // "as any" necessário com Zod v4
})
```

---

## Datas
- DB: sempre `DateTime` (Prisma converte para Date)
- API input: string ISO `"2026-05-27"` ou `"2026-05-27T10:00:00.000Z"`
- Conversão no PUT/POST: `birthDate: new Date(birthDate)`
- Display: `format(new Date(dateString), 'dd/MM/yyyy')` com `date-fns`
- Locale PT: `format(date, "d 'de' MMMM", { locale: pt })` — importar `pt` de `'date-fns/locale'`

---

## Loading e Feedback de Navegação

### `loading.tsx` — Suspense boundary automático
`src/app/(dashboard)/loading.tsx` existe e é apanhado pelo Next.js App Router como Suspense boundary para toda a área autenticada. Mostra spinner enquanto o chunk JS da nova página carrega. **Não criar `loading.tsx` por página individualmente** — o do layout dashboard cobre tudo.

### Sidebar — estado pending
`Sidebar.tsx` rastreia `pendingHref` para dar feedback imediato ao click: o ícone do item clicado muda para `Loader2` animado antes da navegação completar. Limpa automaticamente via `useEffect([pathname])`. Padrão a manter se a Sidebar for alterada.

### Inputs de hora — formato 24h
Usar `type="text"` com `placeholder="HH:MM"` e `maxLength={5}` em vez de `type="time"` para garantir formato 24h independente do locale do SO do utilizador (Windows pode mostrar AM/PM com `type="time"`).

---

## Responsividade
- Mobile first com Tailwind
- Sidebar: fixa em desktop (`lg:static`), overlay em mobile (z-30)
- Tabelas: `hidden sm:table-cell` para colunas secundárias; sempre envolver em `overflow-x-auto`
- Sheets: `w-full sm:max-w-lg` com `overflow-y-auto`
- Grids de cards: `grid-cols-1 md:grid-cols-2` (2 cols) ou `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` (3 cols)
- Grids de calendário mensal (12 meses): `grid-cols-3 sm:grid-cols-4` — 3 cols mobile, 4 cols desktop
- Grids de checkboxes (escalões, etc.): `grid-cols-2 sm:grid-cols-3`
- Grids de formulário (3 campos lado a lado): `grid-cols-1 sm:grid-cols-3`
- Calendário semanal (`grid-cols-7`): envolver em `<div className="overflow-x-auto"><div className="... min-w-[480px]">...</div></div>`
- Toolbars (`flex flex-wrap gap-3`): search input com `flex-1 min-w-0` (não `min-w-48`) para encolher em mobile

---

## Nomenclatura

| Tipo | Convenção | Exemplo |
|------|-----------|---------|
| Componentes | PascalCase | `AthleteProfilePage` |
| Hooks | camelCase + use | `usePermissions` |
| API routes | kebab-case dirs | `/api/age-groups/` |
| Stores | camelCase + Store | `authStore` |
| Schemas Zod | camelCase + Schema | `createAthleteSchema` |
| DB models | PascalCase (Prisma) | `DirectionMember` |
| Enums Prisma | UPPER_CASE | `AgeGroup.SENIORS` |

---

## Checklist Pré-Deploy com Schema Changes

> Lições aprendidas 2026-07-16 — dois deploys falhados consecutivos em produção.

### Regras obrigatórias antes de cada push com alterações de schema

**1. NUNCA usar `prisma db push` no build script de produção**  
`db push` não usa `_prisma_migrations`. Em produção, usar sempre `prisma migrate deploy`.  
`db push` **só** para dev local, **nunca** no `package.json build script**.

**2. Qualquer mudança de `@@unique` EXIGE migration SQL manual**  
`db push` rejeita mudanças de unique constraints sem `--accept-data-loss`. `migrate deploy` usa o SQL exacto da migration — que tem de incluir `DROP INDEX IF EXISTS` + `CREATE UNIQUE INDEX`.  
Verificar sempre: se a migration tem `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE` ou `CREATE UNIQUE INDEX`, testar localmente primeiro.

**3. Switching de `db push` → `migrate deploy` em prod EXIGE baseline**  
Se o DB de produção foi criado com `db push` (sem `_prisma_migrations`), e se passa a usar `migrate deploy`, todas as migrations antigas têm de ser marcadas como aplicadas antes de `migrate deploy` correr:

```bash
npx prisma migrate resolve --applied <migration_name>  # uma por uma
```

O script `scripts/resolve-migration.js` automatiza isto para o HoqueiManager: marca todas as migrations anteriores ao cutoff `20260716000001_season_feature` como baseline, sem correr SQL.

**4. Verificar `_prisma_migrations` no Neon antes de cada deploy com novas migrations**  
Via Neon console ou `prisma studio`, confirmar quais migrations estão registadas. Se o count for 0 (DB novo) ou muito menor que o esperado (DB criado via `db push`), o script de baseline vai ser necessário.

### Sequência correcta para deploy com schema changes

```bash
# 1. Criar migration SQL manual (nunca deixar o Prisma gerar via migrate dev se há unique changes)
mkdir -p prisma/migrations/YYYYMMDDHHMMSS_description
# editar migration.sql com SQL exacto

# 2. Build local para confirmar
npm run build   # → node scripts/resolve-migration.js && prisma migrate deploy && prisma generate && next build

# 3. Verificar que build local passa sem erros (0 TypeScript errors)

# 4. Push → Vercel deploy automático
git push
```

### Diagnóstico rápido de erros de deploy Prisma

| Erro | Causa | Fix |
|------|-------|-----|
| `--accept-data-loss` | `db push` tentou mudar unique constraint | Criar migration SQL com `DROP INDEX IF EXISTS` + `CREATE UNIQUE INDEX` |
| `P3018 / type "X" already exists` | `migrate deploy` tentou re-aplicar migrations já no DB | Script baseline `resolve-migration.js` para marcar as existentes como aplicadas |
| `P3009 / migration failed` | SQL da migration tem erro de sintaxe ou objeto já existe | Corrigir SQL; adicionar `IF NOT EXISTS` / `IF EXISTS` onde adequado |
| `P1001 / can't reach database` | `DATABASE_URL` errada ou Neon em sleep | Verificar env var no Vercel; acordar Neon |

---

## Playwright E2E — Guia Rápido

Tests em `e2e/`. Requer dev server em `localhost:3000` (ou `reuseExistingServer: true` no config).

```bash
# Setup uma vez (instala browsers)
npx playwright install chromium

# Seed dados de teste
npx tsx scripts/seed-test-clubs.js

# Correr todos os E2E
npm run test:e2e

# Correr com UI interativa
npm run test:e2e:ui

# Correr um ficheiro específico
npx playwright test e2e/seasons.spec.ts
```

### Estrutura dos testes de épocas

| Ficheiro | O que testa |
|----------|-------------|
| `e2e/auth.setup.ts` | Login + save session state |
| `e2e/seasons.spec.ts` | CRUD de épocas: criar, ativar, editar, eliminar |
| `e2e/seasons-members.spec.ts` | Isolamento sócios: mesmo nº em 2 épocas |
| `e2e/seasons-sponsors.spec.ts` | Isolamento patrocinadores por época |
| `e2e/seasons-fees.spec.ts` | Meses dinâmicos da grelha de mensalidades |
| `e2e/seasons-dashboard.spec.ts` | Stats filtradas por época |

### Padrões obrigatórios nos testes E2E

- **Usar `page.evaluate(() => fetch(...))`** para chamadas API dentro de testes — garante `Origin` header correcto (CSRF pass). **Nunca** `page.request.post()` para rotas que passam pelo middleware CSRF.
- **Zustand reset**: `clearSeasonFilter()` limpa `localStorage['hm-season'].state.selectedSeasonId` + `page.reload()`. Chamar sempre em `beforeEach` ou no início de cada test que precisa de estado limpo.
- **data-testid**: usar `data-testid="season-selector"` no trigger do SeasonSelector e `data-testid="season-card-{slug}"` nos cards de época para selectors robustos.
- **Cleanup em `afterAll`**: apagar seasons via API (cascade deleta members/sponsors linked). Order: deletar a mais recente primeiro (B antes de A) para evitar FK issues.
- **`beforeAll` com browser context separado**: criar dados de teste num context isolado que fecha antes dos tests correrem — evita interferência de state entre setup e testes.
