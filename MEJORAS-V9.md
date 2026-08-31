# Melate Genius · Protocolo autónomo v9 (Live Intelligence)

Port a JavaScript, dentro de `index.html`, de las mejoras entregadas en los
paquetes `melatepro-autonomous-v3 … v9`. Todo corre en el navegador: no hay
backend, ni Docker, ni FastAPI.

| Paquete original | Qué se portó |
|---|---|
| `engine/app/analysis/*` | χ² de uniformidad, autocorrelación, pair lift, información mutua, deriva L1, punto de cambio, permutación, block bootstrap, BH |
| `engine/app/backtesting/core.py` | walk-forward + `summarize` (media de aciertos, delta vs azar, hit rate 3+) |
| `research/*` | catálogo de hipótesis, compuerta de replicación, model cards, planificador de ciclo |
| `v7/*` | ensemble dinámico, portafolio con límite de solape, búsqueda evolutiva, Monte Carlo, Research Memory, modo NO_EDGE |
| `v8/*` | aprendizaje continuo, meta-learner de presupuesto, early stopping, disparador de deriva, decaimiento de Champion, auditoría live, track record |
| `v9/*` | análisis secuencial, ventanas móviles 20/40/60, presupuesto adaptativo, linaje de datos, guardia de regresión, ranking por evidencia, plan del siguiente ciclo |

Los retadores que exigen backend (LSTM, Transformer y la red neuronal cuántica
de `worker/qnn.py`) se reportan como `optional_dependency_missing`, igual que en
`engine/app/models/challengers.py`.

## Dónde vive

Dos bloques `<script>` nuevos en `index.html`:

- **Research Core** — `MG_*`: ajustes, primitivas estadísticas, ciclo de
  investigación, pipeline de predicción y métricas live.
- **Ajustes del motor** — `MG_SETTINGS_SCHEMA` y las funciones `mgRender*`:
  la pantalla de ajustes y los paneles de estado.

## Ajustes globales

Se llega desde el engrane ⚙︎ del header o desde el botón del dashboard
(sección `#sec-ajustes`). Los ajustes viven en `MG_STATE.settings`, se guardan
en `localStorage` y se sincronizan con Supabase (`user_preferences`, clave
`research_settings`), así que **aplican a toda la app**: dashboard,
predicciones, portafolio, sistémico, backtest, historial y el agente.

Cambiar un ajuste invalida el ciclo cacheado, vuelve a evolucionar el ensemble
y repinta los paneles.

Grupos disponibles:

1. **Protocolo** — interruptor maestro, aplicar a predicciones, NO_EDGE
   estricto, semilla determinista.
2. **Compuertas estadísticas** — alfa, BH, repeticiones de permutación y
   bootstrap, ventana de validación, lookback por paso, tamaño del Golden
   Holdout, replicación, estabilidad y modelos mínimos para declarar EDGE.
3. **Ensemble dinámico (v7)** — pesos por evidencia, mezcla con el softmax
   histórico, temperatura y piso por modelo.
4. **Portafolio y búsqueda (v7)** — límite de solape, sobre-muestreo,
   generaciones/población/élite/mutación de la búsqueda evolutiva y universos
   de Monte Carlo.
5. **Aprendizaje continuo (v8)** — umbral y ventana de deriva, decaimiento del
   Champion, early stopping y topes de presupuesto por familia.
6. **Inteligencia live (v9)** — z del IC, ventanas móviles, tolerancia de
   regresión, auditoría live y frontera temporal al entrenar con live.

## Qué pasa al generar predicciones

Con el protocolo activo, `generatePredictions()` deja de ser un muestreo simple:

1. **Ciclo de investigación** (en `runEvolution`): walk-forward sobre la
   ventana de validación → permutación de etiquetas → block bootstrap →
   estabilidad por bloques → replicación multi-semilla → Golden Holdout →
   corrección BH → Champion Gate.
2. **Ensemble dinámico**: sólo pesan los modelos que pasan las compuertas,
   mezclados con el softmax histórico según el ajuste correspondiente. Si
   ninguno pasa → `NO_EDGE` y se conservan los pesos clásicos (o se aplana
   hacia uniforme si el modo estricto está encendido).
3. **Pool sobre-muestreado** de candidatos con la distribución resultante.
4. **Búsqueda evolutiva** (mutación + cruce) sobre ese pool. No accede al
   Golden Holdout.
5. **Portafolio diversificado**: se eligen los boletos respetando el límite de
   solape.
6. **Auditoría Monte Carlo**: cada boleto recibe su percentil frente a una
   referencia de boletos aleatorios.
7. **Registro auditable**: cada boleto guarda `run_id`, semilla, snapshot de
   datos y versión del modelo. La trazabilidad viaja con la predicción hasta el
   historial.

Los modos Portafolio y Sistémico pasan por la diversificación y la auditoría; el
agente IA usa exactamente el mismo pipeline.

## Qué pasa al agregar un resultado real

`submitRealResult()` cierra el ciclo continuo: evalúa las predicciones
pendientes, re-evoluciona y luego corre `mgOnNewDraw()`, que actualiza el track
record live, el análisis secuencial con ventanas 20/40/60, el score de deriva,
el decaimiento del Champion, la guardia de regresión y el plan del siguiente
ciclo (exploración vs. confirmación).

## Invariantes que el código respeta

- El Golden Holdout no alimenta pesos ni búsqueda evolutiva.
- El agente IA y el meta-learner leen el protocolo pero **no** pueden mover
  alfa, BH, permutación, Golden Holdout ni el Champion Gate: sólo el usuario,
  desde Ajustes.
- Live se mantiene separado del backtest.
- Un IC que cruza el baseline se marca como compatible con la tasa base.
- La degradación live puede retirar un Champion, pero nunca promueve otro
  automáticamente.
- `NO_EDGE` es un estado válido y no detiene la app: las combinaciones siguen
  siendo **candidatos, nunca garantías**.

## Auditoría

El botón *Exportar auditoría (JSON)* en Ajustes descarga ajustes, ciclo
completo, model cards, registros live, estado del Champion, meta-learner y
Research Memory.
