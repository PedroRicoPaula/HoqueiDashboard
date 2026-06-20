# Database — HoqueiManager

## Config Prisma 7
- Schema em `prisma/schema.prisma`
- **Sem `url` no datasource** (removido na v7) — URL configurada em runtime via `prisma.ts`
- `PrismaClient` usa `@prisma/adapter-pg` + `pg` pool
- Singleton em `globalThis` para HMR-safe em dev

```typescript
// src/lib/prisma.ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })
```

---

## Schema — Modelos

### Club (multi-tenant root)
```prisma
Club {
  id                     String     @id @default(uuid())
  name                   String
  slug                   String     @unique   ← URL-friendly, gerado no registo
  email                  String               ← email do admin
  country                String     @default("pt")
  language               String     @default("pt")   ← idioma do dashboard
  logoUrl                String?              ← URL do logo do clube (R2 ou /uploads/)
  primaryColor           String     @default("142 71% 45%")  ← cor HSL do dashboard (paleta de 8 presets)
  status                 ClubStatus @default(PENDING_PAYMENT)
  stripeCustomerId       String?    @unique
  stripeSubscriptionId   String?    @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?
  // relações inversas para todos os modelos tenanted
  indexes: slug, status
}
enum ClubStatus { PENDING_PAYMENT ACTIVE PAST_DUE CANCELLED SUSPENDED }
```
**Ciclo de vida:** `PENDING_PAYMENT` → `ACTIVE` (webhook checkout.session.completed) → `PAST_DUE` (invoice.payment_failed) → `CANCELLED` (subscription.deleted).

Bloco de login se `club.status !== 'ACTIVE'` (exceto super admin).

### User
```prisma
User {
  id           String      @id @default(uuid())
  clubId       String?     FK → Club (onDelete: Cascade) — null para super admin
  name, email (unique), password (PBKDF2)
  isSuperAdmin Boolean     @default(false)  ← acesso a /platform, sem clubId
  tokenVersion Int @default(0)  ← incrementa em logout e quando admin redefine password
  lastLoginAt  DateTime?
  permissions  Permission? (1-to-1)
  auditLogs    AuditLog[]
  index: clubId
}
```

### Permission
```prisma
Permission {
  userId (unique, FK → User)
  viewAthletes, editAthletes         default: true/false
  viewMembers, editMembers           default: true/false
  viewMaterials, editMaterials       default: false/false
  viewSponsors, manageSponsors       default: false/false
  viewTraining, editTraining         default: true/false
  viewTravel, editTravel             default: true/false
  viewDirection, editDirection       default: false/false
  viewFees, editFees                 default: false/false
  viewAttendance, editAttendance     default: true/false
  viewTextiles, editTextiles         default: false/false
  isAdmin                            default: false
}
```
> `isAdmin` bypassa todas as outras permissões em `hasPermission()`.

### AuditLog
```prisma
AuditLog {
  clubId? FK → Club (onDelete: Cascade)  ← scoped por tenant
  userId?, userEmail?, action, entity, entityId?, details (Json?), ip?
  indexes: clubId, entity, userId, createdAt
}
```

### Athlete
```prisma
Athlete {
  clubId FK → Club (onDelete: Cascade)  ← TENANTED
  number, name, ageGroup (AgeGroup enum)
  birthDate (DateTime), phone?, email?, nif?, address?
  school?, idCard?, parentName?, parentPhone?
  monthlyFee Float @default(0), feeExempt Boolean @default(false)
  materials Material[], payments AthletePayment[]
  directionRole DirectionMember? (1-to-1 opcional)
  indexes: name, ageGroup
}
enum AgeGroup { SUB11 SUB13 SUB15 SUB17 SUB19 SENIORS }
```

### AthletePayment
```prisma
AthletePayment {
  athleteId (FK Athlete, onDelete: Cascade)
  month (1-12), year, paid Boolean, amount Float?, paidAt?, notes?
  unique: (athleteId, month, year)
  indexes: (athleteId, year), (year, month)
}
```

### Member + Quota
```prisma
Member {
  number (unique, autoincrement), name, phone?, email?, address?
  monthlyQuota Float @default(0)
  quotas Quota[]
  index: name
}
Quota {
  memberId (FK Member, Cascade), month, year, paid, amount Float?, paidAt?, notes String?
  unique: (memberId, month, year)
  index: (memberId, year)
  // amount: guardado no momento do pagamento (evita imprecisão se monthlyQuota mudar)
  // notes: texto livre opcional (ex: "pago por transferência")
}
```

### Material
```prisma
Material {
  name, category (MaterialCategory), type (String), state (MaterialState) @default(FREE)
  athleteId? (FK Athlete, onDelete: SetNull)
  notes?
  paidByAthlete Boolean @default(false)  ← atleta pagou? (clube poupou esse valor)
  paidAmount    Float?                   ← custo do equipamento (independente de quem pagou)
  indexes: state, category, athleteId
}
enum MaterialCategory { ATHLETE GOALKEEPER SMALL }
enum MaterialState { FREE ASSIGNED DAMAGED }
```
> **Semântica de `paidAmount`:** representa o **custo do material**, não o valor pago por alguém em particular.
> Combinado com `paidByAthlete`: se `true` → clube poupou `paidAmount`; se `false` → clube gastou `paidAmount`.
> Limpos para `false`/`null` quando o material é desatribuído (`PUT /api/materials/[id]`).

### Sponsor
```prisma
Sponsor {
  name, website?, phone?, email?, annualContribution Float @default(0)
  contractStart (DateTime), contractEnd (DateTime)
  notes?
  logoUrl?                                    ← URL do logo (R2 ou /uploads/sponsors/)
  sponsorTypes    String[] @default([])       ← ex: ['EQUIPMENT_SENIOR', 'NAMING_RIGHTS']
  equipmentZones  Int[]    @default([])       ← zonas 1-6 no equipamento
  bannerCount     Int?                        ← nº de lonas publicitárias no pavilhão
  includesSticks  Boolean  @default(false)    ← autocolante nos sticks
  includesShinguards Boolean @default(false)  ← logo nas caneleiras do GR
  indexes: name, contractEnd
}
```
**sponsorTypes válidos:** `EQUIPMENT_SENIOR`, `EQUIPMENT_FORMATION`, `NAMING_RIGHTS`, `BANNER`, `STICKS`, `SHINGUARDS`, `OTHER`  
**equipmentZones:** 1=Ombro Esq, 2=Ombro Dir, 3=Peito, 4=Calções, 5=Costas Inf, 6=Trás Calções

### Travel
```prisma
Travel {
  opponent, pavilionUrl?, departureDate (DateTime), returnDate?
  departureTime?, transport?, drivers String[], meal?, notes?
  convocados          String[]  @default([])    ← atletas convocados
  budgetTransport     Float?                    ← orçamento transporte
  budgetMeal          Float?                    ← orçamento refeições
  budgetAccommodation Float?                    ← orçamento alojamento
  checklistItems      String[]  @default([])    ← lista de tarefas pré-viagem
  index: departureDate
}
```

### DirectionMember
```prisma
DirectionMember {
  name, roles String[], phone?, email?, salary Float?
  trainerAgeGroups String[], sectionistAgeGroups String[]
  athleteId? (unique, FK Athlete, onDelete: SetNull)
  salaryPayments DirectionSalaryPayment[]
  index: name
}
```

### DirectionSalaryPayment
```prisma
DirectionSalaryPayment {
  id       String          @id @default(uuid())
  memberId String          FK → DirectionMember (onDelete: Cascade)
  month    Int             (1-12)
  year     Int
  paid     Boolean         @default(false)
  amount   Float?          ← valor pago (default = member.salary se omitido)
  paidAt   DateTime?
  notes    String?
  unique: (memberId, month, year)
  index: (memberId, year)
}
```
> Historial de pagamento de salários mensais. Espelha o modelo `Quota` dos sócios.
> `amount` guardado no upsert; se não enviado pelo cliente, a API usa `member.salary` como default.

### Training + Playbook
```prisma
Training {
  date (DateTime), title, notes?
  playbook Playbook? (1-to-1)
  index: date
}
Playbook {
  trainingId (unique, FK Training, Cascade)
  frames Json @default("{\"elements\":[],\"frames\":[]}")
}
```

### TrainingSchedule
```prisma
TrainingSchedule {
  season String          ← ex: "2025/26"
  seasonStart DateTime?  ← data de início opcional da época
  ageGroup AgeGroup
  dayOfWeek Int          ← 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sáb
  startTime String       ← ex: "19:00"
  endTime String?
  location String?
  sessionType SessionType @default(GENERAL)
  active Boolean @default(true)
  sessions TrainingSession[] (FK reversa)
  indexes: season, ageGroup
}
```
> Horário semanal recorrente. O calendário gera visualmente sessões esperadas a partir deste modelo.
> Pré-populado para 2025/26 na migration `20260602000003_training_schedules`.

### TrainingSession + AttendanceRecord
```prisma
TrainingSession {
  date (DateTime), time String?
  primaryAgeGroup AgeGroup     ← escalão "anfitrião" do treino (SPECIFIC usa SUB15 como placeholder — irrelevante)
  sessionType SessionType @default(GENERAL)
  title?, notes?
  cancelled Boolean @default(false)          ← treino cancelado
  cancellationReason String?                 ← motivo do cancelamento
  scheduleId? (FK TrainingSchedule, onDelete: SetNull)  ← de que horário veio; SPECIFIC têm null
  records AttendanceRecord[]
  indexes: date, primaryAgeGroup, scheduleId
}

AttendanceRecord {
  sessionId (FK TrainingSession, Cascade)
  athleteId (FK Athlete, Cascade)
  present Boolean @default(false)
  notes?
  paidByAthlete Boolean @default(false)   ← atleta pagou este treino específico
  paidAmount    Float?                    ← valor pago (relevante para SPECIFIC)
  unique: (sessionId, athleteId)
  indexes: athleteId, sessionId
}
```
> `paidByAthlete` e `paidAmount` são relevantes apenas para `sessionType = SPECIFIC`.
> Para treinos regulares estes campos ficam `false`/`null` (nunca gravados pela UI).
AttendanceRecord {
  sessionId (FK TrainingSession, Cascade)
  athleteId (FK Athlete, Cascade)
  present Boolean @default(false)
  notes?
  unique: (sessionId, athleteId)
  indexes: athleteId, sessionId
}
enum SessionType { GENERAL GOALKEEPERS FIELD_PLAYERS SPECIFIC }
```
> Sessões são independentes do módulo `Training` para permitir registo em jogos, concentrações e sessões específicas (GR/campo).
> Um atleta pode aparecer em sessões de qualquer escalão — isso é tracking intencional (cross-training).

### TextileItem
```prisma
TextileItem {
  category TextileCategory
  type TextileType
  size String                   ← XS-3XL ou 4-16 (infantil)
  jerseyNumber Int?              ← só para camisolas
  personalized Boolean @default(false)
  personalizationDetails String?  ← ex: "João Silva · Nº 10"
  season String                 ← ex: "2025/26"
  state TextileState @default(STOCK)
  athleteId? (FK Athlete, onDelete: SetNull)
  isPartOfKit Boolean @default(false)
  kitRef String?                 ← agrupa peças do mesmo kit (ex: "kit-1748xxx")
  paidByAthlete Boolean @default(false)
  paidAmount Float?              ← valor pago pelo atleta
  totalCost Float?               ← custo total ao clube
  notes?
  indexes: athleteId, state, category, season
}
enum TextileCategory { GAME TRAINING OTHER }
enum TextileType { GAME_SHIRT GAME_SHORTS GAME_SOCKS GK_SHIRT TRAINING_TOP TRAINING_PANTS TRAINING_KIT JACKET TSHIRT OTHER }
enum TextileState { STOCK ASSIGNED DAMAGED LOST }
```

### PasswordResetToken
```prisma
PasswordResetToken {
  id        String   @id @default(uuid())
  userId    String   FK → User (onDelete: Cascade)
  token     String   @unique  ← token URL-safe random, hashed
  expiresAt DateTime           ← 1h após criação
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
  indexes: token, userId
}
```
> Usado no fluxo forgot-password: `POST /api/auth/forgot-password` cria token + envia email via Resend.
> `POST /api/auth/reset-password` valida token (não expirado, não usado) → atualiza password + marca `used=true`.

### RateLimit
```prisma
RateLimit {
  key       String   @id         ← ex: "login:1.2.3.4"
  count     Int      @default(1) ← nº de pedidos na janela actual
  resetAt   DateTime             ← quando a janela expira
  updatedAt DateTime @updatedAt
}
```
> Rate limiting distribuído por PostgreSQL — substitui a implementação in-memory que era ineficaz em serverless multi-instância.
> Upsert atómico via `INSERT ... ON CONFLICT DO UPDATE` — sem race conditions.
> Sem relação com outros modelos; pode ser limpo periodicamente (registos com `resetAt < NOW()`).

---

## Histórico de Migrações

| Migration | Data | O que faz | Estado |
|-----------|------|-----------|--------|
| `20260304171152_init` | Mar 2026 | Schema inicial completo | ✅ aplicada |
| `20260427161023_add_tokenversion_auditlog_indexes` | Abr 2026 | tokenVersion em User, indexes em AuditLog | ✅ aplicada |
| `20260504142123_add_fees` | Mai 2026 | Modelo AthletePayment | ✅ aplicada |
| `20260508105321_add_athlete_nif` | Mai 2026 | Campo nif em Athlete | ✅ aplicada |
| `20260511000000_salary_viewedit_materials` | Mai 2026 | salary em DirectionMember; viewMaterials+editMaterials (substitui manageInventory) | ✅ aplicada |
| `20260511000001_direction_athlete_trainergroups` | Mai 2026 | Tenta: trainerAgeGroups, athleteId, FK | ⚠️ **resolve-applied** (falhou em prod, saltou) |
| `20260511000002_direction_athleteid` | Mai 2026 | athleteId IF NOT EXISTS, FK safe | ✅ aplicada |
| `20260511000003_direction_sectionistagroups` | Mai 2026 | sectionistAgeGroups IF NOT EXISTS | ✅ aplicada |
| `20260511000004_fix_direction_member_columns` | Mai 2026 | **CRÍTICA**: adiciona roles[] e trainerAgeGroups[] que faltavam | ✅ aplicada (deploy Jun 2026) |
| `20260527000001_quota_amount` | Mai 2026 | Campo `amount Float?` em Quota (guarda valor no momento do pagamento) | ✅ aplicada |
| `20260527000002_material_payment` | Mai 2026 | `paidByAthlete Boolean` + `paidAmount Float?` em Material (custo e tracking de quem pagou) | ✅ aplicada |
| `20260602000001_attendance` | Jun 2026 | Modelos `TrainingSession` + `AttendanceRecord` + enum `SessionType` + 4 novas permission flags (`viewAttendance`, `editAttendance`, `viewTextiles`, `editTextiles`) | ✅ aplicada |
| `20260602000002_textiles` | Jun 2026 | Modelo `TextileItem` + enums `TextileCategory`, `TextileType`, `TextileState` | ✅ aplicada |
| `20260602000003_training_schedules` | Jun 2026 | Modelo `TrainingSchedule` + campos `cancelled`/`cancellationReason`/`scheduleId` em `TrainingSession` + seed horários 2025/26 (Sub11/Sub13/Sub17) | ✅ aplicada |
| `20260602000004_attendance_record_payment` | Jun 2026 | `paidByAthlete Boolean` + `paidAmount Float?` em `AttendanceRecord` (pagamento individual por treino SPECIFIC) | ✅ aplicada |
| `20260602000005_rate_limit` | Jun 2026 | Modelo `RateLimit` — rate limiting distribuído via PostgreSQL (substitui in-memory Map) | ✅ aplicada |
| `20260605000001_improvements` | Jun 2026 | `User.lastLoginAt DateTime?`; `Quota.notes String?`; 5 novos campos em `Travel` (convocados, budgetTransport, budgetMeal, budgetAccommodation, checklistItems); novo modelo `DirectionSalaryPayment` | ✅ aplicada |
| `20260605000002_remove_sponsor_logo` | Jun 2026 | `DROP COLUMN "logoUrl"` em `Sponsor` — logos removidos da funcionalidade | ✅ aplicada |
| `20260607000001_sponsor_enhancements` | Jun 2026 | Re-adiciona `logoUrl` + 5 campos novos: `sponsorTypes String[]`, `equipmentZones Int[]`, `bannerCount Int?`, `includesSticks Boolean`, `includesShinguards Boolean` | ✅ aplicada |
| `20260619000001_logo_and_reset_token` | Jun 2026 | `logoUrl TEXT?` em `Club`; novo modelo `PasswordResetToken` | ✅ aplicada |
| *(db push — sem migration)* | Jun 2026 | `primaryColor TEXT NOT NULL DEFAULT '142 71% 45%'` em `Club` — cor HSL da paleta do clube | aplicada via `db push` |

### Porquê a 20260511000001 falhou
A migration tentava:
```sql
ALTER TABLE "DirectionMember" ADD COLUMN "trainerAgeGroups" TEXT[] ...
UPDATE ... SET "trainerAgeGroups" = ARRAY["trainerAgeGroup"] ...  ← coluna não existia!
ALTER TABLE "DirectionMember" DROP COLUMN "trainerAgeGroup"       ← falha
```
Não existia `trainerAgeGroup` no schema original. A migration foi marcada como `resolve --applied` no build script para saltar. Resultado: `trainerAgeGroups` e `roles` nunca foram adicionados em produção → causa dos erros 500 na página de perfil de atleta.

### Build Script (package.json)
```bash
prisma migrate resolve --applied 20260511000001_direction_athlete_trainergroups 2>/dev/null || true
prisma migrate deploy
prisma generate
next build
```
O `resolve --applied` marca a 001 como "já aplicada" sem correr. O `|| true` garante que não falha se já estava marcada.

---

## Seed
```bash
npx prisma db seed
# Ficheiro: prisma/seed.ts
# Cria: superadmin@hoqueimanager.com / superadmin123 (isSuperAdmin=true, clubId=null)
# Clubes são criados pelo fluxo de registo (/api/register), não pelo seed
```

## Setup local (fresh install)
A tabela `Club` e colunas `clubId` foram adicionadas ao schema sem migration explícita. `prisma migrate dev` falha em BD nova porque `20260619000001` tenta `ALTER TABLE "Club"` antes da tabela existir.

**Workaround dev:**
```bash
$env:DATABASE_URL="postgresql://postgres:postgresql123@localhost:5432/hoqueimanager"
npx prisma db push   # sincroniza schema sem migrations (ok para dev)
npx prisma db seed   # cria superadmin
```

**Produção:** `prisma migrate deploy` funciona normalmente — Club existia antes do deploy das migrations recentes. Não afetado.

Fix técnico correto (futuro): squash das migrations para incluir Club na migration init, ou criar migration `20260616000001_multi_tenant_base` com o CREATE TABLE Club e ALTER TABLE ... ADD COLUMN clubId.

---

## Índices Importantes
- `Athlete`: name, ageGroup → pesquisa e groupBy rápidos
- `AthletePayment`: (athleteId, year) → consultas de época; (year, month) → stats
- `AuditLog`: entity, userId, createdAt → filtros e paginação
- `Material`: state, category, athleteId → filtros de inventário
