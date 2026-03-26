-- Lista distinta de IDs para filtros (Grupo / Nível). Executar após estoque_giro_fragment.sql.
SELECT DISTINCT
    G.ID_GRUPO,
    G.ID_NIVEL1,
    G.ID_NIVEL2
FROM GIRO G
ORDER BY G.ID_GRUPO, G.ID_NIVEL1, G.ID_NIVEL2
