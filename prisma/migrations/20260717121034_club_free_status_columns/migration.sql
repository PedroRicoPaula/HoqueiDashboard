-- Club.isFreeClub / Club.statusChangedAt existem em schema.prisma e são usados em
-- código de produção (platform CREATE_FREE_CLUB / CHANGE_CLUB_STATUS, webhook Stripe)
-- desde ~2026-06-25, mas foram aplicados via `prisma db push` antes de este projeto
-- ter histórico de migrations — nunca ganharam uma migration própria (ver INFRA-003
-- em docs/ISSUES-BACKLOG.md e docs/DATABASE.md). IF NOT EXISTS torna isto seguro tanto
-- em bases de dados que já têm as colunas (produção, provavelmente) como em bases novas
-- (qualquer `prisma migrate deploy` a partir do zero, onde `prisma.club.create()` falha
-- com P2022 "column isFreeClub does not exist" sem esta migration).
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "isFreeClub" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "statusChangedAt" TIMESTAMP(3);
