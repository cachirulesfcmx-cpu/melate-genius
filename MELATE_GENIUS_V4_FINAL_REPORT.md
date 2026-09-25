# MELATE GENIUS V4 — Reporte final
## Future Learning + Continuous Blind Validation + Scientific Preservation

**Fecha:** 2026-09-25 · **Producción:** `bb5246dc43d45130e935d1c6126cad1bf689fc353b2d619e2b9b167208c2b79f` (1 379 709 B)

---

## Objetivo

El holdout histórico de V3 está quemado. Lo único ciego que queda es **el futuro**.

V4 convierte Melate Genius en un sistema de aprendizaje científico continuo, con un ciclo que no se puede saltar:

```
PREDICT → SEAL → OBSERVE → EVALUATE → LEARN
```

Nunca `RESULTADO → AJUSTE → PREDICCIÓN DEL MISMO RESULTADO`.

V4 **no busca ventaja**. Construye el aparato que la detectaría si apareciera frente a datos realmente futuros — y que la rechaza si es una racha.

---

## Baseline V3

Verificado sobre `main` antes de tocar nada, artefacto `764a53e2cbecd33a…` (1 343 225 B), idéntico al que servía producción:

| | |
|---|---|
| tests | **302 PASS · 0 FAIL** |
| candados | 21 funciones científicas y 5 datasets con su hash · **intactos** |
| Global Brain | 5 observaciones · 65 filas de Failure Memory · 4268 presente, 4288 ausente |
| backup | 29 filas en `user_draws_backup_20260809`, sin tocar |
| Tris | fuera del colectivo |
| veredicto V3 | NO_EDGE en los cuatro juegos |

---

## Cambios

`MG_SCI_V4` — **`scientific-v4.0.0`**, protocolo **`mg-v4-future-1.0.0`**.

| componente | qué hace |
|---|---|
| **FutureHoldout** | máquina de 6 estados con tres guardianes: `selectionGuard`, `trainingGuard`, `learningGuard` |
| **Snapshot** | los 17 campos de la §3, con hash propio y un cortafuegos que **se niega a crear el snapshot** si detecta algo que parezca credencial |
| **Evaluation** | sólo corre con resultado oficial **verificado**; el azar se genera con la seed **sellada** en el snapshot, no con una nueva |
| **LearningGate** | tope duro de **0.01** de cambio de peso por evento, mínimo de 10 observaciones, renormalización y `projectCapFloor`. Reutiliza `computeWeights` |
| **StateSeparation** | `EVALUATION STATE` y `LEARNING STATE` son objetos distintos, con hash propio cada uno |
| **FutureEvidence** | los cuatro estados de la §9, con estabilidad futura **por bloques** |

Errores legibles, todos probados: `FUTURE_HOLDOUT_LEAK` · `RESULT_NOT_SEALED` · `PREDICTION_ALREADY_MUTATED` · `LEARNING_BEFORE_EVALUATION` · `INVALID_TRANSITION` · `DUPLICATE_CONTEST` · `MISSING_OFFICIAL_IDENTITY` · `OFFICIAL_RESULT_NOT_CONFIRMED` · `CONTEST_MISMATCH` · `DATASET_CHANGED` · `SNAPSHOT_WOULD_LEAK_SECRETS`.

### Archivos

| archivo | |
|---|---|
| `index.html` | +761 líneas, **−0**. Fuera del bloque V4, el diff son **dos líneas**: el contenedor del panel |
| `scientific/v4-future-holdout.json` | **nuevo** — la reserva sellada |
| `MELATE_GENIUS_V3_FINAL_REPORT.md` | incorporado: era la fuente de verdad de V4 y no estaba en `main` |
| Supabase | migración `v4_01_future_holdout` |

---

## Protocolo Future Holdout

La reserva se selló **en su propio commit, antes de que existiera una sola predicción**.

```
commit   c08940c63c971a4bb1f79766243d149e8120dccd
archivo  scientific/v4-future-holdout.json
hash     6b09dd241afc8d82
```

| juego | estado | concursos |
|---|---|---|
| **melate** | `RESERVED` ×12 | **4269 … 4280** |
| **retro** | `RESERVED` ×12 | **1671 … 1682** |
| revancha | `AWAITING_OFFICIAL_IDENTITY` | — |
| chispazo | `AWAITING_OFFICIAL_IDENTITY` | — |

Los números salen de `melate_sorteos` — `max(concurso)+1`, sucesión estricta. Melate va en **4268** (2026-09-20), Retro en **1670** (2026-09-19). No hay nada supuesto en ellos.

### La limitación que hay que decir

El registro oficial `melate_sorteos` contiene **3 824 filas de melate y retro, y cero de revancha y chispazo**. Lo comprobé antes de diseñar nada.

Esos dos juegos quedan reservados **sin número de concurso**, en `AWAITING_OFFICIAL_IDENTITY`. Se les puede predecir, pero **no** sellarles identidad oficial ni aprender de ellos hasta que el registro los ancle. La máquina de estados se niega explícitamente:

```
FutureHoldout.transition(revancha, 'PREDICTED')  →  MISSING_OFFICIAL_IDENTITY
FutureHoldout.learningGuard(revancha)            →  MISSING_OFFICIAL_IDENTITY
```

Inventar la numeración habría sido trivial y habría dejado el reporte más redondo. También habría roto la identidad canónica `(game, official_contest_number)`, que es exactamente lo que este protocolo existe para proteger.

Hay una segunda cosa que conviene saber: el `target_draw` que la app usa internamente es un **índice local** (2173 para Melate), no el concurso oficial (4268). Por eso V4 necesita el mapeo explícito del registro y no puede reutilizar lo que ya había.

---

## Esquema de estados

```
                                    ┌──────────────────────────────┐
  AWAITING_OFFICIAL_IDENTITY        │  sin numeración oficial:     │
  (revancha, chispazo)              │  no avanza, no aprende       │
                                    └──────────────────────────────┘

  RESERVED ──▶ PREDICTED ──▶ SEALED ──▶ RESULT_AVAILABLE ──▶ EVALUATED ──▶ RELEASED_TO_LEARNING
     │             │            │              │                 │                 │
     │             │            │              │                 │                 └─▶ el Global Brain
     │             │            │              │                 │                     puede aprender
     │             │            │              │                 └─ hits, baseline, delta, métricas
     │             │            │              └─ resultado oficial VERIFICADO, por separado
     │             │            └─ snapshot inmutable: a partir de aquí no se toca
     │             └─ predicción generada con lo que se sabía
     └─ el sorteo todavía no ha ocurrido

  selectionGuard / trainingGuard  →  sólo pasan en RELEASED_TO_LEARNING
  learningGuard                   →  sólo pasa desde EVALUATED
```

### Los guardianes viven también en la base de datos

Tabla `collective_future_holdout`: RLS ON, 1 política SELECT, **0 de escritura**, y un trigger que hace del orden temporal una regla del motor. Probado **contra la base real**, no asumido:

| intento | resultado |
|---|---|
| saltar `RESERVED` → `RELEASED_TO_LEARNING` | `INVALID_TRANSITION` |
| llegar a `RESULT_AVAILABLE` sin snapshot sellado | `RESULT_NOT_SEALED` |
| mutar el snapshot ya **SELLADO** | `PREDICTION_ALREADY_MUTATED` |
| `SEALED` → `EVALUATED` saltándose el resultado | `INVALID_TRANSITION` |
| liberar a aprendizaje **sin** evaluación | `LEARNING_BEFORE_EVALUATION` |
| liberar **con** evaluación | **PERMITIDO** ✓ |
| retroceder de `RELEASED_TO_LEARNING` a `RESERVED` | `FUTURE_HOLDOUT_STATE_REGRESSION` |

Un cliente comprometido no puede saltarse el orden ni aunque tuviera permisos de escritura. No los tiene.

---

## Tests — 361 PASS · 0 FAIL

| suite | | |
|---|---|---|
| `tests.js` · `tests_multi.js` · `tests_hotfix.js` | colectivo, multi-juego, sin fuga retroactiva | 27+27+27 |
| `tests_pr9.js` | escalera P1→P5 | 22 |
| `tests_edge_parity.mjs` · `tests_edge_v2.mjs` | paridad cliente↔edge, Failure Memory server-side | 8+16 |
| `tests_global_ui.mjs` | navegador: Tris fuera, export/import, memoria global | 27 |
| `tests_v2.js` · `tests_v2_ui.mjs` | los 9 módulos V2 + navegador | 45+29 |
| `tests_v3.js` · `tests_v3_ui.mjs` | los 7 componentes V3 + CDN presente/ausente | 47+27 |
| **`tests_v4.js`** | **los 18 obligatorios + el ciclo + los 4 estados** | **30** |
| **`tests_v4_ui.mjs`** | **PRE/POST-DRAW, evidencia futura, inmutabilidad** | **29** |
| | | **361** |

### Los 18 obligatorios de la §15

Todos verdes. Los que más importan:

- **V4-02** · un resultado futuro no puede entrenar antes de la evaluación — probado en los cuatro estados previos
- **V4-03** · mover un solo peso dentro de un snapshot sellado lo delata con `PREDICTION_ALREADY_MUTATED`
- **V4-06** · el `POST_DRAW` no arrastra al `PRE_DRAW`: son copias, y tocar el PRE después se detecta
- **V4-08** · cinco usuarios aportando el mismo sorteo → **una** observación
- **V4-09** · un intento de winner-take-all (un peso a 0.90) se recorta a **0.01 de cambio**, suma 1.0 exacta
- **V4-18** · el snapshot **se niega a nacer** con una `api_key` dentro

### Lo que estos tests encontraron

Tres cosas, y las tres eran **mis tests**, no el código:

- **V4-16** casaba con el *comentario* del guardián de Supabase, que cita la línea vieja para explicar qué arregla. Reescrito para mirar código ejecutable, no prosa.
- **V4-22** esperaba una redacción del mensaje que no era la real.
- La prueba SQL de los guardianes tenía el rollback mal entendido: el fallo del paso 2 devolvía la fila a `RESERVED`, así que los pasos 4 y 6 probaban desde el estado equivocado y daban un falso «PASÓ (mal)». Rehecha dirigiendo la máquina paso a paso, con fila dedicada.

**BUILD:** no aplica — un solo `index.html`, sin bundler ni `package.json`.

---

## Seguridad

| | |
|---|---|
| RLS | **7 tablas globales**, todas con RLS · **0 políticas de escritura** |
| navegador | no escribe en ninguna tabla global — verificado por búsqueda en el artefacto (V4-17) |
| Edge Function | `collective-feedback` sigue siendo la autoridad, con `verify_jwt` |
| guardián del CDN | intacto y **antes** de usarse; la línea sin guardián no volvió (V4-16) |
| secretos | la reserva no contiene ninguno; el snapshot se niega a crearse con uno |
| mínimo privilegio | `security_invoker` en las vistas y `mg_user_hash` restringido, de V3, intactos |

### BLOCKED

**Leaked password protection** de Supabase Auth sigue desactivada. Es un interruptor del panel, no código, y no hay forma de tocarlo desde aquí: **Supabase Dashboard → Authentication → Providers → Email → «Prevent use of leaked passwords»**. Es el mismo pendiente de V3 y sigue siendo el único.

---

## Resultados

| juego | estado de evidencia futura | sorteos futuros evaluados |
|---|---|---|
| melate | `INSUFFICIENT_FUTURE_EVIDENCE` | **0** de 30 |
| revancha | `INSUFFICIENT_FUTURE_EVIDENCE` | **0** de 30 |
| retro | `INSUFFICIENT_FUTURE_EVIDENCE` | **0** de 30 |
| chispazo | `INSUFFICIENT_FUTURE_EVIDENCE` | **0** de 30 |

Cero. Es lo correcto: la reserva se selló hoy y el primer sorteo reservado (Melate 4269) todavía no ha ocurrido. **No hay nada que evaluar, y por tanto nada que afirmar.**

Los umbrales están declarados en el código, no se decidirán después de ver los datos:

```
MIN_FUTURE_DRAWS      30   por debajo → INSUFFICIENT_FUTURE_EVIDENCE
MIN_FUTURE_STABILITY  0.6  fracción de bloques futuros por encima del azar
MIN_CONFIRM_DRAWS     60   para EDGE_CONFIRMED
p ≤ 0.05                   sobre la serie acumulada, nunca sobre un sorteo
```

### Una racha no es una ventaja

Probado con series sintéticas, para que el comportamiento esté fijado antes de que lleguen datos reales:

| escenario | estado | ¿es edge? |
|---|---|---|
| 8 sorteos, **todos** positivos, ventaja grande | `INSUFFICIENT_FUTURE_EVIDENCE` | **no** |
| 40 sorteos sin ventaja | `NO_EDGE` | no |
| 40 sorteos con ventaja sostenida | `EDGE_CANDIDATE` | **no** — candidato no es confirmado |
| 70 sorteos con ventaja sostenida | `EDGE_CONFIRMED` | sí |
| media positiva concentrada en **un solo bloque** | `NO_EDGE` | no — falla por estabilidad |

---

## Limitaciones

1. **Revancha y Chispazo no tienen identidad oficial.** El registro no los contiene. Quedan reservados sin número y no pueden sellar ni aprender hasta que alguien cargue su numeración. Es la limitación más importante de V4 y no tiene arreglo desde aquí.
2. **El holdout futuro es finito**: 12 sorteos por juego, unas cuatro semanas. Cuando se agoten hay que reservar más — el protocolo lo permite, pero no se renueva solo.
3. **Con 12 sorteos no se llega a 30.** Ni siquiera agotando la reserva actual habrá muestra para salir de `INSUFFICIENT_FUTURE_EVIDENCE`. Hacen falta al menos tres tandas.
4. **El sellado todavía es manual.** V4 construye la maquinaria y la reserva; enganchar la generación de predicciones para que selle automáticamente cada snapshot al predecir es el paso siguiente, y no estaba en el alcance de este PR.
5. **`p` y `q` no se calculan sobre un sorteo.** La evaluación individual los deja en `null` con su nota; sólo tienen sentido sobre la serie acumulada.

---

## Hash del artefacto

**`bb5246dc43d45130e935d1c6126cad1bf689fc353b2d619e2b9b167208c2b79f`** · 1 379 709 B — verificado **descargando el artefacto real de producción** y comparándolo con `origin/main`. Coinciden.

## Commit

`b697ebb6921f62f04c56c5cdc5408c8379c19345`, precedido por la reserva:

```
c08940c  chore(v4): reservar el FUTURE HOLDOUT antes de que exista una predicción
b697ebb  feat: v4 future learning, continuous blind validation and scientific preservation
```

## PR

[**#13 · feat: v4 future learning, continuous blind validation and scientific preservation**](https://github.com/cachirulesfcmx-cpu/melate-genius/pull/13) — CI Vercel ✅ · merge SHA `3106492f527713a394c2d21dfd273facbdc5d859`

## Deployment

`dpl_AWUt3SuFCW5odwiSirtL9fmqJo4X` — **READY**, target production, commit `3106492f`

**URL:** https://melate-genius.vercel.app/

---

## Smoke de producción — 112 PASS · 0 FAIL

Contra el artefacto **descargado de producción**, no contra el repositorio.

| suite | |
|---|---|
| `tests_v4_ui.mjs` | 29 |
| `tests_v3_ui.mjs` | 27 |
| `tests_v2_ui.mjs` | 29 |
| `tests_global_ui.mjs` | 27 |
| **total** | **112 PASS · 0 FAIL** |

Candados sobre el artefacto servido: **todos intactos**.

Los catorce puntos de la §16: artefacto descargado ✓ · SHA256 calculado ✓ · coincide con `origin/main` ✓ · suite completa ✓ · smoke real ✓ · los cuatro juegos ✓ · Global Brain ✓ · Future Holdout ✓ · NO_EDGE ✓ · Portfolio Intelligence ✓ · guardián del CDN ✓ · seguridad ✓ · **0 errores JS propios** ✓.

### Regresiones

**Ninguna.**

---

## Pendientes

1. **Cargar la numeración oficial de Revancha y Chispazo** en `melate_sorteos`. Sin eso, la mitad del Future Holdout está bloqueada.
2. **Enganchar el sellado automático**: que cada `generatePredictions` cree y selle el snapshot V4 del concurso reservado correspondiente. La maquinaria está; falta el cable.
3. **Leaked password protection** — el interruptor de Auth. Único BLOCKED, heredado de V3.
4. **Los 28 sorteos de `user_draws_backup_20260809`**, sin recuperar. No se tocaron, como se pidió.
5. **Las 65 filas legado de Failure Memory** siguen sin `prediction` ni `confidence_bucket`. No se pueden rellenar sin inventarlas.
6. **Reservar más futuro** cuando se agoten los 12 por juego.

---

## Veredicto científico

> # NO_EDGE / INSUFFICIENT_FUTURE_EVIDENCE
>
> en Melate, Revancha, Retro y Chispazo.

**Cero sorteos futuros evaluados.** No es un fallo: es dónde empieza un protocolo que acaba de reservar el futuro esta misma noche.

Y conviene decirlo con precisión, porque las dos frases no significan lo mismo:

- **NO_EDGE** — se miró y no hay ventaja sostenida. Es lo que dijeron V2 y V3 sobre el histórico, con holdout ciego, FDR, sensibilidad y replicaciones.
- **INSUFFICIENT_FUTURE_EVIDENCE** — todavía **no se puede saber**, porque el futuro reservado aún no ha ocurrido. No dice que haya ventaja. No dice que no la haya.

La app lo muestra así, con esas palabras, antes de enseñar un solo boleto.

**SUCCESS de implementación no significa EDGE.** Lo que V4 entrega es la capacidad de responder la pregunta cuando los datos existan — y la garantía, en el código y en el motor de la base de datos, de que nadie podrá responderla mirando primero el resultado.
