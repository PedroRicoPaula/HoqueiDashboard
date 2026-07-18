-- Athlete.joinedAt / Athlete.leftAt — pertença ao clube por época, sem duplicar o
-- Athlete por época (ao contrário de Member/Sponsor). Um atleta tem histórico rico
-- ligado a um único athleteId (AthletePayment, AttendanceRecord, Material, Textile,
-- audit log) — duplicar a linha por época destruiria essa continuidade. Em vez disso,
-- a pertença a uma época é calculada por janela temporal: activo nessa época se
-- joinedAt <= época.endDate AND (leftAt IS NULL OR leftAt >= época.startDate).
-- Ambos nullable e sem DEFAULT: NULL em joinedAt = "sempre foi membro" (não precisa de
-- backfill para atletas existentes — ficam visíveis em todas as épocas passadas, tal
-- como hoje); NULL em leftAt = ainda activo (comportamento actual de 100% dos atletas
-- existentes, já que esta ação não existia antes). Nada isto é gravado por omissão —
-- só quando o utilizador criar um atleta novo ou marcar "saiu do clube" a partir de agora.
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "joinedAt" TIMESTAMP(3);
ALTER TABLE "Athlete" ADD COLUMN IF NOT EXISTS "leftAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "Athlete_clubId_leftAt_idx" ON "Athlete"("clubId", "leftAt");
