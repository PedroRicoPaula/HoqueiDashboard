# Issues & Backlog — HoqueiManager
> Registo vivo. Atualizar sempre que se resolve um problema ou se identifica um novo.

---

## 🔴 Bugs Activos

_(sem bugs activos conhecidos — 2026-06-22)_

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

## 🟡 Débito Técnico

### ~~[DEBT-011] Dashboard i18n — páginas restantes por atualizar~~ ✅ RESOLVIDO 2026-06-19
Sistema: `useDashT`, `useDashLabels`, `getDateLocale`, `messages/dashboard/*.json` (5 langs). Todas as páginas completas. `useDashLabels` extendido com `sponsorTypes`, `auditActions`, `auditEntities`.
Nota: `admin/permissions/page.tsx` tem algumas strings PT hardcoded (baixa prioridade — só admin vê).

---

### ~~[DEBT-012] Migration 20260511000001 quebrada em instalações novas~~ ✅ RESOLVIDO 2026-06-19
**Encontrado:** 2026-06-19 durante setup local  
Migration `20260511000001_direction_athlete_trainergroups` assumia coluna `trainerAgeGroup` existente mas em BD nova ela nunca foi criada. SQL corrigido com `IF EXISTS` guards e `DO $$ BEGIN ... END $$` condicional. Safe para fresh installs e migrações incrementais.

---

### [INFRA-001] Club table ausente das migrations — `prisma db push` obrigatório em dev fresh
**Encontrado:** 2026-06-19  
A tabela `Club` e colunas `clubId` em modelos tenanted foram adicionadas ao schema mas não geradas como migration explícita. `prisma migrate dev` falha em BD nova. **Workaround dev:** usar `prisma db push` em vez de `migrate dev` para sincronizar schema em fresh install. Produção usa `migrate deploy` que aplica migrations históricas — esta issue não afeta produção (Club existia antes do deploy das migrations). Fix correto: squash das migrations ou nova migration base.

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
