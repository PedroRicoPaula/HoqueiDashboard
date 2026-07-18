-- Club.registerCompletedAt — trava de uso único para POST /api/register/complete.
-- Sem isto, o endpoint aceitava reproduzir o mesmo Stripe session_id indefinidamente
-- para emitir um novo hm_token válido (login sem password), incluindo depois do admin
-- mudar a password ou terminar sessão em todos os dispositivos — o session_id da
-- Stripe é documentado como só para exibição, mas continua recuperável mesmo depois de
-- pago. NULL = ainda não usado (todos os clubes existentes); a rota reivindica este
-- campo atomicamente (updateMany WHERE registerCompletedAt IS NULL) antes de emitir o
-- token — qualquer pedido a seguir ao primeiro é rejeitado.
ALTER TABLE "Club" ADD COLUMN IF NOT EXISTS "registerCompletedAt" TIMESTAMP(3);
