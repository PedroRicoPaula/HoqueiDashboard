-- Free trial de 14 dias no registo: clube fica ACTIVE de imediato sem Stripe, com prazo
-- guardado aqui. Um cron diário (/api/cron/trial-sweep) suspende quem passar do prazo
-- sem stripeSubscriptionId. Nullable, sem backfill — só afecta registos novos com plan="trial".
ALTER TABLE "Club" ADD COLUMN "trialEndsAt" TIMESTAMP(3);
