# MELATE GENIUS — PR #14 · Reporte final
## Automatic Future Holdout Sealing · cerrar PREDICT → SEAL

**Fecha:** 2026-09-25 · **Producción:** `c7d767874757d613897fd91137b15712b130f6b06bd15e99e5f1bf488157e3e2` (1 391 676 B)

---

## Baseline V4

Verificado sobre `main` antes de tocar nada, artefacto `bb5246dc43d45130…` (1 379 709 B), idéntico al servido:

| | |
|---|---|
| tests | **361 PASS · 0 FAIL** |
| candados | 21 funciones científicas y 5 datasets · **intactos** |
| Future Holdout | 26 filas — melate 4269…4280, retro 1671…1682, revancha y chispazo esperando identidad |
| Global Brain | 5 observaciones · 65 filas legado de Failure Memory · 4268 presente, 4288 ausente |
| veredicto | NO_EDGE / INSUFFICIENT_FUTURE_EVIDENCE |

---

## El problema que resuelve

El reporte de V4 lo dijo con todas las letras:

> **El sellado del snapshot todavía es manual.** La maquinaria existe y está probada, pero `generatePredictions()` todavía no está conectado automáticamente al Future Holdout.

Es decir: había una máquina de estados completa, un snapshot inmutable, guardianes en el cliente y en Postgres… y **nadie llamaba a nada**. Este PR conecta ese cable, y sólo ese.

---

## Archivos modificados

| archivo | qué cambió |
|---|---|
| `index.html` | +265 líneas, **−0**. De ellas, 248 son el bloque nuevo `MG_V4_SEAL`; **fuera del bloque, 17 líneas** — la llamada, su `try/catch` y su comentario |
| Edge Function **`future-seal`** | **nueva** · `verify_jwt` · ACTIVE · id `5e52545f-b16b-4a0c-bf77-07fdbfe36472` |
| `tests_v4_sealing.js` · `tests_v4_sealing_ui.mjs` | nuevas suites |

**Cero** cambios en el esquema de la base (la tabla y el trigger de V4 ya servían), **cero** en el motor científico, **cero** en el aprendizaje del Global Brain.

### Por qué una Edge Function nueva y no extender `collective-feedback`

El navegador **no puede** escribir `collective_future_holdout` — RLS con 0 políticas de escritura, por diseño de V4. El sellado tenía que pasar por el servidor. Se hizo una función **separada** para que el radio de daño de este PR no alcance la ruta de aprendizaje, que es la que mueve pesos. Es más archivos, pero menos riesgo: la §25 pide cambio mínimo, y «mínimo» aquí significa mínimo en superficie de impacto, no en número de ficheros.

---

## Flujo antes / después

**Antes:**

```
generatePredictions()
  → boletos
  → congelado colectivo (SHA local)
  → renderizar
                              ← el Future Holdout no se entera de nada
```

**Después:**

```
generatePredictions()
  → boletos
  → congelado colectivo (SHA local)
  → MG_V4_SEAL.seal()
       ├─ ¿este juego está reservado?          ← manifiesto sellado, no suposición
       ├─ action 'next'  → el SERVIDOR dice qué concurso toca   (sólo LEE)
       ├─ construir el snapshot PRE-DRAW de ESE concurso
       ├─ action 'seal'  → validar + RESERVED→PREDICTED→SEALED  (atómico)
       └─ SEALED  ó  FUTURE_PREDICTION_NOT_SEALED, dicho en pantalla
  → renderizar
```

### Cómo se resuelve el concurso oficial

El servidor devuelve el `official_contest_number` **más bajo todavía en `RESERVED`** para ese juego. Sale de la reserva sellada en el commit `c08940c`.

No se usa: índice local, posición de array, `first`, `last`, `localStorage`, `Date.now()`, número inferido ni número inventado.

El `target_draw` que la app usa internamente **es** un índice local (2162) y **no** es el concurso oficial (4269). El mapeo es explícito y lo hace el servidor, que es quien tiene la reserva.

### Dos llamadas, y por qué

El snapshot lleva el concurso dentro y el hash lo cubre, así que el cliente necesita saber el concurso **antes** de construirlo. `action: 'next'` se lo dice **sin tocar ningún estado**. La ventana entre las dos llamadas no abre ningún hueco: **la carrera la arbitra el `UPDATE ... WHERE state='RESERVED'`**, que es atómico. Si otro cliente gana, el segundo recibe `ALREADY_SEALED` — o `FUTURE_PREDICTION_NOT_SEALED` si el ganador no llegó a sellar.

### Sellado sólo en modo colectivo

Es donde nacen los pesos, `model_picks` y la memoria que el experimento evalúa. Sellar un boleto de modo «balanced» sería sellar algo que **no es el experimento**. En los demás modos se reporta `NO_COLLECTIVE_PREPARATION`, explícito y visible.

---

## Estados

Los mismos seis de V4. **No se creó una segunda máquina de estados**, ni un sistema paralelo:

```
RESERVED ──▶ PREDICTED ──▶ SEALED ──▶ RESULT_AVAILABLE ──▶ EVALUATED ──▶ RELEASED_TO_LEARNING
    └── PR #14 automatiza ESTE tramo ──┘
```

`AWAITING_OFFICIAL_IDENTITY` sigue fuera de la cadena, para revancha y chispazo.

### Los errores, todos reutilizados o nuevos sólo cuando hacía falta

| error | cuándo |
|---|---|
| `MISSING_OFFICIAL_IDENTITY` | el juego no tiene numeración oficial (ya existía en V4) |
| `RETROACTIVE_SEAL_FORBIDDEN` | el resultado oficial **ya** existe (nuevo, la §10 lo pedía) |
| `FUTURE_PREDICTION_NOT_SEALED` | el sellado falló (nuevo, la §9 lo pedía) |
| `PREDICTION_ALREADY_MUTATED` | el hash no cuadra (ya existía; **no se creó otro**) |
| `FUTURE_HOLDOUT_LEAK` | el snapshot PRE-DRAW trae algo del después (ya existía) |
| `NO_RESERVED_CONTEST` · `SNAPSHOT_INCOMPLETE` · `CONTEST_MISMATCH` · `NO_COLLECTIVE_PREPARATION` | nuevos, sin equivalente previo |

---

## Tests — 416 PASS · 0 FAIL

| suite | | |
|---|---|---|
| suites V1–V4 anteriores | sin cambios | 361 |
| **`tests_v4_sealing.js`** | los 20 obligatorios + 7 ataques + el ciclo completo | **29** |
| **`tests_v4_sealing_ui.mjs`** | PRE-DRAW, NOT SEALED, degradación, regresión | **26** |
| | | **416** |

### Los 20 obligatorios de la §18

Todos verdes. Los que más pesan:

- **S-05** · generar la predicción **no llama a `computeWeights` ni a `evolveWeights`** — se instrumentaron ambas y quedaron sin invocar
- **S-07 / S-08** · segunda llamada y dos llamadas **concurrentes** → 1 snapshot, 1 observación, el mismo hash
- **S-09** · si el sellado falla: no SEALED, no evidencia futura, no aprendizaje, y la fila no avanza
- **S-11** · el sellado sólo ocurre cuando **no** hay resultado oficial; cualquier resultado posterior lo es por construcción
- **S-20** · el snapshot queda atado a `(game, official_contest_number)`: cambiar el concurso o el juego cambia el hash, y el servidor rechaza un snapshot que no sea del concurso que toca

### Los 7 ataques de la §20

| ataque | resultado |
|---|---|
| A · resultado → snapshot | `RETROACTIVE_SEAL_FORBIDDEN` |
| B · resultado → aprendizaje sin evaluar | `LEARNING_BEFORE_EVALUATION` en los 4 estados previos |
| C · sellado → mutar pesos | `PREDICTION_ALREADY_MUTATED` |
| D · sellado → mutar la predicción | detectado en los **7 campos** probados |
| E · predicción duplicada | 3 llamadas → **1 sello** |
| F · concurso inventado (99999) | `CONTEST_MISMATCH`, fila intacta |
| G · retrosellado por la puerta de atrás | `RETROACTIVE_SEAL_FORBIDDEN` |

### El escenario de la §19, con Melate 4269

`SEALED` → resultado simulado → `RESULT_AVAILABLE` → `EVALUATED` → `RELEASED_TO_LEARNING`, comprobando en cada paso que el Global Brain **no** puede aprender antes de tiempo. Y lo importante:

> **El resultado simulado no modificó el snapshot PRE-DRAW.** Se comparó byte a byte antes y después, y el snapshot sigue verificando contra su propio hash.

### Lo que los tests encontraron

Un **defecto real, corregido antes de desplegar**: si la función perdía la carrera, devolvía `ALREADY_SEALED` **sin comprobar que el otro llamador hubiera llegado a `SEALED`**. Pudo quedarse en `PREDICTED`. Eso era un **éxito falso** — exactamente lo que la §9 prohíbe. Ahora lee el estado real y, si no está sellado, devuelve `FUTURE_PREDICTION_NOT_SEALED`.

---

## Ataque y seguridad

| | |
|---|---|
| RLS | 7 tablas globales, **0 políticas de escritura** — sin cambios |
| escrituras del navegador | ninguna, verificado por búsqueda en el artefacto (S-18) |
| `future-seal` | `verify_jwt: true`; sin token, 401 |
| snapshot | los 17 campos obligatorios; el cortafuegos de credenciales sigue lanzando `SNAPSHOT_WOULD_LEAK_SECRETS` |
| fuga PRE-DRAW | el servidor rechaza un snapshot que traiga `official_result`, `result`, `hits`, `evaluation`, `learning_state`, `hits_by_model` o `delta_vs_baseline` |
| paridad de hash | **9/9 cliente↔edge**, verificada **antes** de desplegar: si `canon`/`hashOf` divergieran, el servidor rechazaría snapshots legítimos |
| guardián del CDN | intacto; sin servidor el sellado reporta `SEAL_UNREACHABLE`, **no un falso sellado** |
| secretos en código | ninguno |

---

## Concurrencia

La deduplicación **no vive en la memoria del navegador**. Tiene tres capas, todas en la base:

1. `UNIQUE (game, official_contest_number, protocol_version)` — de V4
2. `UPDATE ... WHERE id = ? AND state = 'RESERVED'` — sólo un escritor la gana
3. el trigger `mg_v4_guard_state` — rechaza saltos, regresiones, mutación del snapshot sellado y liberación sin evaluación

Probado en tres formas: dos llamadas secuenciales (S-07), dos simultáneas con `Promise.all` (S-08) y tres seguidas (A-E). En los tres casos: **un sello**.

---

## Resultados

| | |
|---|---|
| future holdout | 26 filas · 24 `RESERVED` · 2 `AWAITING_OFFICIAL_IDENTITY` |
| **sellados** | **0** |
| liberados a aprendizaje | 0 |
| observaciones globales | 5 — sin cambios |
| Failure Memory legado | 65, sin rellenar |
| backup `20260809` | 29, sin tocar |
| 4268 / 4288 | presente / ausente |
| 4269 | **sin resultado oficial** — sigue siendo futuro |

**Cero sellados es el resultado correcto hoy**, y conviene entender por qué: sellar exige un usuario autenticado generando en modo colectivo desde la app. Este PR deja el cable puesto y probado; el primer sello real lo produce el primer uso.

---

## Hashes

| | |
|---|---|
| artefacto en producción | `c7d767874757d613897fd91137b15712b130f6b06bd15e99e5f1bf488157e3e2` |
| bytes | 1 391 676 — **idéntico a `origin/main`**, verificado descargándolo |
| reserva del holdout | `6b09dd241afc8d82` (commit `c08940c`) |
| Edge Function | `8f5e22389ad075ec3da023bc8e86b54fbb1d629b86bac7ff970e87fd0febf29c` |
| 21 funciones científicas | **mismo sha256, una a una** |
| 5 datasets | **byte a byte** |

---

## Commit · PR · Merge · Deployment

| | |
|---|---|
| **commit** | `2c617d43a23732dabef6414fa373f0801ef46615` |
| **PR** | [**#14 · feat: automatic future holdout sealing — cierra PREDICT → SEAL**](https://github.com/cachirulesfcmx-cpu/melate-genius/pull/14) — CI Vercel ✅ |
| **merge** | `4672b51f565c9d8d67d5bee0e47c56588e6fb21f` |
| **deployment** | `dpl_7LScoZu8kCt7txi5qZSUgy6rymCx` — **READY**, production |
| **URL** | https://melate-genius.vercel.app/ |

---

## Smoke de producción — 138 PASS · 0 FAIL

Contra el artefacto **descargado de producción**.

| suite | |
|---|---|
| `tests_v4_sealing_ui.mjs` | 26 |
| `tests_v4_ui.mjs` | 29 |
| `tests_v3_ui.mjs` | 27 |
| `tests_v2_ui.mjs` | 29 |
| `tests_global_ui.mjs` | 27 |
| **total** | **138 PASS · 0 FAIL** |

Candados sobre el artefacto servido: **todos intactos**.

Los 17 puntos de la §23: suite completa ✓ · suite de sellado ✓ · UI ✓ · desplegado ✓ · artefacto descargado ✓ · SHA256 calculado ✓ · coincide con `origin/main` ✓ · smoke contra lo descargado ✓ · Melate ✓ · Retro ✓ · Revancha ✓ · Chispazo ✓ · Future Holdout ✓ · Global Brain ✓ · CDN ✓ · RLS ✓ · **0 errores JS propios** ✓.

---

## Limitaciones

1. **Todavía no existe ningún sello real.** El cable está puesto y probado de punta a punta —en simulador con las mismas reglas del servidor, y en navegador, donde reporta correctamente `NOT_SEALED` sin servidor—, pero un sello real exige un usuario autenticado generando en modo colectivo. **Ninguna prueba automática puede producirlo**, y no se fabricó uno falso para que el reporte luciera mejor.
2. **Sólo se sella en modo colectivo.** Es una decisión, no una carencia: es el único modo donde existen los pesos que el experimento evalúa.
3. **Revancha y Chispazo siguen sin sellar nada**, porque siguen sin numeración oficial. El sistema lo dice con `MISSING_OFFICIAL_IDENTITY` antes incluso de llamar al servidor.
4. **La reserva es finita**: 12 concursos por juego. Cuando se agoten, `NO_RESERVED_CONTEST` y habrá que reservar más.
5. **El ciclo posterior al sello sigue siendo manual**: `RESULT_AVAILABLE → EVALUATED → RELEASED_TO_LEARNING`. PR #14 cerró `PREDICT → SEAL`, que era lo que pedía. El otro tramo es otro cable.

---

## Pendientes

1. **Cargar la numeración oficial de Revancha y Chispazo** en `melate_sorteos` — sigue bloqueando la mitad del holdout.
2. **Automatizar el tramo posterior al sello** (`RESULT → EVALUATE → LEARN`), cuando llegue el primer resultado oficial de un concurso sellado.
3. **Leaked password protection** — interruptor de Supabase Auth. Único BLOCKED, heredado de V3.
4. **Los 28 sorteos de `user_draws_backup_20260809`**, sin recuperar.
5. **Las 65 filas legado de Failure Memory**, sin `prediction` ni `confidence_bucket`. No se pueden rellenar sin inventarlas.
6. **Reservar más futuro** antes de agotar los 12 por juego.

---

## Veredicto científico

> # NO_EDGE / INSUFFICIENT_FUTURE_EVIDENCE

**Cero sorteos futuros evaluados.** Este PR **no cambia** el veredicto, y no debía cambiarlo: no toca el predictor, no toca pesos, no toca parámetros, no busca ventaja.

Lo que cambia es otra cosa, y es la que importa:

> A partir de ahora, cuando llegue un sorteo futuro, el sistema puede demostrar
> **«ésta era exactamente la información que tenía antes de conocer el resultado»** —
> con el snapshot sellado en el servidor, atado a `(juego, concurso oficial)`, con su
> hash, con su hora, y con un motor de base de datos que se niega a reescribir esa
> historia después.

El experimento ya puede correr solo. **A partir de aquí, dejarlo correr.**
