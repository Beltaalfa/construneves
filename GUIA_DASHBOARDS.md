# Guia: como os dashboards deste repositório foram montados

Este documento descreve o **padrão arquitetural** usado no projeto Construneves (painel Next.js + API FastAPI + Firebird CLIPP), para você **replicar a ideia em outro projeto**: consultas versionadas, camada API enxuta e UI que consome JSON.

---

## 1. Visão geral da stack

| Camada | Tecnologia | Papel |
|--------|------------|--------|
| Banco | **Firebird** (CLIPP) | Fonte única de verdade; leitura via `SELECT`. |
| API interna | **FastAPI** (`uvicorn`), porta típica **8091**, só **127.0.0.1** | Expõe endpoints `/dash/...` que executam SQL (ou agregam em Python). |
| Painel | **Next.js** (App Router) | Páginas em `painel/src/app/...`, componentes de dashboard em `painel/src/components/dashboard/`. |
| Proxy BFF | Rota **Next** `GET /api/dash/*` | O browser chama `/api/dash/...`; o servidor Next repassa para a API FastAPI (`internalFetch`). |

**Ideia central:** manter **consultas SQL (ou trechos SQL)** em arquivos **`.sql` na raiz do repositório** (`/var/www/construneves/*.sql`), e o **Python** só **carrega**, **compõe** (quando necessário) e **executa**. Assim o SQL fica **versionado no Git**, revisável e reutilizável no BI sem depender só do código.

---

## 2. Backend FastAPI

### 2.1 Entrada da aplicação

- **`painel-api/main.py`**: cria `FastAPI`, conexão Firebird (`firebird_connection`), helper `rows_to_dicts`, healthcheck, e opcionalmente `POST /query` para diagnóstico.
- Importa **`dashboard` como módulo** e faz:
  - `dash_module.wire(rows_to_dicts, firebird_connection)`
  - `app.include_router(dash_module.router)`

O `wire` injeta no módulo do dashboard as funções reais de banco, para o mesmo `dashboard.py` poder ser testado ou reutilizado.

### 2.2 Router dos dashboards — `painel-api/dashboard.py`

- `router = APIRouter(prefix="/dash", tags=["dashboard"])`
- Todos os endpoints públicos ficam sob **`/dash/...`** (ex.: `/dash/contas-a-pagar`, `/dash/estoque/giro-itens`, `/dash/financeiro/contas-bancarias/saldos`).

### 2.3 Carregamento de SQL da raiz do repo

Constante típica:

```python
REPO_SQL = Path("/var/www/construneves")
```

Função **`_load_sql("arquivo.sql")`**: lê o arquivo em `REPO_SQL`, valida existência, retorna texto (sem `;` final se necessário para composição).

### 2.4 Execução no Firebird

- **`_execute(sql, max_rows=...)`**: abre conexão, executa `SELECT`, normaliza linhas com **`_row_dict_clean`** (Decimal → float, datas → ISO string, etc.).
- **`_one_row(sql)`**: atalho para um único registro.

**Boas práticas usadas aqui:**

- Endpoints **somente leitura**; SQL composto no servidor a partir de fragmentos versionados.
- Validação de parâmetros de paginação/ordenação com **whitelist** de colunas permitidas no `ORDER BY` (evita injeção via sort).
- Algumas agregações (ex.: curva **ABC**) feitas em **Python** após buscar dados, quando é mais simples que SQL no Firebird.

### 2.5 Lista atual de rotas `/dash/*` (referência)

Consulte `painel-api/dashboard.py` por `@router.get` — exemplos:

- `/contas-a-pagar`, `/contas-a-receber`
- `/estoque/giro-resumo`, `/estoque/giro-itens`, `/estoque/bcg-*`
- `/precos/markup-validacao`
- `/vendas/resumo`, `/vendas/por-produto`, `/vendas/abc`, etc.
- `/financeiro/contas-bancarias/saldos`

---

## 3. Arquivos `.sql` na raiz do repositório

Os scripts cobrem desde **relatórios de produto** até **diagnóstico de schema** (`colunas_*.sql`, `listar_tabelas.sql`).

Exemplos diretamente ligados a telas:

| Arquivo | Uso típico |
|---------|------------|
| `contas_a_pagar_analitico.sql`, `contas_pagar_matriz_hierarquia.sql` | Contas a pagar |
| `contas_a_receber_por_cliente.sql`, `contas_receber_analitico_*.sql` | Contas a receber |
| `estoque_giro_fragment.sql`, `estoque_giro_resumo.sql`, `estoque_giro_filtros.sql` | Hub estoque / giro |
| `estoque_bcg_fragment.sql`, `estoque_bcg_resumo.sql` | BCG (se ainda exposto) |
| `validacao_markup_produtos.sql` | Markup |
| `vendas_linhas_cte.sql`, `vendas_forma_pagamento.sql`, `vendas_schema_doc.sql` | Documentação + CTEs vendas |
| `contas_bancarias_saldos_hoje.sql` | Saldos bancários (`TB_BANCO_CTA`) |
| `dre_*.sql`, `view_dre.sql` | DRE (quando integrado) |

**Padrão recomendado para novo relatório:** criar um `.sql` com **comentário no topo** (objetivo, tabelas, convenção de datas), depois referenciar no `dashboard.py` via `_load_sql` ou incluir como CTE embutida em string se for muito dinâmica.

---

## 4. Frontend Next.js

### 4.1 Chamada direta à API (Server Components)

Páginas **async** usam:

```ts
import { internalFetch } from "@/lib/internal-api";
const res = await internalFetch("/dash/contas-a-pagar");
```

- **`internalFetch`** usa `PAINEL_INTERNAL_API` ou padrão `http://127.0.0.1:8091`.
- `cache: "no-store"` para dados sempre atualizados.

### 4.2 Chamada pelo browser (Client Components)

Hooks no cliente usam caminho **`/api/dash/...`** (mesma origem do site):

- Rota: **`painel/src/app/api/dash/[...path]/route.ts`**
- Faz `internalFetch(\`/dash/${sub}${search}\`)` e devolve o JSON com o mesmo status HTTP.

Assim o browser **não** precisa falar com a porta 8091 (Firewall/CORS); só com o Next.

### 4.3 Componentes de UI reutilizáveis (`painel/src/components/dashboard/`)

- **`KpiCard`**: cartões de indicadores.
- **`DynamicTable`**: tabela a partir de lista de objetos + lista opcional de colunas; suporta **`exportFileName`** para XLSX.
- **`PaginatedRemoteTable`**: tabela com páginas remotas (`page`, `page_size`, `sort`), exportação XLSX em lotes respeitando o limite da API.
- **Gráficos**: `DashboardBarChart`, `DashboardPieChart`, componentes específicos (ex. evolução mensal).

### 4.4 Formatação de células

- **`painel/src/lib/table-cell-format.ts`**: `formatDashboardCell` — detecta chaves com `VLR`, `SALDO`, `PCT_`, etc., e formata em BRL / %.

### 4.5 Exportação XLSX

- **`painel/src/lib/export-xlsx.ts`**: `downloadRowsAsXlsx`
- **`TableExportXlsxButton`**: botão que dispara o download no cliente.

---

## 5. Fluxo completo (exemplo mental)

1. Analista/Especificador define o **SELECT** (ou CTEs) em **`.sql`** no repositório.
2. Desenvolvedor adiciona **`@router.get("/meu-modulo/relatorio")`** em **`dashboard.py`**, carrega SQL com **`_load_sql`**, eventualmente concatena filtros seguros, chama **`_execute`**, devolve `{ "rows": [...], "kpis": {...} }`.
3. Cria **`page.tsx`** em `painel/src/app/(main)/dashboard/...` que faz **`internalFetch("/dash/meu-modulo/relatorio")`** e monta **KPIs + tabela + gráfico**.
4. Se precisar de filtros no cliente, extrai um **`*Client.tsx`** com `useState`/`useEffect` apontando para **`/api/dash/meu-modulo/relatorio?...`**.
5. Opcional: link no **`Sidebar.tsx`** e na home.

---

## 6. Variáveis de ambiente e deploy (referência)

- **API**: variáveis Firebird em **`/var/www/construneves/.env`** (carregadas por `main.py`), ex.: `FIREBIRD_HOST`, `FIREBIRD_DATABASE`, `FIREBIRD_USER`, `FIREBIRD_PASSWORD`.
- **Next**: `PAINEL_INTERNAL_API` apontando para a base da API interna (se não for localhost padrão).

Serviços **systemd** típicos (nomes podem variar):

- `construneves-painel-api.service` — `uvicorn main:app --host 127.0.0.1 --port 8091`
- `construneves-painel.service` — `npm run start` (Next)

Após alterar **`dashboard.py`**: reiniciar a **API**.  
Após alterar **React/TS**: **`npm run build`** + reiniciar o **painel**.

---

## 7. Firebird — armadilhas comuns (vale para qualquer clone deste modelo)

- **Sem `WITH` aninhado** em algumas versões: preferir **um único** bloco `WITH` com todas as CTEs.
- **Limites**: `FIRST n` / `ROWS` conforme dialeto; paginar no servidor para tabelas grandes.
- Nomes de colunas às vezes chegam com **espaços**; o código faz **`.strip()`** em chaves quando necessário.

---

## 8. Checklist para “levar” este modelo a outro projeto

- [ ] Repositório com pasta de **SQL versionado** (ou `sql/` dedicada) e **mesmo padrão de path** que a API usa.
- [ ] **Camada API** (FastAPI ou outro) com: conexão ao banco, **uma função** `execute(sql) → rows`, **router** com prefixo estável (`/api/...` ou `/dash/...`).
- [ ] **Whitelist** para sort/filtros dinâmicos.
- [ ] Frontend com **fetch server-side** para SEO/payload inicial e **`/api/...` proxy** se o browser não puder falar com a API interna.
- [ ] Componentes mínimos: **tabela**, **KPI**, **exportação** se precisar.
- [ ] **CI/deploy**: rebuild do front + **restart** da API após mudanças de rota ou SQL carregado em import time.

---

## 9. Onde aprofundar no código deste repo

| O quê | Onde |
|-------|------|
| Rotas e lógica dos dashboards | `painel-api/dashboard.py` |
| Conexão Firebird e app | `painel-api/main.py` |
| Proxy `/api/dash` | `painel/src/app/api/dash/[...path]/route.ts` |
| Fetch interno | `painel/src/lib/internal-api.ts` |
| Páginas por módulo | `painel/src/app/(main)/dashboard/**/page.tsx` |
| Layout navegação | `painel/src/components/layout/Sidebar.tsx` |

---

*Documento gerado para reutilização da arquitetura em outros projetos; ajuste paths e nomes de serviço conforme seu ambiente.*
