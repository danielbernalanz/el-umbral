# El Umbral — Plan de integración v1.9.0 y v1.10.0

Estado del repo al escribir: `main`, commit `915d24e`, árbol limpio, `data.js` en `1.7.0`.
Marcas usadas: **[H]** hecho verificado en el código o en los documentos citados; **[S]** suposición razonada; **[D]** decisión pendiente del usuario.

---

## 1. Resumen ejecutivo

1. v1.8.0 (daño con riesgo) no es solo anterior en la cola: es la **dependencia dura** de v1.9 y v1.10 porque define la firma de `damage` y la cola `state.harm` sobre la que se apoyan la magia diferida y el tick de salud.
2. v1.9.0 se puede partir en dos: el **reto de habilidad** (infraestructura de servidor + UI, paralelizable desde ya) y el **recorte de magia** (toca `cast`, `spellInfo` y `beginCouncil`, que v1.8 también toca).
3. v1.10.0 debe entregarse en dos cortes: **modelo de 3 zonas + tick determinista** primero, **tratamientos y UI de silueta** después; el diseño `salud.md` completo son 24-26 sesiones y no cabe en una versión.
4. Todo lo que añada una consulta a `q` obliga a tocar `leakcheck.Q_KEYS` (`test/helpers/leakcheck.js:5`) y `test/pure.test.js:14-25`; sin eso la suite falla aunque el código sea correcto.
5. Estimación realista: **v1.9 ≈ 6 sesiones**, **v1.10 ≈ 9 sesiones**, más 1 de cierre y despliegue; el orden de merge es v1.8 → reto → magia → salud.

---

## 2. Inventario por versión

### 2.1 v1.9.0 — reto de habilidad único + magia recortada

**Objetivo de HANDOFF (`HANDOFF.md:29`):** un solo reto, opcional, bonus −6..+15, misma forma y duración para todas las acciones, validación en servidor; magia recortada según `magia.md`.

| Pieza | Punto real | Trabajo |
|---|---|---|
| Reto: tirada | `engine.js:1714-1724` (`rollCheck`) | **[H]** No se toca: el diseño exige aplicar el delta después de la tirada (`magia.md:150`). Se añade un envoltorio, no se reescribe el dado. |
| Reto: acción | `engine.js:1727` (`act`), tirada en `1824` | **[H]** Añadir el token de reto a la firma y aplicarlo antes de la pifia/crítico. Es el punto que v1.8 también modifica. |
| Reto: conjuro | `engine.js:752` (`cast`), `713` (`spellCheck`) | **[H]** Mismo token; `cast` ya valida turno, usos y objetivos antes de tirar. |
| Reto: servidor | `server/game.js:455-555` (`COMMANDS`), `act:456`, `cast:468` | **[H]** Nuevos comandos `challenge` / `challengeSubmit`; el cliente nunca envía `delta` (`magia.md:154`). |
| Reto: vista | `server/view.js:58-109` (`queriesFor`) | **[H]** Exponer estado del reto solo al jugador que lo juega; no hay dato público nuevo. |
| Reto: tests | `test/helpers/leakcheck.js:5` (`Q_KEYS`), `test/pure.test.js:14-25` | **[H]** Lista cerrada: cualquier `q.challenge` debe añadirse aquí o `checkView` falla (`leakcheck.js:54`). |
| Reto: UI | `ui.js:814` (`renderActions`), `1153` (`doAction`), `939` (`doCast`) | **[H]** Overlay de 8 s; `doAction` ya centraliza el envío de acciones. |
| Magia: resolución | `engine.js:2403-2417` (`beginCouncil`), `2405` (`shadowStrike`) | **[H]** Insertar `resolveArcane()` antes de `shadowStrike`, como pide `magia.md:9`. |
| Magia: cola | `engine.js:2866` (`nextRound`), `663-681` (`applySpell`) | **[H]** `state.arcane` se vacía al cerrar ronda; `applySpell` pasa a aplicarse desde la cola. |
| Magia: info | `engine.js:736-751` (`spellInfo`) | **[H]** Añadir capa/tier/escuela y textos de interacción sin revelar defensas ocultas. |
| Magia: recorte | `magia.md:54-99` (37 conjuros), `data.js:94-120` (`ACTIONS`) | **[D]** Qué tiers sobreviven; el documento propone T1-T2 en una entrega y T3-T4 en otra (`magia.md:181`). |
| Magia: vista | `server/view.js:93-107` (`q.spells`), `102-103` (`protection=null`) | **[H]** Cualquier defensa nueva (ward/reflect/ally/conc) debe neutralizarse igual que hoy. |
| Magia: UI | `ui.js:962-1008` (`renderSpellPicker`), `954` (`spellLine`), `958` (`probChip`) | **[H]** Agrupar por escuela/tier y mostrar probabilidad antes de elegir. |

**[S]** El recorte de magia no debería tocar el catálogo de 37 conjuros en esta versión: basta con limitar el acceso (tiers, coste, escuela) y dejar el dato preparado. Reescribir `SPELL_DB` entero es el mayor riesgo de regresión de `cast`.

### 2.2 v1.10.0 — salud recortada a 3 zonas

**Objetivo de HANDOFF (`HANDOFF.md:30`):** salud recortada a 3 zonas. `salud.md` diseña 6 zonas (`salud.md:15`), así que el recorte es una decisión, no una traducción.

| Pieza | Punto real | Trabajo |
|---|---|---|
| Zonas | `engine.js:46` (`ZONES`), `56-59` (`pickZone`), `61-63` (`zoneLvl`) | **[H]** Cambiar el array rompe `damage`, `heal`, `healthInfo`, `visibleHealth`, `tickStatus` y `startRound`. |
| Daño | `engine.js:120-142` (`damage`), `112-118` (`bleed`) | **[H]** Añadir `tipo`/`nivel` y quitar el azar de sangrado (`139`), hoy 25 % / 45 % en torso. |
| Curación | `engine.js:150-161` (`heal`) | **[H]** Hoy reparte la curación por la zona más dañada; con lesiones por zona hay que decidir el orden. |
| Público | `engine.js:168-182` (`visibleHealth`), `184-195` (`healthInfo`) | **[H]** `visibleHealth` ya produce marcas (`174-181`); el diseño añade un vocabulario cerrado (`salud.md:85-97`). |
| Tick | `engine.js:1034-1054` (`tickStatus`) | **[H]** Aquí vive el sangrado (`1038-1043`) y la infección (`1044-1048`); el diseño los quiere deterministas. |
| Inicio de ronda | `engine.js:1668` (tick), `1672-1678` (infección aleatoria 40 %) | **[H]** La infección aleatoria contradice el tick determinista de `salud.md:8`. |
| Objetos | `engine.js:2261-2344` (`useItem`), `data.js:51-87` (`ITEMS`) | **[H]** Añadir zona al uso de vendas/hierbas; ojo al bug conocido: `useItem` muta estado al fallar. |
| Acciones | `engine.js:2094-2105` (`descansar`), `2111-2123` (`socorrer`) | **[H]** Puntos de enganche de Atender/Presionar; `socorrer` ya estabiliza (`2116`). |
| Consejo | `engine.js:2640` (`resolveAmbush`) | **[H]** La emboscada aplica daño; debe pasar por la nueva firma. |
| Vista | `server/view.js:10` (`PUBLIC_PLAYER_KEYS`), `69` (`q.health`), `158` (`visibleHealth`) | **[H]** `look` entra en la lista blanca; `q.health` crece solo para el propio jugador. |
| UI | `ui.js:589-622` (`statsHTML`), `606-609` (zonas) | **[H]** Cuatro chips de zona pasan a tres; hay clases CSS y sprites `z_brazos`/`z_piernas` que quedan huérfanos. |
| Persistencia | `server/snapshot.js:12` (`SCHEMA`), `17-21` (`engineId`), `engine.js:3350` (`loadGame`) | **[H]** `engineId` ya invalida snapshots al cambiar `engine.js`/`data.js`; `SCHEMA` solo sube si cambia el formato del snapshot, no el estado interno. |
| Migración | `engine.js:79` (`initHealth`), `3350` (`loadGame`) | **[H]** Partidas guardadas tienen `zones: {cabeza,torso,brazos,piernas}`; hay que fusionar brazos/piernas sin perder daño. |

---

## 3. Conflictos con v1.8.0

### C1. Una sola firma de `damage`, dos dueños
`dano.md:95` y `salud.md:121` proponen contratos distintos: `damage(p, amount, {src, zone, tipo, nivelMin, noBleed})` y una tabla `src→tipo`. **[H]** La función actual (`engine.js:120`) ya acepta `{src, zone, noZone, noBleed}` y elige zona por pesos (`pickZone`, `56-59`). **[S]** Si v1.8 reescribe `damage` y v1.10 lo vuelve a reescribir, el merge pierde el sangrado, la muerte y las notas privadas. **Regla propuesta:** v1.8 congela la firma completa (incluido `tipo` y `nivel`) aunque aún no la use; v1.10 solo añade cuerpo, nunca cambia parámetros.

### C2. Aleatoriedad contra tick determinista
**[H]** Hoy el sangrado se decide al azar en `damage:138-140` (25 %, 45 % en torso) y la infección en `startRound:1677` (40 %). **[H]** `salud.md:8` y `:36-45` exigen tick determinista y previsión «caes en N rondas»; `dano.md:11` exige capas deterministas al cierre. **[S]** Tres fuentes de azar distintas en la misma ronda hacen imposible el objetivo de balance de HANDOFF: el jugador no puede explicar por qué cae. **Decisión:** el azar se queda solo en la tirada de tratamiento y en el reto.

### C3. 4 zonas → 3 zonas rompe el catálogo de daño
**[H]** `ZONES` (`engine.js:46`) alimenta `pickZone` (`58`), `initHealth` (`88`), `healthInfo` (`191`), `visibleHealth` (`174-176`), `heal` (`156-157`), `tickStatus` (`1039`) y `startRound` (`1675`). **[H]** `dano.md:21-25` describe 24 formas con efectos por zona (`torso`, `brazos`, `piernas`, `cabeza`). **[H]** `salud.md:15` pide 6 zonas. **[D]** Qué tres zonas: (a) cabeza/torso/miembros, (b) cabeza/torso/piernas, (c) cabeza/torso/brazos. Elegir (a) obliga a reescribir las 24 filas de `D.HARM`; elegir (b) o (c) deja una zona sin cubrir. Sea cual sea, hay que decidir si se conserva el modelo de lesión `{t,n,bleed,inf,tx}` o solo buckets de daño.

### C4. El token de reto entra por la puerta de v1.8
**[H]** `dano.md:84-88` ya pide reto en TODAS las acciones privadas y token firmado en `act`. **[H]** `magia.md:150-154` define el mismo reto para `cast` y para cada turno, con ventana fija de 8 s. **[H]** La firma actual es `act(actorId, actionId, targetId, stakeId)` (`engine.js:1727`) y la llamada del servidor `run("act", [aid, t, st])` (`server/game.js:205`). **[S]** Si v1.8 añade el token como quinto argumento y v1.9 lo añade como objeto de opciones, hay que tocar `act`, `game.js:205/456`, `ui.js:1153` y los bots. **Decisión:** forma del token (`{seed,sig}`? `{seed,score}`?) y si viaja como argumento o dentro de un objeto `opts`.

### C5. Acciones, objetos y listas cerradas se pisan
**[H]** v1.8 propone 13 acciones nuevas (`dano.md:59`) sobre `D.ACTIONS` (`data.js:94-120`). v1.10 añade Atender/tratamientos sobre el mismo array y sobre `D.ITEMS` (`51-87`). **[H]** `isUnlocked` (`engine.js:537`) y `visibleActions` (`550`) gobiernan qué ve cada jugador; `q.actions` (`server/view.js:86-87`) y `test/leak.test.js:116-132` verifican que no se filtren acciones bloqueadas. **[H]** `ui.js:789` (`SHORT`) y `814` (`renderActions`) tienen textos y grupos por acción. **[S]** Cualquier acción nueva exige tocar cuatro sitios y un test; si v1.8 y v1.10 lo hacen en ramas distintas, el conflicto es seguro.

### C6 (menor, pero bloqueante). `useItem` muta estado al fallar
**[H]** `useItem` (`engine.js:2261-2344`) valida dentro del `switch` y varios `return err(...)` ocurren después de `antiAct(p)`/`darkAct(p)` (`2273-2274`) y de mensajes ya calculados. **[H]** HANDOFF lo lista como pendiente (`HANDOFF.md:33`). **[S]** v1.10 multiplica los usos de objeto sobre salud; arreglarlo antes es una sesión pequeña y aislada, no un extra.

---

## 4. Paralelización real

### 4.1 Se puede hacer en paralelo desde hoy

| Rama | Contenido | Por qué no choca |
|---|---|---|
| `feat-reto` | Servidor `challenge`/`challengeSubmit`, validación de traza, overlay UI 8 s, ajustes «Sin retos» / «Reto sencillo» | Archivos nuevos o zonas no tocadas por v1.8; no edita `act`, `cast` ni `damage`. |
| `feat-salud-modelo` | `p.inj`/3 zonas, previsión, migración de guardado, tests unitarios del modelo | Trabaja sobre helpers nuevos; solo se integra en `damage`/`tickStatus` al final. |
| `feat-look` | Vocabulario público (`salud.md:85-97`), `publicLook`, ampliación de `PUBLIC_PLAYER_KEYS` y tests de fuga | Aditivo en `view.js:10` y `leakcheck`; no toca la resolución. |

### 4.2 No se puede paralelizar (mismo archivo o misma función)

- `engine.js`: `act` (v1.8 + reto + Atender), `startRound` (v1.8 H1/H2 + infección + tick), `damage`/`heal`/`tickStatus` (v1.8 + v1.10), `beginCouncil` (harm + arcane + salud), `useItem`.
- `data.js`: `ACTIONS` (`94-120`), `ITEMS` (`51-87`), `STATUS` (`220-227`).
- `server/view.js`: `queriesFor` (`58-109`) y `q.spells` (`93-107`) comparten lista blanca y tests.
- `ui.js`: `renderActions` (`814`) y `statsHTML` (`589-622`).
- `test/helpers/leakcheck.js:5` y `test/pure.test.js:14-25`: listas cerradas.

### 4.3 Debe esperar a v1.8 mergeada

- Cualquier cambio en el orden de capas de `state.harm` y su hook en `beginCouncil`.
- El contador `p.oficios` (`dano.md:104-118`): v1.9 y v1.10 quieren colgar de él sus desbloqueos.
- `AGGR_ACT` (`engine.js:527`) y `DARK_ACTS` (`946`): las acciones nuevas de salud/magia deben declarar si cuentan.
- La firma definitiva de `damage`, que condiciona todo el modelo de zonas.

**Orden de merge propuesto:** `v1.8` → `feat-reto` → `feat-magia` (recorte) → `feat-salud` (modelo+tick) → `feat-salud-ui` (tratamientos). El reto va primero dentro de v1.9 porque es la dependencia del token en `act` y `cast`.

---

## 5. Plan de pruebas

| Nivel | Qué se prueba | Dónde |
|---|---|---|
| Unitario motor | 3 zonas, tick determinista, previsión, migración de `zones`; delta del reto aplicado sin tocar dado ni pifia | `npm test`, nuevos casos en `test/` |
| Pureza | Toda consulta nueva de `q` es pura o está declarada impura | `test/pure.test.js:14-25`, lista esperada `50-52` |
| No fuga | `look`, `q.health`, `q.treatOptions`, `q.challenge` no revelan `corr`, autor, herida interna ni defensas ocultas | `test/leak.test.js`, `leakcheck.js:5,42-75` |
| Matriz de fuga | Mismo cuerpo con `corr` distinta produce el mismo `look`; 48 partidas × configuraciones (`salud.md:100`) | harness existente + caso nuevo |
| Persistencia | Guardado local migra `brazos`/`piernas`; snapshot viejo se rechaza por `engineId`; `SCHEMA` solo sube si cambia el formato | `test/persist.test.js:48-66,167-169`, `snapshot.js:12-21` |
| E2E | Escenarios de a uno: `game`, `stun`, `timers`, `persist`, `persisthard`, `dual`, `absvote`, `npc2`, `npcroom`; nuevo escenario de reto (caducar = delta 0, reenvío rechazado) | `python3 test/e2e/online_e2e.py <escenario>` |
| Balance | 3 jugadores 10/12/15 min; asesino 31/46-50/37-45 %, supervivientes ≥88 %, ±4 pp | `WWW=public node tools/work/smart_human.js N minutos [perfil]` |
| Magia | Conjuros 12-25 % de las acciones, muertes por conjuro ≤25 %, éxito 55-65 % | `magia.md:170`, `smart_human` |
| Manual | Reto táctil en Android real; 6-10 jugadores; no verificado nunca | `HANDOFF.md:45` |

**Puertas de salida:** `npm test` verde (≈1 min), sin consultas impuras inesperadas, sin claves nuevas en `q` fuera de `Q_KEYS`, y balance dentro de ±4 pp. **[H]** El E2E no se ejecuta en paralelo: se satura (`test/e2e/README.md`).

---

## 6. Riesgos

| Riesgo | Prob. | Impacto | Mitigación |
|---|---|---|---|
| `damage` con dos dueños y merge destructivo | Alta | Alto | Congelar firma en v1.8; v1.10 solo añade campos; un test de contrato con `src`/`zona`/`tipo` |
| Reto de 8 s alarga la partida 4-10 min y rompe objetivos de duración | Media | Alto | Reto opt-in, por defecto off en local >5; medir con `smart_human` antes de activarlo |
| Colapso a 3 zonas rompe las 24 formas de `D.HARM` | Alta | Alto | Tabla de mapeo zona→zona y migración en `initHealth`; entregar 3 zonas antes de tratamientos |
| Fuga por `look`/`treatOptions` (corrupción, autor, herida interna) | Media | Alto | Calcular con protecciones a `null` como `view.js:102-103`; caso «mismo cuerpo, distinta corr» |
| `useItem` muta estado al fallar y se amplifica con salud | Alta | Medio | Arreglar antes de v1.10 (cambio aislado en `2261-2344`) |
| «Magia recortada» deja a alguien con menos opciones | Media | Alto | Recortar por coste/tier, nunca por jugador; los 13 T1 siguen disponibles para todos |
| Alcance de `salud.md` (24-26 sesiones) se intenta meter en v1.10 | Alta | Alto | Dos cortes: modelo+tick (v1.10.0) y tratamientos (v1.11.0) |
| Números de versión de los diseños no coinciden con HANDOFF | Alta | Bajo | Renumerar `magia.md` (dice v1.7/v1.8) y `salud.md` (dice v1.8/v1.9/v2.0) al cerrar |

---

## 7. Orden, estimación y checklist de cierre

### 7.1 Fases

| # | Fase | Depende de | Sesiones |
|---|---|---|---|
| S0 | Contrato con v1.8: firma de `damage`, orden de capas, forma del token | — | 0,5 |
| S1 | v1.9 reto: servidor `challenge` + validación de traza + overlay UI | S0 | 2 |
| S2 | v1.9 magia: recorte de acceso, `spellInfo`, `resolveArcane` en `beginCouncil`, UI de escuelas | S0 | 2 |
| S3 | v1.9 enganche del token en `act`/`cast`, bots, tests, balance | S1+S2+v1.8 | 1,5 |
| S4 | v1.10 modelo 3 zonas + `damage`/`heal` + tick determinista + migración | v1.8, S0 | 2 |
| S5 | v1.10 `publicLook` + `view.js` + tests de fuga | S4 | 2 |
| S6 | v1.10 UI silueta/panel + Atender/Presionar (si entran) | S4, S5 | 2 |
| S7 | Integración harm/arcane/salud, bots, balance 3j 10/12/15, E2E | S3, S6 | 2 |
| S8 | Cierre: versiones, `news.js`, APK, despliegue con mesa vacía | todo | 1 |

**Total ≈ 14,5 sesiones.** v1.9 ≈ 6; v1.10 ≈ 9 (frente a las 24-26 de `salud.md:140`, porque se recorta a 3 zonas y se dejan cirugía/órganos/oficio para después).

### 7.2 Checklist de cierre (por versión)

- [ ] Versión en los seis sitios: `data.js:233`, `engine.js:1`, `ui.js:1`, `fx.js:1`, `index.html:7`, `sw.js:1` (CACHE), más entrada al principio de `news.js:8`.
- [ ] `npm test` verde: unitarios, pureza, fuga y persistencia.
- [ ] E2E escenario a escenario, incluido el nuevo de reto; nunca en paralelo.
- [ ] Balance 3j 10/12/15 dentro de ±4 pp; `allgood` ≥88 %; sin cambios fuera de rango.
- [ ] Sin restos de 4 zonas: `grep` de `ZONES`, `brazos`, `piernas`, `z_brazos`, `z_piernas` y clases `.zone`.
- [ ] Snapshots: desplegar con la mesa vacía; `/healthz` responde; primera carga tras reposo puede dar 503 ~1 min.
- [ ] APK con `tools/work/build_signed.py`; verificar `img/`, `styles.css`, `fx.js`, `net.js`, `news.js`, `npc.js`.
- [ ] Actualizar `HANDOFF.md`, renumerar `magia.md`/`salud.md` y anotar decisiones tomadas.

### 7.3 Decisiones pendientes

1. **[D] Alcance de «magia recortada»:** ¿qué tiers sobreviven en v1.9 y entra `state.arcane`/`resolveArcane` o se pospone?
2. **[D] Las 3 zonas:** ¿cuáles y se conserva el modelo `{t,n,bleed,inf,tx}` o solo buckets de daño?
3. **[D] Suelo del reto:** HANDOFF fija −6; `magia.md:184` recomienda −6 pero `magia.md:150` formula −10. Confirmar −6 y tope +15.
4. **[D] Obligatoriedad:** ¿reto opcional por ajuste (recomendado) u obligatorio? ¿Distinto en local y online?
5. **[D] Forma del token y validación:** `{seed,sig}` firmado, recálculo en servidor, y si `act` crece a cinco argumentos.
6. **[D] Orden de capas:** harm (H1/H2) → arcane (C0-C8) → salud, o al revés; y qué ocurre antes de `shadowStrike` (`engine.js:2405`).
7. **[D] Alcance de v1.10:** ¿solo modelo + tick, o también Atender/torniquete/cirugía?
8. **[D] Numeración:** los diseños usan v1.7/v1.8; HANDOFF manda v1.9/v1.10. Renumerar antes de implementar para que las citas no se crucen.
