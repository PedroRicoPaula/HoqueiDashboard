-- BUG-045: impede duplicar o mesmo horário (dia+hora) para o mesmo escalão/época/clube.
-- Não impede múltiplos horários por escalão em dias diferentes — essa é uma decisão de
-- produto separada e ainda em aberto (ver UX-004 em docs/ISSUES-BACKLOG.md). Confirmado
-- sem duplicados existentes antes de aplicar (groupBy em produção/dev, 0 grupos com count>1).
CREATE UNIQUE INDEX "TrainingSchedule_clubId_season_ageGroup_dayOfWeek_startTime_key" ON "TrainingSchedule"("clubId", "season", "ageGroup", "dayOfWeek", "startTime");
