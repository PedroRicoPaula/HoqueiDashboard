# Deployment — dashboard.hoqueiclubepdl.com

Aloja o dashboard no **Vercel** (plano Hobby), usando:
- **Neon** — PostgreSQL serverless (base de dados de produção)
- **Cloudflare R2** — armazenamento de logos de patrocinadores
- **Cloudflare DNS** — domínio `dashboard.hoqueiclubepdl.com` apontado para Vercel

---

## Pré-requisitos

- Conta Neon criada com o projeto `hcpdl` e migrações aplicadas ✅
- Bucket R2 `hcpdl-uploads` criado com Public Development URL ativo ✅
- Repositório GitHub com o código do dashboard ✅

---

## Passo 1 — Criar projeto no Vercel

1. Vai a [vercel.com](https://vercel.com) → **"Add New Project"**
2. Seleciona o repositório `gestao-hcpdl`
3. Vercel deteta automaticamente Next.js — não alterar configurações de build

---

## Passo 2 — Variáveis de ambiente

Ainda no ecrã de criação do projeto, expande **"Environment Variables"** e adiciona:

| Name | Value |
|------|-------|
| `DATABASE_URL` | Connection string da Neon (pooler URL — ver abaixo) |
| `JWT_SECRET` | String aleatória ≥ 32 chars (ex: `openssl rand -hex 32`) |
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Access Key |
| `R2_BUCKET_NAME` | Nome do bucket (ex: `hcpdl-uploads`) |
| `R2_PUBLIC_URL` | URL pública do bucket (ex: `https://pub-xxx.r2.dev`) |
| `NEXT_PUBLIC_APP_URL` | `https://dashboard.hoqueiclubepdl.com` |

> ⚠️ **Nunca** colocar valores reais em ficheiros de documentação no repositório.  
> Usar o painel do Vercel ou `vercel env add` via CLI.

### DATABASE_URL — qual usar?

Na dashboard do Neon, o projeto tem **dois** URLs:
- **Direct connection** (para migrações locais): `ep-xxx.eu-west-2.aws.neon.tech`
- **Connection pooler** (para runtime Vercel): `ep-xxx-pooler.eu-west-2.aws.neon.tech`

No Vercel usar o **pooler URL** com `?pgbouncer=true&sslmode=require` no final.

---

## Passo 3 — Deploy inicial

Clica **"Deploy"**. O build corre `prisma migrate deploy` + `prisma generate` + `next build` automaticamente (definido em `package.json` → `"build"`).

Quando terminar, aparece um URL como `gestao-hcpdl.vercel.app`.

---

## Passo 4 — Domínio personalizado

### No Vercel:
1. **Settings → Domains** → adicionar `dashboard.hoqueiclubepdl.com`
2. O Vercel mostra um registo CNAME para configurar

### No Cloudflare (DNS):
1. **Dashboard → hoqueiclubepdl.com → DNS → Add record**
2. Tipo: `CNAME`, Nome: `dashboard`, Destino: `cname.vercel-dns.com`
3. **Desativar o proxy (nuvem laranja → cinzenta)** — o Vercel gere o HTTPS

Domínio ativo em 1-2 minutos.

---

## Passo 5 — Criar a conta de administrador

1. Abre `https://dashboard.hoqueiclubepdl.com`
2. Serás redirecionado para `/setup`
3. Preenche nome, email e palavra-passe do admin
4. A página `/setup` desaparece permanentemente após a criação da primeira conta

---

## Deploys futuros

Cada `git push` para o branch `main` faz deploy automático.

Para deploy manual via CLI:
```bash
npm install -g vercel
vercel --prod
```

---

## Migrações de base de dados

Sempre que houver uma nova migration, o build de produção aplica-a automaticamente via `prisma migrate deploy` no script `build`.

Para aplicar manualmente (ex: urgente sem novo deploy):
```powershell
# Usar o direct URL (não o pooler) para migrações
$env:DATABASE_URL="postgresql://neondb_owner:<pass>@<ep-direct>.neon.tech/neondb?sslmode=require"
npx prisma migrate deploy
```

---

## Arquitetura de produção

```
Browser
  └── Cloudflare DNS (dashboard.hoqueiclubepdl.com)
        └── Vercel (Next.js SSR + API Routes)
              ├── Prisma + PrismaPg → Neon PostgreSQL
              └── Upload API → Cloudflare R2
```
