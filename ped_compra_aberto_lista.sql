-- Pedidos de compra abertos: item, descrição, quantidade **na linha do pedido** (b.qtd_item),
-- grupo do cadastro, custo unitário da última NF de compra (MT) e quantidade nessa linha.
-- (Status ≠ Finalizado/Cancelado; join estoque via identificador.)
--
-- "Quantidade" na listagem = QTD_ITEM do pedido de compra em aberto, não estoque mínimo nem sugestão automática.

SELECT
    a.id_ped_compra_ordem,
    b.id_identificador,
    d.descricao,
    b.qtd_item,
    CASE
        WHEN COALESCE(c.qtd_minim, 0) > COALESCE(c.qtd_atual, 0)
        THEN ROUND(COALESCE(c.qtd_minim, 0) - COALESCE(c.qtd_atual, 0), 2)
        ELSE 0
    END AS sugestao_compra,
    TRIM(COALESCE(gr.descricao, '')) AS nome_grupo,
    (
        SELECT FIRST 1
            COALESCE(
                li.vlr_unit,
                CASE
                    WHEN COALESCE(li.qtd_item, 0) > 0.0001 THEN
                        (COALESCE(li.vlr_total, 0) - COALESCE(li.vlr_desc, 0)) / li.qtd_item
                    ELSE NULL
                END,
                li.vlr_custo
            )
        FROM tb_nfc_item_2 li
        INNER JOIN tb_nfcompra_2 nc ON nc.id_nfcompra = li.id_nfcompra
        WHERE li.id_identificador = b.id_identificador
          AND COALESCE(nc.status, 'E') <> 'C'
        ORDER BY
            COALESCE(CAST(nc.dt_entrada AS TIMESTAMP), CAST(nc.dt_emissao AS TIMESTAMP)) DESC,
            nc.id_nfcompra DESC,
            li.id_nfcitem DESC
    ) AS ultimo_custo_compra,
    (
        SELECT FIRST 1 li.qtd_item
        FROM tb_nfc_item_2 li
        INNER JOIN tb_nfcompra_2 nc ON nc.id_nfcompra = li.id_nfcompra
        WHERE li.id_identificador = b.id_identificador
          AND COALESCE(nc.status, 'E') <> 'C'
        ORDER BY
            COALESCE(CAST(nc.dt_entrada AS TIMESTAMP), CAST(nc.dt_emissao AS TIMESTAMP)) DESC,
            nc.id_nfcompra DESC,
            li.id_nfcitem DESC
    ) AS qtd_ultima_compra
FROM tb_ped_compra_ordem a
JOIN tb_ped_compra_ordem_item b
    ON b.id_ped_compra_ordem = a.id_ped_compra_ordem
JOIN tb_est_produto_2 c
    ON c.id_identificador = b.id_identificador
JOIN tb_est_identificador_2 id2
    ON id2.id_identificador = c.id_identificador
JOIN tb_estoque_2 d
    ON d.id_estoque = id2.id_estoque
LEFT JOIN tb_est_grupo gr
    ON gr.id_grupo = d.id_grupo
JOIN tb_ped_compra_status e
    ON e.id_status = a.ped_compra_status
WHERE TRIM(COALESCE(e.descricao, '')) NOT IN ('Finalizado', 'Cancelado')
ORDER BY a.dt_ordem DESC, a.id_ped_compra_ordem, b.id_identificador
