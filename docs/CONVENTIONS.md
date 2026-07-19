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

**Como tornar um modelo novo "sensível à época" — duas famílias de padrão, escolher pela forma da entidade:**

1. **`seasonId` nullable + FK** (Member, Sponsor, Material, TextileItem, AthletePayment, Quota) — a entidade nasce e morre dentro de uma época (um sócio pode ter uma linha por época; um material pode ser reatribuído a outra época). `seasonId String?` + `season Season? @relation(onDelete: SetNull)`. Filtrar por `where: { seasonId }` quando definido.
2. **Janela temporal `joinedAt`/`leftAt`** (Athlete, desde 2026-07-18) — a entidade é **persistente** através de épocas e tem histórico rico ligado ao mesmo id (pagamentos, assiduidade, materiais, cargos de direção). Duplicar por época partiria esse histórico. Dois campos `DateTime?` nullable, sem defaults, sem backfill: `NULL` em `joinedAt` = sempre foi membro; `NULL` em `leftAt` = ainda é membro. Filtrar com o helper partilhado, nunca reimplementar a lógica de janela caso a caso:
   ```typescript
   // src/lib/athleteMembership.ts
   athleteMembershipWhere(season: {startDate,endDate} | null)  // Prisma where
   wasAthleteActiveInSeason(entity, season)                    // boolean, em memória
   ```
   Escolher este padrão quando a resposta a "esta entidade pode ter registos de épocas diferentes ligados ao mesmo id, que não fazem sentido divididos por várias linhas?" for sim.

### 3. Validação Zod
```typescript
// src/lib/validations.ts — adicionar schemas
// ⚠️ NUNCA derivar o update do create — .partial() não remove .default() dos
// campos herdados (ver "Validação com Zod" mais abaixo). Schema base sem defaults
// + create (extend com defaults) + update (partial do base):
const novoModeloBaseSchema = z.object({ name: z.string() /* ... sem defaults */ })
export const createNovoModeloSchema = novoModeloBaseSchema.extend({ /* campos com .default() aqui */ })
export const updateNovoModeloSchema = novoModeloBaseSchema.partial()
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

### Navegação interna — sempre `<Link>` de `next/link`

Nunca usar `<a href="...">` para rotas internas. O ESLint do Next.js (`@next/next/no-html-link-for-pages`) trata isso como **erro** que bloqueia o build e o CI.

```tsx
// ❌ bloqueia build
<a href="/settings" className="underline">Definições</a>

// ✅ correto
import Link from 'next/link'
<Link href="/settings" className="underline">Definições</Link>
```

Usar `<a href="...">` apenas para links externos (URLs fora da app).

---

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

**Stripe especificamente (2026-07-18, consolidado 2026-07-19):** usar sempre `getStripe()` de `src/lib/stripe.ts` em vez de repetir `new Stripe(...)` — é só uma factory (chamada dentro do handler, continua a respeitar a regra acima), mas centraliza a `apiVersion` para não divergir entre ficheiros. Usado em `register`, `register/complete`, `stripe/webhook`, `platform/page.tsx`, `billing/cancel`, `billing/reactivate`, `platform/clubs/[id]/send-payment-link` — **todos** os pontos de entrada Stripe do projecto, sem excepção.

**`apiVersion` fixa à do webhook de produção, não à mais recente do SDK**: a conta Stripe tem o endpoint de webhook de produção preso a `2025-12-15.clover` (não editável por endpoint nesta conta), por isso o pacote `stripe` está pinado em `^20.2.0` (a versão do SDK cuja `LatestApiVersion` é exactamente essa) em vez da mais recente disponível no npm. Subir o pacote `stripe` sem verificar antes qual API version o webhook de produção usa **quebra silenciosamente** os handlers — API versions diferentes têm forma de payload diferente para os mesmos campos (ex: `invoice.subscription` foi substituído por `invoice.parent.subscription_details.subscription`, e `subscription.current_period_end` moveu para `subscription.items.data[0].current_period_end`, ambos entre `acacia`/`basil` e `clover`). Antes de qualquer upgrade do pacote `stripe`, confirmar a `apiVersion` do webhook na Stripe Dashboard e escolher a versão do SDK npm que lhe corresponde exactamente (`grep 'ApiVersion =' node_modules/stripe/types/apiVersion.d.ts` depois de instalar candidatos).

**Todo `checkout.sessions.create` leva `tax_id_collection: { enabled: true }`** (2026-07-19) — permite ao cliente introduzir o próprio NIF/contribuinte no Checkout; a Stripe grava-o no `Customer` e mostra-o automaticamente na fatura gerada. Aplicado aos 5 pontos de criação de sessão (`register`, `billing/reactivate`, `billing/subscribe`, `billing/checkout-link/[clubId]`, `platform/clubs/[id]/send-payment-link`) — qualquer novo ponto de checkout tem de incluir o mesmo campo. O NIF do próprio HoqueiManager (emissor) não é código — configura-se uma vez em Stripe Dashboard → Settings → Business → Tax details (ver `CLAUDE.md`, tarefas manuais).

**`tax_id_collection` exige `customer_update: { name: 'auto' }` quando a sessão reutiliza um `customer` existente** (BUG-047, 2026-07-19, só apanhado em produção) — sem isto a Stripe rejeita com 400 (`"Tax ID collection requires updating business name on the customer"`), que a API devolvia como 500 genérico. Os 5 pontos de checkout do projecto passam sempre um `customer` (novo ou existente), nunca deixam a Stripe criar um anónimo — por isso os 5 precisam sempre deste campo a par do `tax_id_collection`.

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

**⚠️ `.partial()` NÃO remove `.default()` dos campos herdados** — achado sistémico 2026-07-18, corrigido em 8 módulos. Um `updateSchema` derivado de `createSchema.partial()` continua a ter `.default()` nos campos que o create definiu com default — omitir esse campo num PATCH não o deixa intacto, **reescreve-o silenciosamente para o valor por omissão**:
```typescript
// ❌ perigoso: PATCH que omite `state` reescreve-o para 'FREE' mesmo que o registo tivesse 'ASSIGNED'
const createSchema = z.object({ name: z.string(), state: z.enum([...]).default('FREE') })
const updateSchema = createSchema.partial()   // state continua com .default('FREE')!

// ✅ padrão correto: schema base SEM defaults + create (extend com defaults) + update (partial do base)
const baseSchema = z.object({ name: z.string(), state: z.enum([...]) })          // sem defaults
const createSchema = baseSchema.extend({ state: z.enum([...]).default('FREE') }) // defaults só aqui
const updateSchema = baseSchema.partial()                                        // nunca derivado do create
```
Ver `src/lib/validations.ts` para os 8 módulos já convertidos a este padrão (Athlete, Member, Material, Sponsor, Travel, Direction, TrainingSession, Textile) — usar como referência ao criar um novo módulo.

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

**⚠️ Guarda de sequência quando o fetch é accionado por um filtro que muda depressa** (ex: selector de época, dropdown de escalão) — sem isto, um pedido antigo e mais lento pode resolver **depois** de um mais recente e sobrepor dados correctos com os do filtro anterior. Achado ao vivo 2026-07-18 (troca rápida de época em Mensalidades/Atletas/Dashboard). Padrão: `useRef` incrementado a cada pedido, comparado antes de cada `setState`:
```typescript
const fetchSeq = useRef(0)
const fetchData = useCallback(async () => {
  const seq = ++fetchSeq.current
  setLoading(true)
  try {
    const res = await fetch('/api/...')
    if (seq !== fetchSeq.current) return   // já há um pedido mais recente — descarta esta resposta
    if (res.ok) {
      const data = await res.json()
      if (seq !== fetchSeq.current) return  // repetir o check após o segundo `await`
      setData(data)
    }
  } finally {
    if (seq === fetchSeq.current) setLoading(false)  // não desligar o loading de um pedido já ultrapassado
  }
}, [deps])
```
Aplicar sempre que um `fetchX` estiver na dependency array de um `useEffect` que reage a um filtro/selector (não é preciso em fetches que só correm uma vez ao montar). Ver `fees/page.tsx`, `athletes/page.tsx`, `page.tsx` (dashboard) para exemplos reais.

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

---

## Auth pages i18n (2026-07-19)

`/login`, `/forgot-password`, `/reset-password`, `/register/complete` também não vivem sob `[locale]/` (URL fica `/login`, não `/pt/login` — mudar isso implicaria reescrever o `middleware.ts` matcher e todos os redirects hardcoded `/login` espalhados pelo projecto, considerado desproporcional só para i18n). Usam `useAuthT()` (`src/hooks/useAuthT.ts`), terceiro hook de i18n do projecto a par de `useDashT`/`useDashLabels`, com uma diferença chave: **estas páginas são pré-autenticação, não há `clubLanguage` no Zustand store ainda**.

```typescript
import { useAuthT } from '@/hooks/useAuthT'
const { t, locale, setLocale } = useAuthT()
// t('login.title'), t('forgotPassword.submit')
```

Fonte do idioma, por ordem de prioridade: `?lang=` na query string (handoff vindo da landing — todos os links `/login` na landing e todos os `success_url` do Stripe que apontam para `/login` incluem `&lang=${locale}`/`&lang=${club.language}`) → `localStorage['hm-locale']` → `navigator.language` → `'pt'`. Chaves em `messages/auth/{pt,en,es,fr,it}.json`.

**Estado partilhado via `useSyncExternalStore`, não `useState` local** — várias destas páginas montam o hook em componentes separados (ex: `LoginPage` e `LoginForm`, este último dentro de um `<Suspense>`); com `useState` cada instância teria o seu próprio idioma e o `AuthLanguageSwitcher` só mudaria o texto de um dos dois. `useAuthT` usa um store module-level com `subscribe`/`getSnapshot`, partilhado por todas as chamadas ao hook na página — confirmado ao vivo via Playwright (trocar de ES para EN no switcher actualiza título, labels e placeholders em simultâneo).

`AuthLanguageSwitcher` (`src/components/auth/AuthLanguageSwitcher.tsx`) é o equivalente destas páginas ao `LanguageSwitcher` da landing — mesma UI, mas chama `setLocale()` do hook em vez de trocar o segmento `[locale]` da URL.

**Limitação conhecida, não resolvida**: mensagens de erro devolvidas pela própria API (`json.error`) continuam em português fixo (as rotas `/api/auth/login`, `/api/register`, etc. não são i18n) — só o texto estático das páginas (labels, títulos, toasts genéricos como "erro de ligação") está traduzido.

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

## Stores Zustand persistidas (localStorage) — hidratação segura em SSR

**Regra:** qualquer JSX cuja *estrutura* (não só texto) mude consoante dados de uma store `persist` (`authStore`, `seasonStore`) tem de esperar por `useMounted()` antes de os ler. Caso contrário: erro de hidratação React #418 em produção, em qualquer hard-reload/navegação direta.

**Porque `skipHydration` + `rehydrate()` num componente ancestral NÃO chega:** o padrão documentado pelo Zustand (`persist(..., { skipHydration: true })` + `store.persist.rehydrate()` num `useEffect`) assume que a árvore inteira hidrata de uma vez. No Next.js App Router isso não é garantido — `layout.tsx` e `page.tsx` podem hidratar/commitar em passes separados (boundaries internas do router: `LoadingBoundary`, etc.). Se o `layout` (ex: `(dashboard)/layout.tsx`) rehydrata a store e corre o seu efeito **antes** da `page` fazer o seu próprio primeiro render, a `page` já lê dados "novos" nesse primeiro render — que não batem certo com o HTML gerado no servidor (que nunca teve acesso a `localStorage`). Confirmado empiricamente 2026-07-17: com `skipHydration` sozinho, reproduzia-se o mesmo erro #418 byte-a-byte em `/textiles` com uma época selecionada.

**Fix real — gate local por componente:**
```typescript
// src/hooks/useMounted.ts
export function useMounted() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}
```
```typescript
const mounted = useMounted()
const { seasons: storeSeasons, getSelectedSeason } = useSeasonStore()
const seasons = mounted ? storeSeasons : []               // nunca [] real vs [] fingido trocam de forma inconsistente
const selectedSeason = mounted ? getSelectedSeason() : null
```
`useState(false)` garante que o primeiro render **deste componente** — seja qual for o boundary/pass em que ele hidrata — é sempre igual ao HTML do servidor. Só depois de montar (efeito próprio, sempre depois do commit) é que os dados reais da store entram em jogo. Ao contrário do `skipHydration` isolado, isto não depende da ordem de efeitos entre componentes.

**Continuar a usar `skipHydration: true` no `persist()` da store** (evita que o *módulo* já traga dados no primeiro render de qualquer consumidor) **e** o `rehydrate()` num efeito ancestral (`HtmlLang.tsx` para `authStore`, `(dashboard)/layout.tsx` para `seasonStore`) — isto mantém a store correta o mais cedo possível para consumidores que só leem *texto* (menor risco). O `useMounted()` é a camada extra só para JSX que muda de **estrutura** (tipo de tag, presença/ausência de blocos inteiros).

**Onde já aplicado:** `textiles/page.tsx`, `members/page.tsx`, `sponsors/page.tsx`, `materials/page.tsx`, `fees/page.tsx`, `athletes/page.tsx`, `athletes/[id]/page.tsx`, `direction/page.tsx` (componente `SalaryCalendar`), `SeasonSelector.tsx`. Ao adicionar novo JSX condicionado por `seasons.length`/`selectedSeason`/`user`/`permissions` fora destes ficheiros, aplicar o mesmo padrão — inclui componentes internos de uma página que leem a store directamente (não basta o componente de topo da página estar coberto).

**`hasUserSelected` em `seasonStore` (2026-07-18)** — distingue "nunca escolhi" de "escolhi propositadamente Todas as épocas" (`selectedSeasonId: null` serve para os dois). Sem este flag, `setSeasons()` não conseguia saber se devia respeitar uma escolha explícita do utilizador ou recalcular o default — e recalculava sempre para a primeira época da lista (nem sempre a activa), causando o bug em que sócios/patrocinadores/materiais desapareciam ao criar a primeira época do clube. Ver `src/store/seasonStore.ts`.

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
