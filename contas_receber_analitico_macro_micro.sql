-- =============================================================================
-- CONTAS A RECEBER – modelo analítico para BI (macro + micro)
-- =============================================================================
-- Evolução no tempo (gráfico dia a dia ou foto mensal): use em vez desta
--   contas_receber_evolucao_diaria.sql  ou  contas_receber_evolucao_mensal.sql
-- (esta query usa só CURRENT_DATE por linha de título → não forma série temporal.)
-- Grão micro: uma linha por título (TB_CONTA_RECEBER). No Power BI use medidas
-- para KPIs (total, atrasado, inadimplência %) e agrupe por Cliente, Portador,
-- Faixa de atraso, Ano/Mês, etc.
-- REF_DATA_RELATORIO = data de corte ("AsOf"); ao atualizar o extrato, todos
-- os cálculos de atraso/a vencer ficam consistentes com essa data.
-- =============================================================================

/* Substitua CURRENT_DATE por uma data fixa se quiser snapshot histórico, ex.:
   DATE '2026-01-31' AS REF_DATA_RELATORIO
   e troque CURRENT_DATE nas expressões abaixo pela mesma data. */

SELECT
    CAST(CURRENT_DATE AS DATE) AS REF_DATA_RELATORIO,

    /* --- Identificação (micro) --- */
    C.ID_CLIENTE,
    TRIM(C.NOME) AS CLIENTE,
    R.ID_CTAREC,
    TRIM(R.DOCUMENTO) AS DOCUMENTO,
    TRIM(R.HISTORICO) AS HISTORICO,
    R.ID_PORTADOR,
    TRIM(COALESCE(PT.DESCRICAO, '')) AS PORTADOR,

    /* --- Datas (eixo temporal / PMR) --- */
    R.DT_EMISSAO,
    R.DT_VENCTO,
    R.DT_VENCTO_ORIG,
    R.DT_RECEB,
    EXTRACT(YEAR FROM R.DT_EMISSAO)  AS ANO_EMISSAO,
    EXTRACT(MONTH FROM R.DT_EMISSAO) AS MES_EMISSAO,
    EXTRACT(YEAR FROM R.DT_VENCTO)   AS ANO_VENCIMENTO,
    EXTRACT(MONTH FROM R.DT_VENCTO)  AS MES_VENCIMENTO,
    CAST(EXTRACT(YEAR FROM R.DT_VENCTO) AS VARCHAR(4)) || '-' ||
        LPAD(CAST(EXTRACT(MONTH FROM R.DT_VENCTO) AS VARCHAR(2)), 2, '0') AS ANO_MES_VENCIMENTO,

    /* --- Valores (base para KPIs) --- */
    R.VLR_CTAREC AS VALOR_TITULO,
    COALESCE(R.VLR_PAGO, 0) AS VALOR_PAGO,
    COALESCE(R.VLR_RESTANTE, 0) AS VALOR_RESTANTE,

    /* --- Situação do título --- */
    CASE WHEN COALESCE(R.VLR_RESTANTE, 0) > 0 THEN 1 ELSE 0 END AS FL_EM_ABERTO,
    CASE
        WHEN COALESCE(R.VLR_RESTANTE, 0) > 0 AND CAST(CURRENT_DATE AS DATE) > R.DT_VENCTO THEN 1
        ELSE 0
    END AS FL_VENCIDO,
    CASE
        WHEN COALESCE(R.VLR_RESTANTE, 0) > 0 AND CAST(CURRENT_DATE AS DATE) > R.DT_VENCTO
        THEN R.VLR_RESTANTE
        ELSE 0
    END AS VALOR_VENCIDO,
    CASE
        WHEN COALESCE(R.VLR_RESTANTE, 0) > 0
         AND (CAST(CURRENT_DATE AS DATE) - R.DT_VENCTO) >= 30
        THEN R.VLR_RESTANTE
        ELSE 0
    END AS VALOR_VENCIDO_30_MAIS,
    CASE
        WHEN COALESCE(R.VLR_RESTANTE, 0) > 0 AND CAST(CURRENT_DATE AS DATE) <= R.DT_VENCTO
        THEN R.VLR_RESTANTE
        ELSE 0
    END AS VALOR_A_VENCER,

    /* --- Aging / faixas (como no painel de tempo de atraso) --- */
    CASE
        WHEN COALESCE(R.VLR_RESTANTE, 0) <= 0 THEN 'Liquidado / quitado'
        WHEN CAST(CURRENT_DATE AS DATE) <= R.DT_VENCTO THEN 'A vencer'
        WHEN (CAST(CURRENT_DATE AS DATE) - R.DT_VENCTO) BETWEEN 1 AND 7 THEN '1 a 7 dias'
        WHEN (CAST(CURRENT_DATE AS DATE) - R.DT_VENCTO) BETWEEN 8 AND 15 THEN '8 a 15 dias'
        WHEN (CAST(CURRENT_DATE AS DATE) - R.DT_VENCTO) BETWEEN 16 AND 30 THEN '16 a 30 dias'
        WHEN (CAST(CURRENT_DATE AS DATE) - R.DT_VENCTO) BETWEEN 31 AND 60 THEN '31 a 60 dias'
        WHEN (CAST(CURRENT_DATE AS DATE) - R.DT_VENCTO) BETWEEN 61 AND 90 THEN '61 a 90 dias'
        ELSE 'Acima de 90 dias'
    END AS FAIXA_ATRASO,

    (R.DT_VENCTO - R.DT_EMISSAO) AS DIAS_PRAZO_EMISSAO_ATE_VENCIMENTO,
    CASE
        WHEN COALESCE(R.VLR_RESTANTE, 0) > 0 THEN R.DT_VENCTO - CAST(CURRENT_DATE AS DATE)
        ELSE NULL
    END AS DIAS_ATE_VENCIMENTO,
    CASE
        WHEN COALESCE(R.VLR_RESTANTE, 0) > 0 AND CAST(CURRENT_DATE AS DATE) > R.DT_VENCTO
        THEN CAST(CURRENT_DATE AS DATE) - R.DT_VENCTO
        ELSE NULL
    END AS DIAS_ATRASO,

    /* --- PMR: vencimento → última baixa (quando houve recebimento) --- */
    BX.DT_ULTIMA_BAIXA,
    BX.VLR_TOTAL_RECEBIDO,
    CASE
        WHEN BX.DT_ULTIMA_BAIXA IS NOT NULL
        THEN BX.DT_ULTIMA_BAIXA - R.DT_VENCTO
        ELSE NULL
    END AS PMR_DIAS_VENCIMENTO_ATE_BAIXA,

    /* --- Prazo médio de recebimento do cliente (emissão → vencimento), referência --- */
    ROUND(PM_CLI.PRAZO_MEDIO_EMISSAO_VENC_DIAS, 1) AS PRAZO_MEDIO_CLIENTE_EMISSAO_VENC_DIAS

FROM TB_CONTA_RECEBER R
INNER JOIN TB_CLIENTE C ON C.ID_CLIENTE = R.ID_CLIENTE
LEFT JOIN TB_CONTA_PORTADOR PT ON PT.ID_PORTADOR = R.ID_PORTADOR
LEFT JOIN (
    SELECT
        ID_CTAREC,
        MAX(DT_BAIXA) AS DT_ULTIMA_BAIXA,
        SUM(VLR_RECEB) AS VLR_TOTAL_RECEBIDO
    FROM TB_CTAREC_BAIXA
    GROUP BY ID_CTAREC
) BX ON BX.ID_CTAREC = R.ID_CTAREC
LEFT JOIN (
    SELECT
        R2.ID_CLIENTE,
        AVG(CAST(R2.DT_VENCTO - R2.DT_EMISSAO AS DOUBLE PRECISION)) AS PRAZO_MEDIO_EMISSAO_VENC_DIAS
    FROM TB_CONTA_RECEBER R2
    WHERE (R2.CANC IS NULL OR TRIM(R2.CANC) = '' OR R2.CANC = 'N')
      AND COALESCE(R2.VLR_RESTANTE, 0) > 0
    GROUP BY R2.ID_CLIENTE
) PM_CLI ON PM_CLI.ID_CLIENTE = R.ID_CLIENTE
WHERE (R.CANC IS NULL OR TRIM(R.CANC) = '' OR R.CANC = 'N')
ORDER BY C.NOME, R.DT_VENCTO, R.ID_CTAREC


-- =============================================================================
-- RECEBIMENTOS (grão micro: uma linha por lançamento de baixa)
-- Use para gráficos "Valor recebido por Data da Baixa" e conciliação.
-- =============================================================================
/*
SELECT
    CAST(CURRENT_DATE AS DATE) AS REF_DATA_RELATORIO,
    C.ID_CLIENTE,
    TRIM(C.NOME) AS CLIENTE,
    R.ID_CTAREC,
    TRIM(R.DOCUMENTO) AS DOCUMENTO,
    B.ID_BAIXA,
    B.DT_BAIXA AS DATA_BAIXA,
    B.VLR_RECEB AS VALOR_RECEBIDO,
    COALESCE(B.VLR_DESC, 0) AS VALOR_DESCONTO_BAIXA,
    COALESCE(B.VLR_JURO, 0) AS VALOR_JUROS_BAIXA,
    TRIM(COALESCE(PT.DESCRICAO, '')) AS PORTADOR
FROM TB_CTAREC_BAIXA B
INNER JOIN TB_CONTA_RECEBER R ON R.ID_CTAREC = B.ID_CTAREC
INNER JOIN TB_CLIENTE C ON C.ID_CLIENTE = R.ID_CLIENTE
LEFT JOIN TB_CONTA_PORTADOR PT ON PT.ID_PORTADOR = R.ID_PORTADOR
WHERE (R.CANC IS NULL OR TRIM(R.CANC) = '' OR R.CANC = 'N')
ORDER BY B.DT_BAIXA DESC, C.NOME, R.ID_CTAREC
*/
