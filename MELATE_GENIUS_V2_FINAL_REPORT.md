# MELATE GENIUS V2 — Reporte final

**Fecha:** 2026-09-25 · **Artefacto en producción:** `598296957c0573472575f129427a7da19734125544789c976b828b7b28fbc6b9` (1 302 421 B)

---

## 1 · SUCCESS / BLOCKED

# **SUCCESS**

Los 8 subsistemas están implementados, integrados, probados y desplegados. **228 tests PASS · 0 FAIL.** Smoke de producción **56 PASS · 0 FAIL** contra el artefacto realmente servido.

Y el resultado científico, que es la parte que importa:

> **NO_EDGE en los cuatro juegos.** Medido, no supuesto. 0 de 4 juegos se distinguen del azar tras control de comparaciones múltiples. Después de calibrar, el ensemble de 13 modelos es **indistinguible de predecir `k/N` para todos los números** — diferencias de Brier del orden de 10⁻⁵, con el signo invertido en uno de los juegos.

Nada aquí está maquillado. Las cifras de las secciones 6–11 son las que salieron a la primera y son las únicas que se corrieron con esa configuración.

---

## 2 · Arquitectura

La capa V2 **compone**; no sustituye. Los primitivos científicos que ya existían en el artefacto siguen siendo la única implementación de lo que hacen:

```
index.html
├── MOTOR CIENTÍFICO (sin tocar, byte-preservado)
│   ├─ computeAllModels · computeWeights · fuse · structuralSignals · memorySignals
│   ├─ mgBuildCandidates · mgResolvePortfolioWithBoundedOverlap · mgGeneratePredictions
│   ├─ mgFreezePrediction · mgOnNewDraw · evolveWeights · projectCapFloor
│   └─ mgBrierBinary · mgExpectedCalibrationError · mgIsotonicFit · mgPlattFit
│      mgTheoreticalMean · mgWalkForward · mgStability · mgReplicationCheck · deepBacktest
│
├── MG_COLLECTIVE  (colectivo local, PR #8/#9)         ← sin cambios
├── MG_GLOBAL      (cerebro global, PR #10)            ← sin cambios
│
└── MG_SCI_V2 · scientific-v2.0.0            ← NUEVO, bloque <script> aislado
    ├─ PortfolioOptimizer   cartera, no boleto ganador
    ├─ CalibrationEngine    isotónica / Platt / raw + insufficient_sample
    ├─ ConfidenceEngine     confianza ≠ probabilidad de ganar
    ├─ FailureMemory        fallo bajo alta confianza, degradación, desacuerdo
    ├─ WalkForwardLab       ventanas temporales + auditoría de fuga
    ├─ AblationLab          FULL vs FULL − cada modelo
    ├─ EdgeDetector 2.0     EDGE-0..3 · EDGE-0 y EDGE-1 son NO_EDGE
    ├─ AntiOverfitShield    8 controles · REJECTED_POSSIBLE_OVERFITTING
    └─ RandomBaseline       cartera aleatoria reproducible por seed
    
    PUENTE V2 (lee el estado real, no lo cambia)
    ├─ mgV2Evidence(game)          evidencia del juego actual
    ├─ mgRenderEvidenceBanner()    §12 · se pinta ANTES de los boletos
    └─ mgRenderScienceDashboard()  §8 · tarjeta en Ajustes
```

Cuatro palabras que la capa **nunca** mezcla, y el código lo fuerza:

| | qué es |
|---|---|
| **score** | salida cruda de un modelo. Sin escala probabilística |
| **probability** | sólo después de calibrar y sólo con muestra suficiente |
| **confidence** | cuánta evidencia respalda al sistema. El objeto lleva `isWinProbability: false` |
| **evidence** | veredicto reproducible: EDGE-0..3 / NO_EDGE |

---

## 3 · Archivos modificados

**Uno.** `index.html`: **+732 líneas, −0**.

De esas 732, **726 son el bloque `<script>` aislado** de la capa V2 y su puente. Fuera de ese bloque el diff completo son **4 líneas de código** y 2 en blanco:

```diff
+        <div id="mg-evidence-banner"></div>
+  // §12 · primero la EVIDENCIA, después la cartera.
+  try { mgRenderEvidenceBanner(); } catch (e) { console.warn('MG-V2: banner', e); }
+  try { mgRenderScienceDashboard(); } catch (e) { console.warn('MG-V2: dashboard', e); }
```

Las tres llamadas van envueltas en `try/catch`: si la capa V2 fallara, la app sigue funcionando exactamente como antes.

### Lo que NO cambió, verificado por hash

| | resultado |
|---|---|
| **12 funciones del motor** | mismo sha256 de cuerpo, una a una |
| FLOOR 0.02 · CAP 0.35 · SHRINK_N0 40 · overlapLimit | 11 apariciones antes, 11 después (fuera del bloque V2) |
| **5 datasets oficiales** (`PACKED_DRAWS`) | línea idéntica byte a byte |
| NO_EDGE · Live Frontier · Golden Holdout · Champion Gate · LeakageGuard | 29→29 · 10→10 · 36→36 · 14→14 · 7→7 |
| `mgWalkForward` · `mgStability` · `mgReplicationCheck` · `deepBacktest` | 3→3 · 3→3 · 3→3 · 4→4 |

sha256 de los datasets, sin cambios: chispazo `51558ef6e79ffd20…` · melate `fe566568b978c2c4…` · retro `682699c87258ca3a…` · revancha `56a493a8da490660…` · tris `9fe589a8bf8dd445…`. Revancha sigue siendo un dataset distinto de Melate.

---

## 4 · Tablas

### Nueva: `collective_global_failure_memory`

Una fila por **(juego, concurso oficial, modelo, versión del motor)** — la misma identidad global del resto del cerebro. Migraciones `scientific_v2_01_failure_memory` y `scientific_v2_02_failure_memory_honest_nulls`.

| columna | |
|---|---|
| `prediction` · `official_result` · `hits` · `k` · `baseline` | la predicción y el resultado oficial, tal como se evaluaron |
| `brier` · `log_loss` · `calibration_error` | nulas cuando no aplican. **No se inventan** |
| `confidence_bucket` | bucket de **consenso del ensemble**, calculado por el servidor |
| `disagreement` | `1 − Jaccard medio` de las picks del modelo contra los otros 12 |
| `underperformed` | `hits < k²/N`, la baseline exacta |
| `high_confidence_failure` | `underperformed` **Y** bucket ALTA/MUY_ALTA — la señal que pide la §3 |
| `draw_ref` · `source_event` · `freeze_sha` | trazabilidad hasta el snapshot sellado |

**65 filas** (13 modelos × 5 sorteos oficiales), de las cuales **36 por debajo del baseline**.

Las 65 llevan `prediction` y `confidence_bucket` en **NULL**, y esto es deliberado: la memoria global **no guarda `model_picks`** — guarda señales, no predicciones crudas — así que las observaciones ya migradas no pueden aportarlas sin inventarlas. Las filas que escriba la Edge Function de aquí en adelante sí las traen. El comentario de la columna lo dice en la base de datos, no sólo aquí.

### `collective_global_model_stats`

La Edge Function ahora rellena también `disagreement`, que estaba siempre nula. No se modificó ninguna fila existente.

### Sin tocar

`collective_global_draws` (5) · `collective_global_state` (2 memorias v1) · `collective_global_events` · `collective_global_migrations` · `melate_sorteos` (3 824) · `user_draws` (21) · **`user_draws_backup_20260809` (29) — los 28 pendientes siguen ahí, intactos**.

---

## 5 · Tests — 228 PASS · 0 FAIL

| suite | qué cubre | |
|---|---|---|
| `tests.js` | colectivo: topK, desacuerdo, redundancia, pesos | 27 |
| `tests_multi.js` | multi-juego, idempotencia 1×/2×/10×/100× | 27 |
| `tests_hotfix.js` | sin fuga retroactiva, diagnóstico sin datos sensibles | 27 |
| `tests_pr9.js` | escalera de identidad **P1→P5**, evidencia mezclada | 22 |
| `tests_edge_parity.mjs` | paridad cliente ↔ Edge Function (JSON canónico, SHA, voto) | 8 |
| `tests_global_ui.mjs` | navegador: Tris fuera, export/import, memoria global, privacidad | 27 |
| **`tests_v2.js`** | **los 9 módulos V2, con los primitivos REALES del artefacto** | **45** |
| **`tests_v2_ui.mjs`** | **navegador: módulo cargado, banner antes de los boletos, dashboard** | **29** |
| **`tests_edge_v2.mjs`** | **Failure Memory server-side: determinismo, fuga, umbrales, identidad** | **16** |
| | | **228** |

Los tests de los módulos V2 cargan `mgIsotonicFit`, `mgPlattFit`, `mgBrierBinary`, `mgExpectedCalibrationError` y `mgTheoreticalMean` **desde `index.html`** antes de instanciar el módulo: se prueba el camino real, no el degradado. Y el módulo que se prueba es **byte-idéntico** al que va embebido en el artefacto (24 757 B, comprobado).

### Cosas que estos tests encontraron y se corrigieron

- **Degradación silenciosa de la calibración.** Si `mgIsotonicFit` o `mgPlattFit` no estaban disponibles, el motor caía a `raw` sin decirlo — y el reporte habría dicho "se compararon tres métodos" cuando sólo hubo uno. Ahora `fit()` devuelve `primitivesAvailable` y `unavailable`.
- **La excepción `supabase is not defined`** que aparece en el arnés de pruebas **ya existía** en el artefacto anterior (`probe_err.mjs`: 1 excepción antes, 1 después, en el mismo punto). Ver *Pendientes*.

**BUILD:** no aplica. Proyecto de un solo `index.html`, sin bundler, sin `package.json`, sin TypeScript ni linter. La comprobación equivalente es la suite de navegador contra el artefacto servido: **0 errores JS propios**.

---

## 6 · Walk-forward

Motor: `mgWalkForward` del propio artefacto. **Cero fuga por construcción** — en cada paso `t` entrena sólo con `draws[max(0, t−1500) … t)` y evalúa contra `draws[t]`.

**300 sorteos de test por juego · 10 ventanas temporales.**

| juego | baseline `k²/N` | ensemble | Δ | sd | ventanas positivas | estabilidad |
|---|---|---|---|---|---|---|
| melate | 0.642857 | 0.7067 | **+0.0638** | 0.690 | 6/10 | 83 % |
| revancha | 0.642857 | 0.5900 | **−0.0529** | 0.705 | 3/10 | 33 % |
| retro | 0.923077 | 0.9667 | **+0.0436** | 0.869 | 7/10 | 50 % |
| chispazo | 0.892857 | 0.8367 | **−0.0562** | 0.832 | 3/10 | 17 % |

Δ por ventana, en orden temporal:

```
melate    +0.224 +0.157 +0.190 −0.043 +0.057 +0.157 +0.157 −0.010 −0.076 −0.176
revancha  +0.057 −0.076 −0.043 +0.124 +0.057 −0.076 −0.176 −0.110 −0.110 −0.176
retro     +0.144 +0.244 +0.110 +0.044 +0.044 −0.190 −0.156 +0.010 +0.277 −0.090
chispazo  −0.093 −0.060 −0.026 −0.193 +0.407 −0.293 +0.007 +0.040 −0.293 −0.060
```

El signo salta de ventana a ventana en los cuatro juegos. Eso no es una señal que se degrada: es ruido.

**Contra la baseline exacta**, con contraste formal:

| juego | Δ | SE | z | p |
|---|---|---|---|---|
| melate | +0.0638 | 0.0398 | +1.60 | 0.109 |
| revancha | −0.0529 | 0.0407 | −1.30 | 0.194 |
| retro | +0.0436 | 0.0502 | +0.87 | 0.385 |
| chispazo | −0.0562 | 0.0480 | −1.17 | 0.242 |

Ninguno alcanza significación ni sin corregir por comparaciones múltiples.

---

## 7 · Ablation

FULL contra FULL menos cada modelo, mismas 300 ventanas. Δ positivo = **el ensemble mejora al quitar ese modelo**.

| | mejor al quitarlo | peor al quitarlo |
|---|---|---|
| **melate** (FULL 0.7067) | pairLift +0.0167 · gapHazard +0.0100 | markov −0.0167 · hotStreak −0.0100 |
| **revancha** (FULL 0.5900) | positional +0.0433 · frequency +0.0400 | pairLift −0.0333 · gapHazard −0.0133 |
| **retro** (FULL 0.9667) | hotStreak +0.0267 · bayesian +0.0167 | markov −0.0533 · gaussian −0.0233 |
| **chispazo** (FULL 0.8367) | momentum +0.0067 · hotStreak +0.0067 | zonePressure −0.0267 · gaussian −0.0267 |

Lo que hay que leer aquí: **pairLift es el modelo más prescindible en Melate y el más valioso en Revancha**. `positional` ayuda en Melate y estorba en Revancha. Ningún modelo es consistentemente bueno o malo entre juegos. Las magnitudes (≤ 0.053 aciertos) están muy por debajo de la sd por sorteo (0.69–0.87).

**No se promovió ni degradó ningún modelo.** Los pesos del motor no se tocaron. Un challenger tendría que sobrevivir al escudo de la §11, y ninguno lo hace.

---

## 8 · AI vs Random

Cartera aleatoria reproducible, **seed 20260925**, mismas condiciones: `k` números del mismo rango, evaluados contra el mismo sorteo oficial. Contraste **pareado por sorteo** (el mismo resultado juzga a los dos) y control de Benjamini-Hochberg sobre los 4 juegos.

| juego | n | AI | random | Δ | SE | z | p | q (BH) | veredicto |
|---|---|---|---|---|---|---|---|---|---|
| melate | 300 | 0.7067 | 0.6533 | +0.0533 | 0.0535 | +1.00 | 0.319 | 0.426 | **AI ≈ RANDOM** |
| revancha | 300 | 0.5900 | 0.7000 | −0.1100 | 0.0595 | −1.85 | 0.064 | 0.258 | **AI ≈ RANDOM** |
| retro | 300 | 0.9667 | 0.9433 | +0.0233 | 0.0668 | +0.35 | 0.727 | 0.727 | **AI ≈ RANDOM** |
| chispazo | 300 | 0.8367 | 0.9233 | −0.0867 | 0.0679 | −1.28 | 0.202 | 0.404 | **AI ≈ RANDOM** |

**0 de 4.** Y dos detalles que confirman que esto es ruido y no una señal débil:

- El **signo se invierte entre juegos**: + en melate y retro, − en revancha y chispazo.
- El **signo se invierte con el tamaño de muestra**. En una corrida previa con n=150, retro dio **−0.0267**; con n=300 da **+0.0233**. Una ventaja real no cambia de signo al mirar más datos.

Si se hubiera reportado sólo melate con n=300 — el mejor caso — el titular habría sido "+8 % sobre el azar". **Eso es exactamente lo que este reporte no hace.**

---

## 9 · Calibration

Medida, no declarada. Para cada sorteo de test se tomó la probabilidad por número que produce `computeAllModels` entrenando sólo con los sorteos anteriores, y el resultado binario real. **120 sorteos por juego.**

| juego | pares | `k/N` real | media de la prob. predicha | método elegido |
|---|---|---|---|---|
| melate | 6 720 | 0.107143 | 0.017807 | **platt** |
| revancha | 6 720 | 0.107143 | 0.017807 | **platt** |
| retro | 4 680 | 0.153846 | 0.025539 | **platt** |
| chispazo | 3 360 | 0.178571 | 0.035514 | **platt** |

El motor está **mal calibrado de fábrica**: predice ~0.018 donde la tasa real es 0.107. La calibración lo arregla.

| juego | Brier raw | Brier calibrado | LogLoss raw | LogLoss calibrado | ECE raw | ECE calibrado |
|---|---|---|---|---|---|---|
| melate | 0.103636 | **0.095651** | 0.447696 | **0.340437** | 0.089336 | **0.000098** |
| revancha | 0.103645 | **0.095676** | 0.447887 | **0.340559** | 0.089336 | **0.001532** |
| retro | 0.146636 | **0.130176** | 0.586298 | **0.429312** | 0.128307 | **0.000007** |
| chispazo | 0.167137 | **0.146666** | 0.625787 | **0.469158** | 0.143058 | **0.000075** |

La selección de método se hace en una **partición temporal interna** (ajuste en el primer 70 %, elección por Brier en el 30 % final): nunca se elige el método con los mismos datos con que se ajustó. Los tres candidatos — raw, isotónica, Platt — se compararon de verdad; los primitivos estaban todos disponibles (`primitivesAvailable: true` en los cuatro juegos).

### Y aquí está el hallazgo que importa

Un predictor **constante** que asigna `k/N` a todos los números tiene Brier `p(1−p)`. Comparado con el ensemble calibrado:

| juego | Brier del constante `k/N` | Brier calibrado | diferencia |
|---|---|---|---|
| melate | 0.09566327 | 0.09565093 | **+0.00001234** |
| revancha | 0.09566327 | 0.09567552 | **−0.00001225** |
| retro | 0.13017751 | 0.13017615 | **+0.00000136** |
| chispazo | 0.14668367 | 0.14666624 | **+0.00001743** |

Lo mismo en LogLoss: diferencias de ±0.00006.

**Después de calibrar, el ensemble de 13 modelos no predice mejor que decir "cada número tiene probabilidad k/N".** La calibración corrigió la escala; no descubrió información. El signo se invierte en Revancha. Ésta es la demostración más limpia de NO_EDGE que se puede dar con estos datos.

---

## 10 · Edge status

| juego | estado | veredicto |
|---|---|---|
| melate | EDGE-1 | **NO_EDGE** |
| revancha | EDGE-0 | **NO_EDGE** |
| retro | EDGE-1 | **NO_EDGE** |
| chispazo | EDGE-0 | **NO_EDGE** |

EDGE-1 significa *señal débil o no reproducible*, y en este sistema **EDGE-0 y EDGE-1 son NO_EDGE**. Melate y Retro llegan a EDGE-1 porque su Δ contra la baseline es positivo en esta ventana; no llegan más lejos porque fallan estabilidad, holdout ciego, replicaciones y control de comparaciones múltiples.

En la app, con la memoria global de 5 observaciones, el banner muestra **EDGE-0** en los cinco juegos y explica en texto claro que no se encontró evidencia reproducible de ventaja predictiva, y que los boletos de abajo son **una cartera diversificada, no una predicción con ventaja demostrada**.

Requisitos de EDGE-3 (`EdgeDetector.REQUIREMENTS`): ≥ 5 ventanas, estabilidad ≥ 0.6, Δ > 0, q ≤ 0.05, Δ de holdout > 0, ≥ 2 replicaciones. Ninguno de los cuatro juegos los cumple.

---

## 11 · Anti-overfit

`AntiOverfitShield` devuelve **`REJECTED_POSSIBLE_OVERFITTING` en los cuatro juegos**. Lo que falla, por juego:

| control | melate | revancha | retro | chispazo |
|---|---|---|---|---|
| holdout ciego | ✗ | ✗ | ✗ | ✗ |
| walk-forward (≥5 ventanas) | ✓ | ✓ | ✓ | ✓ |
| sensibilidad a la seed | ✓ | ✓ | ✓ | ✓ |
| sensibilidad a hiperparámetros | ✗ | ✗ | ✗ | ✗ |
| baseline aleatorio | ✓ | ✗ | ✓ | ✗ |
| robustez temporal (≥60 % ventanas +) | ✓ | ✗ | ✓ | ✗ |
| control de comparaciones múltiples | ✗ | ✗ | ✗ | ✗ |
| auditoría de fuga | ✓ | ✓ | ✓ | ✓ |

Los dos ✓ que se aguantan en los cuatro son los que están garantizados por construcción: `mgWalkForward` entrena sólo con el pasado, y el ensemble es determinista.

---

## 12 · Global Brain

| | |
|---|---|
| observaciones oficiales | **5** — melate 4266, 4267, 4268 · retro 1669, 1670 |
| memorias | melate v1 · retro v1 |
| `model_stats` | 65 |
| **`failure_memory`** | **65 (nuevo)** |
| eventos de auditoría | 2 `MIGRATION` |
| registro de migración | 1 |
| registro oficial `melate_sorteos` | 3 824 filas |

**Identidad global:** `(game, official_contest_number)`. Nunca `state.draws.length`, nunca `target_draw` local, nunca `result_fingerprint`, nunca el timestamp del usuario.

**Idempotencia probada** en la Failure Memory: segunda ejecución con los mismos datos → **0 reinsertadas, 65 filas, `max(id)` intacto**.

**El navegador no escribe.** La Edge Function `collective-feedback` (ahora **v2**, `verify_jwt: true`) sigue siendo la única autoridad. Su paso nuevo 7b calcula **en el servidor** el desacuerdo por modelo y el bucket de consenso a partir del snapshot **sellado**; el cliente no los puede afirmar. Y ninguno de los dos mira el resultado oficial — cero fuga, comprobado en `tests_edge_v2.mjs` FM-11.

El diff de la Edge Function frente a la v1: **una sola línea eliminada**, y es la que se extendió con dos campos más de payload. Toda la lógica de verificación (SHA, registro oficial, `TEMPORAL_LEAK`, `FREEZE_HASH_MISMATCH`, bloqueo optimista) es idéntica byte a byte.

**Si la Failure Memory fallara al escribir, no tumba el aprendizaje global** — se registra el error en la respuesta y el feedback continúa. Es observabilidad; el aprendizaje es la operación con valor.

**4268 presente (1 fila) · 4288 ausente (0 filas).**

---

## 13 · RLS

| tabla | RLS | políticas | de escritura |
|---|---|---|---|
| `collective_global_draws` | ✓ | 1 SELECT | **0** |
| `collective_global_model_stats` | ✓ | 1 SELECT | **0** |
| `collective_global_state` | ✓ | 1 SELECT | **0** |
| `collective_global_events` | ✓ | 1 SELECT | **0** |
| `collective_global_migrations` | ✓ | 1 SELECT (dueño) | **0** |
| **`collective_global_failure_memory`** | **✓** | **1 SELECT** | **0** |

Probado de verdad, no asumido: un `INSERT` como rol `anon` y otro como `authenticated` sobre la tabla nueva → **ambos rechazados**. 65 filas antes, 65 después, **0 filas de intruso**.

La tabla no tiene columna `user_id` **por diseño**: son estadísticas del colectivo, sin identidad personal.

---

## 14 · Commit SHA

`1bac61c5e03e8be2a297e63fecc9361404c49216` — rama `feat/scientific-optimizer-v2`

## 15 · PR

[**#11 · feat: scientific optimizer v2 with portfolio, calibration and edge controls**](https://github.com/cachirulesfcmx-cpu/melate-genius/pull/11) — CI Vercel ✅, `mergeable_state: clean`, +732 / −0, 1 archivo.

## 16 · Merge SHA

`5fc62deea94f45ab2a76452f678a4a92812432a1` (squash a `main`)

## 17 · Deployment ID

`dpl_Hv3gWXwfvnXo8ft8CTuGAb7s41av` — **READY**, target production, commit `5fc62dee`

## 18 · Production URL

**https://melate-genius.vercel.app/**

**Huella servida:** 1 302 421 B · `598296957c0573472575f129427a7da19734125544789c976b828b7b28fbc6b9` — **idéntica a `origin/main`**.

---

## 19 · Smoke de producción — 56 PASS · 0 FAIL

Ejecutado contra el artefacto **descargado de producción**, no contra el repositorio.

**Capa V2 (29):** módulo `scientific-v2.0.0` cargado · los 9 subsistemas expuestos · el puente definido · los 7 primitivos originales siguen vivos (no duplicados) · evidencia coherente con `N` y `k` en los 5 juegos · EDGE-0/NO_EDGE en los 5 · la confianza declara que no es probabilidad de ganar · el escudo reporta lo que falta en vez de aprobar en falso · **el banner precede a los boletos en el DOM** · el banner nombra NO_EDGE · el dashboard está en Ajustes, cubre los 4 juegos y no se duplica al repintar · `generatePredictions` sigue produciendo la cartera con overlap ≤ 1 · el optimizador es determinista · **Tris sigue fuera del colectivo** · 0 errores JS propios.

**Regresión global (27):** colectivo disponible en Melate, Revancha, Retro y Chispazo · **oculto y bloqueado en Tris** · caso real de Retro reconciliado por la escalera **P1→P5** (2 aplicados por P3) · exportar es de sólo lectura y sin identidad personal · la validación clasifica los 5 estados · sello roto → INVALID · fuga temporal → INVALID · sin `model_picks` no se importa · sin concurso oficial no se importa · usuario nuevo arranca en 1/13 y recibe la memoria global · la generación usa la memoria **global** · el historial personal sigue siendo privado · la memoria global sobrevive a la recarga · sin conexión se usa la caché sin tocar el cerebro global · la memoria local no se borró.

### Regresiones encontradas

**Ninguna.**

---

## 20 · Pendientes

1. **Los 28 sorteos de `user_draws_backup_20260809`** siguen sin recuperar. No se tocaron en este PR, como se pidió. Tarea separada.

2. **`const sb = supabase.createClient(...)` está en el nivel superior** de su bloque `<script>` (línea ~11146). Si el CDN de jsDelivr no carga, esa línea lanza y **todo lo que viene después en ese bloque deja de ejecutarse**. Es **anterior a este PR** — se comprobó que el artefacto previo lanza la misma excepción, en el mismo punto, bajo las mismas condiciones. No se corrigió aquí porque toca el arranque de la app y está fuera del alcance de la V2. Es una línea; se arregla cuando quieras.

3. **Cuatro avisos del linter de seguridad de Supabase, todos previos a este PR** y ninguno introducido por la V2: dos vistas `SECURITY DEFINER` del subsistema de quinielas (`pg_view_rendimiento_equipos`, `pg_view_h2h`), la función `mg_user_hash` ejecutable por `anon`, y la protección de contraseñas filtradas desactivada en Auth.

4. **Para pasar de NO_EDGE a EDGE-2 harían falta**, como mínimo: un holdout ciego reservado antes de mirar nada, un barrido de hiperparámetros con su sensibilidad medida, control de FDR sobre las 14 hipótesis (13 modelos + ensemble) y al menos 2 replicaciones independientes. Con lo medido hoy, **no hay nada que promover**.

5. **La Failure Memory tiene 65 filas sin `prediction` ni `confidence_bucket`.** Se llenarán solas: cada sorteo nuevo que aportes desde el panel escribirá filas completas. No hay forma honesta de rellenar las viejas.

---

## Regla final

> Si no hay edge reproducible, escribir NO_EDGE.

**No lo hay. NO_EDGE en los cuatro juegos.**

El sistema ahora lo dice en voz alta: en el banner, antes de enseñar un solo boleto; en el dashboard de Ajustes; y en el veredicto del `EdgeDetector`. La lotería sigue siendo lotería. Lo que esta versión aporta no es ventaja — es **la capacidad de demostrar que no la hay**, y de detectarla si algún día apareciera.
