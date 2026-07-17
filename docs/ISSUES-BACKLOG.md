# Issues & Backlog — HoqueiManager
> Registo vivo. Atualizar sempre que se resolve um problema ou se identifica um novo.

---

## 🔴 Bugs Activos

### ~~[BUG-024] Secção "Mensalidade" não aparecia para atletas Seniores no formulário de criação~~ ✅ RESOLVIDO 2026-07-17
**Encontrado:** 2026-07-17 (teste UI pós-deploy). O bloco `Mensalidade` (com info da tarifa da época, desconto individual e toggle de isenção) estava envolto em `{ageGroupValue !== 'SENIORS' && (...)}` — condição que devia guardar apenas "Escola" e "Encarregado de Educação". Como o escalão por defeito ao criar é "Seniores", a secção de mensalidade nunca aparecia.  
**Fix:** `src/app/(dashboard)/athletes/page.tsx` — removido o `!== 'SENIORS'` que envolvia o bloco de mensalidade. Secção agora aparece para todos os escalões. "Escola" e "Encarregado de Educação" mantêm a condicional.

---

### ~~[DEBT-024] `vitest.config.ts` sem `include` — specs Playwright em `e2e/` apanhados pelo Vitest~~ ✅ RESOLVIDO 2026-07-17
**Encontrado:** 2026-07-17 (após criação dos specs E2E Playwright). O Vitest usava o padrão default `**/*.spec.ts` — apanhando os ficheiros Playwright e causando 6 falhas de suite com `Playwright Test did not expect test.describe() to be called here`.  
**Fix:** `vitest.config.ts` — `include: ['src/**/*.test.ts']` + `exclude: ['e2e/**', 'node_modules/**']`. 67/67 testes voltam a passar.

---

### ~~[SEC-027] IDOR em `PUT /api/attendance/[id]/records` — athleteIds não validados contra clube~~ ✅ RESOLVIDO 2026-07-16
**Encontrado:** 2026-07-16 (auditoria de segurança). Body `{ records: [{ athleteId, present }] }` aceitava qualquer `athleteId` sem verificar se pertencia ao clube autenticado. Embora o Prisma Extension injete `clubId` no `create` branch do `upsert`, o `where` usa `sessionId_athleteId` (sem `clubId`), pelo que um `athleteId` de outro clube seria aceite.  
**Fix:** antes do loop de upsert, `db.athlete.findMany({ where: { id: { in: submittedIds } } })` (tenant-scoped) valida todos os IDs — qualquer ID não pertencente ao clube retorna 400.

---

### ~~[SEC-028] `DELETE /api/admin/audit` — body sem validação Zod, tipo inferido por cast `as any`~~ ✅ RESOLVIDO 2026-07-16
**Encontrado:** 2026-07-16 (auditoria de segurança). Body do DELETE era tratado sem schema Zod — body malformado ou com campos extra passava silenciosamente.  
**Fix:** `discriminatedUnion` Zod schema com 3 modos (`all` / `before` + datetime / `ids` + array de UUIDs max 500).

---

### ~~[SEC-029] `PUT /api/admin/permissions/[userId]` — body destructurado sem validação~~ ✅ RESOLVIDO 2026-07-16
**Encontrado:** 2026-07-16 (auditoria de segurança). Body com campos a mais, a menos, ou de tipo errado era passado diretamente ao Prisma sem validação — risco de escrita de permissões parcial ou com tipos incorretos.  
**Fix:** `permissionsSchema` com 21 campos `z.boolean()` — falha com 400 se qualquer campo faltar ou tiver tipo errado.

---

### ~~[DEBT-023] `vitest.config.ts` não carregava `.env.local` — `npm test` falha sem DATABASE_URL explícito~~ ✅ RESOLVIDO 2026-07-16
**Encontrado:** 2026-07-16 (execução de `npm test`). Vitest não carregava `.env.local` por defeito em Windows, resultando em `SASL: client password must be a string` (DATABASE_URL undefined na pool pg). Com `DATABASE_URL=...` explícito na linha de comando funcionava.  
**Fix:** `vitest.config.ts` usa `loadEnv(mode, process.cwd(), '')` do Vite (que carrega `.env` + `.env.local` + `.env.{mode}`) e passa o resultado ao `test.env`. Todos os 67 testes passam com `npm test` sem variáveis explícitas.

---

### ~~[BUG-022] Contador de têxteis mostra "itemns" em vez de "itens"~~ ✅ RESOLVIDO 2026-07-15
**Encontrado:** 2026-07-15 (QA Playwright). Texto do contador de registos na página `/textiles` apresenta o plural com typo: "2 itemns" em vez de "2 itens".
**Fix:** `item{items.length !== 1 ? 'ns' : ''}` → `{items.length !== 1 ? 'itens' : 'item'}` em `src/app/(dashboard)/textiles/page.tsx` linha 331.

---

### ~~[BUG-021] Chaves i18n `colorTheme`/`colorThemeNote` em falta em todos os locales — exibição de chave raw na página de Definições~~ ✅ RESOLVIDO 2026-07-15
**Encontrado:** 2026-07-15 (QA Playwright). A página `/settings` mostrava os textos brutos `settings.colorTheme` e `settings.colorThemeNote` em vez das traduções. O padrão `t('key') || 'fallback'` em `settings/page.tsx` (linhas 221 e 225) não funciona com next-intl: quando a chave não existe, `t()` devolve a própria string da chave (truthy), pelo que o fallback nunca é ativado.
**Fix:** chaves adicionadas ao objeto `"settings"` nos 5 ficheiros: `messages/dashboard/pt.json`, `en.json`, `es.json`, `fr.json`, `it.json`.

---

### ~~[BUG-020] Loop infinito no React — página de Patrocinadores inutilizável (Radix `react-presence` bug)~~ ✅ RESOLVIDO 2026-07-15
**Encontrado:** 2026-07-15 (QA Playwright). A página `/sponsors` entrava em loop de re-renders infinito ao abrir, tornando-se completamente inacessível. Causa: `@radix-ui/react-presence@1.1.5` chama `setNode()` via `React.startTransition()` durante a fase de commit do React quando um `<Checkbox>` do Radix é renderizado dentro de uma tabela com estado controlado — produz um ciclo de setState → re-render → setState.
**Fix:** componente `<Checkbox>` do Radix substituído por componente custom `<CheckMark>` em `src/app/(dashboard)/sponsors/page.tsx`. Não usa `Presence`, não tem efeito colateral no commit. Estado checked resolvido por lógica direta sem portal/animation wrapper.

---

### [BUG-019] Email sender `noreply@hoqueimanager.com` falha sem domínio verificado no Resend ✅ RESOLVIDO 2026-07-09
**Encontrado:** 2026-07-09 (auditoria pré-deploy). `src/lib/email.ts` hardcodava `noreply@hoqueimanager.com` como sender. O Resend rejeita envios de domínios não verificados — todos os emails de boas-vindas e reset de password falhariam silenciosamente em produção (log `[email] Resend error: 403/422`), bloqueando o fluxo de registo completo.
**Fix:** sender alterado para `process.env.EMAIL_FROM ?? 'HoqueiManager <onboarding@resend.dev>'`. `onboarding@resend.dev` é o domínio pré-verificado do Resend, funciona imediatamente sem configuração. Quando o domínio `hoqueimanager.com` for verificado no Resend, basta adicionar `EMAIL_FROM=HoqueiManager <noreply@hoqueimanager.com>` ao Vercel — sem tocar no código.

### ~~[BUG-018] `src/app/icon.png` sobrepõe `metadata.icons` — favicon mostra ícone antigo~~ ✅ RESOLVIDO 2026-07-09
**Encontrado:** 2026-07-09 (auditoria de ficheiros). **Fix (commit `cce8f83`):** `src/app/icon.png` substituído por cópia de `public/logoHD.png`.

### ~~[BUG-015] `getDbForRequest` crashava com `ReferenceError: prisma is not defined` — TODAS as rotas de dashboard~~ ✅ RESOLVIDO 2026-07-06
**Encontrado:** 2026-07-06 (typecheck sem truncar output — ver nota de processo abaixo).
Commit `c83ac59` (2026-06-25, limpeza de warnings) removeu `import { prisma } from './prisma'` de `src/lib/db.ts` por estar "unused" nessa altura. Commit seguinte `efd46cd` (2026-06-26, SEC-022) voltou a usar `prisma.club.findUnique(...)` dentro de `getDbForRequest()` sem repor o import. Isto ficou em `main` desde 26 de junho — **qualquer chamada a `getDbForRequest()` (usado por praticamente todas as rotas API do dashboard) rebentava com `ReferenceError` em runtime**, e o `next build` também devia falhar no typecheck. Não detectado antes porque as verificações de typecheck desta sessão (e possivelmente builds anteriores) estavam a usar `tail -N` sobre o output, cortando erros fora da janela.
**Fix:** import reposto em `db.ts`. **Acção recomendada:** confirmar se o deploy Vercel de produção está mesmo a servir código pós-26-jun sem este erro (se o build falhou silenciosamente e o Vercel ficou a servir a build anterior, o site pode estar bem; se o build passou por algum motivo — ex. `ignoreBuildErrors` — o dashboard em produção pode estar completamente inacessível). **Verificar isto na Vercel antes de mais nada.**

### ~~[BUG-016] 6 sites de `upsert`/`create` sem `clubId` explícito — mascarado por client Prisma desatualizado~~ ✅ RESOLVIDO 2026-07-06
**Encontrado:** 2026-07-06, ao regenerar o client Prisma local (estava desactualizado desde a migration `20260626000001`, sem `clubId` nos tipos de `AthletePayment`/`Quota`/`DirectionSalaryPayment`/`AttendanceRecord` — por isso o TypeScript nunca acusou estes erros).
Rotas afectadas (todas seguiam o padrão de outras rotas como `athletes/route.ts` que já passam `clubId` explícito, mas estas quatro não): `athletes/[id]/payments/route.ts`, `attendance/[id]/records/route.ts`, `direction/[id]/salary/route.ts`, `members/[id]/quotas/route.ts` — mais 2 ocorrências em `scripts/seed-test-clubs.ts`. Sem `clubId` no bloco `create`, o Prisma rejeitaria em runtime assim que o client fosse regenerado (o que aconteceu nesta sessão) — ou seja, estas rotas estavam prestes a partir no primeiro `prisma generate` que alguém corresse.
**Fix:** `clubId` adicionado ao `create` de cada upsert, seguindo o padrão já usado nas restantes rotas.

### ~~[BUG-017] `BoardToolbar.tsx` — `z.record()` com 1 argumento (API Zod v3, quebra em v4)~~ ✅ RESOLVIDO 2026-07-06
**Encontrado:** 2026-07-06, no mesmo typecheck sem truncar.
`playbookSchema` (adicionado em UX-003, 2026-06-26) usava `z.record(z.object({...}))` — assinatura de 1 argumento do Zod v3. O projeto já está em Zod v4 (`^4.3.6`), que exige `z.record(keySchema, valueSchema)`. Erro de compilação, bloquearia o build. **Fix:** `z.record(z.string(), z.object({ x: z.number(), y: z.number() }))`.

### ~~[SEC-026] Prisma Extension `upsert` não protegia o `where` — IDOR potencial~~ ✅ RESOLVIDO 2026-07-06
**Encontrado:** 2026-07-06 (análise de código + TDD contra BD real).
Extensão em `prisma-tenant.ts` injectava `clubId` só no bloco `create` do `upsert`, nunca no `where`. Como o `where` de um upsert usa sempre uma unique constraint composta sem `clubId` (ex. `athleteId_month_year` em `AthletePayment`/`Quota`/`DirectionSalaryPayment`, `sessionId_athleteId` em `AttendanceRecord`), um upsert chamado com uma chave composta pertencente a outro clube (ex. `athleteId` de outro clube) sobreporia esse registo silenciosamente — protegido apenas pelo facto de todas as rotas actuais validarem o `athleteId`/`memberId` antes de chamar upsert, não pela framework.
**Fix:** extensão agora corre um `findFirst` (via helper `flattenUniqueWhere`, que achata a chave composta do `WhereUniqueInput` para um `WhereInput` plano) antes do upsert, e lança erro se o registo encontrado pertencer a outro clube. Tentativas de meter `clubId` directo no `where` do upsert falharam — o `WhereUniqueInput` gerado pelo Prisma para estes modelos não aceita `clubId` como filtro extra.
Teste de regressão adicionado a `src/tests/tenant-isolation.test.ts` (upsert cross-tenant). CI novo (`.github/workflows/ci.yml`) corre este teste contra Postgres efémero em cada push/PR — usa `prisma db push` em vez de `migrate deploy` por causa do INFRA-001 (ver abaixo).

### ~~[DEBT-017] Tenant isolation implícito em 4 modelos~~ ✅ RESOLVIDO 2026-06-26
`AttendanceRecord`, `AthletePayment`, `Quota`, `DirectionSalaryPayment` agora têm campo `clubId` explícito no schema e estão incluídos no `TENANTED` set de `prisma-tenant.ts`. Migration `20260626000001_add_clubid_to_payment_models` com backfill via UPDATE das tabelas pai. Extensão Prisma agora inclui também operação `upsert` (injecta `clubId` no `create` + valida ownership no `where`, ver [SEC-026](#) acima). Todas as 6 routes afetadas atualizadas para usar `db` em vez de `prisma` global.

---

### ~~[BUG-007] Build Vercel falhou — `'FREE'` inválido em `TextileState`~~ ✅ RESOLVIDO 2026-06-07
Regressão introduzida pelo fix de DEBT-009: `textiles/[id]/route.ts:49` usava `data.state = 'FREE'` mas `TextileState` enum só tem `STOCK | ASSIGNED | DAMAGED | LOST`. TypeScript error no build. Fix: `'FREE'` → `'STOCK'`. Também corrigidos todos os outros warnings TypeScript do deploy (unused vars, `as any` sem eslint-disable, deps em falta em hooks).

---

### ~~[BUG-005] Select de atletas vazio em Materiais e Têxteis~~ ✅ RESOLVIDO 2026-06-06
Ambas as páginas faziam `Array.isArray(data)` mas a API retorna `{ athletes, total, page, pages }` — nunca um array direto. O check falhava silenciosamente e `setAthletes` nunca era chamado. Fix: `fetch('/api/athletes?all=true')` + `Array.isArray(d.athletes)` + `setAthletes(d.athletes)` em `materials/page.tsx:162` e `textiles/page.tsx:140`.

---

### ~~[BUG-006] P2025 sem tratamento em 4 rotas de attendance/textiles~~ ✅ RESOLVIDO 2026-06-07
Catch blocks de DELETE/PUT/PATCH em `attendance/[id]`, `attendance/[id]/cancel`, `attendance/schedules/[id]` e `textiles/[id]` agora verificam P2025 e retornam 404 em vez de 500 para recursos inexistentes.

---

### ~~[DEBT-008] setup/route.ts + seed.ts — 4 flags de permissão em falta~~ ✅ RESOLVIDO 2026-06-07
`viewAttendance: true`, `editAttendance: true`, `viewTextiles: true`, `editTextiles: true` adicionados ao bloco `permissions.create` em `setup/route.ts` e `prisma/seed.ts`. Admin criado via setup ou seed agora tem todas as 20 flags explicitamente.

---

### ~~[DEBT-009] textiles/[id] PUT — edge case estado inválido~~ ✅ RESOLVIDO 2026-06-07
Lógica de `src/app/api/textiles/[id]/route.ts` reescrita para espelhar o padrão correto de `materials/[id]/route.ts`: `if (athleteId && state !== 'ASSIGNED') state = 'ASSIGNED'` + `if (!athleteId && state === 'ASSIGNED') { state = 'FREE'; athleteId = null }`. Elimina o estado inválido `ASSIGNED` sem atleta.

---

### ~~[DEBT-010] Playbook GET `/api/training/[id]/playbook` — dead code~~ ✅ RESOLVIDO 2026-06-07
Função GET removida de `src/app/api/training/[id]/playbook/route.ts`. Frontend lê sempre via `GET /api/training/${id}` com `include: { playbook: true }`.

---

### ~~[BUG-003] JWT não inclui `viewAttendance`/`editAttendance`/`viewTextiles`/`editTextiles`~~ ✅ RESOLVIDO 2026-06-05
4 campos adicionados ao `signToken()` em `src/app/api/auth/login/route.ts`. Utilizadores não-admin com estas permissões podem agora aceder a `/attendance` e `/textiles`.

### ~~[BUG-004] Audit trail incompleto — logout, delete de logs e playbook não auditados~~ ✅ RESOLVIDO 2026-06-05
- `logAudit(..., 'LOGOUT', ...)` adicionado em `logout/route.ts`
- `logAudit(..., 'DELETE', 'AuditLog', ..., { mode, count })` adicionado no DELETE de `admin/audit/route.ts`
- `logAudit(..., 'UPDATE', 'Playbook', ...)` adicionado no PUT de `training/[id]/playbook/route.ts`

---

### ~~[BUG-001] Migration 004 pendente em produção~~ ✅ RESOLVIDO 2026-06-05
Migration `20260511000004_fix_direction_member_columns` aplicada no deploy de Jun 2026. Colunas `roles TEXT[]` e `trainerAgeGroups TEXT[]` presentes em produção.

---

## 🔴 Bugs Activos

### ~~[SEC-024] Setup route sem CSRF, sem rate limit, sem audit log~~ ✅ RESOLVIDO 2026-06-26
Rate limit (`setup:${ip}`, 3 req/15min) + `logAudit` adicionados a `src/app/api/setup/route.ts`. CSRF não se aplica (route está fora do middleware CSRF por design — criação de conta pré-auth).

---

### ~~[SEC-025] Templates de email interpolam variáveis user-controlled sem HTML escaping~~ ✅ RESOLVIDO 2026-06-26
Função `escHtml()` adicionada a `src/lib/email.ts`. Todas as variáveis interpoladas nos templates (clubName, email, tempPassword, appUrl, name, resetUrl) agora escapadas.

---

## 🟡 Débito Técnico

### ~~[DEBT-018] Middleware não verifica `tokenVersion` — páginas carregam após logout~~ ✅ ACEITE POR DESIGN 2026-07-07
`middleware.ts` usa `jwtVerify(token, secret)` que verifica só assinatura e expiração. Não consulta DB para verificar `tokenVersion`. Após logout (ou reset de permissões), o token do utilizador fica com `tokenVersion` inválido — as API routes rejeitam (401) mas as páginas Next.js ainda carregam (esqueleto HTML sem dados).
**Impacto real:** baixo — o utilizador vê a página em branco durante <1s antes de ser forçado a re-login pela primeira chamada API. Dados nunca expostos.
**Decisão (2026-07-07):** não implementar. Fix exigiria chamar `/api/auth/me` a partir do middleware em cada navegação (edge runtime não liga directo a Postgres) — latência extra em todas as navegações do dashboard, por um risco sem exposição real de dados. Custo não compensa o benefício.

---

### ~~[DEBT-022] `getTokenFromCookies` — regex sem âncora de início~~ ✅ RESOLVIDO 2026-07-07
**Encontrado:** 2026-07-06/07 (análise de segurança)  
`src/lib/auth.ts` extraía o token com `cookieHeader.match(/hm_token=([^;]+)/)` — sem âncora `^`/`(?:^|;\s*)`, um cookie cujo nome terminasse em `hm_token` (ex. `evil_hm_token=xxx`) também fazia match e era lido como se fosse o token real.
**Impacto real:** baixo/teórico — exigia que outro cookie com esse nome existisse no mesmo browser jar, o que já implicaria outro vector de ataque (XSS ou subdomínio hostil) para o injectar.
**Fix:** `/(?:^|;\s*)hm_token=([^;]+)/`.

---

### ~~[UX-001] Formatação monetária hardcoded `'pt-PT'` no dashboard home~~ ✅ RESOLVIDO 2026-06-26
`getNumberLocale(lang)` adicionado a `src/lib/date-locale.ts`. Dashboard `page.tsx` usa `numLocale` em vez de `'pt-PT'` em todos os 13 lugares. Componentes `RevenueChart` e `ExpensesChart` recebem `numLocale` como prop.

---

### ~~[DEBT-019] `seed-test-clubs.ts` sem guard de ambiente~~ ✅ RESOLVIDO 2026-06-26
Guard `if (process.env.NODE_ENV === 'production') throw new Error(...)` adicionado no topo do script.

---

### ~~[DEBT-020] Teste de isolamento tenant não cobre vetores de ataque reais~~ ✅ RESOLVIDO 2026-06-26
4 testes adicionados a `src/tests/tenant-isolation.test.ts`: findUnique IDOR, updateMany cross-tenant (count=0), deleteMany cross-tenant (count=0), nested relation (include não vaza dados de outro clube).

---

### ~~[DEBT-021] `use-toast.ts` — useEffect com `[state]` como dependência~~ ✅ RESOLVIDO 2026-06-26
`}, [state])` → `}, [])` em `src/hooks/use-toast.ts:186`. Listener registado uma vez no mount.

---

### ~~[INFRA-002] Preços MRR no backoffice `/platform` hardcoded — desincroniza com Stripe~~ ✅ RESOLVIDO 2026-07-07
`src/app/platform/page.tsx` usava `PRICE_MONTHLY = 59` e `PRICE_YEARLY_MONTHLY_EQUIV = 590 / 12` hardcoded para calcular MRR/ARR.
**Fix:** `getPrices()` busca os preços reais via `stripe.prices.retrieve()` usando `STRIPE_PRICE_MONTHLY`/`STRIPE_PRICE_YEARLY`, com cache em memória (5min TTL, ao nível do módulo — evita bater na API Stripe em cada load). Se a chamada Stripe falhar (ex. chaves ainda não configuradas), usa os valores antigos como fallback e regista o erro via `logger.error`.

---

### ~~[UX-002] Validação client-side de email no registo aceita strings inválidas~~ ✅ RESOLVIDO 2026-06-26
Regex `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` substituiu `!form.email.includes('@')` em `register/page.tsx`.

---

### ~~[UX-003] Importação de playbook no quadro táctico sem validação de schema~~ ✅ RESOLVIDO 2026-06-26
Zod schema `playbookSchema` adicionado a `BoardToolbar.tsx`. `safeParse` valida estrutura antes de `loadPlaybook`. JSON inválido é silenciosamente ignorado.

---

### ~~[DEBT-011] Dashboard i18n — páginas restantes por atualizar~~ ✅ RESOLVIDO 2026-06-19
Sistema: `useDashT`, `useDashLabels`, `getDateLocale`, `messages/dashboard/*.json` (5 langs). Todas as páginas completas. `useDashLabels` extendido com `sponsorTypes`, `auditActions`, `auditEntities`.
Nota: `admin/permissions/page.tsx` tem algumas strings PT hardcoded (baixa prioridade — só admin vê).

---

### ~~[DEBT-012] Migration 20260511000001 quebrada em instalações novas~~ ✅ RESOLVIDO 2026-06-19
**Encontrado:** 2026-06-19 durante setup local  
Migration `20260511000001_direction_athlete_trainergroups` assumia coluna `trainerAgeGroup` existente mas em BD nova ela nunca foi criada. SQL corrigido com `IF EXISTS` guards e `DO $$ BEGIN ... END $$` condicional. Safe para fresh installs e migrações incrementais.

---

### ~~[DEBT-016] `db.attendanceRecord` usado onde devia ser `prisma` — inconsistência com convenção~~ ✅ RESOLVIDO 2026-06-23
`db.attendanceRecord` substituído por `prisma.attendanceRecord` em todos os routes afetados, com filtros explícitos via relação: `athlete: { clubId }` em `athletes/[id]/attendance/route.ts`, `session: { clubId }` em `attendance/[id]/records/route.ts` (GET e PUT final read).

---

### [INFRA-001] Club table ausente das migrations — `prisma db push` usado em produção
**Encontrado:** 2026-06-19. **Actualizado:** 2026-07-09.
A tabela `Club` e colunas `clubId` em modelos tenanted foram adicionadas ao schema mas não geradas como migration explícita. `prisma migrate deploy` falha numa BD Neon fresca (migration `20260619000001` tenta `ALTER TABLE "Club"` mas a tabela não existe no histórico de migrations).
**Fix aplicado 2026-07-09 (commit `ad3a9ad`):** build script (`package.json`) alterado de `prisma migrate deploy` para `prisma db push`. O `prisma db push` lê o `schema.prisma` actual e sincroniza a BD sem depender do histórico de migrations — funciona correctamente tanto em BD fresca (cria tudo) como em BD existente (additive only).
**Workaround CI:** `.github/workflows/ci.yml` já usava `prisma db push` por este motivo. CI fix adicional em `61ba4d0`: flag `--skip-generate` removida (não existe no Prisma 7 — `prisma generate` corre via `postinstall` em `npm ci`).
**Fix correcto de longo prazo:** criar migration `20260616000001_saas_multitenant` com o SQL completo de criação da tabela `Club`, enum `ClubStatus`, e todos os `ALTER TABLE ... ADD COLUMN clubId` — permite voltar a `prisma migrate deploy`.
**Consequência prática vista em 2026-07-06:** a BD dev local (sem tabela `_prisma_migrations`) mascarou os bugs BUG-016/BUG-017. **Se outro dev tiver o mesmo sintoma:** correr `npx prisma generate` e depois `npx prisma db push`.

---

### ~~[DEBT-001] Constantes duplicadas entre ficheiros~~ ✅ RESOLVIDO 2026-05-27
Criado `src/lib/constants.ts`. Todos os ficheiros migrados para importar daqui.

---

### ~~[SEC-001] Login não audita tentativas falhadas nem sucessos~~ ✅ RESOLVIDO 2026-06-02
`logAudit` com acção `LOGIN_FAIL` adicionado em falha (userId=null, email tentado, IP). `logAudit` com acção `LOGIN` adicionado em sucesso. Tipo `LOGIN_FAIL` adicionado a `AuditAction` em `src/lib/audit.ts`.

---

### ~~[SEC-002] Mudança de permissões não invalida JWT existente~~ ✅ RESOLVIDO 2026-06-02
`prisma.user.update({ tokenVersion: { increment: 1 } })` adicionado após upsert de permissões em `src/app/api/admin/permissions/[userId]/route.ts`. JWT do utilizador visado é invalidado imediatamente.

---

### ~~[SEC-003] Upload valida só `file.type`~~ ✅ RESOLVIDO 2026-06-02
Magic bytes verificados em `src/app/api/upload/route.ts`: `\x89PNG` para PNG, `\xFF\xD8\xFF` para JPEG. Rejeita ficheiros com conteúdo inconsistente com o tipo declarado.

---

### ~~[SEC-004] CSRF fallback `return true` sem Origin/Referer~~ ✅ RESOLVIDO 2026-06-02
`return true` substituído por `return false` em `src/middleware.ts` e `src/lib/csrf.ts`. Clientes sem `Origin`/`Referer` são rejeitados. Protecção real continua a ser `SameSite: strict` no cookie.

---

### ~~[SEC-005] CSP tem `unsafe-eval` em `script-src`~~ ✅ RESOLVIDO 2026-06-02
`'unsafe-eval'` removido de `script-src` em `next.config.mjs`. Next.js em produção não necessita de eval.

---

### ~~[SEC-006] `pavilionUrl` aceita qualquer string~~ ✅ RESOLVIDO 2026-06-02
`pavilionUrl` em `src/lib/validations.ts` tem agora `.refine()` que rejeita strings que não começam com `http://` ou `https://`. Strings vazias e `undefined` continuam a passar.

---

### ~~[SEC-007] Sem `Strict-Transport-Security` header~~ ✅ RESOLVIDO 2026-06-02
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` adicionado a `securityHeaders` em `next.config.mjs`.

---

### ~~[SEC-008] Export de audit log sem limite de registos~~ ✅ RESOLVIDO 2026-06-02
`take: 10000` adicionado ao `prisma.auditLog.findMany()` em `src/app/api/admin/audit/export/route.ts`.

---

### ~~[DEBT-002] Rate limiting ineficaz em Vercel serverless~~ ✅ RESOLVIDO 2026-06-02
`src/lib/rateLimit.ts` reescrito: substitui in-memory `Map` por PostgreSQL atómico (`INSERT ... ON CONFLICT DO UPDATE`). Funciona correctamente em multi-instância serverless. Novo modelo `RateLimit` no schema + migration `20260602000005_rate_limit`. Callers actualizados para `await checkRateLimit(...)`. Testes actualizados com mock de prisma.

---

### ~~[DEBT-003] `src/lib/csrf.ts` — código possivelmente desnecessário~~ ✅ RESOLVIDO 2026-05-27
Adicionado comentário no topo do ficheiro explicando que é apenas para testes unitários, não para routes.

---

### ~~[DEBT-004] `src/types/index.ts` — ficheiro minimal~~ ✅ RESOLVIDO 2026-05-27
Ficheiro eliminado. Nenhum ficheiro importava dele.

---

### ~~[DEBT-005] Mensagem de erro de upload incorreta~~ ✅ RESOLVIDO 2026-05-27
Mensagem corrigida para "Apenas ficheiros PNG e JPG são permitidos".

---

### ~~[DEBT-006] Revenue de quotas de sócios não armazena amount~~ ✅ RESOLVIDO 2026-05-27
Campo `amount Float?` adicionado ao modelo `Quota`. Guardado no momento do pagamento em `POST /api/members/[id]/quotas`. Dashboard usa `amount` com fallback para `monthlyQuota` em registos antigos.

---

### ~~[DEBT-007] Sem ficheiro de constantes partilhadas~~ ✅ RESOLVIDO 2026-05-27
Ver DEBT-001.

---

## 🟢 Melhorias Planeadas (Roadmap)

### ~~[FEAT-008] GDPR — Política de Privacidade e Termos de Serviço~~ ✅ RESOLVIDO 2026-06-19
`/[locale]/privacy`, `/[locale]/terms` criadas. Cookie consent banner (`CookieBanner.tsx`) com `localStorage` persistência. Links no footer.

### ~~[FEAT-009] Forgot password / reset de senha~~ ✅ RESOLVIDO 2026-06-19
`/forgot-password` + `/reset-password` implementados. Modelo `PasswordResetToken` no schema. Email via Resend (`src/lib/email.ts`). Token expira em 1h.

### ~~[FEAT-010] Logo do clube configurável~~ ✅ RESOLVIDO 2026-06-19
`logoUrl String?` adicionado ao modelo `Club`. API `POST /api/club/logo` (upload para R2/local). Sidebar usa `clubLogoUrl` do auth store com monograma fallback. Settings page tem secção de upload de logo.

### ~~[FEAT-011] Screenshots / demo do produto na landing page~~ ✅ RESOLVIDO 2026-06-20
Secção "O produto real" adicionada à landing page: fundo escuro, tab switcher (Mensalidades/Atletas), screenshots reais em frame de browser. Componente `ProductScreenshots.tsx`. Imagens em `public/screenshots/`.

### ~~[FEAT-012] Platform admin — MRR real~~ ✅ RESOLVIDO 2026-06-19
`/platform` agora mostra MRR e ARR reais (distingue planos mensais €59 vs anuais €49/mês via `stripePriceId`). Breakdown por estado (ACTIVE/PAST_DUE/CANCELLED) e por país. Count de utilizadores e atletas por clube.

---

### ~~[SEO-001] Landing page sem `hreflang`~~ ✅ RESOLVIDO 2026-06-26
`generateMetadata` com `alternates.languages` adicionado a `src/app/[locale]/layout.tsx`. Cobre pt/es/en/fr/it + x-default=pt.

---

### [FEAT-001] Perfil de Atleta — melhorias UX
- [ ] Histórico de materiais (não só ativos)
- [x] ~~Dropdown de navegação entre atletas~~ (implementado 2026-05-27)

### [FEAT-002] Mensalidades — funcionalidades extra
- [ ] Filtro por estado de pagamento (todos em atraso, etc.)
- [ ] Importar pagamentos via CSV

### [FEAT-003] Dashboard — mais métricas
- [ ] Gráfico de evolução de atletas ao longo dos anos
- [ ] Taxa de pagamento por escalão
- [ ] Comparativo de receitas entre épocas
- [x] ~~Custos de material: total, poupança por atletas, custo real do clube~~ (implementado 2026-05-27)

### [FEAT-004] Segurança — Rate limiting robusto
Ver [DEBT-002] — Upstash Redis.

### [FEAT-005] Melhorar relatórios
- [x] ~~CSV → XLSX com encoding correto~~ (implementado 2026-06-05)
- [x] ~~Relatório de sócios com histórico de quotas~~ (implementado 2026-05-27)
- [x] ~~Relatório de assiduidade~~ (implementado 2026-06-05)
- [x] ~~Relatório de têxteis~~ (implementado 2026-06-05)
- [ ] Relatório de viagens

### [FEAT-006] Treinos — melhorias
- [ ] Associar atletas a um treino (presença)
- [ ] Templates de táticas reutilizáveis

### [FEAT-007] Gestão de utilizadores
- [x] ~~Admin criar novos utilizadores na UI~~ (implementado — botão "Novo Utilizador" em `/admin/permissions`)
- [x] ~~Admin redefinir password de utilizadores~~ (implementado 2026-06-05)

---

## ✅ Resolvido Recentemente

| Data | Issue | Resolução |
|------|-------|-----------|
| 2026-05-27 | CSP bloqueava fonts base64 (data:font/ttf) | Adicionado `data:` a `font-src` em `next.config.mjs` |
| 2026-05-27 | CSP bloqueava logos R2 | Adicionado `https://*.r2.dev` a `img-src` |
| 2026-05-27 | ChunkLoadError sem recovery | ErrorBoundary deteta e faz `window.location.reload()` |
| 2026-05-27 | Perfil atleta mostrava "Atleta não encontrado" para 401/403 | Error handling distingue 401/403/404/500 |
| 2026-05-27 | Navegação entre perfis de atletas inexistente | Adicionado dropdown com filtro por escalão |
| 2026-05-27 | JWT_SECRET placeholder crashava em prod | `getSecret()` rejeita placeholder e secrets curtos |
| 2026-05-27 | SVG permitido em uploads (risco XSS) | Removido da allowlist |
| 2026-05-27 | Favicon default Next.js | Substituído por `src/app/icon.png` (logo HCPDL) |
| 2026-05-27 | Migration 001 falhou em prod → colunas em falta | Migration 004 corretiva criada |
| 2026-05-27 | Next.js 14 → 15 async params em 11 routes | Todos migrados para `await params` |
| 2026-05-27 | DEBT-001..007 todos resolvidos | Ver secção Débito Técnico acima |
| 2026-05-27 | BUG-002 lateMonths subestimava meses em atraso | Iteração por range de meses passados em vez de filtrar registos existentes |
| 2026-06-02 | Têxteis — "dados inválidos" ao criar item | `notes`/`personalizationDetails`/`kitRef` enviados como `null` pelo frontend mas schema Zod só aceitava `string \| undefined`; corrigido para `.nullable().optional()` |
| 2026-06-02 | Têxteis — lógica pagamento inconsistente | `paidByAthlete=true` não auto-preenchia `paidAmount` com `totalCost`; input não desativava; sem indicador do custo do clube. Corrigido no form. |
| 2026-06-02 | Assiduidade — hora treino específico mostrava AM/PM | `input type="time"` segue locale do SO (Windows 12h). Mudado para `type="text"` placeholder `HH:MM`. |
| 2026-06-02 | Assiduidade — SPECIFIC aparecia no form de horários | Tipo SPECIFIC estava disponível no select do form de criação de horários recorrentes; removido (SPECIFIC só via botão "+" no calendário). |
| 2026-06-02 | Navegação sem feedback visual ao clicar links | Sem `loading.tsx` nem estado pending na Sidebar; utilizador clicava e nada mudava até o chunk JS carregar. Adicionado `(dashboard)/loading.tsx` (Suspense boundary) + `pendingHref` com `Loader2` na Sidebar. |
| 2026-06-02 | Audit log mostrava acções de admin e não mostrava entidades novas | Filtro aplicado na API: LOGIN/LOGIN_FAIL sempre visíveis, restantes acções de admin excluídas. Adicionadas 4 entidades (TextileItem, TrainingSession, TrainingSchedule, AttendanceRecord), acção LOGIN_FAIL e labels de permissões em falta. |
| 2026-06-05 | Fees sem paginação, sem coluna total, sem confirmação single-click | Paginação 25/pág; coluna "Total" por atleta (pago/pendente); dialog confirmação ao registar célula; nota indicator (ponto azul). Limite de navegação de época a junho removido. |
| 2026-06-05 | Members sem paginação, QuotaCalendar sem confirmação nem notas | Paginação 50/pág; dialog de confirmação com campo de notas; botão "Pagar todas em atraso"; email e telefone clicáveis. |
| 2026-06-05 | Viagens sem persistência, sem convocados, sem budget, sem checklist | localStorage para "Ver todas passadas"; condutores da direção (chips); orçamento 3 campos; convocados multi-select; checklist editável. Migration `20260605000001_improvements`. |
| 2026-06-05 | Direção sem histórico de pagamento de salário | `DirectionSalaryPayment` model + API `GET/POST /api/direction/[id]/salary` + `SalaryCalendar` UI. |
| 2026-06-05 | Relatórios em CSV com encoding frágil | Todos os 6 relatórios migrados para XLSX via `exceljs` (`src/lib/xlsx.ts`). Adicionados relatórios de assiduidade e têxteis. |
| 2026-06-05 | Admin sem reset de password, sem último login, view/edit não enforced | `PUT /api/admin/users/[id]` (reset + tokenVersion++); coluna "Último Login" relativa; enforced view=true ao ativar edit. |
| 2026-06-05 | Login não atualizava lastLoginAt | `prisma.user.update({ lastLoginAt: new Date() })` em paralelo com `logAudit` no login. |
| 2026-06-05 | Textiles aceita qualquer string no campo época | Validação regex `^\d{4}\/\d{2}$` em `lib/validations.ts`. |
| 2026-06-05 | `marketing/brochure/node_modules` commitado acidentalmente | `.gitignore` atualizado com `**/node_modules`; ficheiros removidos com `git rm --cached`. |
| 2026-06-05 | Assiduidade — "Adicionar atleta" não mostrava atletas | `fetch('/api/athletes')` esperava array direto mas API devolve `{ athletes, total, page, pages }`; corrigido para `?all=true` + `d.athletes`. |
| 2026-06-05 | Manifest PWA dava "Syntax error" na consola | Middleware intercetava `/manifest.json` sem cookie → redirecionava para login (HTML); adicionado ao matcher de exclusões. |
| 2026-06-05 | Patrocinadores — logos removidos | `logoUrl` removido do schema, validações e UI; migration `20260605000002_remove_sponsor_logo`. |
| 2026-06-05 | BUG-003: JWT omitia 4 permissões novas | `viewAttendance/editAttendance/viewTextiles/editTextiles` adicionados ao `signToken()` em `login/route.ts`. |
| 2026-06-05 | BUG-004: logout/audit-delete/playbook sem logAudit | `logAudit` adicionado nos 3 handlers em falta. |
| 2026-06-05 | Mobile responsiveness em grids e toolbars | `grid-cols-3 sm:grid-cols-4` em QuotaCalendar/SalaryCalendar; `grid-cols-2 sm:grid-cols-3` em AgeGroupSelector; `grid-cols-1 sm:grid-cols-3` em budget (travel); calendário semanal com `overflow-x-auto min-w-[480px]`; `min-w-0` em search inputs (athletes, materials, textiles, members). |
| 2026-06-07 | Patrocinadores — checkboxes não ficavam selecionados (React #185) | Double trigger: Radix `onCheckedChange` + `div onClick` disparavam `toggleType` 2x, cancelando-se. `htmlFor` em sticks/shinguards criava 3º trigger via label. Fix: removido `onCheckedChange` de todos os Checkboxes dentro de divs com `onClick`; removidos `id`/`htmlFor`. Também: `[...s.equipmentZones].sort()` para não mutar estado; `fetchSponsors` com `try/finally`. |
| 2026-06-19 | BUG-008/009: Sidebar e TopNav hardcoded HC PDL / HCPDL | Sidebar lê `clubName`/`clubLogoUrl` do auth store Zustand; monograma fallback; TopNav usa `clubName` como fallback de título. |
| 2026-06-19 | BUG-010: `<html lang="pt">` estático | `HtmlLang.tsx` client component atualiza `document.documentElement.lang` via `clubLanguage` do auth store. |
| 2026-06-19 | BUG-011: Email transacional ausente | `src/lib/email.ts` via Resend REST API. Webhook Stripe envia boas-vindas com credenciais. `/forgot-password` envia email de reset. |
| 2026-06-19 | FEAT-008: GDPR em falta | `/[locale]/privacy`, `/[locale]/terms`, `CookieBanner.tsx` com consentimento via `localStorage`. |
| 2026-06-19 | FEAT-009: Forgot password inexistente | `/forgot-password` + `/reset-password` + `PasswordResetToken` model + email via Resend. |
| 2026-06-19 | FEAT-010: Logo do clube hardcoded | `Club.logoUrl` no schema + `POST /api/club/logo` + sidebar dinâmica. |
| 2026-06-19 | FEAT-012: Platform admin sem MRR real | MRR/ARR com distinção mensal/anual; breakdown por país e estado; count utilizadores/atletas. |
| 2026-06-20 | FEAT-011: Landing sem screenshots | Secção "O produto real": tab switcher Mensalidades/Atletas, screenshots reais, frame browser. Trial messaging removido — "cancela quando quiseres". |
| 2026-06-20 | FEAT-013: Paleta de cores por clube | `Club.primaryColor` HSL no schema; 8 presets no Settings; `--club-primary` injetado via CSS var no layout; aplica sem re-login. |
| 2026-06-22 | SEC-009: Cross-tenant data leak em dashboard stats | `prisma.quota/athletePayment/directionSalaryPayment` sem filtro de clube → somavam dados de todos os clubes. Fix: filtro `member.clubId` / `athlete.clubId` adicionado nas 4 queries. |
| 2026-06-22 | SEC-010: `/pt/privacy` e `/pt/terms` atrás de auth | `isLocalePublicPath` só permitia `/{locale}` e `/{locale}/register`. Privacy e Terms exigiam JWT — GDPR fail. Fix: adicionados `privacy` e `terms` à whitelist. |
| 2026-06-22 | BUG-012: `/forgot-password` inacessível sem login | Middleware matcher não excluía `forgot-password` nem `reset-password` — redirecionava para `/login`. Fix: adicionados ao matcher de exclusão. |
| 2026-06-22 | UX: KPI cards do dashboard não eram clicáveis | Cards de Atletas/Sócios/Patrocinadores/Materiais/Treinos/Têxteis agora são `<Link>` com hover shadow. |
| 2026-06-22 | UX: Training empty state sem CTA | Página de treinos vazia só mostrava texto. Adicionado ícone `Dumbbell` + botão "Adicionar treino" (permissão `editTraining`). |
| 2026-06-22 | UX: Sidebar — Permissões com ícone duplicado | Settings e Permissões usavam ambos o ícone `Settings`. Permissões migrado para `ShieldCheck`. |
| 2026-06-19 | DEBT-011 (parcial): Dashboard i18n | `useDashT` + `useDashLabels` + `messages/dashboard/*.json` (5 langs). 9/13 páginas atualizadas. |
| 2026-06-19 | DEBT-012: Register validação em PT fixo | Mensagens de validação usam `t('validation.*')` via next-intl em todos os 5 idiomas. |
| 2026-06-19 | DEBT-013/014/015: Landing page — CTA, links, ícones | CTA com chave própria; links `/${locale}/register` explícitos; ícone `UserCheck` para sócios. |
| 2026-06-23 | TS-BUILD: `AuditAction` type incompleto — 3 ações em falta | `PASSWORD_RESET`, `UPDATE_CLUB_LOGO`, `REMOVE_CLUB_LOGO` usados em `reset-password/route.ts` e `club/logo/route.ts` mas não declarados no union type em `src/lib/audit.ts`. Build TS falharia em produção. |
| 2026-06-23 | TS-BUILD: Stripe `apiVersion` errada em 2 routes | `'2025-05-28.basil'` não existe no SDK 17.7.0 — versão correta é `'2025-02-24.acacia'`. Afetava `register/route.ts` e `stripe/webhook/route.ts`. |
| 2026-07-09 | BUILD: `new Stripe()` a nível do módulo falha em Vercel | Next.js executa o corpo do módulo durante `Collecting page data` no build. `register/route.ts` e `stripe/webhook/route.ts` instanciavam `new Stripe(process.env.STRIPE_SECRET_KEY!)` no topo — lança `Neither apiKey nor config.authenticator provided` se a env var não estiver definida. Fix (commit `796643a`): instanciação movida para dentro do handler. Padrão documentado em `docs/CONVENTIONS.md`. |
| 2026-06-23 | TS-BUILD: `MONTHS` fora de scope em `QuotaCalendar` | Variável `MONTHS` (derivada de `useDashLabels`) definida no componente pai `MembersPage` mas usada em `QuotaCalendar` (componente filho separado). React não partilha variáveis entre componentes. Fix: `useDashLabels()` movido para dentro de `QuotaCalendar`. |
| 2026-06-23 | TS-BUILD: `Property 'club' missing` em 9 routes POST | Prisma 7 usa `Exact<>` strict typing — num `create()`, Prisma exige `clubId` explícito OU `club: { connect }`, nunca nenhum dos dois. A Prisma Extension injetava `clubId` em runtime mas TS não vê isso. Fix: `const { user, db, clubId } = ctx` + `clubId` adicionado ao objeto `data` nos 9 routes (`athletes`, `attendance`, `attendance/schedules`, `direction`, `materials`, `members`, `sponsors`, `training`, `travel`). |
| 2026-06-23 | TS-BUILD: `AgeGroup` string não castado em seed-test-clubs.ts | `ageGroup: a.ageGroup` inferred como `string` mas Prisma exige `AgeGroup` enum. Fix: `as AgeGroup` cast + import do tipo. |
| 2026-06-23 | SEC-011: Attendance aggregate cross-tenant no dashboard stats | `db.attendanceRecord.aggregate` → `prisma.attendanceRecord.aggregate` + `session: { clubId: ctx.clubId, date: ... }`. KPI "Presenças últimos 30 dias" agora isolado por clube. |
| 2026-06-23 | BUG-013: `stripePriceId` sempre null no webhook Stripe | `stripe.checkout.sessions.retrieve(session.id, { expand: ['line_items'] })` adicionado antes do `club.update`. `expanded.line_items?.data?.[0]?.price?.id` agora corretamente guardado. MRR/ARR em `/platform` funcional. |
| 2026-06-23 | SEC-012: `Math.random()` para password temporária + plaintext em metadata | `randomBytes(16).toString('base64url')` (Node.js `crypto`). Password continua em metadata Stripe (aceite — acesso ao Stripe implica trust). |
| 2026-06-23 | DEBT-015: Register sem transação DB — registos órfãos em falha | `prisma.$transaction(async tx => ...)` envolve `club.create` + `user.create`. Em caso de falha, `.catch` faz `stripe.customers.del(customer.id)` antes de re-throw. |
| 2026-06-23 | DEBT-016: `db.attendanceRecord` em routes não-tenanted | `prisma.attendanceRecord` com filtros explícitos: `athlete: { clubId }` em `athletes/[id]/attendance`, `session: { clubId }` em `attendance/[id]/records` (GET + PUT final read). |
| 2026-06-25 | BUG-001 (build blocker): `<a href="/fees">` no perfil de atleta | Substituído por `<Link href="/fees">` + import `next/link` em `athletes/[id]/page.tsx:742`. |
| 2026-06-25 | SEC-012 FULL FIX: Completamente removido `tempPassword` do fluxo de registo | Webhook `checkout.session.completed` cria `PasswordResetToken` (24h); email "Definir Palavra-passe" via Resend. `welcomeEmailHtml(clubName, email, setPasswordUrl)`. |
| 2026-06-25 | Rate limit em `/api/register` e `/api/auth/reset-password` | 5/hora por IP no register; 5/15min no reset-password. `logAudit` com ação `REGISTER` adicionado. |
| 2026-06-25 | CSRF inline + `isSuperAdmin` em `/api/setup` | `validateCsrf(req)` no início do POST. `isSuperAdmin: true` no user criado. |
| 2026-06-25 | `logAudit` no webhook Stripe e `/api/auth/forgot-password` | 4 handlers do webhook + forgot-password auditados. `AuditAction` alargado com 6 novos tipos. |
| 2026-06-25 | CSP `img-src` dinâmico para R2 custom domain | `next.config.mjs` lê `R2_PUBLIC_URL` em build time. Fallback: `https://*.r2.dev`. |
| 2026-06-25 | `<img>` → `<Image>` em `sponsors/page.tsx` | Logos e icons de zona usam `next/image`. |
| 2026-06-26 | SEC-013: Admin permissions GET expunha users de todos os clubes | `where: { clubId }` adicionado a `prisma.user.findMany` em `admin/permissions/route.ts`. |
| 2026-06-26 | SEC-014/015/016: GET de payments/quotas/salary sem filtro de clube | Modelos movidos para TENANTED; routes usam `db` em vez de `prisma` global. |
| 2026-06-26 | SEC-017: Prisma Extension não interceptava `findUnique`, `update`, `delete` — IDOR sistémico | `findUnique`, `update`, `delete` adicionados à extensão em `src/lib/prisma-tenant.ts`. |
| 2026-06-26 | SEC-018: Admin reset-password sem verificação de clube | `where: { id, clubId }` em `admin/users/[id]/route.ts`. |
| 2026-06-26 | SEC-019: Playbook upsert sem verificar ownership do treino | `db.training.findUnique({ where: { id } })` antes do upsert. |
| 2026-06-26 | SEC-020: Admin criar utilizador sem clubId | `clubId` adicionado ao `prisma.user.create` em `admin/users/route.ts`. |
| 2026-06-26 | SEC-021: Admin alterar permissões de user de outro clube — IDOR | `prisma.user.findUnique({ where: { id: userId, clubId } })` antes do upsert. |
| 2026-06-26 | SEC-022: Club CANCELLED/SUSPENDED não bloqueava chamadas API | `getDbForRequest()` verifica `club.status`; retorna `null` se CANCELLED ou SUSPENDED. |
| 2026-06-26 | SEC-023: Upload de logo sem registo no audit log | `logAudit` adicionado em `api/upload/route.ts`. |
| 2026-06-26 | SEC-024: Setup sem rate limit nem audit log | Rate limit 3/15min + `logAudit` adicionados em `api/setup/route.ts`. |
| 2026-06-26 | SEC-025: HTML injection em templates de email | `escHtml()` aplicada a todos os valores user-controlled em `src/lib/email.ts`. |
| 2026-06-26 | BUG-014: loginSchema aceitava passwords de 6 caracteres | `min(6)` → `min(8)` em `loginSchema` em `src/lib/validations.ts`. |
| 2026-06-26 | DEBT-017: Tenant isolation implícito em 4 modelos + upsert não coberto | Schema + migration `20260626000001` + TENANTED set alargado + upsert interceptor. |
| 2026-06-29 | CRITICAL: `prisma` não importado em `src/lib/db.ts` — crash em todas as API routes | `import { prisma } from './prisma'` adicionado. Todas as 42 routes do dashboard chamavam `getDbForRequest()` que fazia `prisma.club.findUnique` sem o import. ReferenceError em runtime. |
| 2026-06-29 | CRITICAL: `logAudit()` não incluía `clubId` — audit log vazio em todos os clubes | `getUserFromRequest(req)` adicionado dentro de `logAudit()` em `src/lib/audit.ts` para extrair `clubId` do JWT automaticamente. Antes: todas as entradas tinham `clubId=null` → extensão Prisma filtrava tudo → página de auditoria mostrava zero entradas. |
| 2026-06-29 | HIGH: Stripe `cancel_url` apontava para dashboard em vez da landing | `NEXT_PUBLIC_APP_URL` → `NEXT_PUBLIC_LANDING_URL` (fallback `hoqueimanager.com`) em `src/app/api/register/route.ts`. Utilizadores que cancelavam o checkout recebiam 404. |
| 2026-06-29 | TS-ERROR: `z.record()` em Zod v4 requer 2 argumentos | `z.record(z.object({...}))` → `z.record(z.string(), z.object({...}))` em `BoardToolbar.tsx`. Zod v4 exige key schema explícito. Causava erros TS2554 + tipo errado em `loadPlaybook()`. |
| 2026-06-29 | MEDIUM: loginSchema cliente usava `min(6)` vs `min(8)` no servidor | `min(6)` → `min(8)` em `loginSchema` de `src/app/login/page.tsx`. Inconsistência causava erro 400 opaco para passwords de 6-7 chars. Mensagem `?registered=1` corrigida (dizia "senha temporária", fluxo real é set-password link). |
| 2026-07-15 | BUG-020: Loop infinito em Patrocinadores — Radix `react-presence` crash | `<Checkbox>` Radix substituído por `<CheckMark>` custom em `sponsors/page.tsx`. Página estava completamente inutilizável. |
| 2026-07-15 | BUG-021: i18n keys `colorTheme`/`colorThemeNote` em falta em Definições | Chaves adicionadas aos 5 ficheiros `messages/dashboard/*.json`. `t('key') \|\| fallback` não funciona com next-intl (devolve key string truthy quando key não existe). |
| 2026-07-15 | BUG-022: Contador de têxteis "itemns" (typo) | `item{items.length !== 1 ? 'ns' : ''}` → `{items.length !== 1 ? 'itens' : 'item'}` em `textiles/page.tsx:331`. |
| 2026-07-15 | FEAT: Importação CSV FPP para Atletas | `parseCsv` agora strip quotes dos headers; `parseAgeGroup` mapeia "Sénior Masculino - 3ª Divisão" → SENIORS, "Sub-19 Masculino" → SUB19, etc.; `rowToAthlete` usa `num_fpp` como número e `escal_o` como escalão (normalização da coluna "Num FPP" e "Escalão" da FPP). |
| 2026-07-15 | FEAT: Importação CSV FPP para Direção | `parseDirectionCsv()` agrupa pessoas por Num FPP e mescla cargos; `POST /api/direction` aceita array; UI com botão "Importar CSV FPP" + dialog com pré-visualização em `direction/page.tsx`. |
| 2026-07-15 | FEAT: Secção "Primeiros Passos" no dashboard | Card com 4 ações guiadas (Atletas, Mensalidades, Sócios, Definições) mostrado quando clube tem 0 atletas. i18n em 5 línguas (`messages/dashboard/*.json` chave `onboarding`). |
