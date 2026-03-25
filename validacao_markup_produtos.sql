-- Validação MarkUP: MARGEM_LB (cadastro) vs markup calculado (PRC_CUSTO / PRC_VENDA).
-- Ver painel: /dashboard/precos/markup-validacao

SELECT *
FROM (
    SELECT
        P.ID_IDENTIFICADOR AS COD_PRODUTO,
        TRIM(E.DESCRICAO) AS PRODUTO,
        ROUND(E.PRC_CUSTO, 4) AS CUSTO,
        ROUND(E.PRC_VENDA, 4) AS VENDA,
        ROUND(
            COALESCE(E.MARGEM_LB, 0)
            - (((E.PRC_VENDA - E.PRC_CUSTO) / NULLIF(E.PRC_CUSTO, 0)) * 100.0),
            2
        ) AS DIF_MARKUP_PCT,
        ROUND(COALESCE(E.MARGEM_LB, 0), 2) AS MARKUP_SISTEMA_PCT,
        ROUND(
            ((E.PRC_VENDA - E.PRC_CUSTO) / NULLIF(E.PRC_CUSTO, 0)) * 100.0,
            2
        ) AS MARKUP_CALCULADO_PCT,
        ROUND(
            ((E.PRC_VENDA - E.PRC_CUSTO) / NULLIF(E.PRC_VENDA, 0)) * 100.0,
            2
        ) AS MARGEM_BRUTA_PCT,
        CASE
            WHEN E.PRC_CUSTO IS NULL OR E.PRC_CUSTO <= 0 THEN 'SEM CUSTO'
            WHEN ABS(
                COALESCE(E.MARGEM_LB, 0)
                - (((E.PRC_VENDA - E.PRC_CUSTO) / NULLIF(E.PRC_CUSTO, 0)) * 100.0)
            ) > 0.05 THEN 'DIVERGENTE'
            ELSE 'OK'
        END AS VALIDACAO
    FROM TB_EST_PRODUTO_2 P
    INNER JOIN TB_EST_IDENTIFICADOR_2 I ON I.ID_IDENTIFICADOR = P.ID_IDENTIFICADOR
    INNER JOIN TB_ESTOQUE_2 E ON E.ID_ESTOQUE = I.ID_ESTOQUE
    WHERE COALESCE(E.PRC_VENDA, 0) > 0
) T
ORDER BY
    CASE T.VALIDACAO
        WHEN 'DIVERGENTE' THEN 1
        WHEN 'SEM CUSTO' THEN 2
        ELSE 3
    END,
    ABS(T.DIF_MARKUP_PCT) DESC
