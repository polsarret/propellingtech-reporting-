# Nota técnica — Bug en el P&L de gold: incluye el asiento de cierre de fin de año

**Proyecto:** `propellingtech-datalake` (BigQuery, región EU)
**Objeto afectado:** `03_gold_holded.tbl-gld-fin-f_pnl`
**Origen:** se construye desde `02_silver_holded.tbl-slv-fin-general_ledger`
**Severidad:** alta (P&L incorrecto en diciembre de cualquier ejercicio cerrado; totales anuales de años cerrados mal)
**Fecha:** 2026-08-25

---

## Resumen

El P&L de gold (`tbl-gld-fin-f_pnl`) se está construyendo a partir del libro mayor **incluyendo los
asientos de cierre y regularización de fin de año** (tipos `closing` y `reg` en
`general_ledger`). Esos asientos llevan todas las cuentas de los grupos 6 y 7 contra la 129 para
dejarlas a cero (cierre contable español), por lo que **en diciembre revierten el P&L de todo el
ejercicio**. Resultado: diciembre sale con importes enormes y **signo invertido**.

## Evidencia (España, diciembre 2025)

Valores actuales en `tbl-gld-fin-f_pnl` para `market='ES'`, `year=2025`, `month=12`:

| pnl_l1 | balance (mal) |
|--------|--------------:|
| Revenues | **−2.016.744** (ingresos en negativo) |
| COGS | **+1.283.160** (coste en positivo) |
| SG&A | **+619.748** (positivo) |

- Los ingresos ES de **enero–noviembre 2025 suman 2.016.748**; diciembre muestra **−2.016.744** →
  diciembre está revirtiendo el acumulado anual.
- En `general_ledger` (ES, dic-2025) aparecen los tipos de asiento: **`closing`** (débito/crédito
  1.639.926) y **`reg`** (2.234.066). Son los asientos de cierre/regularización.

## Causa raíz

El modelo que materializa `tbl-gld-fin-f_pnl` agrega los movimientos del libro mayor **sin filtrar** los
asientos de cierre. Un P&L nunca debe incluir el asiento que traspasa 6xx/7xx a la 129.

## Fix propuesto (en el modelo que construye f_pnl)

Excluir esos tipos de asiento al leer el ledger:

```sql
-- en el modelo/consulta que alimenta tbl-gld-fin-f_pnl desde general_ledger
WHERE type NOT IN ('closing', 'reg')
```

(El P&L por cuenta/mes = `SUM(credit - debit)` sobre las cuentas de P&L, con esos tipos excluidos.)

## Validación realizada

Reconstruido el P&L de ES desde `general_ledger` con `SUM(credit - debit)`, cuentas de P&L
(`pnl_master`), **excluyendo `closing` y `reg`**, comparado contra el `f_pnl` actual:

- **Todos los meses ene–nov 2025 y ene–dic 2026 coinciden al céntimo** con el gold actual (la
  exclusión no afecta a los meses normales — esos asientos solo existen en el cierre de diciembre).
- **Diciembre 2025 se corrige**: de **−100.702 €** (gold actual, contaminado) a **−70.342 €** (correcto).
  Este −70.342 coincide con el diciembre del cierre independiente basado en el export "Objetivos" de
  Holded (~−67/−70k).
- Diciembre 2024 también queda saneado (+13.316 €).

## Impacto

- **Diciembre de todo ejercicio cerrado** está mal (signo invertido, importes inflados).
- **Totales anuales (FY) de años cerrados** están mal (el cierre revierte el año dentro de diciembre).
- Enero–noviembre no están afectados.

## Workaround temporal (ya aplicado, no bloqueante para vosotros)

Para no bloquear la app de reporting, la vista de consumo
`03_gold_finance.vw-gld-fin-f_pnl_consolidated` reconstruye el ES actual directamente desde
`general_ledger` excluyendo `closing`/`reg`. **Cuando corrijáis `tbl-gld-fin-f_pnl` en origen**, la
vista puede volver a leer directamente de `f_pnl` (avisadme y lo revierto).

## Comprobación rápida tras el fix

```sql
SELECT month, ROUND(SUM(balance)) result
FROM `propellingtech-datalake.03_gold_holded.tbl-gld-fin-f_pnl`
WHERE market='ES' AND year=2025
GROUP BY month ORDER BY month;
-- diciembre debe salir ~ -70.342, no -100.702; y ningún mes con importes de ~millones.
```
