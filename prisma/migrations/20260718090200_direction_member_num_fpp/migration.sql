-- DirectionMember.numFpp — chave estável da federação para o reimport de CSV FPP não
-- fundir duas pessoas diferentes com o mesmo nome (pai/filho, nomes comuns em PT). O
-- Num FPP já era usado no cliente para agrupar linhas DENTRO de um mesmo import, mas
-- era descartado antes do pedido chegar ao servidor — o reimport (import seguinte)
-- só tinha o nome para tentar corresponder.
ALTER TABLE "DirectionMember" ADD COLUMN IF NOT EXISTS "numFpp" TEXT;
