-- Totais: linhas e ordens distintas (mesmo filtro de ped_compra_aberto_lista.sql)

SELECT
    COUNT(*) AS QTD_ITENS,
    COUNT(DISTINCT a.id_ped_compra_ordem) AS QTD_ORDENS
FROM tb_ped_compra_ordem a
JOIN tb_ped_compra_ordem_item b
    ON b.id_ped_compra_ordem = a.id_ped_compra_ordem
JOIN tb_est_produto_2 c
    ON c.id_identificador = b.id_identificador
JOIN tb_est_identificador_2 id2
    ON id2.id_identificador = c.id_identificador
JOIN tb_estoque_2 d
    ON d.id_estoque = id2.id_estoque
JOIN tb_ped_compra_status e
    ON e.id_status = a.ped_compra_status
WHERE TRIM(COALESCE(e.descricao, '')) NOT IN ('Finalizado', 'Cancelado')
