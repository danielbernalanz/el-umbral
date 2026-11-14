# Plan de integración v1.9.0 y v1.10.0

> Base verificada: `main` @ `915d24e`, árbol limpio (2026-11-14). Este documento es solo análisis: no modifica código.
> **Hecho**: todo lo citado con archivo y línea existe en esa base. **Suposición**: v1.8.0 (`docs/designs/dano.md`) se fusiona en otra rama antes de v1.10.0; si no, aplican los acoplamientos de §3.
> **Recorte propuesto** (pendiente, §7.4): v1.9.0 = reto único + magia T1/T2 sin T3/T4 ni ritos; v1.10.0 = 3 zonas con tick determinista y tratamientos básicos.

## 1. Resumen ejecutivo

- **v1.9.0** tiene dos bloques separables: (A) el reto de habilidad único, opcional, con ventana fija y validación en servidor; (B) «magia recortada»: metadatos de escuela/tier, cola `state.arcane` y resolución por capas solo para T1 (los 13 conjuros actuales) y un T2 mínimo, sin T3/T4, ritos ni afinidad de escuela.
- El reto **no toca `rollCheck`** (`public/engine.js` l.1714): se aplica después de la tirada como corrección de probabilidad; el dado, la pifia y el crítico no cambian. Es la única forma de que v1.8.0, v1.9.0 y v1.10.0 compartan tirada.
- **v1.10.0** reduce el cuerpo de 4 zonas (`ZONES` l.46) a 3, sustituye el azar de sangrado/infección (`damage` l.138-139; `startRound` l.1672-1678) por un tick determinista y añade la vista pública `look` + tratamiento básico («Atender»). Mantiene `hp` como único número de supervivencia.
- La integración con v1.8.0 es el riesgo principal: comparte `damage`, `tickStatus`, `act`, `beginCouncil`, `view.js` y el hash de snapshots. Sin contratos congelados (§3), las tres versiones se pisan.
- Ninguna versión puede desplegarse con salas vivas: cambiar `engine.js`/`data.js` cambia `engineId` y toda restauración devuelve **409** (`server/room.js` l.336; `HANDOFF.md` l.40).
- Presupuesto: ~14-18 jornadas de agente; v1.9.0 ~7-9, v1.10.0 ~6-8, más 1 de contratos y línea base.

## 2. Inventario de cambios por versión

### 2.1 v1.9.0 — reto de habilidad único

| Pieza | Archivo | Función / línea real | Cambio |
|---|---|---|---|
| Núcleo de tirada | `public/engine.js` | `rollCheck` l.1714; `pSuccess` l.1209 | No tocar. Añadir `applySkill(res, delta)`: si `delta>0` y falló, pasa a éxito con `delta/(1−p)`; si `delta<0` y acertó, pasa a fallo con `|delta|/p`. Pifia/crítico solo del dado. |
| Puntos de llamada | `public/engine.js` | `cast` l.786; `act` l.1727+ (cada `rollCheck`); `learnSpell` l.839 | Aceptar un 5.º argumento `skill` (token ya puntuado o delta local) y aplicarlo justo después de la tirada. |
| Datos | `public/data.js` | junto a `STAKES` l.123 | `D.SKILL = { windowMs: 8000, floor: -6, ceil: 15 }`. Sin acciones nuevas. |
| Servidor | `server/game.js` | `COMMANDS` l.455; `act` l.456; `cast` l.468 | `challenge` (emite seed/issuedAt) y `challengeSubmit` (valida traza y firma token); pasar `skill` en `act`/`cast`. |
| Módulo nuevo | `server/challenge.js` | — | Puntuación, plausibilidad (≥120 ms entre eventos), ventana 8 s + 1,5 s de gracia, un envío por seed. Sin estado en la sala. |
| Cliente | `public/ui.js` | `renderPrivate` l.624; `renderActions` l.814; `renderSpellPicker` l.962 | Overlay de reto al confirmar CUALQUIER acción; misma forma y duración para todos. «Sin retos» = delta 0 con pantalla de respiración. |
| Accesibilidad | `ui.js`, `index.html`, `styles.css` | ajustes existentes | «Reto sencillo» (misma ventana, objetivos mayores y más lentos) y «Sin retos». Nunca cambia las opciones disponibles. |
| Privacidad | `server/view.js` | `TOP_KEYS` l.11 | No exponer seed, puntuación ni delta ajenos. El seed propio va en la respuesta del comando, no en `q`. |
| Versión | `data.js` l.233; `engine.js` l.9 | `D.VERSION` y `VERSION` (formato de guardado) | Subir ambos y migrar saves (§3.9). |

### 2.2 v1.9.0 — magia recortada

| Pieza | Archivo | Función / línea real | Cambio |
|---|---|---|---|
| Metadatos | `engine.js` | `SPELL_FORMS` l.597; `SPELL_ASPECTS` l.612 | Añadir `school`, `tier`, `layer`, `cost`; `spellMeta(sp)` con fallback T1 para partidas viejas. |
| Tirada vs efecto | `engine.js` | `cast` l.752-821 | Mantener tirada y costes en el acto (l.785-804); mover el efecto a `queueArcane()`. |
| Cola y capas | `engine.js` | `applySpell` l.662 | `state.arcane` + `resolveArcane()` por capas C1-C6; misma entrada, mismo resultado, sin importar el orden de llegada. |
| Hook único | `engine.js` | `beginCouncil` l.2403-2406 | `resolveArcane()` antes de `shadowStrike()` (l.2405). Un solo punto de resolución. |
| Limpieza | `engine.js` | `startRound` l.1637-1690 | Vaciar `state.arcane`; caducar `p.charge`/wards; no tocar el orden de `tickStatus`. |
| Información | `engine.js` | `spellInfo` l.736 | Devolver tier, escuela y capa; nunca wards ni colas ajenas. |
| Estudio | `engine.js` | `studyOptions` l.830; `learnSpell` l.839; `improveSpell` l.861 | Tope por peso (sustituye `p.spells.length >= 4` de l.851); solo T1/T2. |
| UI | `ui.js` | `renderSpellPicker` l.962; `renderModePicker` l.1047; `spellsHTML` l.921 | Agrupar por escuela, chip de tier, capacidad por peso; T3/T4 no aparecen. |
| Vista y snapshots | `view.js` l.10 y l.100-104; `snapshot.js` l.12 | lista blanca; `SCHEMA` | Excluir `state.arcane`, `p.charge`, wards ajenos; neutralizar defensas ocultas como ya se hace con `protection`; `SCHEMA` 2. |
| Datos | `data.js` | `SPELL_DB` | 13 T1 + ≤8 T2 con textos, costes y requisitos; sin grimorio mayor ni libro sin nombre. |

### 2.3 v1.10.0 — salud a 3 zonas

| Pieza | Archivo | Función / línea real | Cambio |
|---|---|---|---|
| Zonas | `engine.js` | `ZONES` l.46; `ZONE_LABEL` l.47; `ZONE_IN` l.48; `ZONE_W` l.49 | Pasar a 3 zonas (propuesta: `cabeza`, `torso`, `miembros`); migrar pesos y textos. |
| Modelo | `engine.js` | `initHealth` l.79; `zoneLvl` l.61; `zoneMod` l.67; `legPen`/`armPen` l.65-66 | `p.inj[z] = { t, n, bleed, inf, tx }`; `n` 1-3; penalizadores derivados con tope −2. |
| Daño | `engine.js` | `damage` l.120; `hitNote` l.145; `ZONE_DESC` l.162 | `opts.tipo` escribe la lesión; **eliminar** el sangrado aleatorio l.138-139; conservar `dying`/`fast` l.132-137. |
| Tick | `engine.js` | `tickStatus` l.1034-1054 | Hemorragia, infección y veneno deterministas; tope 4 hp/ronda; previsión «caes en N rondas». |
| Inicio de ronda | `engine.js` | `startRound` l.1637-1690 | Quitar la infección aleatoria l.1672-1678; conservar la ventana del moribundo l.1647-1657. |
| Público | `engine.js` | `visibleHealth` l.168; `healthInfo` l.184 | `publicLook(p)` con enum cerrado de signos (máx. 3); `healthInfo` amplía zonas y previsión solo para el propio. |
| Vista | `view.js` | `PUBLIC_PLAYER_KEYS` l.10; `q.health` l.69 | Añadir `look` a la lista blanca; `q.health` crece con `inj`, `sist`, `dolor`, `prevision`; `ME_EXCLUDE` l.13 sigue ocultando identidades. |
| Tratamiento | `data.js` l.94; `engine.js` `act` l.1727 | `ACTIONS`; motor | Nueva acción «Atender»: Presionar / Vendar / Limpiar / Descansar / Socorrer. Sin cirugía ni oficio en esta versión. |
| UI | `ui.js` | `statsHTML` l.589-622 (zones l.606); `renderSheet` l.754; `openActionSheet` l.881 | Silueta de 3 zonas, panel «qué te pasa y qué hacer», probabilidad y consecuencia visibles. |
| Migración | `engine.js` | `loadGame` l.3350-3374 | `p.zones` numérico → `p.inj`; estados `sangrado`/`infeccion` → flags; aceptar saves de formato 5 (hoy l.3364 rechaza todo lo que no sea `VERSION`). |

## 3. Dependencias y conflictos con v1.8.0

1. **`damage()` (l.120) — conflicto duro.** v1.8 añade `{tipo, nivelMin}` y 24 formas que dirigen zonas; v1.10 necesita ese mismo contrato para escribir `p.inj`. *Resolución*: congelar ya `damage(p, amount, {src, zone, tipo, noBleed, fast})`; v1.8 debe enviar `tipo` y `zone` siempre, y v1.10 lo consume sin cambiar la firma.
2. **`tickStatus()` (l.1034-1054) — conflicto duro.** v1.8 mete estados nuevos (veneno lento, sopor, cepo) por ronda; v1.10 reescribe el tick entero. *Resolución*: v1.10 es dueño del bucle; v1.8 registra sus efectos por ronda en una tabla (`state.harm`/hooks), no en líneas nuevas del `forEach`.
3. **`act()` (l.1727) y el reto — conflicto duro.** v1.8 añade `stake` (4.º argumento) y 13 acciones; v1.9 añade `skill` (5.º). *Resolución*: `act(actorId, actionId, targetId, stakeId, skill)`, con `stakeId` y `skill` opcionales y validados por separado; `server/game.js` l.456 serializa ambos.
4. **`beginCouncil()` (l.2403-2406) — conflicto duro.** v1.8 quiere H1 (plantadas/mechas) y H2 (diferidos) después de la magia y antes de `shadowStrike`; v1.9 quiere `resolveArcane` en ese mismo punto. *Resolución*: orden fijo y documentado: `resolveArcane()` → `resolveHarm()` (H1/H2) → `shadowStrike()`. Un solo PR puede introducir el esqueleto.
5. **Zonas y `ZONE_W` (l.46-52) — conflicto de datos.** `dano.md` reparte daño por `brazos`/`piernas`/`cabeza`; v1.10 los funde. *Resolución*: si v1.8 entra antes, sus 24 formas y pesos se migran en v1.10 con una tabla `src→zona3`; si v1.10 entra antes, v1.8 nace ya en 3 zonas. No puede haber dos `ZONE_W`.
6. **`view.js` y `leakcheck` — conflicto de lista blanca.** v1.8 debe ocultar `state.harm` y marcas ajenas; v1.9 `state.arcane`/wards; v1.10 `look`/`q.health`. Los tres tocan `PUBLIC_PLAYER_KEYS` l.10, `queriesFor` l.58 y `Q_KEYS` (`test/helpers/leakcheck.js` l.5). *Resolución*: un solo PR «vista» por versión, con `Q_KEYS` actualizado en el mismo commit; nunca dos ramas añadiendo claves a la vez.
7. **`startRound()` (l.1637) — conflicto medio.** v1.8 puede necesitar limpiar marcas/cepos; v1.10 quita la infección aleatoria l.1672-1678. *Resolución*: v1.10 conserva el bloque de moribundos (l.1647-1657) y mueve la infección a `p.inj`; v1.8 no añade azar nuevo al inicio de ronda.
8. **Snapshots y `engineId` — conflicto de despliegue.** Cada cambio de `engine.js`/`data.js`/`npc.js` invalida salas (409). Tres versiones = tres ventanas de invalidación. *Resolución*: desplegar con mesa vacía, aviso en cliente y `SCHEMA` incrementado una sola vez por versión.
9. **Saves locales — conflicto silencioso.** `loadGame` l.3364 rechaza cualquier `data.v !== VERSION` (hoy 5). Subir `VERSION` sin conversión borra la partida en curso. *Resolución*: mantener 5 si los cambios son aditivos; si hay migración, aceptar 5 y convertir en `initHealth`/`initArcane` antes de validar.
10. **UI de acciones — conflicto blando.** v1.8 añade el selector de riesgo en `openActionSheet` l.881 y 13 acciones; v1.9 añade el overlay de reto; v1.10 «Atender» y la silueta. *Resolución*: v1.8 y v1.10 solo añaden filas a `ACTIONS`/`ACTION_GROUPS` (l.543-549); el overlay de reto es un componente único invocado desde `renderPrivate`.

## 4. Qué se puede paralelizar y qué no

**Sí, en paralelo (contratos de §3 congelados primero):**
- `server/challenge.js` + sus unitarios y el `challenge`/`challengeSubmit` de `server/game.js`, siempre que `act`/`cast` acepten `skill` opcional.
- `SPELL_DB` T1/T2 y textos de `data.js`; no toca el motor.
- Overlay de reto y ajustes de accesibilidad en `ui.js`/`styles.css`, con una maqueta de `skill`.
- Tests de no-fuga y de snapshots escritos contra las claves nuevas, antes de implementarlas.
- Documentación, `news.js` y checklist de despliegue.
- Maqueta de la silueta de 3 zonas y del panel «qué hacer», con datos falsos.

**No, en paralelo:**
- `damage`, `tickStatus`, `act`, `beginCouncil`, `startRound`, `rollCheck`: un solo dueño por versión.
- `view.js` + `Q_KEYS` + `SCHEMA`: una sola rama por ventana.
- Subida de `VERSION`/`D.VERSION` y `news.js`: al final de cada versión, nunca en paralelo.
- Balance final y E2E online: necesitan el árbol integrado y la mesa vacía.

```
contratos §3 ──┬─> v1.9-A reto (servidor+UI) ──┐
               ├─> v1.9-B magia T1/T2 ─────────┼─> v1.9.0 integrada ─> v1.10 motor ─> v1.10 UI/vista ─> balance
               └─> v1.8 (otra rama) ───────────┘
```

## 5. Plan de pruebas por versión

### 5.1 v1.9.0

| Tipo | Qué se prueba | Criterio |
|---|---|---|
| Unitario | `applySkill`: media desplazada exactamente `delta`; pifia/crítico intactos; `delta=0` idéntico a hoy. | 10 000 tiradas por celda, error < 0,5 pp. |
| Unitario | `resolveArcane`: mismas entradas en distinto orden → mismo estado; contrahechizo/ward/reflejo; muerte del lanzador antes de C4. | Estado serializado idéntico. |
| Unitario | Estudio: tope por peso, T2 solo con Practicante, save viejo → T1 por `spellMeta`. | Sin excepciones ni pérdida de conjuros. |
| No-fuga | `test/leak.test.js` l.18 y l.116; `Q_KEYS` con `skill`/`arcane` si aplica; seed y delta ajenos nunca en la vista. | 0 aciertos del detector; control negativo sigue fallando. |
| Snapshots | `test/persist.test.js`: restauración exacta a mitad de fase; motor distinto → 409; `SCHEMA=2`. | Salas viejas rechazadas limpiamente; vistas idénticas. |
| E2E | `python3 test/e2e/online_e2e.py game1|game2|game3|stun|timers|persist|persisthard` + flujo de reto. | Un escenario a la vez; sin timeouts; reto caducado = base. |
| Balance | `WWW=public node tools/work/smart_human.js 300 10|12|15 human|allgood|aggro`. | Asesino 31/46-50/37-45 % ±4 pp; allgood ≥88 %; conjuros 12-25 % de acciones; muertes por conjuro ≤25 %. |

### 5.2 v1.10.0

| Tipo | Qué se prueba | Criterio |
|---|---|---|
| Unitario | `damage`/`heal` con `p.inj`: niveles 1-3, fusión de tipos, tope 4 hp/ronda, previsión determinista. | Misma secuencia → mismo resultado; sin `Math.random` en el tick. |
| Unitario | `initHealth`: migración de `zones` numérico y estados viejos; `stabilize`/`finish`. | Save de formato 5 conserva hp, zonas y moribundos. |
| No-fuga | `look` idéntico para mismo `inj` con `corr`, `alignment` o `cause` distintos; `q.health` solo propio; `PUBLIC_PLAYER_KEYS` sin campos nuevos. | 48 partidas × configuraciones, 0 diferencias; detector ampliado. |
| Snapshots | `SCHEMA=3`; restauración con `p.inj` y `state.harm`/`arcane`. | 409 en blobs viejos; estado y vistas idénticos tras restaurar. |
| E2E | Los mismos escenarios + `persist`, `dual`, `small`, `npc2`. | Nadie ve menos acciones; «Atender» aparece para todos. |
| Balance | Igual que 5.1, midiendo muertes por causa y moribundos socorridos. | Muertes naturales ≤0,25/partida a 3j/12 min; ≥65 % de moribundos estabilizados; duración ±0,5 min; asesino ±4 pp. |

## 6. Riesgos y mitigaciones

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| El reto alarga la partida 4-10 min y cansa | Alta | Alto | Opcional y «Sin retos»; por defecto solo en online; medir tiempo real y abandonos. |
| Validación de traza frágil (latencia, trampas) | Media | Medio | Caducidad = delta 0, nunca penaliza; gracia 1,5 s; tope +15; token firmado, el cliente nunca manda delta. |
| La magia recortada se convierte en las 37 piezas | Alta | Alto | Puerta de alcance: T1+T2 máximo, sin T3/T4, ritos, afinidad ni grimorio mayor. |
| v1.8 y v1.9 tocan las mismas funciones | Alta | Alto | Contratos §3 congelados; PRs pequeños; rebase diario; un dueño por función. |
| 3 zonas rompen el balance y la curación | Media | Alto | Tick determinista, presupuesto de daño, línea base F0 y revertir el dial si >4 pp. |
| `look` delata corrupción/rol | Media | Alto | Enum cerrado, máx. 3 signos, orden fijo; test «mismo cuerpo, distinta corrupción → mismo look». |
| 409 en salas vivas | Alta | Medio | Desplegar con mesa vacía; aviso en cliente; snapshot final antes de cerrar. |
| Saves locales borrados por subir `VERSION` | Media | Alto | Migración explícita o mantener 5; probar `loadGame` con save real de v1.7.0. |

## 7. Orden recomendado, estimaciones y checklist de cierre

### 7.1 Fases

| Fase | Contenido | Est. (jornadas) | Depende de |
|---|---|---|---|
| F0 | Congelar contratos §3; línea base de balance y de muertes por causa | 1 | — |
| F1 | v1.9-A: `applySkill`, `server/challenge.js`, comandos, overlay, tests | 3-4 | F0 |
| F2 | v1.9-B: metadatos, `state.arcane`, `resolveArcane`, estudio T2, UI, vista | 4-5 | F1 (hook) y F0 |
| F3 | v1.10 motor: 3 zonas, `p.inj`, `damage`, tick, migración | 3-4 | F2 + v1.8 fusionada |
| F4 | v1.10 vista y UI: `publicLook`, `q.health`, silueta, «Atender» | 3-4 | F3 |
| F5 | Balance, E2E, snapshots, APK y despliegue de cada versión | 2-3 | F1-F4 |

### 7.2 Checklist de cierre por versión

- [ ] `npm test` verde (incluye `leak`, `persist`, `pure`, `online`, `npc`).
- [ ] `Q_KEYS`/`PUBLIC_PLAYER_KEYS` actualizados en el mismo commit que la vista.
- [ ] `D.VERSION`, `VERSION` (formato), `sw.js` (CACHE), `news.js` e `index.html` alineados.
- [ ] Save local de la versión anterior cargado y continuado sin pérdida.
- [ ] `SCHEMA` incrementado; restauración vieja devuelve 409 y mensaje claro.
- [ ] E2E online uno por uno; sin falsos timeouts por ejecución paralela.
- [ ] Balance ±4 pp en 10/12/15 min; métricas nuevas dentro de objetivo.
- [ ] Sin fugas: `look`, `q.health`, `arcane`, `harm` y marcas ajenas fuera de la vista.
- [ ] APK firmado verificado (`unzip -l`: `img/`, `styles.css`, `fx.js`, `net.js`, `news.js`, `npc.js`).
- [ ] Despliegue manual en Render con mesa vacía; `/healthz` correcto.
- [ ] `HANDOFF.md` y `docs/NOTAS_PROYECTO.md` actualizados con la versión cerrada.

### 7.3 Puerta entre versiones

No abrir v1.10 hasta que v1.9 esté desplegada y con una semana de partidas sin incidencias de reto/magia. Si v1.8 se retrasa, v1.9 puede entregarse sin ella **solo** si el reto se integra con `act`/`cast` actuales y no se toca `damage`; v1.10 queda bloqueada hasta v1.8.

### 7.4 Decisiones pendientes del usuario

1. **Suelo del reto**: `−6` (HANDOFF l.29) o `−10` (magia.md §9.1). Recomendado `−6`; el techo +15 se mantiene.
2. **Alcance de «magia recortada»**: ¿T1+T2 sin T3/T4/ritos (recomendado) o solo T1 con metadatos y cola?
3. **3 zonas**: ¿`cabeza / torso / miembros` (recomendado) o `cabeza / torso / piernas`? Cambia `ZONE_W`, la silueta y los penalizadores.
4. **Reto por defecto**: ¿activado en online y desactivado en local con >5 jugadores (recomendado), o siempre opcional?
5. **Salud recortada**: ¿entran «Limpiar» y la previsión «caes en N rondas» en v1.10, o solo Presionar/Vendar/Descansar/Socorrer?
6. **Migración de saves**: ¿mantener formato 5 con campos aditivos (recomendado) o subir a 6 con conversión explícita?
