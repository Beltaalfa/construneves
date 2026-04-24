-- Sincroniza MARGEM_LB (mark-up no cadastro) com o valor recalculado
-- ((PRC_VENDA - PRC_CUSTO) / PRC_CUSTO) * 100, só onde a tela de validação
-- marcaría DIVERGENTE: diferença > 0,05 p.p. (mesma regra do painel).
-- Tabela: TB_ESTOQUE_2. Executar fora de pico; fazer backup antes se preferir.

UPDATE TB_ESTOQUE_2 E
SET MARGEM_LB = ROUND(
  ((E.PRC_VENDA - E.PRC_CUSTO) / NULLIF(E.PRC_CUSTO, 0)) * 100.0, 2
)
WHERE COALESCE(E.PRC_VENDA, 0) > 0
  AND COALESCE(E.PRC_CUSTO, 0) > 0
  AND ABS(
    COALESCE(E.MARGEM_LB, 0) - 
    (((E.PRC_VENDA - E.PRC_CUSTO) / NULLIF(E.PRC_CUSTO, 0)) * 100.0)
  ) > 0.05;
