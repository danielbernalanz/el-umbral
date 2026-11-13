# El Umbral online: diseño y viabilidad (sobre v1.5.0)

Solo diseño. No se ha tocado ningún archivo del juego. Datos medidos del código: engine.js 3312 líneas, ui.js 1492.
Entorno: Node v22.23.4. No hay `ws` ni otros paquetes de red instalados globalmente; sí está **playwright**, que sirve para la fase F6.

## 0. Veredicto
Es viable sin dependencias y sin cambiar las reglas del motor. Hay cuatro claves:
1. **Un motor por sala** cargado con `vm.createContext` (data.js + engine.js tal cual). Lo único mutable a nivel de módulo es `let state` y el almacén en memoria `LS`, así que el aislamiento entre salas es total y no hace falta editar el motor.
2. **Cambio de contexto por jugador.** Node ejecuta cada comando de forma atómica porque el motor es síncrono. Antes de cada comando de P se fijan `state.turn=P`, `state.handoff=false` y `state.pendingPush=ctx[P]`, y al terminar se guardan. Así funcionan sin tocarlas todas las comprobaciones `state.turn !== pid` (act, cast, declare, answerPact/Offer/Hand, pushLuck, useItem, estudiar).
3. **Vista filtrada con lista blanca** (todo lo que no está listado es privado) y **consultas precalculadas** en el servidor. El cliente nunca ejecuta el motor.
4. **Transporte SSE + POST** sobre `http` de Node: sin dependencias, se puede probar aquí y funciona en Render, en el navegador y en WebView.

## 1. Arquitectura y adaptador en ui.js
**API que usa ui.js** (grep de `U.*`, 60 funciones distintas):
- **Mutaciones** (unas 32 llamadas): createGame, act×2, cast, declare×2, answerOffer×4, answerHand×2, answerPact, answerTime, addTime, useItem×2, learnSpell, improveSpell, pushLuck, encounterStart×2, encounterAct, finishTurn, nextTurn, nextRound, resolveCouncil, endCouncil, dismissWarn, tick×2. Solo en local: save, loadGame, hasSave, clearSave.
- **Consultas:** getState (33 llamadas), currentPlayer (17), maxRounds, visibleHealth, spellProgress, spellInfo, isUnlocked, actionOdds, pSuccess, secretInfo, healthInfo, umbralInfo, xpInfo, domInfo, studyOptions, declareOptions, getPactOffers, getOffer, getHandOffer, pactTerms, activePacts, unlockNotices, getSince, behindSchedule, turnSeconds, councilSeconds, councilPrompt, timeWarn, timeLeftMs, endAtTs, extEnd, elapsedMin, getEnding, exportLog/exportStory/buildStory, más hhmm y D, que son puros.
- **Ojo:** `getOffer` y `unlockNotices` mutan el estado (generan la oferta de forma perezosa o marcan avisos). Cada consulta hay que auditarla para saber si es pura antes de precalcularla.

**Dónde lee ui.js datos ajenos:**
- `s.players` (18 lecturas): nombres y vivos, y las sombras alzadas en la línea 448 (`players[id].risenBy`).
- `pendingAction.canTarget(t,p)` en las líneas 765, 872/877 y 912. Ejecuta funciones de D.ACTIONS sobre campos ocultos del objetivo. **Esto hay que sustituirlo por una lista `q.targets[acción]` calculada en el servidor.**
- `s.assassinId` y `s.shadow` (2 lecturas cada uno): solo se usan en el final y el log.
- `s.order`, `s.skipped`, `s.lastResolution`, `s.ending`, `s.publicClues`, `s.chronicle`.

**Capa intercambiable:**
- **LocalBackend = `window.UMBRAL` tal cual**, el mismo objeto. El modo local no cambia ni en el orden de ejecución.
- **OnlineBackend** (www/net.js, nuevo) expone los mismos nombres:
  - `getState` devuelve el estado redactado.
  - `currentPlayer` devuelve «mi» jugador (con mis datos completos).
  - Las consultas leen `view.q[nombre][args]`, precalculado por el servidor.
  - Las mutaciones envían POST y devuelven una Promise.
- Se añade un ayudante `run(res, cb)`: si `res` es una Promise espera; si no, llama a `cb` en el acto. Las unas 32 llamadas de mutación quedan como `run(U.act(...), r => …)`, y en local el resultado es idéntico y síncrono.

**Puntos de ui.js que hay que tocar:** unas 32 mutaciones (cambio mecánico), 3 sitios de canTarget, las pantallas de traspaso y la de «esperando a: Ana, Luis (2/4)», autoturno y reloj (en online solo se muestran; decide el servidor), menú «En línea» y lobby. **En total, unas 50-70 líneas de ui.js**, más net.js (unas 400 líneas) y unas 40 líneas de HTML del lobby.

**Cómo se evitan regresiones en local:**
- Se verifica que `U === window.UMBRAL` en local.
- net.js solo se usa al pulsar «En línea».
- ui_run.py, fuzz_ui.py e ix_ui.py deben pasar sin cambios antes y después.
- Se comparan capturas de los mismos flujos.

## 2. Privacidad
**Vista por jugador:** `view(P) = { serverNow, phase, round, endAt, event, timeAsk, publicClues, chronicle visible, players: [públicos], me: jugador P completo, q: consultas de P, wait: [nombres pendientes], votes }`.

**Campos públicos de cada jugador (lista blanca):** id, name, dead, dying, exposed y `visibleHealth(p)`, que es un texto ya calculado.

**Todo lo demás de un jugador es privado:**
- Identidad y personaje: role, affinity, secret*, stats.
- Atributos y estado interno: virtue, corr, hp, zones, wounds, status, focus.
- Inventario y conocimiento: items, clues, notes, spells, stolen.
- Defensa y modificadores: roundDefense, roundAttack, protection, shield, reflect, ally, fog.
- Historial y contadores: betrayals, keptPacts, successfulAccusations, aggr, agg, dom, did, newAct, hints, pressure, alignment, umbral.
- Ofertas, encuentros y premios: offer, lastOffer, enc, via, gift, fulfilled, reward*.
- Nigromancia: risen y risenBy.
- Turno: acted, action, actionTarget.

**Estado global oculto hasta el desenlace:** assassinId, shadow, pacts, pactOffers, hands, council.interactions y council.ambushes (solo se publica el resultado: lastResolution y la crónica), finalTempt, falseAccusations, eventsSeen, rumorRound, firstIdx, pendingPush, glog, epi, ending.

**Fugas temporales:** la ejecución es inmediata, así que la crónica pública y las notas causadas por otros pueden aparecer en mitad de la fase privada. Por ejemplo, «✖ X pierde su turno», «Un grito se oyó…» o «una sombra te atacó».
- El servidor **retiene** las entradas de crónica añadidas durante la fase privada hasta la barrera (el Consejo).
- Para las notas de cada jugador, mide la longitud de `p.notes` de todos antes y después de cada comando. Las notas que P recibe por comandos ajenos quedan retenidas hasta el Consejo.
- La vitalidad y el estado moribundo se muestran en vivo, porque cambian lo que se puede hacer. Es la misma información que en local, donde ya sabes que fue uno de los que jugaron antes que tú.

**Log y crónica exportables:** exportLog, exportStory y buildStory leen glog y epi con todo. Solo se sirven cuando `phase === "ending"`, que es el desenlace y ya lo revela todo.

**Errores:**
- La respuesta va solo a quien hizo el comando.
- Antes de llamar al motor, el servidor valida el objetivo contra `q.targets`. Si no está en la lista responde «Objetivo no válido», genérico, para que nadie pueda sondear canTarget («no puede ser alzado» o «devorado»).

**Anti-trampas:**
- Las reglas, las tiradas y el RNG se ejecutan solo en el servidor (`Math.random` de la sala).
- El cliente solo envía `{cmd, args}` con una lista de comandos permitidos por fase.
- El token de jugador es aleatorio de 128 bits (crypto) y solo puede actuar como su propio jugador.

**Garantía comprobable (F1):** test que juega cientos de partidas de bots y, en cada paso, serializa `view(P)` y busca cualquier valor privado de Q≠P. Busca el texto del secreto, el nombre del rol, ítems, notas y estos fragmentos de crónica: «assassin», «Asesino» antes de que lo desenmascaren, `pacto_`, `secret`. Además comprueba que todas las claves están en la lista blanca.

## 3. Sincronización
- **Salas:** código de 5 letras sin ambiguas (unos 8 M combinaciones).
  - El anfitrión crea la sala y comparte el código o un enlace `?sala=ABCDE`.
  - Para unirse se da nombre y se recibe `{roomId, pid, token}`, que se guarda en localStorage.
  - Antes de empezar se puede entrar y salir. Una vez empezada no se admiten nuevos jugadores.
  - El anfitrión pulsa «Empezar» con 3-10 jugadores y elige la hora de fin. El cliente convierte la hora local a una marca de tiempo epoch (`endAt`) y el servidor llama a `createGame(names, {endAt})`.
- **Reloj:** el motor usa el `Date.now()` del servidor. Cada vista lleva `serverNow`; el cliente calcula su desfase y muestra `endAt − (Date.now()+desfase)`. Los ticks del cliente se ignoran en online y el servidor revisa cada segundo timeUp, timeWarn y los plazos.
- **Reconexión:** con el token se reabre el SSE y se recibe la vista completa. No se pierde nada, porque el estado del turno vive en el servidor: acted, encuentro y pendingPush (en `ctx[P]`).
- **Fase privada simultánea:**
  - Todos los vivos que pueden actuar juegan a la vez. Los comandos de la sala se ejecutan en serie por orden de llegada (el bucle de eventos los hace atómicos).
  - `finishTurn` marca a P como «listo». Si otro jugador deja a P con `acted=true` antes de que actúe (aturdir o grillete) o moribundo, P queda listo automáticamente con su nota.
  - **Barrera:** cuando todos están listos, el servidor fija `state.turn` al último de `state.order` y llama a `nextTurn()`. Eso ejecuta `beginCouncil()` (que a su vez lanza shadowStrike), sin tocar el motor.
- **Orden de efectos al cerrar la ronda:** es el del motor, sin cambios: barrera → shadowStrike → Consejo → resolveCouncil (declaraciones) → endCouncil (pactos, corrupción y hambre, curación, tentación…) → nextRound (evento, rondas de gracia, estados). Todo lo de fin de ronda ya era determinista y no depende de quién jugó primero.
- **Pactos y manos:**
  - La oferta llega en vivo si el destinatario aún no ha terminado (aviso «Tienes una propuesta»). Si ya terminó, la responde en su turno de la ronda siguiente. Es la misma semántica que en local, donde solo puedes responder en la misma ronda si juegas después.
  - El rechazo automático de `finishTurn` se mantiene.
- **Consejo:** temporizador del servidor (councilSeconds). Termina antes si todos los vivos pulsan «Listo». Después el servidor llama a resolveCouncil y endCouncil, y pasa a nextRound cuando todos pulsan «Continuar» o a los 30 s.
- **Pregunta de tiempo** (Añadir 1/2 rondas o Terminar ahora): cada uno vota y los votos se ven. Decide el anfitrión. A los 30 s gana la mayoría; si hay empate, «Añadir 1 ronda». Después el servidor llama a `answerTime`.
- **Autoturno en el servidor:** la misma regla que `autoTurn()` de ui.js. Al llegar a `turnSeconds()` se manda un aviso; a los +25 s, si no ha actuado, se ejecuta `act(meditar)`, la declaración pendiente se omite y se llama a finishTurn. La lógica se copia a server/auto.js y se comprueba con un test que compare ambas.
- **Desconexiones:**
  - Si un jugador se desconecta, el autoturno sigue su curso normal.
  - Si todos los conectados están listos y solo faltan jugadores desconectados desde hace más de 15 s, el autoturno se les aplica ya.
  - Tras 2 rondas desconectado, el personaje queda «ausente»: medita siempre y su voto cuenta como abstención.
  - Si el anfitrión se va, el papel pasa al primer jugador conectado.

## 4. Qué cambia al pasar de secuencial a simultáneo
Hoy cada acción se resuelve **al instante**, con su tirada, contra el estado del objetivo en ese momento. En online, el «orden» pasa a ser el de llegada. Lo que dependía del orden:
1. **Defensas de la ronda** (proteger, égida, sombra_guarda, objetos de +defensa): solo protegen si llegan antes que el ataque. Igual que en local, pero ahora gana el más rápido en vez de seguir la rotación de `firstIdx`.
2. **Aturdir y grillete:** «pierde su turno esta ronda» solo afecta a quien aún no ha actuado. Un jugador rápido queda inmune; uno lento puede perder una acción que ya estaba eligiendo, lo que es frustrante.
3. **Socorrer:** solo pueden hacerlo quienes aún no hayan actuado cuando alguien cae moribundo.
4. **Robar:** depende de los objetos que tenga el objetivo en ese momento.
5. **Pactos y manos:** se responden en la misma ronda solo si el destinatario no ha terminado.
6. Los encuentros, la caza, las rondas de gracia, la Sombra, la corrupción y la tentación van por ronda y no les afecta el orden.

**Propuesta mínima:**
- (a) Mantener la ejecución inmediata por orden de llegada. Es lo que preserva las tiradas en vivo, pushLuck y los encuentros.
- (b) Exigir **10 s de lectura** antes de aceptar acciones dirigidas a otros jugadores, para cortar la carrera de clics.
- (c) **Aturdir y grillete contra quien aún no ha actuado pasan a valer para la ronda siguiente** solo en online. Así nadie pierde a medias una acción ya elegida, y además se elimina la ventaja de ser rápido.
- (d) Retener notas y crónica (sección 2).

**Riesgos de equilibrio que hay que medir con bots:** sim10, smart y smart_human con un modo `--online` que simule el orden de llegada:
- (i) Orden aleatorio cada ronda en lugar de la rotación. Es el caso realista.
- (ii) El Asesino siempre primero. Es el peor caso: los ataques llegan antes que proteger o égida.
- (iii) El Asesino siempre último.

Si (ii) sube la victoria del Asesino más de 5 pp sobre local (3 jugadores a 12/15 min, y 6 jugadores a 20 min), hay que subir el +2 de `protection` o aplicar las defensas de la ronda con retroactividad (todas las defensas cuentan contra los ataques de esa ronda). Este segundo cambio sí tocaría el motor, así que se dejaría para una segunda vuelta.

## 5. Operación en Render (plan gratuito)
- **Límites del plan:** 1 proceso, unos 512 MB. Se suspende tras unos 15 min sin peticiones, con arranque en frío de unos 30-60 s. El disco es efímero.
  - Respuesta del cliente: hace ping a `/healthz` al abrir el lobby («Despertando el servidor…»).
  - Durante la partida, cada cliente envía `POST /api/ping` cada 60 s.
  - El SSE manda un latido (`:hb`) cada 20 s para que no lo corten los proxies.
- **Persistencia:** las salas viven en memoria. Opcionalmente se guarda una instantánea JSON por sala en `/tmp` en cada barrera, para sobrevivir a un fallo del proceso pero no a un redespliegue. Se avisa en el lobby de que reiniciar el servidor cancela las partidas.
- **Tamaños:** cada sala ocupa unos 2-5 MB (contexto vm + estado). Máximo 50 salas y 10 jugadores por sala. Cada vista ocupa unos 10-30 KB y se envía completa en cada cambio, sin diffs.
- **Limpieza:** una sala sin conexiones se borra a los 30 min. Una partida terminada se borra a los 15 min. Ninguna sala dura más de 4 h.
- **Límites de uso:** 10 comandos/s por token; 20 creaciones o uniones por minuto por IP. Cuerpo máximo de 8 KB. Nombres de 1-16 caracteres, saneados.
- **Orígenes:** el servidor sirve www/ como estático, así que en navegador todo es mismo origen. `/api` responde con `Access-Control-Allow-Origin: *` sin cookies (el token va en una cabecera), lo que permite usar el APK desde file://, cuyo origen es «null».
- **Despliegue:** `GET /healthz` y `render.yaml` (web service Node, `startCommand: node server/index.js`, `healthCheckPath: /healthz`, PORT por entorno, sin build). Incluir instrucciones paso a paso para el usuario (repo en GitHub, luego New → Blueprint).
- **URL configurable:** constante `ONLINE_URL` en data.js. En navegador o PWA se usa el propio origen. En sw.js las rutas `/api` no se cachean.
- **APK:** el manifiesto actual **no tiene el permiso INTERNET**; está comprobado en el AXML binario. Hay dos opciones:
  - Parchear el AXML en build_signed.py: hay que insertar una cadena y el recurso, es delicado.
  - Que el botón «En línea» del APK abra la URL web en el navegador. **Recomendado para la primera versión.**

## 6. Fases (todo verificable sin dispositivos reales)
| Fase | Archivos | Modelo | Aceptación | Riesgo |
|---|---|---|---|---|
| F1 Vista y auditoría de pureza | online/server/view.js, test/noleak.js, test/pure.js | dev | 0 fugas en 300 partidas de bots (3/6/10 jugadores) con todos los Q≠P; lista de consultas puras e impuras; `q.targets` igual a canTarget | Medio (consultas que mutan) |
| F2 Servidor, salas y transporte | server/index.js, rooms.js, engine_vm.js, ctx.js | dev | Clientes Node (fetch + EventSource propio sobre http) crean, se unen y juegan con bots 50 partidas completas sin error; las salas no se mezclan; el cambio de contexto de pendingPush funciona | Medio |
| F3 OnlineBackend y lobby | www/net.js (nuevo), ui.js (unas 60 líneas), index.html (lobby) | dev | La batería de UI local pasa sin cambios; en online, Playwright con 3 contextos juega 1 partida; 0 avisos de «consulta no precalculada» | **Alto** (cobertura de consultas) |
| F4 Simultaneidad, reloj y barreras | rooms.js, auto.js, sims con `--online` | dev, con revisión puntual de arquitecto solo de la barrera y la retención | Desenlace en el 100 % de 200 partidas; equilibrio (i)/(ii)/(iii) dentro del ±5 pp o propuesta | Alto (balance y fugas temporales) |
| F5 Reconexión, desconexión y anfitrión | rooms.js, net.js | dev | Test: cortar SSE en mitad del turno → reconectar → mismo turno; si nadie vuelve, el autoturno cierra la ronda; el anfitrión se transfiere | Medio |
| F6 E2E | test/e2e_online.py (playwright) | dev escribe, mecanico ejecuta y resume | 4 navegadores × 20 partidas, mezcla de humanos-bot y desconexiones; ninguna vista contiene datos ajenos (se reutiliza el escáner de F1 sobre el tráfico SSE) | Bajo |
| F7 Render y documentación | render.yaml, package.json (sin dependencias), README_ONLINE.md, data.js ONLINE_URL, sw.js | dev (mecanico para comprobar versiones y APK) | `node server/index.js` sirve el juego y `/healthz`; el APK y la web local siguen como antes | Bajo |

**Orden y paralelismo:**
- F1 primero; es la base de seguridad.
- F2 puede empezar en paralelo (otro agente, sin tocar www).
- F3 necesita F1 y F2.
- F4 y F5 van en serie sobre F2/F3.
- F6 y F7 al final.
- Las simulaciones de línea base para comparar el equilibrio se pueden lanzar ya con mecanico.
- Durante F3 solo un agente edita www.

## 7. Decisiones del usuario (recomendación por defecto)
1. **Plataforma:** online primero en el navegador/PWA (URL de Render); el APK abre esa URL. Meter el permiso INTERNET en el APK queda para después. *Rec.: sí.*
2. **Orden en simultáneo:** inmediato por orden de llegada, con 10 s de lectura y aturdir/grillete válidos para la ronda siguiente. *Rec.: sí.* La alternativa (resolver todo al cierre) rompe pushLuck y las tiradas en vivo.
3. **Pregunta de tiempo:** votos visibles; decide el anfitrión; a los 30 s gana la mayoría y el empate es +1 ronda. *Rec.: sí.*
4. **Desconexión:** autoturno normal, que se acelera si solo faltan desconectados; tras 2 rondas el jugador queda «ausente»; no se puede entrar en una partida empezada. *Rec.: sí.*
5. **Log y historia exportables en online:** solo tras el desenlace y para todos los jugadores. *Rec.: sí.* La alternativa es solo el anfitrión.

**Esfuerzo:** de 8 a 12 sesiones de dev, más mecanico para las pruebas, y 1 revisión breve de arquitecto en F4.

**Riesgos principales:**
- Cobertura de consultas en ui.js (F3).
- Fugas por momento de llegada (mitigadas con la retención).
- Equilibrio por velocidad.
- Arranque en frío de Render y pérdida de salas al reiniciar.
- APK sin INTERNET.

El modo local queda protegido por diseño, porque `U` sigue siendo el mismo objeto.

## Resumen
1. Es viable sin dependencias: Node 22 con http, SSE + POST y vm; `ws` no está y no hace falta. Playwright está disponible para el E2E.
2. Un motor por sala (vm con data.js + engine.js intactos). Solo `state` es mutable, así que las salas quedan aisladas sin tocar el motor.
3. Simultaneidad por cambio de contexto: antes de cada comando de P se fija `turn=P`, `handoff=false` y `pendingPush=ctx[P]`. Los comandos son atómicos y van por orden de llegada.
4. Barrera: cuando todos han hecho finishTurn (o el autoturno del servidor), se llama a `nextTurn()` → `beginCouncil()`. El orden de fin de ronda es el actual.
5. ui.js usa 60 funciones `U.*`. El adaptador mantiene `U = window.UMBRAL` en local (idéntico) y añade OnlineBackend con las mismas firmas.
6. En ui.js hay que tocar unas 50-70 líneas: unas 32 mutaciones con `run()` (síncrono en local), 3 canTarget pasan a `q.targets`, pantalla de espera y lobby.
7. Las consultas se precalculan en el servidor; getOffer y unlockNotices mutan, así que hay que auditar la pureza (F1).
8. Privacidad con lista blanca (id, name, dead, dying, exposed, visibleHealth). Todo lo demás, incluidos assassinId, pactos, ofertas, manos y glog/epi, es privado hasta el desenlace.
9. La crónica y las notas generadas por otros durante la fase privada se retienen hasta el Consejo, para evitar fugas por el momento de llegada.
10. Las tiradas y el RNG solo ocurren en el servidor. Los objetivos se validan contra `q.targets`, con errores genéricos y solo para quien envía el comando. El token es de 128 bits.
11. Reglas: inmediato por llegada, 10 s de lectura, y aturdir/grillete sobre quien aún no ha actuado pasan a la ronda siguiente. Riesgo de equilibrio con el Asesino primero, medible con sims `--online`.
12. Pregunta de tiempo con votos (decide el anfitrión; a los 30 s gana la mayoría; el empate es +1 ronda). El autoturno lo aplica el servidor y se acelera si solo faltan desconectados.
13. Render gratuito: memoria y 1 proceso, `/healthz`, latido SSE, ping a los 60 s, límites de uso, limpieza de salas y `render.yaml`. El APK no tiene el permiso INTERNET, así que la primera versión abre la web.
14. Fases: F1 vista y no-fuga → F2 servidor (en paralelo) → F3 adaptador y lobby (riesgo alto) → F4 simultaneidad → F5 reconexión → F6 Playwright → F7 Render. Todo con dev, mecanico para las pruebas y una revisión de arquitecto en F4.
15. Esfuerzo de 8 a 12 sesiones de dev. El usuario debe decidir 5 puntos, con recomendación por defecto en la sección 7.
