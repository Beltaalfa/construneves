# CLIPP BI – Queries no Firebird

Projeto separado do App-Cotação. Uso apenas para rodar queries no banco **CLIPP** e exportar dados para BI.

## Configuração

1. Instale as dependências:
   ```bash
   pip install -r requirements.txt
   ```
2. O `.env` já aponta para `C:\backup\CLIPP - Copia.FDB`. Ajuste se precisar.

## Uso

```bash
# Query direta (exemplo: listar tabelas)
python query.py "SELECT RDB\$RELATION_NAME FROM RDB\$RELATIONS WHERE RDB\$SYSTEM_FLAG = 0 FETCH FIRST 10 ROWS ONLY"

# Query em arquivo
python query.py --file minha_consulta.sql

# Exportar para CSV (Excel em português: ; e ,)
python query.py "SELECT * FROM SUA_TABELA" --csv resultado.csv

# Exportar para Excel
python query.py "SELECT * FROM SUA_TABELA" --excel resultado.xlsx
```

Depois use os CSVs/Excel no Power BI, Google Data Studio, etc.

## Queries disponíveis

| Arquivo | Descrição |
|---------|-----------|
| `contas_a_receber_por_cliente.sql` | Contas a receber sintético por cliente (saldo em aberto) |
| `contas_receber_analitico_prazo_medio.sql` | Contas a receber analítico (título a título) + prazo médio por cliente |
| `contas_a_pagar_analitico.sql` | Contas a pagar analítico (título a título) por fornecedor |
| `dre_detalhada.sql` | **DRE detalhada** por conta (receita, deduções, custos, despesas, resultado financeiro, retiradas). Fonte: TB_MOVDIARIO + TB_PLANO_CONTAS. Para filtrar por período, edite o arquivo e descomente/ajuste as datas no WITH MOV. |
| `dre_analitica_por_dia.sql` | **DRE analítica por dia**: um lançamento por linha, com DATA, CONTA, BLOCO_DRE, **DESCRICAO_LANCAMENTO** (o que foi aquele valor), TIPO D/C, VALOR_ORIGINAL e VALOR_DRE. Para filtrar por período, descomente as datas no WHERE. |

### DRE – filtrar por período

Edite `dre_detalhada.sql` e na CTE `MOV` descomente e ajuste:

```sql
AND M.DT_MOVTO >= '2026-01-01' AND M.DT_MOVTO < '2026-02-01'
```
