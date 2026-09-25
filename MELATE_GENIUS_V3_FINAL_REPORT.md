# MELATE GENIUS V3 — Reporte final
## Hardening + Blind Validation + Portfolio Intelligence

**Fecha:** 2026-09-25 · **Producción:** `764a53e2cbecd33a3834294a433e2b97eed3fb26d9824ac4cc3c4bb4ba05fc8b` (1 343 225 B)

---

## 1 · SUCCESS / BLOCKED

# **SUCCESS** · con un punto BLOCKED declarado

Todo lo pedido está implementado, probado y desplegado. **302 tests PASS · 0 FAIL.** Smoke de producción **83 PASS · 0 FAIL** contra el artefacto realmente servido.

El único BLOCKED es el aviso de *leaked password protection* de Supabase Auth: es un ajuste del panel de Auth, no SQL, y no hay forma de tocarlo desde aquí. Detalle en §12.

El objetivo de V3 no era encontrar ventaja. Era hacer la conclusión más difícil de tumbar. Y el protocolo hizo justo eso: **atrapó un falso positivo que un reporte descuidado habría publicado como titular**.

> El barrido sobre DEV prometía **+0.1338** en Melate. Se preinscribió la predicción, se abrieron las replicaciones y el holdout ciego, y se derrumbó. **NO_EDGE en los cuatro juegos**, ahora sostenido por holdout ciego, control de FDR, sensibilidad y dos replicaciones.

---

## 2 · Baseline V2

Verificado sobre `main` antes de tocar nada, artefacto `598296957c…` (1 302 421 B), idéntico al que servía producción:

| suite | |
|---|---|
| `tests.js` · `tests_multi.js` · `tests_hotfix.js` | 27 + 27 + 27 |
| `tests_pr9.js` · `tests_edge_parity.mjs` · `tests_edge_v2.mjs` | 22 + 8 + 16 |
| `tests_global_ui.mjs` · `tests_v2.js` · `tests_v2_ui.mjs` | 27 + 45 + 29 |
| **total** | **228 PASS · 0 FAIL** |

Y el estado que V3 recibió: 5 observaciones globales (melate 4266/4267/4268, retro 1669/1670), 65 filas de Failure Memory, 4268 presente, 4288 ausente, 29 filas en `user_draws_backup_20260809`, Tris bloqueado, las 21 funciones científicas y los 5 datasets con su hash.

---

## 3 · Holdout ciego · manifiesto y hash

La reserva se selló **en su propio commit, antes de correr un solo barrido**. Ése es el punto: no es una promesa, es un objeto con fecha en el historial de git.

```
commit   88ecb4dd42da0104ca00b1aa3cdf52f7df01bd66
archivo  scientific/v3-holdout-manifest.json
```

| | |
|---|---|
| `protocol_version` | `mg-v3-blind-1.0.0` |
| `reserved_at` | 2026-09-25T00:00:00Z |
| `artifact_sha256` | `598296957c0573472575f129427a7da19734125544789c976b828b7b28fbc6b9` |
| **`manifest_hash`** | **`000d987cda90c3b9891fe62cc975270949ebc7ab098725b87d878885a5f0f7e7`** |

Cinco bloques disjuntos de 300 sorteos por juego, contados desde el final del histórico:

| bloque | uso | melate | revancha | retro | chispazo |
|---|---|---|---|---|---|
| `BURNED_V2` | quemado por V2 · **excluido** | [1862, 2162) | [1879, 2179) | [1357, 1657) | [10370, 10670) |
| `DEV` | **único** donde se ajusta y se selecciona | [1562, 1862) | [1579, 1879) | [1057, 1357) | [10070, 10370) |
| `HOLDOUT` | **CIEGO** · se abre una vez | [1262, 1562) | [1279, 1579) | [757, 1057) | [9770, 10070) |
| `REP1` | replicación 1 · seed 101 | [962, 1262) | [979, 1279) | [457, 757) | [9470, 9770) |
| `REP2` | replicación 2 · seed 202 | [662, 962) | [679, 979) | [157, 457) | [9170, 9470) |

Cada bloque lleva su propio `manifest_hash` y el `dataset_hash` del juego. `BlindHoldout.verify()` detecta tanto un manifiesto alterado (`MANIFEST_TAMPERED`) como un dataset cambiado bajo sus pies (`DATASET_CHANGED`).

El módulo no sólo documenta la regla: **se niega a romperla**. `selectionGuard('HOLDOUT', 'SELECTION')` lanza, y `selectionGuard('BURNED_V2', …)` lanza siempre.

### Limitación, declarada y no disimulada

El bloque más reciente de cada juego **ya se midió en V2**, así que no puede ser ciego. El HOLDOUT es un bloque **anterior** y disjunto: prueba **reproducibilidad en otra época del histórico**, no rendimiento futuro. Está escrito en el propio manifiesto, en el campo `limitation`, desde antes de abrirlo.

Cero fuga en todos los casos: `mgWalkForward` entrena en cada paso `t` sólo con `draws[max(0, t−lookback) … t)`.

### Preinscripción

Después del barrido sobre DEV y **antes** de abrir REP1, REP2 y HOLDOUT:

```
commit   194bbcf
archivo  scientific/v3-preregistration.json
hash     1d76f15d96a3f9f7cf3cff699a84d020be2d0f489518b67be9355406ed5291da
```

Registra las dos configuraciones a probar, la predicción explícita (*si la mejora de Melate fuera real debe reaparecer con el mismo signo; si es sobreajuste, se encogerá o cambiará de signo*) y la **regla de no promoción**: pase lo que pase, ningún hiperparámetro se promueve en este PR.

---

## 4 · Sensibilidad a hiperparámetros

Rejilla **congelada** de 12 configuraciones: `maxTrainDraws` ∈ {400, 800, 1500, 3000} × `stabilityBlocks` ∈ {4, 6, 10}. Sólo mueve el protocolo de medición. **No toca pesos, FLOOR, CAP ni shrinkage** — hay un test que lo verifica (`SE-02`).

Medida **sólo sobre DEV**:

| juego | media Δ | sd | min | max | rango | positivas | veredicto |
|---|---|---|---|---|---|---|---|
| melate | +0.0563 | 0.0593 | −0.0029 | **+0.1338** | 0.1367 | 9/12 | **POSSIBLE_OVERFITTING** |
| revancha | −0.0529 | 0.0252 | −0.0929 | −0.0295 | 0.0633 | 0/12 | **POSSIBLE_OVERFITTING** |
| retro | +0.0094 | 0.0484 | −0.0497 | +0.0803 | 0.1300 | 9/12 | **POSSIBLE_OVERFITTING** |
| chispazo | −0.0087 | 0.0374 | −0.0695 | +0.0205 | 0.0900 | 9/12 | **POSSIBLE_OVERFITTING** |

Melate, desglosado, es el caso instructivo:

```
lookback  400  → Δ +0.1338      lookback 1500 → Δ +0.0071
lookback  800  → Δ +0.0871      lookback 3000 → Δ −0.0029
```

El efecto no es una propiedad del modelo: es una propiedad de cuánta historia le des. **Los cuatro juegos fallan** por al menos una de estas razones: el signo cambia dentro de la rejilla, la dispersión entre configuraciones supera al efecto medio, o no todas las configuraciones son positivas.

**Ningún parámetro se promovió a producción.** El barrido mide fragilidad; no busca la mejor celda.

---

## 5 · Las 14 hipótesis y Benjamini-Hochberg

Congeladas antes de medir: 13 modelos + ensemble, por juego. Evaluadas sobre el **holdout ciego**, configuración de producción, contra la baseline exacta `k²/N`.

| juego | `frozen_hash` | q mínima | significativas | veredicto |
|---|---|---|---|---|
| melate | `1a4a1e7b…` | 0.9910 | 0/14 | NO_SIGNIFICANT_AFTER_FDR |
| revancha | (ver estudio) | 0.9487 | 0/14 | NO_SIGNIFICANT_AFTER_FDR |
| **retro** | `93b5487f3e6114d7` | **0.0487** | **4/14** | FDR_SIGNIFICANT |
| chispazo | `ddd11f672ecb528f` | 0.4280 | 0/14 | NO_SIGNIFICANT_AFTER_FDR |

Una hipótesis que no se midió **cuenta como no significativa**; no se omite. Omitirla sería seleccionar después de ver resultados, y hay un test que lo fija (`FD-05`).

### Retro sacó cuatro. No se enterraron ni se inflaron.

```
cooccurrence  Δ +0.1236   p 0.0117   q 0.0487  ◄
markov        Δ +0.1236   p 0.0117   q 0.0487  ◄
delta         Δ −0.1131   p 0.0136   q 0.0487  ◄
frequency     Δ +0.1203   p 0.0139   q 0.0487  ◄
ENSEMBLE      Δ +0.0769   p 0.1204   q 0.2407     (no significativa)
```

Tres cosas que hay que decir sobre esto, y ninguna es cómoda:

1. **`delta` es significativa con efecto NEGATIVO** (−0.1131). Que también salga la cola izquierda, con 14 contrastes de dos colas sobre un bloque, es exactamente lo que produce el ruido — no una señal.
2. **q = 0.0487 está pegado al umbral.** Con 14 tests, eso es el borde, no un resultado robusto.
3. **El ensemble no llega** (q = 0.2407). Lo que la app usa para generar boletos no es significativo.

Y la prueba definitiva, la que manda el protocolo: **replicación**.

| modelo | HOLDOUT Δ | REP1 Δ | REP2 Δ | DEV Δ | ¿replica? |
|---|---|---|---|---|---|
| cooccurrence | +0.1236 | −0.0364 | +0.0003 | +0.0203 | **NO** (1/2) |
| markov | +0.1236 | −0.0797 | −0.0364 | −0.0264 | **NO** (0/2) |
| delta | −0.1131 | −0.0264 | +0.0103 | −0.0531 | **NO** (1/2) |
| frequency | +0.1203 | −0.0297 | +0.0003 | +0.0203 | **NO** (1/2) |

**Ninguna de las cuatro sobrevive a las dos replicaciones.** La regla preinscrita se cumple sin excepción: NO_EDGE.

---

## 6 · Replicación 1

Bloque `REP1`, seed **101**, configuración de producción (lookback 1500, bloques 6), 300 sorteos por juego.

| juego | rango | Δ vs baseline |
|---|---|---|
| melate | [962, 1262) | −0.0462 |
| revancha | [979, 1279) | +0.0171 |
| retro | [457, 757) | −0.0697 |
| chispazo | [9470, 9770) | −0.0195 |

Con la configuración que DEV habría elegido (lookback 400): melate **−0.0595**, revancha −0.0595, retro −0.0197, chispazo +0.0471.

---

## 7 · Replicación 2

Bloque `REP2`, seed **202**, misma configuración, 300 sorteos por juego.

| juego | rango | Δ vs baseline |
|---|---|---|
| melate | [662, 962) | +0.0105 |
| revancha | [679, 979) | +0.0071 |
| retro | [157, 457) | −0.0197 |
| chispazo | [9170, 9470) | −0.0395 |

Con lookback 400: melate **−0.0562**, revancha −0.0362, retro +0.0103, chispazo +0.0405.

### Supervivencia

| juego | config | REP1 | REP2 | mismo signo | ¿sobrevive? |
|---|---|---|---|---|---|
| melate | PROD | −0.0462 | +0.0105 | **no** | no |
| melate | DEV_SELECTED | −0.0595 | −0.0562 | sí (negativo) | no |
| revancha | PROD | +0.0171 | +0.0071 | sí | **sí** |
| revancha | DEV_SELECTED | −0.0595 | −0.0362 | sí (negativo) | no |
| retro | PROD | −0.0697 | −0.0197 | sí (negativo) | no |
| retro | DEV_SELECTED | −0.0197 | +0.0103 | **no** | no |
| chispazo | PROD | −0.0195 | −0.0395 | sí (negativo) | no |
| chispazo | DEV_SELECTED | +0.0471 | +0.0405 | sí | **sí** |

Sólo dos combinaciones sobreviven a las replicaciones, y ninguna de las dos pasa después el resto de condiciones de EDGE-2.

### El derrumbe, en una tabla

Ésta es la que resume V3:

| juego | config | DEV Δ | REP1 Δ | REP2 Δ | HOLDOUT Δ |
|---|---|---|---|---|---|
| **melate** | **DEV_SELECTED** | **+0.1338** | **−0.0595** | **−0.0562** | **+0.0338** |
| melate | PROD | +0.0071 | −0.0462 | +0.0105 | +0.0105 |
| revancha | PROD | −0.0929 | +0.0171 | +0.0071 | +0.0171 |
| retro | PROD | +0.0036 | −0.0697 | −0.0197 | +0.0769 |
| chispazo | PROD | +0.0005 | −0.0195 | −0.0395 | −0.0029 |

La fila de arriba es la predicción preinscrita cumpliéndose delante de la cámara.

---

## 8 · Edge Detector 2.1

EDGE-2 ahora exige **las cinco condiciones a la vez**: holdout ciego positivo · q ≤ 0.05 tras BH · sensibilidad estable · 2 replicaciones positivas · dirección consistente. EDGE-3 añade ≥ 5 ventanas, estabilidad ≥ 0.6, superar al azar, control de comparaciones múltiples y evidencia fuera de muestra repetida.

Un test (`ED-02`) quita **una sola** de las cinco, una por una, y comprueba que las cinco veces cae a NO_EDGE. Otro (`ED-05`) comprueba que una q **ausente** no se trata como favorable.

| juego | estado | veredicto | qué falta para EDGE-2 |
|---|---|---|---|
| **melate** | EDGE-1 | **NO_EDGE** | q ≤ 0.05 (0.991) · sensibilidad · 2 replicaciones (1) · dirección consistente |
| **revancha** | EDGE-1 | **NO_EDGE** | q ≤ 0.05 (0.949) · sensibilidad |
| **retro** | EDGE-1 | **NO_EDGE** | q ≤ 0.05 (0.241) · sensibilidad · 2 replicaciones (0) |
| **chispazo** | EDGE-0 | **NO_EDGE** | holdout positivo · q ≤ 0.05 (0.949) · sensibilidad · 2 replicaciones (0) |

La app muestra este veredicto, no el de V2: el banner lee el estudio congelado que viaja en el artefacto (`scientific/v3-study-results.json`) y lo pasa por el EdgeDetector 2.1 en el navegador.

---

## 9 · Portfolio Intelligence

Mantiene el objetivo de **cartera, no boleto ganador**, y no reimplementa nada: llama al optimizador de V2 y lo declara en `optimizerVersion` (test `X-02`).

Lo que añade V3 es un candado:

```js
// La evidencia de salida es, byte a byte, la de entrada.
evidenceUnchanged: canon(evidenciaSalida) === canon(evidenciaEntrada)
```

- `PI-01` · la evidencia entra y sale igual
- `PI-02` · un `portfolioScore` altísimo (todos los scores calibrados a 0.99, incertidumbre 0, consenso 1) **no asciende** la evidencia: sigue EDGE-0 / NO_EDGE
- `PI-03` · con NO_EDGE la descripción dice *«cartera diversificada sin ventaja demostrada»* y *«no mejora las probabilidades matemáticas»*, con `isWinProbability: false`
- `PI-04` · `overlapLimit` 1 por defecto y respetado, con la relajación declarada cuando el pool no alcanza
- `PI-05` · determinista con la misma seed
- `PI-06` · **sin evidencia declarada asume NO_EDGE**, no lo contrario

---

## 10 · AI vs Random

Cartera aleatoria reproducible, **pareada por sorteo** (el mismo resultado oficial juzga a los dos), sobre el **holdout ciego**, con Benjamini-Hochberg entre los cuatro juegos.

| juego | n | AI | azar | Δ | SE | z | p | **q (BH)** | veredicto |
|---|---|---|---|---|---|---|---|---|---|
| melate | 300 | 0.6533 | 0.6833 | −0.0300 | 0.0602 | −0.50 | 0.618 | 0.912 | **AI ≈ RANDOM** |
| revancha | 300 | 0.6600 | 0.6667 | −0.0067 | 0.0601 | −0.11 | 0.912 | 0.912 | **AI ≈ RANDOM** |
| retro | 300 | 1.0000 | 0.8600 | +0.1400 | 0.0708 | +1.98 | **0.048** | **0.192** | **AI ≈ RANDOM** |
| chispazo | 300 | 0.8900 | 0.9133 | −0.0233 | 0.0641 | −0.36 | 0.716 | 0.912 | **AI ≈ RANDOM** |

**0 de 4 distinguibles.** Retro es el ejemplo de por qué esto importa: p = 0.048 sin corregir parecería «ganamos». Con cuatro juegos sobre la mesa, q = 0.192.

Durante esta fase se encontró y corrigió **un defecto real en el propio módulo V3**: si la varianza de las diferencias era exactamente cero, el contraste devolvía `z = 0` y por tanto `p = 1` — es decir, una ventaja enorme y perfectamente constante se habría reportado como «sin diferencia». Es la forma más peligrosa de equivocarse, porque **oculta** un efecto real. Corregido: el caso degenerado ahora devuelve `p = 0` con la bandera `degenerate` y su explicación. Se comprobó que ninguno de los cuatro contrastes del estudio era degenerado (`se` entre 0.060 y 0.071), así que **las cifras publicadas no cambian**.

---

## 11 · CDN hardening

El pendiente que arrastrábamos desde antes de V2:

```js
// antes — en el nivel superior del bloque <script>
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

Si jsDelivr no cargaba, esa línea lanzaba y **todo lo que venía después en ese bloque dejaba de existir**: `handleSignup`, `handleLogin`, `enterApp`, el ledger personal. La app quedaba muerta por un recurso de terceros.

```js
// ahora
const sb = MG_SUPABASE_GUARD.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

El guardián comprueba la dependencia antes de usarla y, si no está, devuelve un cliente degradado construido con cadenas *thenable*: `sb.from('x').select().eq().single()` resuelve a `{ data: null, error: { code: 'SUPABASE_UNAVAILABLE' } }` en vez de lanzar. Misma forma que el resto del código ya maneja.

Probado en los dos escenarios sobre el mismo artefacto — el glob `**cdn.jsdelivr.net**` de Playwright **no casaba** con la URL real, así que el escenario «CDN presente» era un falso positivo; se cambió a regex y se verificó la intercepción:

| | CDN presente | CDN caído |
|---|---|---|
| guardián | disponible | degradado, con motivo |
| `sb` | cliente real | cliente degradado |
| `enterApp` / `handleSignup` | ✓ | **✓ sobreviven** |
| motor científico + V2 + V3 | ✓ | ✓ |
| generar boletos | ✓ | **✓ 3 boletos de 6** |
| aviso al usuario | no procede | ✓ sin filtrar URL ni claves |
| llamadas que lanzan | — | **0 de 6** |
| **excepciones JS** | **0** | **0** (antes: 1) |

El aviso dice lo justo: *«Modo sin conexión a la cuenta: no se pudo cargar un recurso externo. Puedes generar y ver boletos; iniciar sesión, el historial en la nube y el cerebro colectivo global no están disponibles hasta que vuelva la conexión.»* Ni URL, ni clave, ni nombre del proveedor.

---

## 12 · Seguridad

Los cuatro avisos, uno por uno. Nada destructivo; todo reversible con un `GRANT` o un `ALTER VIEW`. Migración `v3_01_security_least_privilege`.

**1 y 2 · `pg_view_rendimiento_equipos` y `pg_view_h2h` — RESUELTOS**

Se inspeccionó primero: ambas vistas leen `pg_historico_jornadas` y `pg_historico_partidos`, y **ambas tablas ya tienen una política SELECT para `public`**. Sólo con eso se podía tocar sin romper la lectura.

- `security_invoker = true` (PG 17): la vista respeta la RLS de quien consulta, no la del creador
- Tenían `arwdDxtm` — es decir, **ALL, incluido INSERT/UPDATE/DELETE** — para `anon` y `authenticated`. Ahora sólo SELECT

Comprobado después: `anon` lee ✓, `anon` escribe ✗, `authenticated` lee ✓, `authenticated` actualiza ✗.

**3 · `mg_user_hash(uuid)` — RESUELTO**

`SECURITY DEFINER`, ejecutable por PUBLIC. Calcula `sha256(uid || salt fija)`: quien pueda llamarla puede calcular el hash de **cualquier** uuid, lo que permitiría enlazar identidades si algún hash llegara a ser público.

Se verificó que **nadie la llama**: 0 coincidencias en el artefacto — que ni siquiera usa `sb.rpc` — y 0 en la Edge Function. EXECUTE retirado a PUBLIC, `anon` y `authenticated`; `service_role` lo conserva.

**4 · Leaked password protection — BLOCKED**

Es un ajuste de Supabase Auth, no SQL, y no hay herramienta para cambiarlo desde esta sesión. Se activa en **Supabase Dashboard → Authentication → Providers → Email → «Prevent use of leaked passwords»**. Es un interruptor, no requiere migración, y no afecta a nada de lo que hay aquí.

El linter, después: **de 4 avisos a 1**, y el que queda es el BLOCKED.

---

## 13 · Failure Memory

| | |
|---|---|
| filas | **65**, sin tocar |
| sin `prediction` | **65** — las históricas, **no rellenadas** |
| sin `confidence_bucket` | **65** — igual |
| por debajo del baseline | 36 |
| políticas de escritura | **0** |

Se volvió a probar que el navegador no puede escribir: un `INSERT` como `anon` y un `UPDATE` masivo como `authenticated` → **0 filas de intruso, 0 hits alterados, 65 filas intactas**.

Las 65 siguen honestas. La memoria global no guarda `model_picks`, así que no hay forma de rellenar `prediction` sin inventarla — y la regla 5 del prompt lo prohíbe explícitamente. Los feedbacks nuevos que escriba la Edge Function sí traen `prediction`, `confidence_bucket`, `disagreement`, `official_result`, `hits`, `model_version` y `draw_ref` completos, calculados **en el servidor** desde el snapshot sellado.

---

## 14 · Tests — 302 PASS · 0 FAIL

| suite | | |
|---|---|---|
| `tests.js` · `tests_multi.js` · `tests_hotfix.js` | colectivo, multi-juego, sin fuga retroactiva | 27 + 27 + 27 |
| `tests_pr9.js` | escalera de identidad P1→P5 | 22 |
| `tests_edge_parity.mjs` · `tests_edge_v2.mjs` | paridad cliente↔edge, Failure Memory server-side | 8 + 16 |
| `tests_global_ui.mjs` | navegador: Tris fuera, export/import, memoria global | 27 |
| `tests_v2.js` · `tests_v2_ui.mjs` | los 9 módulos V2 + navegador | 45 + 29 |
| **`tests_v3.js`** | **los 7 componentes V3** | **47** |
| **`tests_v3_ui.mjs`** | **navegador · CDN presente y CDN ausente** | **27** |
| | | **302** |

### Lo que los tests encontraron

- **Un defecto real en mi propio parche, antes de probarlo.** El `function mgRenderEvidenceBanner()` de V3 se **iza** al inicio de su bloque y pisa al de V2 *antes* de que corriera la línea que lo guardaba — el fallback habría acabado llamándose a sí mismo. Corregido declarando `mgRenderEvidenceBannerV3` y reasignando en tiempo de ejecución, con el porqué escrito en el código.
- **El defecto de varianza cero** en `RandomProtocol.paired` (§10).
- **El glob de Playwright que no casaba**, que hacía del escenario «CDN presente» un falso positivo (§11).
- **Un test mío con la expectativa equivocada**: creía que 14 p-valores en 0.04 dejarían de ser significativos tras BH. No es así, y BH hace bien — `p(14) = 0.04 ≤ 14/14 × 0.05`. Se reescribió con el caso que de verdad demuestra la corrección: un p de 0.04 entre 13 altos → q = 0.56.

### Dos expectativas de V2 actualizadas

- `V2-UI-17` esperaba EDGE-0. Ahora el banner muestra **EDGE-1** para Melate porque el veredicto sale del estudio ciego, no de la memoria local de 5 observaciones. Se cambió a comprobar que se declare *un* estado y que diga NO_EDGE, en vez de clavar el valor viejo.
- `V2-UI-29` toleraba **1** excepción (`supabase is not defined`). El guardián la eliminó, así que la prueba se **aprieta a cero**.

**BUILD:** no aplica — un solo `index.html`, sin bundler ni `package.json`. La comprobación equivalente es la suite de navegador contra el artefacto servido.

---

## 15 · Regresión

Todo verificado contra el artefacto de producción descargado:

Melate ✓ · Revancha ✓ · Retro ✓ · Chispazo ✓ · **Tris sigue fuera del colectivo** ✓ · Global Brain carga ✓ · historial personal privado ✓ · export/import ✓ · reconciliación **P1→P5** de Retro (2 aplicados por P3) ✓ · **4268 presente** ✓ · **4288 ausente** ✓ · NO_EDGE ✓ · Golden Holdout 36→36 ✓ · Champion Gate 14→14 ✓ · LeakageGuard 7→7 ✓ · Live Frontier 10→10 ✓

**Hashes:** las **21 funciones científicas** con el mismo sha256 de cuerpo, una a una. Los **5 datasets** byte a byte (`melate fe566568…`, `revancha 56a493a8…` — distintos entre sí —, `retro 682699c8…`, `chispazo 51558ef6…`, `tris 9fe589a8…`). FLOOR 2 %, CAP 35 %, shrinkage 40, `overlapLimit` 1.

**Fuera de los dos bloques nuevos, el diff completo del artefacto es una línea**: la de `const sb`.

RLS ✓ (6 tablas globales, 0 políticas de escritura) · Edge Function `collective-feedback` v2 ACTIVE con `verify_jwt` ✓ · **sin escrituras directas desde el navegador**, probado ✓ · **0 errores JS propios** ✓

### Regresiones encontradas

**Ninguna.**

---

## 16 · Commit

`41a262f9956db894a52e21e1c7285e767a198791` — rama `feat/v3-hardening-blind-validation`

Precedido por los dos commits del protocolo, que existen para que la cronología sea auditable:

```
88ecb4d  chore(v3): reservar el holdout ciego ANTES de cualquier ajuste
194bbcf  chore(v3): preinscribir las predicciones ANTES de abrir REP1, REP2 y HOLDOUT
41a262f  feat: v3 hardening, blind validation and portfolio intelligence
```

## 17 · PR

[**#12 · feat: v3 hardening, blind validation and portfolio intelligence**](https://github.com/cachirulesfcmx-cpu/melate-genius/pull/12) — CI Vercel ✅

## 18 · Merge SHA

`f00be555625080208d9c53014a1045553fd1dd43` (squash a `main`)

## 19 · Deployment

`dpl_EWwbAnvdCbZUKpY4qghYzqrxzoYk` — **READY**, target production, commit `f00be555`

**URL:** https://melate-genius.vercel.app/

**Huella servida:** 1 343 225 B · `764a53e2cbecd33a3834294a433e2b97eed3fb26d9824ac4cc3c4bb4ba05fc8b` — **idéntica a `origin/main`**, verificada descargando el artefacto real.

---

## 20 · Smoke de producción — 83 PASS · 0 FAIL

Contra el artefacto **descargado de producción**, no contra el repositorio.

| suite | |
|---|---|
| `tests_v3_ui.mjs` — capa V3, escenarios A y B | 27 |
| `tests_v2_ui.mjs` — capa V2 | 29 |
| `tests_global_ui.mjs` — regresión global | 27 |
| **total** | **83 PASS · 0 FAIL** |

Y los candados verificados sobre el artefacto servido: **todos intactos**.

Lo que confirma el smoke: `MG_SCI_V3` cargado con su protocolo · el estudio congelado viaja dentro · el banner muestra **EDGE-1 / NO_EDGE** con la línea de validación ciega, el holdout, la q y las replicaciones · Tris fuera · **y, sin el CDN, `enterApp` y `handleSignup` sobreviven y se generan boletos, con cero excepciones**.

---

## 21 · Pendientes

1. **Leaked password protection** (§12) — un interruptor en Supabase Dashboard → Authentication → Providers → Email. Es el único BLOCKED.
2. **Los 28 sorteos de `user_draws_backup_20260809`** siguen sin recuperar. No se tocaron, como se pidió.
3. **Las 65 filas históricas de Failure Memory** seguirán sin `prediction` ni `confidence_bucket`. No hay forma honesta de rellenarlas; se llenarán solas con cada sorteo nuevo que aportes.
4. **Para llegar a EDGE-2** harían falta, como mínimo: un holdout ciego **posterior en el tiempo** (el actual es anterior, por la limitación de §3), un efecto que sobreviva a la rejilla de sensibilidad, q ≤ 0.05 tras BH y dos replicaciones positivas con la misma dirección. Hoy no se cumple ninguna de las cuatro en ningún juego.
5. **El holdout de V3 ya está quemado.** La próxima validación ciega necesita un bloque nuevo — lo natural es reservar los sorteos que vayan ocurriendo de aquí en adelante, que sí serían genuinamente futuros.

---

## 22 · Veredicto científico

> **NO_EDGE en Melate, Revancha, Retro y Chispazo.**

Y ahora cuesta mucho más discutirlo. La conclusión de V2 se apoyaba en un barrido walk-forward y una comparación con el azar. La de V3 se apoya en:

- un **holdout ciego** reservado y sellado en git antes de ajustar nada, con su hash atado a los datasets;
- una **preinscripción** de la predicción, también sellada, antes de abrir los bloques;
- un **barrido congelado** que dice POSSIBLE_OVERFITTING en los cuatro juegos;
- **14 hipótesis congeladas** por juego con control de FDR;
- **dos replicaciones** independientes que tumban las cuatro hipótesis que BH había marcado;
- una comparación con el azar **pareada, con seed y con q**, que no distingue nada en 0 de 4 juegos;
- y un detector que exige **las cinco condiciones a la vez** y enumera cuál falta.

El momento que justifica todo el trabajo es Melate con lookback 400: **+0.1338 en DEV**. Con un poco de descuido, ese número es un titular. Con el protocolo, es −0.0595, −0.0562 y +0.0338 — y una línea en el reporte explicando por qué no era nada.

V3 no encontró ventaja porque no la hay. Lo que sí hizo fue construir el aparato que **la habría detectado si existiera**, y que de paso atrapa las que sólo lo parecen.
