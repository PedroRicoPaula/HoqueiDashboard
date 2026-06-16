# HoqueiManager — Plano Completo do Produto

> **Domínio:** hoqueimanager.com  
> **Conceito:** SaaS multi-tenant de gestão de clubes de hóquei em patins  
> **Mercados:** Portugal · Espanha · Itália · França · Internacional  
> **Criado:** 2026-06-16  

---

## 1. Visão do Produto

Um sistema de gestão completo para clubes de hóquei em patins, acessível a partir de qualquer dispositivo, com pagamento mensal e configuração em minutos. Cada clube tem o seu espaço isolado — os dados de um clube nunca são visíveis para outro.

**Problema que resolve:** A maioria dos clubes gere atletas, mensalidades, materiais e viagens em Excel, WhatsApp e papel. É lento, propenso a erros e não escala.

**Proposta de valor:** Um único sistema com tudo — atletas, mensalidades, assiduidades, materiais, têxteis, patrocinadores, viagens, direção e finanças — disponível em 5 línguas, por menos do que o custo de um equipamento por mês.

---

## 2. Nome e Domínio

**hoqueimanager.com**

- Imediatamente reconhecível nos mercados PT, ES, IT, FR (todas as línguas da patinagem)
- "Hoquei" sem ambiguidade com ice hockey (ao contrário de "Hockey")
- "Manager" é universal e comunica gestão
- `.com` sem alternativas regionais — um produto, um domínio

**Domínios secundários a registar:**
- hoqueimanager.pt
- hoqueimanager.es
- hoqueimanager.eu

---

## 3. Mercados-Alvo

| País | Liga Principal | Nº estimado clubes | Língua |
|------|---------------|-------------------|--------|
| Portugal | Campeonato Nacional | ~60 | PT |
| Espanha | OK Liga / Divisão de Honor | ~120 | ES |
| Itália | Serie A1/A2 | ~80 | IT |
| França | Ligue Elite | ~50 | FR |
| Outros | — | ~40 | EN |

**Total endereçável: ~350 clubes.** Capturar 20% = 70 clubes = €3.430/mês MRR mínimo.

**Estratégia de entrada:** PT primeiro (mercado de validação, língua nativa), ES segundo (maior mercado), depois IT e FR.

---

## 4. Stack Técnica

Baseada no projecto HCPDL existente — sem mudar tecnologias desnecessariamente.

| Camada | Tecnologia | Notas |
|--------|-----------|-------|
| Framework | Next.js 15 App Router | Igual ao HCPDL |
| Linguagem | TypeScript 5 | Igual |
| ORM | Prisma 7 + @prisma/adapter-pg | Igual |
| DB | Neon PostgreSQL | Igual |
| Auth | jose (JWT HS256) + PBKDF2 | Igual |
| UI | shadcn/ui (new-york, tema personalizável) | Igual |
| State | Zustand | Igual |
| Validação | Zod v4 | Igual |
| **i18n** | **next-intl** | NOVO |
| **Billing** | **Stripe** | NOVO |
| Storage | Cloudflare R2 | Igual (logos, ficheiros) |
| Deploy | Vercel | Igual |
| Testes | Vitest | Igual |

---

## 5. Arquitectura Multi-Tenant

### 5.1 Modelo de isolamento (3 camadas)

**Camada 1 — Prisma Client Extension:**
```typescript
// src/lib/tenant-prisma.ts
export function getTenantClient(clubId: string) {
  return prisma.$extends({ /* injeta clubId em todas as queries */ })
}
```
Impossível esquecer o filtro de tenant — é automático.

**Camada 2 — PostgreSQL Row-Level Security:**
Políticas na DB bloqueiam acesso cross-tenant mesmo contornando o Prisma.

**Camada 3 — Testes de isolamento:**
Suite Vitest que verifica que clube B não acede a dados do clube A.

### 5.2 Modelo de dados core

```prisma
model Club {
  id                     String      @id @default(uuid())
  name                   String
  slug                   String      @unique
  email                  String
  language               String      @default("pt")  // língua do dashboard
  status                 ClubStatus  @default(PENDING_PAYMENT)
  stripeCustomerId       String?     @unique
  stripeSubscriptionId   String?     @unique
  stripePriceId          String?
  stripeCurrentPeriodEnd DateTime?
  users                  User[]
  createdAt              DateTime    @default(now())
  updatedAt              DateTime    @updatedAt
}

enum ClubStatus {
  PENDING_PAYMENT
  ACTIVE
  PAST_DUE
  CANCELLED
  SUSPENDED
}
```

Todas as tabelas de negócio (Athlete, Member, Sponsor, etc.) recebem `clubId String` com FK para Club.

### 5.3 SUPER_ADMIN

```prisma
// Campo adicional em User:
isSuperAdmin Boolean @default(false)
clubId       String? // null = SUPER_ADMIN
```

SUPER_ADMIN acede a `/platform` — lista todos os clubes, estado, MRR, acções de suporte. Nunca acede ao dashboard de um clube específico.

---

## 6. Internacionalização (i18n)

### 6.1 Estratégia

- **Landing page:** 5 línguas disponíveis em simultâneo via routing de locale (`/pt`, `/es`, `/en`, `/fr`, `/it`)
- **Dashboard:** uma língua por clube, definida no registo, alterável nas definições. Todas as línguas incluídas no preço — sem add-ons pagos.
- O utilizador vê o dashboard na língua do clube. Se quiser mudar vai às definições e altera.

### 6.2 Implementação com next-intl

```bash
npm install next-intl
```

Estrutura de ficheiros:
```
messages/
├── pt.json      # Português
├── es.json      # Español
├── en.json      # English
├── fr.json      # Français
└── it.json      # Italiano
```

Routing:
```
src/app/
├── [locale]/              # landing page — PT, ES, EN, FR, IT
│   ├── page.tsx           # hero + features + pricing
│   ├── layout.tsx
│   └── ...
├── (dashboard)/           # dashboard — sem locale no URL, língua vem do Club.language
└── (platform)/            # backoffice SUPER_ADMIN
```

### 6.3 Conteúdo a traduzir

**Landing page:** Hero, features, pricing, FAQ, CTA, footer  
**Dashboard:** Todos os labels, mensagens de erro, notificações, emails transacionais  
**Emails Stripe:** Confirmação de pagamento, aviso de renovação, falha de pagamento

---

## 7. Landing Page

### 7.1 Estrutura de secções

```
1. Nav          Logo + língua selector + "Entrar" + "Começar agora"
2. Hero         Headline + subtítulo + CTA + screenshot do dashboard
3. Problema     "Como gere o teu clube hoje?" — Excel, WhatsApp, papel
4. Solução      3 pilares: centralizado, seguro, acessível em qualquer dispositivo
5. Features     12 módulos em cards com ícone + descrição curta
6. Social proof Número de clubes, atletas geridos, países (actualizar com dados reais)
7. Pricing      2 planos: Mensal vs Anual (com destaque "Poupa 20%")
8. FAQ          6-8 perguntas frequentes
9. CTA final    "Experimenta 14 dias com garantia de reembolso total"
10. Footer      Links + línguas + contacto + termos
```

### 7.2 Headline por língua (sugestões)

| Língua | Headline |
|--------|---------|
| PT | "Toda a gestão do teu clube num só lugar" |
| ES | "Toda la gestión de tu club en un solo lugar" |
| EN | "Complete hockey club management, simplified" |
| FR | "Gérez votre club de hockey en un seul endroit" |
| IT | "Tutta la gestione del tuo club in un unico posto" |

### 7.3 Selector de língua

No nav, dropdown com bandeira + nome. URL muda para `/es`, `/it`, etc. A preferência é guardada em cookie para visitas futuras.

---

## 8. Pricing e Billing (Stripe)

### 8.1 Planos

| | Mensal | Anual |
|-|--------|-------|
| **Preço** | €59/mês | €590/ano (=€49/mês) |
| **Desconto** | — | 20% (~2 meses grátis) |
| **Atletas** | Ilimitados | Ilimitados |
| **Utilizadores** | Ilimitados | Ilimitados |
| **Módulos** | Todos | Todos |
| **Línguas** | Todas | Todas |
| **Suporte** | Email | Email prioritário |

**Sem limite de atletas, sem add-ons, sem tier "enterprise" — simplicidade total.**

### 8.2 Garantia

- **14 dias de garantia de reembolso total.** Sem perguntas.
- Reembolso processado manualmente via botão no `/platform`.
- Após reembolso, conta CANCELLED — não pode recriar com o mesmo email/NIF sem contacto.

### 8.3 Fluxo de registo + pagamento

```
/register (landing page → "Começar agora")
  ↓
Passo 1: Dados do clube
  - Nome do clube
  - País (define língua default)
  - Nome do admin, email, password

Passo 2: Escolha de plano
  - Mensal €59 ou Anual €590
  - Botão → Stripe Checkout

Stripe Checkout (hosted)
  - Pagar com cartão
  - Webhook: checkout.session.completed
    → Club.status = ACTIVE
    → Email de boas-vindas

/login (com email e password criados)
  ↓
Dashboard na língua do clube
```

### 8.4 Gestão de billing

| Evento Stripe | Acção |
|---------------|-------|
| `checkout.session.completed` | `Club.status = ACTIVE`, email boas-vindas |
| `invoice.payment_succeeded` | `Club.status = ACTIVE`, renovação confirmada |
| `invoice.payment_failed` | `Club.status = PAST_DUE`, email de aviso |
| `customer.subscription.deleted` | `Club.status = CANCELLED` |

PAST_DUE: clube ainda acede em read-only. Stripe reintenta 4x em 7 dias antes de cancelar.

---

## 9. Módulos do Dashboard

Todos os módulos do HCPDL migram para o produto novo. Lista completa:

| # | Módulo | Descrição |
|---|--------|-----------|
| 1 | **Dashboard** | KPIs, receitas, despesas, saldo líquido, alertas |
| 2 | **Atletas** | Fichas completas, perfis, histórico |
| 3 | **Mensalidades** | Grelha época × atletas, um clique |
| 4 | **Assiduidades** | Calendário automático, presenças, stats |
| 5 | **Materiais Hóquei** | Inventário, atribuição, custos |
| 6 | **Materiais Têxteis** | Camisolas, kits, tamanhos, personalização |
| 7 | **Sócios** | Quotas mensais, histórico |
| 8 | **Patrocinadores** | Contratos, logos R2, alertas expiração |
| 9 | **Viagens** | Logística, condutores, orçamento |
| 10 | **Direção** | Cargos, escalões, salários |
| 11 | **Treinos + Tático** | Quadro tático digital com playbooks |
| 12 | **Relatórios** | Exportação CSV por módulo |
| 13 | **Admin** | Utilizadores, 20 permissões, audit log |

---

## 10. /platform — Backoffice SUPER_ADMIN

Página interna em `/platform`, acessível apenas com `isSuperAdmin = true`.

### Funcionalidades

- Lista todos os clubes com status badge (ACTIVE / PAST_DUE / CANCELLED)
- Por clube: nome, email, país, língua, plano, data de criação, último acesso
- Acções: Suspender, Cancelar, Reembolsar (botão → Stripe API)
- Métricas: MRR total, clubes activos, clubes PAST_DUE, churn do mês
- Criar convite manual para clube (bypass do fluxo de pagamento para testes/parcerias)

---

## 11. Estrutura de Ficheiros (novo projecto)

```
hoqueimanager/
├── prisma/
│   ├── schema.prisma          schema multi-tenant completo
│   ├── migrations/
│   └── seed.ts                criar SUPER_ADMIN
├── messages/
│   ├── pt.json
│   ├── es.json
│   ├── en.json
│   ├── fr.json
│   └── it.json
├── src/
│   ├── app/
│   │   ├── [locale]/          landing page (5 línguas)
│   │   │   ├── page.tsx
│   │   │   └── register/
│   │   ├── (dashboard)/       dashboard do clube (autenticado)
│   │   ├── (platform)/        backoffice SUPER_ADMIN
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── register/      onboarding clube
│   │   │   ├── stripe/
│   │   │   │   └── webhook/
│   │   │   ├── platform/      API do backoffice
│   │   │   └── [todos os módulos]/
│   │   └── login/
│   ├── lib/
│   │   ├── auth.ts            JWT + PBKDF2 (igual ao HCPDL)
│   │   ├── prisma.ts          singleton
│   │   ├── tenant-prisma.ts   getTenantClient() — isolamento automático
│   │   ├── stripe.ts          singleton Stripe
│   │   ├── permissions.ts     hasPermission()
│   │   ├── audit.ts           logAudit()
│   │   └── i18n.ts            helpers next-intl
│   ├── components/
│   │   ├── ui/                shadcn/ui
│   │   ├── landing/           componentes da landing page
│   │   ├── layout/            sidebar, topnav do dashboard
│   │   └── [módulos]/
│   ├── store/
│   │   ├── authStore.ts       + clubId, isSuperAdmin, language
│   │   └── sidebarStore.ts
│   ├── hooks/
│   │   └── useTranslation.ts  wrapper next-intl
│   └── middleware.ts          CSRF + JWT + RBAC + locale redirect
├── public/
│   └── locales/               (fallback estático se necessário)
├── CLAUDE.md
├── .env.local
└── package.json
```

---

## 12. Variáveis de Ambiente

```bash
# DB
DATABASE_URL=postgresql://...neon.tech/hoqueimanager

# Auth
JWT_SECRET=min-32-chars-strong-secret

# App
NEXT_PUBLIC_APP_URL=https://hoqueimanager.com

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_ANNUAL=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Cloudflare R2
R2_BUCKET_NAME=hoqueimanager
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_PUBLIC_URL=https://...r2.dev
```

---

## 13. Infraestrutura

### Vercel
- Projecto novo no Vercel ligado ao novo repositório
- Branch `main` → deploy automático para hoqueimanager.com
- Custom domain: hoqueimanager.com + www.hoqueimanager.com

### Neon PostgreSQL
- Nova base de dados (não partilhar com HCPDL)
- Nome: `hoqueimanager`
- Connection pooling activo (Neon já inclui)

### Cloudflare R2
- Novo bucket `hoqueimanager` (separado do bucket HCPDL)
- Organização de paths: `{clubId}/sponsors/{filename}`, `{clubId}/documents/{filename}`

### Stripe
- Novo produto: "HoqueiManager"
- Preços: monthly €59, annual €590
- Webhook endpoint: `https://hoqueimanager.com/api/stripe/webhook`

---

## 14. Fases de Implementação

### Fase 1 — Fundação (1-2 semanas)
- [ ] Criar repositório Git: `hoqueimanager`
- [ ] Copiar codebase HCPDL para o novo repo
- [ ] Remover dados/branding HCPDL (seeds, logos, referências hardcoded)
- [ ] Instalar e configurar next-intl
- [ ] Criar ficheiros de tradução PT/ES/EN/FR/IT (estrutura, não conteúdo completo)
- [ ] Adicionar modelo `Club` ao schema Prisma
- [ ] Adicionar `clubId`, `isSuperAdmin`, `language` ao `User`
- [ ] Adicionar `clubId` a todos os modelos de negócio
- [ ] Migration inicial
- [ ] Criar `src/lib/tenant-prisma.ts` (Prisma Extension)
- [ ] Actualizar middleware para locale + JWT + RBAC

### Fase 2 — Landing Page (1 semana)
- [ ] Layout e design da landing page (dark theme, cores da patinagem)
- [ ] Hero section com screenshot do dashboard
- [ ] Secção de features (12 módulos)
- [ ] Secção de pricing (mensal vs anual)
- [ ] FAQ
- [ ] Selector de língua no nav
- [ ] Traduzir landing page para PT, ES, EN (FR e IT depois)
- [ ] Formulário de waitlist/registo antecipado (email capture)
- [ ] Deploy: hoqueimanager.com

### Fase 3 — Billing + Registo (1 semana)
- [ ] Instalar Stripe SDK
- [ ] Criar produto + preços no Stripe Dashboard
- [ ] `src/app/api/register/route.ts` — criar clube + user + Stripe Customer + Checkout
- [ ] `src/app/api/stripe/webhook/route.ts` — gerir eventos de billing
- [ ] Página `/register` (2 steps: dados + plano)
- [ ] Página `/register/success`
- [ ] Guard de status activo nas API routes
- [ ] Emails transacionais (boas-vindas, aviso PAST_DUE)

### Fase 4 — Dashboard Multi-Tenant (1-2 semanas)
- [ ] Substituir `prisma` por `getTenantClient()` em todas as API routes
- [ ] Validar referências cruzadas entre entidades
- [ ] Dashboard com língua do clube (next-intl no dashboard)
- [ ] Definições do clube: alterar língua, dados do clube
- [ ] Upload R2 com prefixo de tenant
- [ ] Testes de isolamento (Vitest)

### Fase 5 — Backoffice SUPER_ADMIN (3-4 dias)
- [ ] Layout `/platform` separado do dashboard
- [ ] API routes `/api/platform/*`
- [ ] Lista de clubes com status, MRR, acções
- [ ] Botões: suspender, cancelar, reembolsar
- [ ] Script `create-super-admin.ts`
- [ ] Protecção no middleware (`isSuperAdmin` required)

### Fase 6 — Qualidade e Launch (1 semana)
- [ ] Row-Level Security PostgreSQL no Neon
- [ ] Testes de isolamento passam a verde
- [ ] Traduzir dashboard para ES (PT já traduzido)
- [ ] Traduzir IT e FR (pode ser após launch)
- [ ] Política de Privacidade + Termos de Serviço
- [ ] GDPR: consentimento de cookies na landing
- [ ] Configurar Vercel Analytics
- [ ] Launch: contactar primeiros 5 clubes em PT manualmente

---

## 15. Go-to-Market

### Sequência de mercados
1. **Portugal** — mercado de validação, língua nativa, rede do HCPDL como referência
2. **Espanha** — maior mercado, OK Liga tem visibilidade, abordar via federação ou clubes top
3. **Itália** — Serie A1/A2 competitiva, abordagem directa a clubes
4. **França** — abordar via Ligue Elite
5. **Outros** — versão EN para clubes fora dos mercados principais

### Canais
- **Rede pessoal** — HCPDL como caso de uso real e referência
- **Federações** — parceria ou menção oficial (lenta mas credível)
- **Redes sociais** — Instagram dos clubes, grupos de Facebook de dirigentes
- **Email directo** — contactar presidentes/secretários com demo personalizada
- **Testemunhos** — primeiros 3 clubes com caso de uso documentado

### Primeiros 90 dias
- Mês 1: 2-3 clubes PT em onboarding manual (gratuito ou desconto)
- Mês 2: 3-5 clubes PT pagantes, primeiro contacto ES
- Mês 3: 5-8 clubes PT + primeiros ES, landing page ES live

---

## 16. Riscos e Mitigação

| Risco | Probabilidade | Mitigação |
|-------|---------------|-----------|
| Clubes não pagam por software | Médio | Demo ao vivo + garantia 14 dias + preço acessível |
| Concorrência de ferramentas gratuitas (Spond) | Alto | Funcionalidades específicas de hóquei que Spond não tem |
| Mercado PT demasiado pequeno sozinho | Alto | Lançar ES no mês 2, não esperar |
| Suporte consome demasiado tempo | Médio | Documentação clara + FAQ + limitar canais de suporte |
| Churn sazonal (verão) | Médio | Plano anual com 20% desconto reduz churn |
| Bug de isolamento de dados | Baixo | 3 camadas de segurança (Extension + RLS + Testes) |

---

## 17. Métricas de Sucesso

| Métrica | Mês 3 | Mês 6 | Mês 12 |
|---------|-------|-------|--------|
| Clubes activos | 5 | 15 | 35 |
| MRR | €245 | €735 | €1.715 |
| Churn mensal | <10% | <8% | <5% |
| NPS (satisfação) | >30 | >40 | >50 |
| Mercados activos | PT | PT + ES | PT + ES + IT |

---

## Referências Rápidas

- **Repositório:** a criar em GitHub como `hoqueimanager`
- **Baseado em:** HCPDL (C:\Users\pedro\Desktop\Pedro Pessoal\PDL\gestao-hcpdl)
- **DB local dev:** `postgresql://postgres:postgresql123@localhost:5432/hoqueimanager`
- **Admin dev:** a definir no seed
- **Stripe test:** usar chaves `sk_test_` até ao launch
