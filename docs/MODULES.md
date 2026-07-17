# Modules — HoqueiManager
> Um bloco por módulo. Atualizar sempre que adicionar features, APIs ou encontrar problemas.

---

## 0. Landing Page & Registo (público)
**Status:** ✅ funcional  
**Páginas:** `/{locale}` (landing), `/{locale}/register` (registo), `/{locale}/privacy`, `/{locale}/terms`  
**Permissão:** pública (sem autenticação)  
**APIs:** `POST /api/register`, `POST /api/register/complete`

### Funcionalidades
- Landing page marketing em 5 idiomas (PT/ES/EN/FR/IT) via `next-intl`
- **Nav**: logo + nome (`hidden sm:block`), language switcher (`hidden md:flex`), login (`hidden sm:inline`), botão registar sempre visível. Em mobile: só logo + botão registar.
- Secções: Hero → Social proof → **Product preview** → How it works → Features → Pricing → FAQ → CTA → Footer
- **Hero**: tipo responsivo (`text-4xl sm:text-5xl lg:text-6xl`), botão CTA full-width em mobile, login como CTA secundário visível apenas em mobile
- **Social proof**: grid com `divide-x divide-y` e bordas — aspecto de card table em vez de espaço aberto
- **How it works**: cards com border em mobile, step circles com sombra verde
- **Features**: `group-hover` no ícone, sombra suave verde em hover
- **Pricing** (`PricingToggle.tsx`): badge `-17%` sempre visível no tab anual (não só quando selecionado), badge "Clube completo" acima do card
- **CTA final**: anéis decorativos de fundo, gradiente `from-green-600 to-green-700`
- **Footer**: duas linhas — (1) logo + links nav; (2) copyright + "Feito por Pedro Paula" + locale switcher
- **Secção "O produto real"** (`ProductScreenshots.tsx`): fundo escuro, tabs Mensalidades/Atletas, imagens reais do dashboard (`/screenshots/fees-preview.png`, `/screenshots/athletes-preview.png`), frame de browser fake. Usa `<img>` tag (não `next/image`) porque os ficheiros são estáticos em `public/`.
- Sem trial — messaging honesto: "Cancela quando quiseres. Sem contratos de permanência." em todos os 5 idiomas
- Registo 2 passos: (1) dados do clube **+ password/confirmar password**, (2) seleção de plano; mensagens de validação i18n
- `POST /api/register` → rate limited (5/hora/IP) → valida `password`/`confirmPassword` (`min(8)` + iguais) → cria `Club` (PENDING_PAYMENT) + `User` admin com a hash da password já definida (sem placeholder) + `Stripe Checkout Session`. Audit log com ação `REGISTER`.
- **Login automático pós-pagamento (2026-07-17):** `success_url` do Checkout aponta para `/register/complete?session_id={CHECKOUT_SESSION_ID}` — página fora de `[locale]`/`(dashboard)`. `POST /api/register/complete` confirma `payment_status === 'paid'` **directo no Stripe** (não espera pelo webhook — evita a corrida entre o browser voltar e o webhook assíncrono chegar), activa o clube via `src/lib/clubActivation.ts` e devolve o mesmo contrato JSON de `/api/auth/login` (`{user, permissions, redirectTo}` + cookie `hm_token`). A página cliente chama `setAuth()` e entra logo no dashboard — sem passar pelo login. Em cancelamento redireciona para `NEXT_PUBLIC_LANDING_URL/{locale}/register?cancelled=1` (fallback: `hoqueimanager.com`)
- **Webhook como backstop:** `checkout.session.completed` chama o mesmo `activateClubFromSession()` (idempotente — não importa qual dos dois activa primeiro) só para o caso de o browser nunca voltar ao `success_url`. Já não cria `PasswordResetToken` nem envia email — a password já existe desde o registo. `RESEND_API_KEY` deixou de ser necessário para o onboarding, só para `/forgot-password`.
- Stripe webhook (`/api/stripe/webhook`) muda status `Club` em resposta a eventos de pagamento e regista `logAudit` em todos os eventos
- **Cookie consent banner** (`CookieBanner.tsx`): aparece na 1ª visita, persiste aceitação em `localStorage` chave `hm_cookie_consent`
- **Política de Privacidade** (`/{locale}/privacy`) e **Termos de Utilização** (`/{locale}/terms`) — Server Components, link no footer. Email de contacto: `pedroricopaula@gmail.com` (substituiu placeholders `@hoqueimanager.com`).
- **Footer** (landing + privacy + terms): crédito "Feito por Pedro Paula" com link para `https://pedropaula.com/`

### Ficheiros chave
- `src/app/[locale]/layout.tsx` — NextIntlClientProvider + CookieBanner
- `src/app/[locale]/page.tsx` — landing page (Server Component)
- `src/app/[locale]/register/page.tsx` — wizard 2 passos (Client Component)
- `src/app/register/complete/page.tsx` — confirmação de pagamento + login automático (fora de `[locale]`, hardcoded PT como `/login`)
- `src/lib/clubActivation.ts` — `activateClubFromSession()` partilhado entre `/api/register/complete` e o webhook
- `src/app/[locale]/privacy/page.tsx` — Política de Privacidade
- `src/app/[locale]/terms/page.tsx` — Termos de Utilização
- `src/components/landing/CookieBanner.tsx` — banner GDPR (client component)
- `src/components/landing/LanguageSwitcher.tsx`
- `src/components/landing/PricingToggle.tsx`
- `src/components/landing/FaqAccordion.tsx`
- `src/components/landing/ProductScreenshots.tsx` — tab switcher com screenshots reais
- `public/screenshots/fees-preview.png` — screenshot real da página de mensalidades
- `public/screenshots/athletes-preview.png` — screenshot real da lista de atletas
- `messages/{pt,es,en,fr,it}.json` — traduções (inclui secção `preview.*`)
- `src/i18n/routing.ts` + `src/i18n/request.ts` — config next-intl

---

## 0b. Platform Backoffice (super admin)
**Status:** ✅ funcional  
**Páginas:** `/platform`  
**Permissão:** `isSuperAdmin: true` no JWT (verificado no middleware)  
**APIs:** usa `prisma` diretamente (super admin tem acesso global)

### Funcionalidades
- **Stats 4-colunas**: clubes ativos (pagos), total utilizadores, MRR, ARR
- **MRR/ARR real**: distingue planos mensais vs anuais via `stripePriceId`; exclui clubes grátis (`isFreeClub: true`); valores dos preços vêm da API Stripe (`stripe.prices.retrieve`), não hardcoded
- **Tabela interativa de clubes** (`PlatformClubs.tsx` — Client Component): nome, email, país, estado, atletas, data de registo
  - Badge "Grátis" em clubes `isFreeClub`
  - Status com cores: ACTIVE (verde), PENDING_PAYMENT (amarelo), PAST_DUE (laranja), CANCELLED (cinzento), SUSPENDED (vermelho)
  - Coluna de ações por linha: Suspender / Ativar / Eliminar (visíveis conforme elegibilidade — ver regras abaixo)
- **Criar Clube Grátis**: botão abre dialog com campos: nome clube, email clube, país, idioma, nome admin, email admin, password admin. Cria clube com `isFreeClub: true`, `status: ACTIVE`. Admin criado com `isAdmin: true` + todas as permissões.
- **Alterar estado**: botão por linha; regras de negócio:
  - Clube grátis: ACTIVE ↔ SUSPENDED livremente
  - Clube pago: só SUSPENDED a partir de PAST_DUE; ACTIVE só a partir de SUSPENDED
- **Eliminar clube**: botão por linha; regras de elegibilidade:
  - Clube grátis: requer `status === 'SUSPENDED'`
  - Clube pago: requer `status === 'SUSPENDED'` + `statusChangedAt < NOW() - 1 ano`
  - Elimina em cascade (Prisma `onDelete: Cascade` em todos os modelos tenanted)
- **Sidebar de estatísticas**: breakdown por estado, por país (pagos ativos), faturação mensal/anual/grátis

### APIs
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/platform/clubs` | Criar clube grátis + admin |
| PATCH | `/api/platform/clubs/[id]/status` | Alterar estado (ACTIVE/SUSPENDED) |
| DELETE | `/api/platform/clubs/[id]` | Eliminar clube (com validação elegibilidade) |

Todas as rotas exigem `user.isSuperAdmin` — qualquer outro utilizador recebe 403.  
`POST /api/platform/clubs` tem rate limiting: 20 req/hora por super admin (`checkRateLimit`).  
Todas as operações de escrita têm audit log: `CREATE_FREE_CLUB`, `CHANGE_CLUB_STATUS` (captura `previousStatus`/`newStatus`), `DELETE_CLUB` (snapshot de atletha/user count antes do cascade delete).

### Ficheiros chave
- `src/app/platform/layout.tsx` — nav simples com link "Clubes" e logout
- `src/app/platform/page.tsx` — Server Component; lê dados, serializa datas, passa para `PlatformClubs`
- `src/app/platform/PlatformClubs.tsx` — Client Component; dialogs + mutações via fetch
- `src/app/api/platform/clubs/route.ts` — POST criar clube grátis
- `src/app/api/platform/clubs/[id]/status/route.ts` — PATCH estado
- `src/app/api/platform/clubs/[id]/route.ts` — DELETE clube

### Preços MRR/ARR (em `platform/page.tsx`)
`getPrices()` busca os preços reais via `stripe.prices.retrieve(STRIPE_PRICE_MONTHLY/YEARLY)`, com cache em memória (5min TTL, nível de módulo — evita bater na API Stripe em cada load de `/platform`). Se a chamada falhar (ex. chaves não configuradas), usa fallback `59€`/`590€÷12` e regista o erro via `logger.error`. Clube é classificado mensal/anual comparando `club.stripePriceId` com os price IDs em env.

---

## 0c. Definições do Clube
**Status:** ✅ funcional  
**Página:** `/settings`  
**Permissão:** `isAdmin`  
**APIs:** `GET /api/settings`, `PATCH /api/settings`, `PATCH /api/seasons/[id]` (para guardar tarifas da época)

### Funcionalidades
- Página reorganizada em 4 cards: **Logo do clube**, **Mensalidades e Quotas por Época**, **Cor do clube**, **Informações gerais**
- Atualizar nome do clube, país, idioma do dashboard
- Idioma guardado em `Club.language` — a mudança requer novo login para ter efeito no JWT
- **Paleta de cores do clube** — 8 presets (Verde, Azul, Vermelho, Roxo, Laranja, Teal, Azul Escuro, Rosa) guardados como HSL triplet em `Club.primaryColor`. Aplicado imediatamente no auth store; propaga via CSS variable `--club-primary` no layout do dashboard sem necessitar de novo login.
- `PATCH /api/settings` aceita campo `primaryColor` (regex: `/^\d{1,3} \d{1,3}% \d{1,3}%$/`)
- **Mensalidades e Quotas por Época**: card com selector de época + dois campos numéricos (`defaultAthleteMonthlyFee`, `defaultMemberMonthlyQuota`). Guarda via `PATCH /api/seasons/[id]`. Se não existirem épocas, mostra link para `/seasons`.
- Overscroll whitespace corrigido — `overscroll-contain` no `<main>` do dashboard layout
- Audit log em cada PATCH
- Logo do clube renderizado via `next/image` (`Sidebar.tsx`, `settings/page.tsx`) — hosts externos (R2) têm de estar em `images.remotePatterns` no `next.config.mjs`, **separado** do `img-src` do CSP (um permite o browser carregar a imagem, o outro permite ao `/_next/image` pedi-la para otimizar). Ver BUG-028 em `docs/ISSUES-BACKLOG.md`.

---

## 0d. Épocas Desportivas (Seasons)
**Status:** ✅ funcional  
**Página:** `/seasons`  
**Permissão:** `isAdmin` (leitura e escrita)  
**APIs:**
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/seasons` | Lista épocas do clube (com `_count.members` + `_count.sponsors`) |
| POST | `/api/seasons` | Criar época (`name`, `startDate`, `endDate`); `defaultAthleteMonthlyFee`/`defaultMemberMonthlyQuota` inicializados a `5` (não `null`) para Definições nunca mostrar valores vazios — clube ajusta depois se quiser |
| PATCH | `/api/seasons/[id]` | Atualizar campos ou ativar época (`{ isActive: true }` → desativa todas as outras) |
| DELETE | `/api/seasons/[id]` | Eliminar época (rejeita se tiver members/sponsors/athletePayments/quotas associados) |

### Funcionalidades
- **CRUD completo**: criar, editar, ativar e eliminar épocas desportivas
- **Épocas por clube**: cada clube tem as suas próprias épocas (TENANTED — `clubId` auto-injectado)
- **Ativar época**: muda `isActive=true` nessa época e `isActive=false` em todas as outras; no máximo 1 ativa por clube
- **Guarda de eliminação**: API rejeita DELETE se a época tiver sócios, patrocinadores, pagamentos ou quotas associados
- **SeasonSelector no Sidebar**: dropdown compacto que mostra as épocas e permite alternar; persiste em `seasonStore` (Zustand, key `hm-season`)
- **Badge chip na toolbar**: quando uma época está selecionada, os módulos Members/Sponsors/Fees/Dashboard mostram um chip com o nome da época

### State Global (`src/store/seasonStore.ts`)
```typescript
interface SeasonOption {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  defaultAthleteMonthlyFee?: number | null   // tarifa padrão de atletas
  defaultMemberMonthlyQuota?: number | null  // quota padrão de sócios
}
{
  seasons: SeasonOption[]
  selectedSeasonId: string | null
  setSeasons(seasons: SeasonOption[]): void
  setSelectedSeason(id: string | null): void
  getSelectedSeason(): SeasonOption | null
  getActiveSeason(): SeasonOption | null
}
```
- Persistido via `zustand/middleware/persist` com key `hm-season` em `localStorage`
- Carregado por `SeasonSelector.tsx` (GET `/api/seasons`) ao montar o Sidebar
- `defaultAthleteMonthlyFee`/`defaultMemberMonthlyQuota` disponíveis em todos os componentes via store

### Componentes
- `src/components/season/SeasonSelector.tsx` — dropdown no Sidebar com opção "Todas as épocas"
- `src/app/(dashboard)/seasons/page.tsx` — página CRUD (Sheet criar/editar, confirm dialog eliminar)

### Módulos que respondem ao seasonStore
| Módulo | Comportamento |
|--------|--------------|
| Dashboard | `?seasonId` filtra contadores de sócios, patrocinadores e receitas de mensalidades |
| Mensalidades | `?seasonId` usa meses dinâmicos da Season; `effectiveFee` calculado com `defaultAthleteMonthlyFee` e `discountPercent` |
| Sócios | `?seasonId` filtra lista; form pré-seleciona a época; QuotaCalendar usa `season.endDate.year`; quota auto-preenchida com `defaultMemberMonthlyQuota` |
| Patrocinadores | `?seasonId` filtra lista; form pré-seleciona a época |
| Equip. Hóquei | `?seasonId` filtra materiais por `Material.seasonId`; form usa picker de época |
| Materiais Têxteis | `?seasonId` filtra têxteis por `TextileItem.seasonId`; form usa picker de época |
| Definições | card "Mensalidades e Quotas" edita `defaultAthleteMonthlyFee`/`defaultMemberMonthlyQuota` da época selecionada |

### Validações Zod (`src/lib/validations.ts`)
```typescript
createSeasonSchema: { name: string, startDate: string, endDate: string }
updateSeasonSchema: { name?, startDate?, endDate?, isActive? }
```

### Notas
- `endDate <= startDate` → 400 na API
- Nome duplicado no mesmo clube → 409 (Prisma P2002 unique `[clubId, name]`)
- Épocas sem `isActive` existem (nunca foram ativadas); o Sidebar mostra a ativa com destaque verde
- TENANTED: `db.season.create()` requer `clubId: ctx.clubId` explicitamente no `data` (TS type o exige; ver nota em DATABASE.md)
- `defaultAthleteMonthlyFee`/`defaultMemberMonthlyQuota` nascem a `5` em toda época nova (2026-07-17) — evita inputs vazios em Definições logo após registo/criação de época; continuam nullable no schema (épocas antigas podem ter `null`)
- `SeasonSelector.tsx` só lê `seasons`/`selectedSeasonId` do store depois de montar (`useMounted()`) — ver padrão "Stores Zustand persistidas" em `docs/CONVENTIONS.md`; sem isto, hard-reload numa página com época selecionada causava erro de hidratação React #418

---

## 1. Dashboard
**Status:** ✅ funcional  
**Página:** `/`  
**Permissão:** qualquer utilizador autenticado  
**API:** `GET /api/dashboard/stats[?seasonId=<uuid>]`

### Funcionalidades
- **Cards KPI clicáveis**: atletas → `/athletes`, sócios → `/members`, patrocinadores → `/sponsors`, materiais → `/materials`, treinos (30d) → `/attendance`, têxteis atribuídos → `/textiles`. Hover shadow via `hover:shadow-md hover:border-primary/40`.
- **Gráfico de receitas** por fonte: mensalidades (época atual) + quotas sócios (ano civil) + patrocinadores ativos
- **Gráfico de despesas** por categoria: materiais hóquei (acumulado) + têxteis clube (acumulado) + salários direção (ano civil)
- Atletas por escalão (bar chart visual)
- Estado dos materiais (FREE/ASSIGNED/DAMAGED)
- **Alertas clicáveis**: mensalidades em atraso → `/fees`, quotas em atraso → `/members`, contratos a expirar → `/sponsors`
- Próximas viagens (até 5)
- **Filtro por época**: quando `seasonStore.selectedSeasonId` está definido, o dashboard passa `?seasonId` à API e os contadores de sócios, patrocinadores e receitas de mensalidades são filtrados por essa época

### Notas técnicas
- `getCurrentSeasonStart()` → se mês >= 9 usa ano atual, senão ano-1 (fallback sem seasonId)
- `?seasonId`: API busca o modelo Season, chama `computeSeasonMonths(startDate, endDate)`, filtra AthletePayment via `OR: [{year,month}…]` e Member/Sponsor via `{ seasonId }`
- Revenue de mensalidades: soma `AthletePayment.amount` where `paid=true` na época
- Revenue de quotas: soma `Quota.amount` (com fallback para `member.monthlyQuota` em registos antigos)
- `athletesWithLatePayments`: atletas com `feeExempt=false`, `monthlyFee>0`, não SENIORS, com menos pagamentos pagos que meses passados no ano
- Despesas materiais: `SUM(paidAmount)` - `SUM(paidAmount WHERE paidByAthlete=true)` → custo real clube
- Despesas têxteis: `SUM(TextileItem.paidAmount WHERE paidByAthlete=false)` → o que clube pagou diretamente
- Despesas salários: `SUM(DirectionSalaryPayment.amount WHERE paid=true AND year=anoAtual)`
- Janelas temporais: receitas (época/ano) vs despesas (acumulado + ano) — não comparar diretamente num saldo
- Skeleton loading com `animate-pulse`

---

## 2. Atletas
**Status:** ✅ funcional  
**Páginas:** `/athletes` (lista), `/athletes/[id]` (perfil)  
**Permissão leitura:** `viewAthletes`  
**Permissão escrita:** `editAthletes`  
**APIs:**
- `GET /api/athletes?search=&ageGroup=` → lista filtrada, orderBy number asc
- `POST /api/athletes` → criar (201)
- `GET /api/athletes/[id]` → perfil com `include: { materials, directionRole }`
- `PUT /api/athletes/[id]` → atualizar
- `DELETE /api/athletes/[id]` → eliminar

### Funcionalidades — Lista (/athletes)
- Tabela com número, nome, escalão, data nascimento, **idade** (calculada em runtime), telefone
- Filtro por escalão (select) + pesquisa por nome/telefone (debounced)
- Botão perfil (ExternalLink → `/athletes/[id]`)
- Empty state com CTA "Adicionar primeiro atleta" quando sem filtros
- Sheet lateral para criar/editar atleta
- Dialog de confirmação de eliminação
- Campos: número, nome, escalão, data nasc., telefone, email, NIF, CC/BI, morada
- **Mensalidade** (todos os escalões incluindo SENIORS): info box com tarifa da época (`defaultAthleteMonthlyFee`), campo de desconto individual (0-100%), toggle isenção; preview do valor efetivo quando desconto > 0
- Campos só para não-SENIORS: escola, encarregado de educação

### Funcionalidades — Perfil (/athletes/[id])
- Header com número, nome, escalão, badge isento
- **Dropdown de navegação**: filtrar por escalão → selecionar atleta → navega para perfil
- Escalão pré-selecionado = escalão do atleta atual
- Cards: info pessoal, contacto, **mensalidade** (breakdown: tarifa época → desconto% → valor efetivo), materiais atribuídos
- Funções na Direção (se athlete.directionRole existe)
- Histórico de pagamentos (só se `can('viewFees')` e não-SENIORS) com navegação por época (‹ ›)
- Sheet de edição inline (inclui campo `discountPercent`)
- Error handling: 401→"Sessão expirada", 404/500→"Atleta não encontrado"

### Lógica de mensalidade (effectiveFee)
```typescript
// em /api/fees e /api/athletes/[id]/payments
const seasonDefault = season.defaultAthleteMonthlyFee   // tarifa base da época
const effectiveFee = seasonDefault != null
  ? Math.round(seasonDefault * (1 - (athlete.discountPercent ?? 0) / 100) * 100) / 100
  : athlete.monthlyFee  // fallback legado
```
- `athlete.monthlyFee` mantido no schema para backward compat mas **não exposto nos formulários**
- `discountPercent` é individual por atleta (0-100, nullable = sem desconto)
- Valor efetivo exibido no perfil e na grelha de mensalidades

### Enums
```typescript
AgeGroup: SUB11 | SUB13 | SUB15 | SUB17 | SUB19 | SENIORS
```

### Notas
- SENIORS excluídos do histórico de pagamentos na tab do perfil (design intencional), mas têm mensalidade configurável
- `birthDate` guardado como `DateTime` no DB, sempre string ISO na API
- Número de atleta único (`@unique`)

---

## 3. Mensalidades (Fees)
**Status:** ✅ funcional  
**Página:** `/fees`  
**Permissão leitura:** `viewFees`  
**Permissão escrita:** `editFees`  
**APIs:**
- `GET /api/fees?season=&ageGroup=[&seasonId=<uuid>]` → grelha época com summary financeiro
- `GET /api/athletes/[id]/payments?year=` → pagamentos de atleta por ano (usa `db` — tenant-scoped)
- `POST /api/athletes/[id]/payments` → upsert pagamento (usa `db.athletePayment.upsert`, clubId auto-injectado)

### Funcionalidades
- Grelha: linhas = atletas (não-SENIORS), colunas = meses da época (dinâmicos)
- **Paginação**: 25 atletas por página; controls ‹ › com indicador "Pág X / Y"
- **Coluna "Total"** sticky à direita: verde = total pago na época, vermelho = total pendente; "—" se isento
- **Célula não paga**: clique abre dialog de confirmação (valor editável, campo de notas) → regista pagamento
- **Célula paga**: ponto azul se tiver nota; clique abre dialog para editar valor / remover pagamento
- **Cabeçalho de mês clicável**: marca todos os atletas não pagos desse mês de uma vez (com confirmação + notas opcional)
- **Seleção múltipla**: botão "Seleção múltipla" + barra inferior para registar vários pagamentos em batch
- Filtro por escalão + navegação por época (sem limite superior quando sem seasonId)
- Summary: total cobrado, total em falta, atletas a dia, atletas com atrasos, isentos
- Não inclui SENIORS (design intencional)
- **Filtro por época**: quando `seasonStore.selectedSeasonId` está definido, o botão de navegação de época desaparece e os meses são calculados dinamicamente a partir do Season do DB

### Lógica de época (dinâmica)
- **Com `?seasonId`**: API busca Season, chama `computeSeasonMonths(startDate, endDate)` — gera array `[{year, month}]` para qualquer intervalo de datas. Filtro de pagamentos usa `OR: months.map(({year,month}) => ({year,month}))`. Resposta inclui campo `months` que o cliente armazena em `apiMonths` state.
- **Sem `?seasonId`** (legado): usa `?season=<yearStart>`, meses 9-12 do primeiro ano + 1-6 do segundo ano (hardcoded).
- `activeMonths` no cliente: `useMemo` que combina ambos os caminhos no mesmo shape `{year, month, label, labelFull}` — toda a renderização usa `sm.year` em vez de calcular o ano localmente.
- `isMonthPast`: `year < currentYear || (year === currentYear && month < currentMonth)`

### Cálculo effectiveFee na API (/api/fees)
- API busca a `Season` selecionada para obter `defaultAthleteMonthlyFee`
- Para cada atleta: `effectiveFee = seasonDefault * (1 - discountPercent/100)` (ou `monthlyFee` como fallback legado)
- `AthleteWithPayments` no cliente inclui `effectiveFee: number` — toda a lógica de pagamento usa este valor

### Notas
- `amount` guardado no upsert: se pago → `amount ?? athlete.effectiveFee`, se não pago → null
- `paidAt` definido em upsert quando `paid=true`, null quando `paid=false`

---

## 4. Sócios (Members)
**Status:** ✅ funcional  
**Página:** `/members`  
**Permissão leitura:** `viewMembers`  
**Permissão escrita:** `editMembers`  
**APIs:**
- `GET /api/members?search=&page=[&seasonId=<uuid>]` → lista paginada (50/pág) com `paidCount` + `lateMonths` do ano corrente; search por nome, email ou número; retorna `{ members, total, page, pages }`
- `POST /api/members` → criar (aceita `seasonId?`)
- `GET/PUT/DELETE /api/members/[id]`
- `GET /api/members/[id]/quotas?year=` → quotas do ano (usa `db` — tenant-scoped)
- `POST /api/members/[id]/quotas` → upsert quota (usa `db.quota.upsert`, clubId auto-injectado; guarda `amount = member.monthlyQuota`, aceita `notes?`)

### Funcionalidades
- Tabela com número (auto-increment por época), nome, quota mensal, telefone, email
- **Paginação**: 50 sócios por página
- **Coluna Estado**: badge verde "Em dia" / vermelho "X em atraso" com base nos meses passados do ano corrente
- Pesquisa por nome, email ou número de sócio (debounced)
- Email e telefone clicáveis: `mailto:` e `tel:` links diretos
- Empty state com CTA "Adicionar primeiro sócio" quando sem pesquisa ativa
- Sheet lateral criar/editar com dropdown de época (quando existem épocas) — pré-selecionado com a época ativa do `seasonStore`
- **Filtro por época**: chip de badge mostra a época selecionada; lista filtra por `seasonId` quando definido; novo sócio herda a época selecionada
- **Quota automática ao criar**: ao criar novo sócio, `monthlyQuota` é automaticamente preenchida com `Season.defaultMemberMonthlyQuota`; info box exibe o valor (sem input editável). Na edição mantém-se o input normal para ajustes individuais.
- **QuotaCalendar**:
  - Calendário 12 meses do ano, toggle pago/não-pago, mostra valor pago em cada tile
  - Ano padrão ao abrir o QuotaCalendar: `selectedSeason.endDate.getFullYear()` (quando há época ativa); fallback para ano atual
  - Clique abre dialog de confirmação com campo de notas antes de registar
  - Botão **"Pagar todas em atraso"** (conta e lista meses pendentes, batch com uma confirmação)
- Número de sócio auto-increment (não editável); mesmo número pode existir em épocas diferentes (unique é `[clubId, number, seasonId]`)

### Diferença atleta vs sócio
- Sócio = pessoa associada ao clube (pagamento de quota mensal, sem relação com jogos)
- Atleta = jogador (mensalidade, equipamento, viagens)
- Podem ser pessoas diferentes

---

## 5. Materiais (Inventory)
**Status:** ✅ funcional  
**Página:** `/materials`  
**Permissão leitura:** `viewMaterials`  
**Permissão escrita:** `editMaterials`  
**APIs:**
- `GET /api/materials?search=&category=&state=[&seasonId=<uuid>]` → lista filtrada (por época quando `seasonId` fornecido)
- `POST /api/materials` → criar (aceita `seasonId?`)
- `GET/PUT/DELETE /api/materials/[id]`

### Funcionalidades
- Tabela: tipo, marca/modelo, categoria, estado, atleta atribuído, **valor/quem pagou**
- Filtros: pesquisa por tipo/nome, categoria, estado
- **Filtro por época**: chip de badge quando `selectedSeason` ativo; lista filtra por `Material.seasonId`; form inclui picker de época (selector com épocas do store ou fallback input texto)
- **Tipos predefinidos por categoria** (constante `MATERIAL_TYPES` em `src/lib/constants.ts`):
  - `ATHLETE`: Patins Completos, Botas, Chassis, Rodas, Travões, Rolamentos, Stick, Bola, Luvas, Joelheiras, Caneleiras, Coquilha, Capacete com Viseira
  - `GOALKEEPER`: Patins de Guarda-Redes, Stick de Guarda-Redes, Caneleiras GR, Peitilho, Luva de Raquete, Luva do Stick, Máscara com Grelha/Viseira, Calções Almofadados, Proteção de Pescoço
  - `SMALL`: Cones, Coletes, Bola de Treino, Saco de Equipamento, Garrafa, Rolamentos, Fita para Sticks, Atacadores, Conjunto de Parafusos, Borracha de Suspensão
  - "Outro..." → input de texto livre para tipos não listados
- **Campo Marca/Modelo** (campo `name`) — opcional, marca ou modelo do equipamento
- **Custo e pagamento por item** (quando estado = ASSIGNED):
  - `paidAmount Float?` — **custo do equipamento**, independente de quem pagou; sempre visível
  - `paidByAthlete Boolean` — se o atleta pagou (sim → clube poupou; não → clube gastou)
  - Tabela: badge **verde** `X€ (atleta)` se pago pelo atleta; badge **laranja** `X€ (clube)` se clube pagou; traço se sem valor
  - Campos limpos automaticamente quando material é desatribuído
- **Modo batch**: criar múltiplos itens de uma vez com atleta partilhado + lista de cards
  - Submit usa `Promise.allSettled` (falha parcial não cancela os restantes)
- Empty state com CTA quando sem materiais e sem filtros ativos
- **Perfil de atleta**: mostra tipo como label principal, marca como texto secundário, badge de pagamento + badge de estado

### Dashboard — Custos e Despesas
A API `GET /api/dashboard/stats` inclui `materialCosts`, `textiles` e `expenses`:
```typescript
materialCosts: { total, savedByAthletes, clubCost }
textiles: { assignedCount, savedByAthletes, clubCost }
expenses: {
  year: number                // ano civil atual
  materialsClubCost: number   // custo real clube em materiais hóquei (acumulado)
  textilesClubCost: number    // SUM(paidAmount WHERE paidByAthlete=false) em têxteis
  directionSalaries: number   // SUM(DirectionSalaryPayment.amount WHERE paid=true AND year)
}
```
Exibido na secção "Despesas" do dashboard com gráfico de barras proporcional + cards por categoria.

### Enums
```typescript
MaterialCategory: ATHLETE | GOALKEEPER | SMALL
MaterialState: FREE | ASSIGNED | DAMAGED
```

### Notas
- `athleteId` nullable → quando atribuído, estado deve ser ASSIGNED
- `onDelete: SetNull` no atleta (eliminar atleta não elimina material, apenas desassocia)
- `crypto.randomUUID()` usado para IDs dos batch items (sem biblioteca extra)
- TypeScript: `zodResolver` tem cast `as any` por incompatibilidade com `z.coerce.number().nullable().optional()` — runtime correto

---

## 6. Patrocinadores (Sponsors)
**Status:** ✅ funcional  
**Página:** `/sponsors`  
**Permissão leitura:** `viewSponsors`  
**Permissão escrita:** `manageSponsors` (único permissão para leitura E escrita)  
**APIs:**
- `GET /api/sponsors[?seasonId=<uuid>]` → lista (filtrada por época quando `seasonId` fornecido)
- `POST /api/sponsors` → criar (aceita `seasonId?`)
- `GET/PUT/DELETE /api/sponsors/[id]`

### Funcionalidades
- **Stats no topo**: patrocinadores ativos, €/ano total, naming rights, total de lonas
- Cards com logo do patrocinador, nome, contribuição, badges de tipo, zonas de equipamento, lonas, sticks/caneleiras
- **Filtro de estado**: Todos / Ativos / A expirar / Expirados (botões pills)
- **Filtro por tipo**: Todos os tipos + cada `sponsorType` disponível
- **Filtro por época**: chip de badge mostra a época selecionada; lista filtra por `seasonId` quando definido; novo patrocinador herda a época ativa do `seasonStore`
- Badge por estado: verde "Ativo", laranja "Expira em Xd" (≤30d), vermelho "Expirado"
- Empty state com CTA quando sem patrocinadores
- **Formulário expandido**: dropdown de época (quando existem épocas), upload de logo (R2 via `/api/upload`), multi-select de tipos de patrocínio, grid de 6 zonas de equipamento (condicional), nº de lonas (condicional), checkboxes sticks/caneleiras
- `formSeasonId` gerido como estado externo ao react-hook-form (padrão idêntico ao `logoUrl` e `selectedTypes`)

### Tipos de Patrocínio (sponsorTypes)
`EQUIPMENT_SENIOR` · `EQUIPMENT_FORMATION` · `NAMING_RIGHTS` · `BANNER` · `STICKS` · `SHINGUARDS` · `OTHER`

### Zonas de Equipamento (equipmentZones)
1=Ombro Esq · 2=Ombro Dir · 3=Peito ★ · 4=Calções · 5=Costas Inf · 6=Trás Calções

### Notas
- `viewSponsors` para leitura, `manageSponsors` para escrita
- Dashboard mostra patrocinadores a expirar em 30 dias
- Zonas de equipamento apenas aparecem no formulário quando tipo inclui `EQUIPMENT_SENIOR` ou `EQUIPMENT_FORMATION`
- Nº de lonas apenas aparece no formulário quando tipo inclui `BANNER`

---

## 7. Viagens (Travel)
**Status:** ✅ funcional  
**Página:** `/travel`  
**Permissão leitura:** `viewTravel`  
**Permissão escrita:** `editTravel`  
**APIs:**
- `GET /api/travel` → lista, orderBy departureDate desc
- `POST /api/travel` → criar
- `GET/PUT/DELETE /api/travel/[id]`

### Funcionalidades
- Lista dividida: "Próximas" vs "Passadas"
- "Ver todas" aparece se >6 viagens passadas (expansível); preferência guardada em `localStorage` (`travel_showAllPast`)
- Campos: adversário, URL pavilhão, data partida, data regresso, hora partida, transporte, refeição, notas
- **Condutores**: selecionáveis a partir dos membros da Direção (chips clicáveis), mais input livre adicional
- **Convocados**: lista multi-select de atletas (checkbox por nome)
- **Orçamento**: 3 campos opcionais — transporte, refeição, alojamento (Float); total calculado em tempo real
- **Checklist de partida**: lista de itens editáveis com botão "+" e remoção individual
- Cards mostram: adversário, data, convocados count, total orçamento, checklist count
- Sheet criar/editar com todas as secções acima

### Notas
- `drivers` é `String[]` (nomes livres + nomes selecionados da direção)
- `convocados String[]`, `checklistItems String[]` — arrays PostgreSQL `@default([])`
- `budgetTransport`, `budgetMeal`, `budgetAccommodation` — `Float?`, opcionais
- `returnDate` e outros campos opcionais

---

## 8. Direção (Direction)
**Status:** ✅ funcional (após migration 004)  
**Página:** `/direction`  
**Permissão leitura:** `viewDirection`  
**Permissão escrita:** `editDirection`  
**APIs:**
- `GET /api/direction` → lista com `include: athlete`
- `POST /api/direction` → criar
- `GET/PUT/DELETE /api/direction/[id]`
- `GET /api/direction/[id]/salary?year=` → pagamentos de salário do membro no ano (usa `db` — tenant-scoped)
- `POST /api/direction/[id]/salary` → upsert pagamento (usa `db.directionSalaryPayment.upsert`, clubId auto-injectado); `amount` usa `member.salary` como default se omitido

### Funcionalidades
- Tabela com nome, cargos (badges), escalões, salário, link para atleta
- **Total de salários** exibido abaixo da tabela
- Empty state com CTA "Adicionar primeiro membro da direção"
- Cargos múltiplos por membro (array `roles`)
- Escalões de treinador e seccionista separados (`trainerAgeGroups`, `sectionistAgeGroups`)
- Link opcional para atleta sénior (`athleteId` → unique)
- Sheet criar/editar
- **Histórico de salário** (botão calendário por membro, só aparece se `salary > 0`):
  - Calendário 12 meses do ano com navegação ‹ › (mín 2025)
  - Toggle pago/não-pago por mês; valor padrão = `member.salary`
  - Total pago no ano calculado em tempo real
  - Modal `SalaryCalendar` idêntico ao `QuotaCalendar` dos sócios

### Cargos disponíveis
```typescript
DIRECTION_ROLES: 'TRAINER' | 'ASSISTANT_TRAINER' | 'DIRECTOR' | 'SECCIONISTA' | 'SOCORRISTA' | 'FIELD_DIRECTOR'
```

### Notas críticas
- Se `roles` não inclui `'TRAINER'` → `trainerAgeGroups` é limpo no PUT
- Se `roles` não inclui `'SECCIONISTA'` → `sectionistAgeGroups` é limpo
- **Migration 004 essencial** — adiciona `roles TEXT[]` e `trainerAgeGroups TEXT[]` que estavam em falta em produção
- Relação bidirecional: `Athlete.directionRole` ↔ `DirectionMember.athlete`

---

## 9. Treinos + Quadro Tático
**Status:** ✅ funcional  
**Páginas:** `/training` (lista), `/training/[id]` (quadro tático)  
**Permissão leitura:** `viewTraining`  
**Permissão escrita:** `editTraining`  
**APIs:**
- `GET /api/training` → lista, orderBy date desc
- `POST /api/training` → criar
- `GET/PUT/DELETE /api/training/[id]`
- `GET /api/training/[id]/playbook` → carregar playbook
- `PUT /api/training/[id]/playbook` → guardar playbook (upsert)

### Funcionalidades — Lista
- Cards de treino com data, título, notas
- Botão para abrir quadro tático
- **Empty state com CTA**: ícone `Dumbbell` + botão "Adicionar treino" visível para utilizadores com `editTraining`

### Funcionalidades — Quadro Tático
- Campo de hóquei SVG (HockeyField.tsx)
- Elementos: jogador (azul), adversário (vermelho), bola (amarela), cone (laranja)
- Drag-and-drop por CSS transform (sem biblioteca externa)
- Multi-frame: adicionar frames, navegar, remover
- Playback animado (1200ms/frame) com PlaybackOverlay
- Guardar/carregar playbook (JSON no DB)
- Reset do quadro

### Limites (validados na API)
- Máx 50 elementos por playbook
- Máx 100 frames
- Labels máx 20 chars
- IDs máx 64 chars

### State (tacticalStore — NÃO persistido)
- Reset ao navegar para outro treino
- `loadPlaybook()` carrega do DB ao abrir quadro
- `toPlaybook()` serializa para guardar

---

## 10. Relatórios (Reports)
**Status:** ✅ funcional  
**Página:** `/reports`  
**Permissão:** `viewAthletes` (atletas) · `viewMembers` (sócios) · `viewFees` (financeiro) · `viewMaterials` (materiais) · `viewAttendance` (assiduidade) · `viewTextiles` (têxteis)  
**APIs:**
- `GET /api/reports/athletes?ageGroup=` → XLSX atletas
- `GET /api/reports/members?year=` → XLSX sócios com estado de quotas
- `GET /api/reports/financial?season=` → XLSX financeiro (mensalidades por época)
- `GET /api/reports/materials` → XLSX materiais
- `GET /api/reports/attendance?ageGroup=` → XLSX assiduidade
- `GET /api/reports/textiles?season=` → XLSX têxteis

### Funcionalidades
- Download **XLSX** (Excel nativo — encoding de caracteres especiais correto sem BOM hack)
- Helper `src/lib/xlsx.ts` → `buildXlsx(sheetName, headers, rows)` (ExcelJS) com auto-width e cabeçalho negrito+fundo cinzento
- Relatório atletas: número, nome, escalão, data nasc., NIF, CC/BI, contacto, mensalidade
- **Relatório sócios**: número, nome, contacto, quota mensal, Jan-Dez (valor pago), total pago, estado
- Relatório financeiro: por época, colunas por mês, total pago, em falta
- Relatório materiais: nome, categoria, tipo, estado, atleta atribuído
- Relatório assiduidade: atleta, escalão, total sessões, presenças, %
- Relatório têxteis: tipo, tamanho, categoria, época, estado, atleta, custo

---

## 11. Admin — Permissões
**Status:** ✅ funcional  
**Página:** `/admin/permissions`  
**Permissão:** `isAdmin`  
**APIs:**
- `GET /api/admin/permissions` → lista utilizadores com permissões (inclui `lastLoginAt`)
- `PUT /api/admin/permissions/[userId]` → atualizar permissões (incrementa `tokenVersion` → invalida sessão)
- `POST /api/admin/users` → criar utilizador (nome, email, password mín 6 chars)
- `PUT /api/admin/users/[id]` → redefinir password (mín 8 chars; incrementa `tokenVersion` → invalida sessão)

### Funcionalidades
- Tabela de utilizadores com coluna **"Último Login"** (relativa: "Hoje", "Ontem", "Xd atrás")
- Botão **"Redefinir Password"** (ícone chave) por utilizador → dialog com 2 campos + confirmação de match
- Botão **"Permissões"** por utilizador → `PermissionsModal`
- Botão **"Novo Utilizador"** → dialog criar utilizador
- Proteção: admin não pode remover isAdmin de si próprio (verificado no cliente)
- **Enforced**: ativar permissão de edição ativa automaticamente a de leitura; desativar leitura desativa edição

### 20 Flags de Permissão
```
viewAthletes, editAthletes
viewMembers, editMembers
viewMaterials, editMaterials
viewSponsors, manageSponsors
viewTraining, editTraining
viewTravel, editTravel
viewDirection, editDirection
viewFees, editFees
viewAttendance, editAttendance
viewTextiles, editTextiles
isAdmin
```

---

## 12. Admin — Audit Log
**Status:** ✅ funcional  
**Página:** `/admin/audit`  
**Permissão:** `isAdmin`  
**APIs:**
- `GET /api/admin/audit?page=&entity=&action=&userId=` → paginado (50/página), filtro de admin aplicado
- `DELETE /api/admin/audit` → limpar (all / before date / by ids)
- `GET /api/admin/audit/export` → export JSON do audit log (max 10 000 registos), filtro de admin aplicado

### Regra de visibilidade (filtro activo na API)
A API aplica automaticamente este filtro **antes** dos filtros do utilizador:
- **Sempre visível:** acção `LOGIN_FAIL` de qualquer utilizador (incluindo admin)
- **Visível:** todas as acções (`CREATE`, `UPDATE`, `DELETE`, `LOGIN`, etc.) de utilizadores **não-admin**
- **Não visível:** acções de admin (incluindo LOGIN bem-sucedido de admin)

Implementado com `OR: [{ action: 'LOGIN_FAIL' }, { userId: { notIn: adminIds } }]`, sendo `adminIds` os IDs dos utilizadores com `isAdmin: true`. Permite auditar o que os outros utilizadores fazem e qualquer tentativa de login falhada, sem poluir com as acções de administração.

### Funcionalidades
- Tabela paginada com filtros por entidade, ação, utilizador
- Ver detalhes de cada entrada (inclui IP para LOGIN/LOGIN_FAIL)
- Limpar logs (tudo / antes de data / selecionados)
- Export JSON (com mesma regra de visibilidade)
- Cabeçalho explica o critério de filtragem ao admin

### Ações auditadas
```typescript
AuditAction: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGIN_FAIL' | 'LOGOUT' | 'CHANGE_PASSWORD' | 'CHANGE_PERMISSIONS'
```
- `LOGIN_FAIL` — tentativa de login com credenciais incorretas; `userEmail` = email tentado, `userId` = null

### Entidades auditadas (14 total)
`Athlete` · `Member` · `Material` · `TextileItem` · `Sponsor` · `Travel` · `DirectionMember` · `Training` · `TrainingSession` · `TrainingSchedule` · `AttendanceRecord` · `User` · `Quota` · `AthletePayment`

---

## 13. Assiduidades (Attendance)
**Status:** ✅ funcional  
**Página:** `/attendance`  
**Permissão leitura:** `viewAttendance`  
**Permissão escrita:** `editAttendance`  
**APIs:**
- `GET /api/attendance?ageGroup=&sessionType=&from=&to=` → lista sessões com contagem de presenças + cancelled/scheduleId
- `POST /api/attendance` → criar sessão (aceita `scheduleId?`)
- `GET/PUT/DELETE /api/attendance/[id]` → sessão individual
- `PATCH /api/attendance/[id]/cancel` → cancelar/reativar (`{ cancelled, cancellationReason? }`)
- `GET /api/attendance/[id]/records` → registos de presença (usa `db` — tenant-scoped)
- `PUT /api/attendance/[id]/records` → upsert bulk (usa `db.attendanceRecord.upsert`, clubId auto-injectado; `{ records: [{athleteId, present, notes?}] }`). **Segurança:** antes do upsert, todos os `athleteId` são validados contra o clube atual via `db.athlete.findMany` — athleteIds de outros clubes → 400 (fix SEC-027)
- `GET /api/attendance/schedules?season=` → horários por época
- `POST /api/attendance/schedules` → criar horário recorrente
- `PUT/DELETE /api/attendance/schedules/[id]` → editar/eliminar horário
- `GET /api/athletes/[id]/attendance` → stats de assiduidade do atleta (usa `db` — tenant-scoped)
- `GET /api/reports/attendance?ageGroup=` → CSV de assiduidade

### Funcionalidades
**Tab Calendário:**
- Grelha mensal (Seg→Dom) gerada a partir dos horários semanais da época ativa
- Cada célula mostra os treinos esperados para aquele dia (cor por estado):
  - Cinzento = sem registo ainda
  - Verde = presenças registadas (mostra X/Y e %)
  - Vermelho = treino cancelado (com motivo se definido)
- Clicar numa célula → modal com opções: "Registar presenças" ou "Cancelar treino"
- Ao registar pela 1ª vez, cria `TrainingSession` e pré-popula atletas do escalão automaticamente
- Campo de motivo de cancelamento no modal

**Tab Horários:**
- Navegação por época com setas ‹ ›, mínimo 2025/26 (seta esquerda bloqueada antes disso)
- Botão "Novo Horário" só aparece se houver escalões sem horário na época selecionada
- Dropdown de escalão no form filtra automaticamente escalões já cobertos (ao editar mostra todos)
- Aviso amarelo se existem escalões sem horário enquanto outros já têm
- **Copiar época**: botão "Copiar de YYYY/YY" disponível quando época está vazia — replica todos os horários da época anterior com a nova label; disponível mesmo na empty state
- Horários agrupados por escalão com contagem de treinos/semana
- Cores por escalão no calendário: Sub11=amarelo, Sub13=verde, Sub15=azul, Sub17=roxo, Sub19=cinzento, Seniores=preto (`AGE_GROUP_CALENDAR_COLORS` em `src/lib/constants.ts`)
- **Tipo de treino no form**: só mostra GENERAL / GOALKEEPERS / FIELD_PLAYERS — SPECIFIC não é selecionável aqui (criado exclusivamente via botão "+" no calendário)

**Treinos Específicos (SPECIFIC) — sessões pagas ad-hoc:**
- Criados via botão "+" que aparece em hover em cada dia do calendário
- Hora introduzida em formato texto `HH:MM` (24h) — não usa `type="time"` para evitar AM/PM em locales de sistema 12h
- Não ligados a nenhum schedule; aparecem no calendário como slots pretos com ⚡
- Atletas adicionados manualmente (grelha começa vazia — nenhum pré-carregado por escalão)
- Grelha tem colunas extra: **Pagou?** (botão €) + **Valor (€)** por atleta
- Saved via `PUT /api/attendance/[id]/records` com `paidByAthlete` + `paidAmount` por record
- Cancelar via `PATCH /api/attendance/[id]/cancel` (mesmo endpoint dos regulares)
- Stats no perfil do atleta: secção "⚡ Treinos Específicos" com realizados, pagamentos, total pago
- `bySeason` exclui sessões SPECIFIC (stats de época = apenas treinos regulares)

**Grelha de presenças** (abre ao registar):
- Botão ✓/✗ por atleta; "Todos presentes"; "Adicionar atletas"
- Atletas do escalão principal em secção própria; outros escalões integrados na mesma tabela com badge de escalão
- SPECIFIC: tabela única com todos os atletas + colunas de pagamento

**Popup "Adicionar Atletas"** (multi-select):
- Accordions agrupados por escalão, fechados por defeito — só mostra escalões com atletas disponíveis
- Pesquisa livre por nome/número filtra dentro dos grupos
- Clique num atleta faz toggle de seleção (checkbox visual); popup não fecha
- Badge de contagem no header do grupo quando há selecionados
- Atletas já presentes na grelha (com ou sem presença) excluídos da lista
- Botão "Confirmar" dentro do popup: todos os selecionados entram na grelha com `present: true` (linha verde)

**Tab Estatísticas:** ranking por presenças totais, split treinos próprios vs outros escalões

**Perfil atleta — card Assiduidade:**
- Toggle "Total" | "Por época"
- "Total": barra de progresso geral + últimos 8 treinos
- "Por época": lista de épocas com X/Y e % por época, highlight de treinos noutros escalões
- API `/api/athletes/[id]/attendance` retorna `bySeason[]` com breakdown por época

- Dashboard: card "Treinos (30d)"

### Enums
```typescript
SessionType: GENERAL | GOALKEEPERS | FIELD_PLAYERS | SPECIFIC
```

### Constantes de cor (calendário)
```typescript
// src/lib/constants.ts — AGE_GROUP_CALENDAR_COLORS
SUB11:   bg-yellow-100 / text-yellow-900
SUB13:   bg-green-100  / text-green-900
SUB15:   bg-blue-100   / text-blue-900
SUB17:   bg-purple-100 / text-purple-900
SUB19:   bg-gray-100   / text-gray-700
SENIORS: bg-gray-800   / text-white
```

### Notas
- `TrainingSchedule.dayOfWeek`: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
- `MIN_SEASON_YEAR = 2025` — épocas anteriores a 2025/26 bloqueadas na navegação
- `TrainingSession.scheduleId` nullable — liga à schedule de onde veio; SPECIFIC têm `null`
- `TrainingSession.cancelled` + `cancellationReason` — ao cancelar cria sessão se ainda não existia
- Stats por época derivadas da data da sessão (mês ≥ 9 → época desse ano, senão época anterior)
- `bySeason` exclui sessões SPECIFIC e canceladas (stats de época = apenas treinos regulares presentes)
- Stats de temporada calculadas client-side na tab Estatísticas
- `AttendanceRecord.paidByAthlete` + `paidAmount` gravados apenas para SPECIFIC; treinos regulares ficam `false`/`null`

---

## 14. Materiais Têxteis (Textiles)
**Status:** ✅ funcional  
**Página:** `/textiles`  
**Permissão leitura:** `viewTextiles`  
**Permissão escrita:** `editTextiles`  
**APIs:**
- `GET /api/textiles?search=&category=&state=&season=[&seasonId=<uuid>]` → lista filtrada (por época FK quando `seasonId` fornecido, por texto quando `season` fornecido)
- `POST /api/textiles` → criar item (aceita `seasonId?`)
- `GET/PUT/DELETE /api/textiles/[id]`
- `GET /api/reports/textiles?season=` → CSV de têxteis

### Funcionalidades
- Tabela: tipo, tamanho, categoria, época, estado, atleta, custo
- Filtros: pesquisa (notas/personalização), categoria, estado, época (texto)
- **Filtro por época global (FK)**: chip de badge quando `selectedSeason` ativo; lista filtra por `TextileItem.seasonId`; form inclui picker de época que usa `storeSeason` (épocas do store) — separado do campo `season` (texto livre legado)
- **Modo peça única**: categoria → tipo → tamanho → nº camisola + personalização → estado → atleta + custo
- **Modo kit de jogo**: cria camisola + calções + meias de uma vez com `kitRef` partilhado + atleta comum
  - Itens de kit têm `isPartOfKit=true` e o mesmo `kitRef` (timestamp-based)
  - Pode adicionar/remover peças antes de criar
- **Secção de custo** (só ASSIGNED):
  - `totalCost` — custo total do item
  - `paidAmount` — valor pago pelo atleta; auto-preenchido com `totalCost` quando `paidByAthlete=true` (input desativado)
  - `paidByAthlete` — toggle "Totalmente pago pelo atleta?"; quando ativo: `paidAmount = totalCost`, clube não suporta custo
  - Label calculado em tempo real: "Clube paga: Xe" = `totalCost - paidAmount` quando `paidByAthlete=false`
- Perfil de atleta: card com todos os têxteis atribuídos (tipo, tamanho, nº, época, estado, pagamento)
- Dashboard: card "Têxteis Atrib." com count + custo do clube; secção Despesas com breakdown completo

### Enums
```typescript
TextileCategory: GAME | TRAINING | OTHER
TextileType: GAME_SHIRT | GAME_SHORTS | GAME_SOCKS | GK_SHIRT | TRAINING_TOP | TRAINING_PANTS | TRAINING_KIT | JACKET | TSHIRT | OTHER
TextileState: STOCK | ASSIGNED | DAMAGED | LOST
```

### Tamanhos disponíveis
- Infantil: `4 6 8 10 12 14 16`
- Adulto: `XS S M L XL XXL 3XL`

### Notas
- `kitRef` = `"kit-{timestamp}"` — agrupa peças criadas em batch; sem FK própria
- Quando estado ≠ ASSIGNED: `athleteId`, `paidByAthlete`, `paidAmount` são limpos automaticamente no PUT
- `onDelete: SetNull` no atleta (eliminar atleta não elimina têxteis, apenas desassocia)
- **Campo `season` (texto legado)**: `z.string().min(3).max(20)` — sem regex de formato fixo (era `^\d{4}\/\d{2}$`, ex. "2025/26"; removido 2026-07-17 porque `Season.name` aceita qualquer formato — ex. "2025/2026" — e o form preenche `season` a partir do nome da Season selecionada, pelo que o regex antigo rejeitava com 400 qualquer época cujo nome não fosse exatamente "AAAA/AA". Ver BUG-027 em `docs/ISSUES-BACKLOG.md`.)

---

## 15. Auth (Setup + Login + Logout + Change Password + Forgot Password)
**Status:** ✅ funcional  
**Páginas:** `/login`, `/setup`, `/forgot-password`, `/reset-password`  
**APIs:**
- `POST /api/auth/login` → autenticar, set cookie `hm_token`; resposta inclui `clubPrimaryColor` (HSL string do preset do clube)
- `POST /api/auth/logout` → clear cookie, increment tokenVersion, redirect 302 para `/` (middleware redireciona para `/{locale}` da landing — não devolve JSON; suporta native form POST do platform layout e fetch do Sidebar)
- `GET /api/auth/me` → devolver user + permissions
- `POST /api/auth/change-password` → mudar password (rate limited: 5/15min)
- `POST /api/auth/forgot-password` → gera token, envia email Resend com link `/reset-password?token=...`
- `POST /api/auth/reset-password` → valida token, atualiza password, invalida token
- `POST /api/setup` → criar primeiro admin (só funciona se 0 utilizadores)

### Forgot Password
- Modelo `PasswordResetToken` no schema: `token String @unique`, `userId`, `expiresAt`, `used Boolean`
- Token válido por 1 hora; marcado `used=true` após uso (não reutilizável)
- Email enviado via `src/lib/email.ts` → Resend REST API (requer `RESEND_API_KEY`)
- Rate limit: 3 pedidos por email / 15 min (protege contra spam)

### Email Transacional (`src/lib/email.ts`)
- Usa Resend REST API diretamente (sem SDK — evita dependências extras)
- Funções: `sendWelcomeEmail(to, clubName, tempPassword)`, `sendPasswordResetEmail(to, resetLink)`
- `from:` configurado para `noreply@hoqueimanager.com` (necessita domínio verificado no Resend)
- Email de boas-vindas enviado pelo webhook Stripe após `checkout.session.completed`

### Notas
- `/setup` serve para criar o primeiro utilizador em ambiente limpo
- `ChangePasswordDialog` acessível via TopNav
- Rate limit em change-password: 5 req / 15 min por IP
- Login rate limit: 10 req / 15 min por IP
- Login bem-sucedido: `user.lastLoginAt` atualizado via `prisma.user.update` (em paralelo com `logAudit`)
