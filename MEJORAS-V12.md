# Melate Genius · Protocolo autónomo v12 (Production Gate)

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
| `v10/*` | predicciones congeladas con SHA-256, monitoreo secuencial con gasto de alfa, detector de edge de tres estados, Champion Live Gate, Research Guard, leaderboard live |
| `v11/*` | features multi-fuente, split temporal con LeakageGuard, MLP, LSTM, Transformer, Autoencoder y meta-ensemble neuronal |
| `v12/*` | Live Frontier, apilado temporal, dimensiones por juego, manifiestos reproducibles, model cards con estados, calibración, guardia adversarial de fuga, candado del Golden Holdout, congelado inmutable y Production Gate |

Desde v11, el MLP, la LSTM, el Transformer y el Autoencoder entrenan dentro del
navegador. El único retador que sigue necesitando backend es la QNN de
`worker/qnn.py`, que requiere PennyLane y se reporta como
`optional_dependency_missing`, igual que en `engine/app/models/challengers.py`.

## Las redes neuronales

El paquete construye las redes con PyTorch. Aquí van implementadas sobre un
mini-autodiff propio (tensores 2D con cinta de operaciones, Adam y recorte de
gradiente) para que entrenen de verdad en el cliente:

| Red | Arquitectura | Rol |
|---|---|---|
| MLP | `Linear→ReLU→Dropout(.10)` ×2 + salida sigmoide, una muestra por número | Combina historia agregada con las salidas de los 13 modelos clásicos |
| LSTM | Celda completa (i, f, g, o) con dropout .10 + softmax sobre los números | Dependencia temporal en la secuencia de sorteos |
| Transformer | Proyección + atención escalada de 1 cabeza + FFN residual | Atención sobre la ventana de historia |
| Autoencoder | `maxN→64→latente→64→maxN` sigmoide | Reconstrucción; su error es la señal de anomalía |

Las dimensiones se reducen respecto al paquete (hidden 128 → 20-24, d_model
128 → 24, 3 capas → 1) porque el entrenamiento corre en el hilo principal de un
teléfono; el ciclo cede el hilo entre redes y respeta un presupuesto de tiempo
configurable.

**Los gradientes están verificados contra diferencias finitas** en las cuatro
arquitecturas (error relativo ≤ 2·10⁻⁷), y una prueba de sanidad confirma que
las redes aprenden: sobre una serie con señal temporal inyectada alcanzan
p = 0.007 y +2.16 aciertos sobre el azar; sobre ruido puro se quedan en Δ ≈ 0.

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
6. **Endurecimiento live (v10)** — congelado con SHA-256, monitoreo secuencial,
   Research Guard y ciclos de Live Trial.
7. **Cerebro neuronal (v11)** — qué redes entrenan, presupuesto de tiempo,
   épocas, tasa de aprendizaje, tamaños de cada arquitectura y si el
   meta-ensemble exige evidencia live para ponderar.
8. **Inteligencia live (v9)** — z del IC, ventanas móviles, tolerancia de
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
7. **Meta-ensemble neuronal (v11)**: si alguna red pasó TODAS las compuertas,
   su distribución se mezcla con la clásica según el peso configurado. Si
   ninguna califica, la distribución no se toca (regla 57).
8. **Registro auditable**: cada boleto guarda `run_id`, semilla, snapshot de
   datos y versión del modelo. La trazabilidad viaja con la predicción hasta el
   historial.
9. **Congelado (v10)**: cada combinación se sella con un hash SHA-256 sobre su
   payload canónico antes del sorteo, y queda verificable después (reglas 43 y
   44). El hash aparece en la tarjeta del boleto.

### Sobre el peso de las redes

`v11/meta_ensemble.py` pondera con `validation_score × live_delta`. Mientras no
exista historial live evaluado el producto es cero, así que **ninguna red
pondera aunque pase todas las compuertas**: es la exigencia de evidencia live
antes de dar peso (reglas 48 y 57). El comportamiento por defecto respeta esa
fórmula; el ajuste *«Exigir evidencia live para ponderar»* permite sustituir ese
factor por un piso para que una red ya validada pese sin esperar al live.

Los modos Portafolio y Sistémico pasan por la diversificación y la auditoría; el
agente IA usa exactamente el mismo pipeline.

## Qué pasa al agregar un resultado real

`submitRealResult()` cierra el ciclo continuo: evalúa las predicciones
pendientes, re-evoluciona y luego corre `mgOnNewDraw()`, que actualiza el track
record live, el análisis secuencial con ventanas 20/40/60, el score de deriva,
el decaimiento del Champion, la guardia de regresión y el plan del siguiente
ciclo (exploración vs. confirmación).

## Production Gate (v12)

Capa de endurecimiento. **No fabrica ventaja**: cierra huecos de ingeniería.

- **Live Frontier** por juego (`train/validation/holdout/live cutoff`). Un
  resultado entra al entrenamiento sólo tras cerrar su evaluación live, y al
  hacerlo la frontera avanza.
- **Apilado temporal**: cada predicción guarda `prediction_id`, modelo, versión,
  snapshot, `cutoff_draw`, `target_draw`, timestamp, semilla y scores. Sólo
  entran al meta-modelo las temporalmente válidas (`cutoff < target`).
- **Dimensiones por juego**: `GameSpec` con `n_numbers`, `picks`, tasa base
  `picks/N` y solape esperado `picks²/N`. Ningún tamaño de salida está fijo.
- **Reproducibilidad**: manifiesto con semilla, arquitectura, hiperparámetros,
  lookback, épocas, learning rate, dropout, optimizador, cortes, dispositivo y
  duración, más un hash del checkpoint. Verificado: dos corridas con el mismo
  snapshot y semilla producen el mismo checkpoint.
- **Model cards y estados**: `TRAINED → VALIDATED → ELIGIBLE → LIVE_TRIAL →
  QUALIFIED → CHAMPION`, con `REJECTED` y `DECAYED`. Ningún modelo salta a
  CHAMPION; un validado puede ser ELIGIBLE con peso 0.
- **Calibración**: compara raw, Platt e isotónica ajustando en una mitad de la
  validación y midiendo en la otra (la isotónica calibra perfectamente sus
  propios datos, así que compararla in-sample la elegiría siempre). Reporta
  Brier y ECE. Nunca toca el Golden Holdout.
- **Guardia adversarial de fuga**: `actual_draw`, `future_draw`, `next_draw`,
  `future_frequency`, `future_prediction`, `future_model_score` y
  `target_after_cutoff` abortan el experimento y bloquean la promoción.
- **Candado del Golden Holdout**: sólo lectura para evaluar la compuerta;
  cualquier otro propósito queda registrado y bloquea la promoción.
- **Congelado inmutable**: payload canónico `{run_id, seed, snapshot_id,
  numbers}` con SHA-256. Una vez sellada, la predicción no se sobrescribe;
  manipular cualquier campo falla la verificación.
- **Champion Gate de diez compuertas**: OOS, Holdout, Live Trial, Secuencial,
  FDR, Estabilidad, Calibración, Sin deriva, Sin fuga y Replicación. Ninguna
  métrica individual la esquiva.
- **Autoencoder**: sólo detecta régimen (`NORMAL / WATCH / ANOMALY / DRIFT`).
  La deriva nunca altera los números por sí sola.
- **Veredicto GO / NO-GO**: catorce comprobaciones. **GO significa seguro,
  reproducible y auditable — no que exista una ventaja.**

## Estados de la evidencia (v10)

Racha, anomalía y edge son estados distintos (regla 46):

- `RACHA_O_INESTABILIDAD` — el modelo no es estable o no replica.
- `ANOMALIA_NO_CONFIRMADA` — replica y es estable, pero falla q, permutación o
  Golden Holdout.
- `EDGE_CANDIDATE` — pasa todo. Aun así entra a **Live Trial**, que no equivale
  a Champion (regla 48).

El monitor secuencial gasta alfa en cada mirada al live: mirar muchas veces
exige una frontera más alta antes de llamar candidato a una diferencia.

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
- Las redes sólo reciben features disponibles antes del sorteo objetivo
  (regla 53) y el Golden Holdout es inaccesible durante el entrenamiento
  (regla 58).
- Validation loss nunca basta para declarar edge (regla 56); mayor complejidad
  no es evidencia de ventaja (regla 62).
- El Research Guard rechaza cualquier petición de bajar alfa, saltar BH,
  permutación, Golden Holdout o auto-promover (regla 50).
- Una predicción congelada no puede editarse retrospectivamente (regla 44).

## Auditoría

El botón *Exportar auditoría (JSON)* en Ajustes descarga ajustes, ciclo
completo, model cards, registros live, estado del Champion, meta-learner y
Research Memory.
