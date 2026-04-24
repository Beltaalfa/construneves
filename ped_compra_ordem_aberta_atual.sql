-- Ordem de compra "actual" para inserir itens negativos (mesmo critério que ped_compra_aberto_lista.sql):
-- a mais recente por data, excluindo status Finalizado e Cancelado.

SELECT FIRST 1 a.id_ped_compra_ordem AS id_ped_compra_ordem
FROM tb_ped_compra_ordem a
JOIN tb_ped_compra_status e ON e.id_status = a.ped_compra_status
WHERE TRIM(COALESCE(e.descricao, '')) NOT IN ('Finalizado', 'Cancelado')
ORDER BY a.dt_ordem DESC, a.id_ped_compra_ordem DESC
