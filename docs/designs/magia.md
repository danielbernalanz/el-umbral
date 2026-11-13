# El Umbral — Diseño del Sistema de Magia profunda («Arcana») v1.7 (propuesta)

Solo diseño. Rutas de código: `scratchpad/apk/assets/www/{engine,data,ui}.js` (E/D/UI) y repo `/home/claude/el-umbral/server/*` (S).
Estado: PROPUESTA para decidir (ver §12).

## 0. Resumen en 12 líneas
1. Hoy hay 13 formas (E:`SPELL_FORMS` ~l.563) × 6 aspectos (E:`SPELL_ASPECTS` ~l.577), maestría 0-3 por éxitos (E:`MASTERY` l.644, `spellLevel` l.650, `spellRise` l.653), modos cauto/normal/desatado (E:`spellCheck` l.672, `cast` l.711), estudio por grimorio (E:`studyOptions` l.789, `learnSpell` l.798, `improveSpell` l.820), máx. 4 conjuros.
2. `cast` hoy **resuelve al instante** (E:`applySpell` l.621 aplica estado/daño en el momento) → el resultado depende de quién actúa antes. En online eso se arregla con `server/order.js` (aturdir a ronda siguiente), pero no hay interacción real entre conjuros.
3. Propuesta: la TIRADA sigue siendo inmediata y secreta (feedback intacto) pero el EFECTO se encola en `state.arcane` y se resuelve **al final de la fase privada** (hook en E:`beginCouncil` l.2314, antes de `shadowStrike`) en **capas fijas** → determinista, independiente del orden de llegada, idéntico en local y online.
4. 5 escuelas (Luz, Sombra, Naturaleza, Mente, Umbral) y 4 tiers (Básico, Intermedio, Avanzado, Arcano). 37 conjuros (§5).
5. Simultaneidad propia (preparar/liberar, concentración, cadena) y entre jugadores (contrahechizo, resonancia, desbordamiento, reflejo, ritos colectivos vía infraestructura de pactos).
6. Skill checks (micro-retos) que desplazan la probabilidad entre −10 y +15 puntos (§9), todos los turnos pasan por un reto de forma/duración idénticas (privacidad).
7. Compatibilidad: los 13 conjuros actuales son el Tier 1; partidas guardadas válidas con metadatos derivados; snapshots online se invalidan (ya es política: desplegar con mesa vacía).

## 1. Qué hay hoy y qué cambia (citas)
| Pieza | Hoy | Cambio |
|---|---|---|
| Formas/aspectos | `SPELL_FORMS` (kind off/def, attr, diff), `SPELL_ASPECTS` (roll, selfCorr, power, stealth, pierce) | se añaden `school`, `tier`, `layer`, `cost` a cada forma; aspectos solo en T1-T2 (T3-T4 son fijos, «arcanos») |
| Lanzar | `cast` l.711: valida turno, `sp.uses -= 1`, `rollCheck`, `applySpell` inmediato; protecciones consultadas en el acto (`t.ally` l.735, `t.reflect` l.738) | `cast` tira y paga costes igual; encola `{caster,spell,target,mode,ok,crit,power,arrival}` en `state.arcane`; `resolveArcane()` aplica por capas |
| Maestría | por éxitos 1/2/4 sobre CADA conjuro | se mantiene por conjuro (T1-T2) y se añade **maestría de ESCUELA** (suma de niveles de sus conjuros → afinidad, §3) |
| Tope | `p.spells.length >= 4` (E:l.280, l.810) | capacidad por «peso» (T1=1, T2=1, T3=2, T4=2; capacidad 6) |
| Exposición | «Se oyeron palabras antiguas cerca de X» (E: ~l.760) revela objetivo si éxito | T1: igual solo si éxito y sin sigilo; T2+: **nunca** nombra objetivo ni escuela; T3 «temblor»; T4 «el Umbral se estremece» |
| Info a la vista online | `view.js` l.91-105 calcula `spellInfo` con `t.protection=null` | extender a TODA defensa oculta nueva (ward, reflect, ally, concentración): la vista se calcula como si no existiesen |
| Comando online | `game.js` l.380 `cast(spellId,target,mode)` | + `skill` (token del reto, §9) |

## 2. Escalera de poder (tiers)
| Tier | Rol | Cómo se desbloquea | Coste típico | Limita |
|---|---|---|---|---|
| T1 Básico | los 13 actuales | grimorio incompleto (3 opciones), meditar (1.º defensivo), ermitaño, círculo | usos 1-2, ±3 oscuridad | — |
| T2 Intermedio | efectos de estado, protección ajena, contrahechizo básico | **Practicante** (nivel 1) en ≥1 conjuro de la MISMA escuela + grimorio o ermitaño (opción «Enseñar»); `Perfeccionar` ofrece «saltar de escuela» | 1 foco + 1-4 oscuridad o 1-2 vit | máx. 2 T2 conocidos |
| T3 Avanzado | zonas, rituales de 2, reacciones, concentración | **Dominado** (nivel 2) en la escuela + **Grimorio mayor** (objeto nuevo, eventos «biblioteca», «copista», ermitaño con pista alta) + componente opcional | 2 foco, 1 uso, 3-8 oscuridad/vit | máx. 1 T3 activo por ronda; 1 uso por conjuro y partida salvo meditar |
| T4 Arcano/prohibido | decide partidas: pistas absolutas, resurrecciones, anulación global | **Maestro** (nivel 3) en la escuela + **Libro sin nombre** (evento raro, 1 por partida, nunca en mesa de ≤3 antes de ronda 4) + componente obligatorio (vela, ceniza, hierbas, polvo, espejo, reliquia, fragmento) | 3 foco + componente + vit/oscuridad altos; 1 uso por partida | 1 por jugador, y máximo 2 en toda la partida; siempre deja rastro público |

Regla de oro anti-snowball: pagar siempre una de tres monedas (oscuridad, vitalidad, foco) y que los desbloqueos T3/T4 exijan especialización (una escuela) → la profundidad es elegir, no acumular.

## 3. Escuelas y afinidad (la elección que importa)
| Escuela | Estilo | Estado/atributo | Sinergia |
|---|---|---|---|
| Luz | proteger, sanar, purificar | Mente | −oscuridad por lanzar; en corrupción alta +1 dif. (ya existe E:l.683) |
| Sombra | daño, nigromancia, sombras | sombra | +1 «hambre» satisfecha por lanzar; se funde con el **dominio de sombras** (E:`DOM_NAMES` l.461): niveles de dominio = niveles de escuela Sombra; Alzar (l.1669) es T3 |
| Naturaleza | estados lentos, regeneración, cosecha | cuerpo (nuevo: attr `cuerpo`) | estados duran +1 si el objetivo ya los tiene |
| Mente | información, control, anulación blanda | mente | pistas fuertes sin mancharse; Verdad forzada (T4) |
| Umbral/Tiempo | reflejo, contrahechizo, aturdir, rebobinar | mente/sombra | únicos que interactúan con otros conjuros (capas 1-3) |

Afinidad: la **primera escuela** en la que alcances Practicante da «Afinidad»: −1 dificultad y +1 potencia en esa escuela. Una segunda escuela es posible (cuesta 1 grimorio extra), pero **Luz↔Sombra son opuestas**: lanzar ambas en la misma partida = «Disonancia» (+1 dificultad a la opuesta hasta ser Maestro en las dos). Resto sin penalización. Capacidad 6 pesos obliga a decidir.

## 4. Riesgos y exposición (d)
- Fallo: nada (igual que hoy) salvo cauto (no gasta uso). Pifia (dado 1): +3 oscuridad (E:l.762). **Backlash por tier** (modo desatado o pifia): T1 igual que hoy (2 daño +4 oscuridad); T2 3 daño; T3 «Reverberación»: 3-4 daño en zona aleatoria y estado `maldito` 2 rondas; T4 «Rotura del Velo»: pierdes el conjuro, +10 oscuridad y herida grave, **línea pública sin nombres**.
- Hambre del Umbral (corrupción media/alta): todo conjuro Sombra T2+ y T3 de cualquier escuela con coste de oscuridad cuenta como «acto oscuro» (usa `darkAct`, E:l.909). Luz/Naturaleza NO sacian el hambre (siguen siendo «bien»); en corrupción alta los def siguen +1 dificultad (E:l.683), nunca se prohíben.
- Corrupción: conjuros Luz con `selfCorr<0` cuentan `antiAct` (frena daño y reduce nivel); Sombra T3 puede ser usado por el Asesino sin coste extra de oscuridad (pero ya ES oscuro).
- Exposición pública (crónica): T1 como hoy; T2: «Se oyeron palabras antiguas entre las ruinas» (sin objetivo, a veces falso rumor de relleno, ver §6.6); T3: «El suelo tembló bajo las ruinas» (sin autor); T4: «El Umbral se estremeció» (sin autor ni escuela). **Nunca** autor, escuela ni objetivo. Los afectados reciben nota privada genérica («una fuerza ajena…»), como hoy.
- Pactos/secretos/tentación: cast sigue registrando `p.deeds` (E:l.766) y `noteAggr` (tentación por comportamiento). Nuevos eventos de secreto: «Justicia» se cumple con Verdad forzada; «Intacto» con Égida/Custodia. Sin cambios de reglas.

## 5. Catálogo (37 conjuros)
Leyenda: coste = usos / foco / oscuridad(os) / vitalidad(vit) / comp(onente). Capa = orden de resolución (§6). «Sim» = interacción simultánea.
### Tier 1 — Básico (los 13 actuales, con escuela)
| # | Nombre | Esc. | Coste | Efecto | Riesgo | Desbloqueo | Capa / Sim |
|---|---|---|---|---|---|---|---|
|1|Égida|Luz|1-2 usos|+3 defensa (+5 potente)|—|grimorio / meditar|C2 ward; absorbe 1 conjuro T1|
|2|Sanar|Luz|1-2|+3 vit (+6)|se pierde si no hay heridas|idem|C5|
|3|Purga|Luz|1-2|−10 os. y limpia estados|—|idem|C5|
|4|Presagio|Mente|1-2|pista fuerte sobre objetivo|—|idem|C6|
|5|Velo|Umbral|1-2|anula próxima acusación|—|idem|C2|
|6|Reflejo|Umbral|1-2|rebota 1.ª agresión directa|maldito al emisor|idem|C3; ver §6 reflejo|
|7|Rayo|Sombra|1-2|3-4 vit (5-6 crit)|deja rastro|idem|C4|
|8|Pesadilla|Sombra|1-2|+5 os. al objetivo|—|idem|C4|
|9|Plaga|Nat.|1-2|veneno 2 rondas|—|idem|C4 (se acumula con Esporas)|
|10|Marchitar|Nat.|1-2|sangrado 1 ronda|—|idem|C4|
|11|Maleficio|Mente|1-2|−1 tiradas 2 rondas|—|idem|C4|
|12|Drenar|Mente|1-2|−8 virtud al objetivo, +4 a ti|—|idem|C4|
|13|Grillete|Umbral|1-2|aturde (ronda siguiente)|—|idem|C4; interrumpe concentración|
### Tier 2 — Intermedio (requiere Practicante en la escuela)
|14|Custodia|Luz|1 uso, 1 foco, +1 os. si objetivo es el asesino|Protege a OTRO: absorbe 1 ataque o conjuro T≤2 dirigido a él (no a ti)|ataca la pista de que proteges|grimorio+Practicante Luz|C2 ward ajena|
|15|Aurora|Luz|1,1 foco|Cura 4 a otro y purga 1 estado|−3 os. si éxito; falla: +2 os.|idem|C5|
|16|Savia|Nat.|1,1 foco|Regeneración +1 vit/ronda 3 rondas (concentración: +1 ronda)|se corta si recibes ≥3 daño|idem|C5 sostenido|
|17|Zarza|Nat.|1,1 foco|Objetivo −2 defensa 2 rondas + sangrado 1|—|idem|C4|
|18|Esporas|Nat.|1,1 foco|Veneno 2 al objetivo y al siguiente en `state.order`|puede caer en tu aliado (determinista, anunciado)|idem|C4|
|19|Eco|Mente|1,1 foco, +1 os. si no hay conjuro|CONTRAHECHIZO: eliges un jugador; si ese jugador tiene un conjuro T≤2 encolado esta ronda lo anulas|si no hay → «eco vacío»: +2 os.|idem|C1|
|20|Olvido|Mente|1,1 foco|El objetivo pierde su pista más reciente sobre ti (y 1 sobre otro de tu elección)|—|idem|C4|
|21|Mordedura de sombra|Sombra|1,1 foco, +3 os.|4-5 vit y +2 os. al objetivo|hambre sí; rastro|idem|C4|
|22|Marca del Umbral|Umbral|1,1 foco|Marca: tus próximos 2 conjuros contra él −1 dif.; su próximo conjuro cuesta +1 foco|rastro T2|idem|C3 (afecta capa 4)|
|23|Ancla|Umbral|1,1 foco|Inmune a Grillete/aturdir esta ronda y la siguiente (concentración opcional)|—|idem|C2|
### Tier 3 — Avanzado (Dominado + Grimorio mayor)
|24|Santuario|Luz|1,2 foco|Égida 4 a ti y a quien tengas con pacto/protección; «temblor» público|—|Dominado Luz|C2; **rito de 2**: si el pacto cumple a la vez, +2 a ambos|
|25|Resurgir|Luz|1,2 foco,−2 vit|Saca de moribundo a un jugador (vit 4) sin tirada de Socorrer|si falla: tú −3 vit|idem|C5 antes de que `startRound` lo mate|
|26|Pacto de huesos|Sombra|1,2 foco,+6 os.|Un alzado (E:`riseCount` l.1669) ataca a un objetivo (5-6 vit) esta ronda|+hambre; revela «sombras»|Dominado Sombra (dom ≥2)|C4|
|27|Justicia sombría|Sombra|1,2 foco,+4 os.|REACCIÓN: hiere 3 a cada jugador que lanzó un ofensivo esta ronda (sin tocar a defensivos)|golpea a quien te ayudó con rito|idem|C6 (tras C4)|
|28|Cosecha|Nat.|1,2 foco, hierbas −2 os.|Cada estado del objetivo (veneno/sangrado/infección/maldito) hace 2 vit y se consume|—|Dominado Nat.|C4|
|29|Voz ajena|Mente|1,2 foco|Cambia el OBJETIVO de un conjuro ofensivo encolado de otro jugador (tú eliges el nuevo, no puedes ser tú)|si el nuevo es el emisor: rebota completo|Dominado Mente|C3 «desvío»|
|30|Quiebre|Umbral|1,2 foco, espejo −1 os.|CONTRAHECHIZO mayor: anula conjuro T≤3 de un jugador y corta su concentración|si no hay, +4 os.|Dominado Umbral|C1|
|31|Segunda oportunidad|Umbral|1,2 foco|Guardas: tu primera tirada FALLIDA de la ronda (acción con tirada) se repite 1 vez (sin crit)|usas tu foco igual|idem|C0 (preparado, §7)|
### Tier 4 — Arcano / prohibido (Maestro + Libro sin nombre + componente)
|32|Alba|Luz|1 uso/partida,3 foco,vela|RITO (2-4): purga 15 y cura 5 a los participantes, quita maldiciones; solo 1 vez en la mesa|Si 1 participante falla, todos −3 vit|Maestro Luz|C7; rito|
|33|Alma robada|Sombra|1,3 foco,ceniza,+10 os.|Roba 4 vit a un objetivo y le añade +8 os.; si lo mata, lo alza|rastro T4; pierdes dominio −1 si falla|Maestro Sombra|C4+|
|34|Floración|Nat.|1,3 foco,hierbas,−4 vit|RITO (≥2): cura 6 vit y estados a participantes; regeneración 2 rondas|participante ausente: sangrado a todos|Maestro Nat.|C7|
|35|Verdad forzada|Mente|1,3 foco,polvo,+6 os.|El objetivo debe mostrarte la verdad sobre su alineamiento (pista absoluta, solo para ti)|el objetivo recibe «alguien te ha leído»; falla = tu secreto de «Justicia» no cuenta|Maestro Mente|C6|
|36|Cierre del Umbral|Umbral|1,3 foco,espejo,+8 os.|Anula TODOS los conjuros T≤3 encolados esta ronda (incluidos los tuyos T≤2)|rastro T4; los anulados no pagan uso|Maestro Umbral|C1 global|
|37|Rebobinar|Umbral|1,3 foco,reliquia,−4 vit|Deshaces las heridas/estados que recibas esta ronda y cuentas lo no ocurrido|corrompe 5|Maestro Umbral|C8 (última)|
Excepto el Rito de Resonancia (§6.4) los T4 «de ritos» (32, 34) se disparan por pacto `rito`.

## 6. Reglas de resolución simultánea
### 6.1 Cola y capas
`state.arcane = [{id, caster, spell, tier, school, layer, power, target, ok, crit, mode, order}]`. `order` = turno en `state.order` (local) o, online, el orden determinista de capa; **la llegada no importa**. Capas fijas (A→B):
C0 Preparados (liberar cargas) → C1 Contrahechizos/Anulación → C2 Protecciones (wards: Égida, Custodia, Velo, Ancla, Santuario) → C3 Redirecciones y marcas (Reflejo, Voz ajena, Marca) → C4 Ofensivos → C5 Curación/Purificación → C6 Reacciones e información (Presagio, Justicia, Verdad) → C7 Ritos → C8 Rebobinar/limpieza (concentración, estados, `startRound` los gasta).
Dentro de una capa: potencia desc., tier desc., id de jugador asc. (pura función; mismo resultado en cualquier cliente/orden).
### 6.2 Contrahechizo
El contrahechizo (Eco/Quiebre/Cierre) NOMBRA a un jugador (o ninguno en Cierre). En C1: si el objetivo tiene una entrada `ok` de tier ≤ el del contrahechizo, esa entrada se marca `anulada` (el emisor NO pierde el uso si fue anulada; recibe nota «tu conjuro se deshizo»). Si el tier es mayor: contra-éxito parcial: se resta 1 de potencia y +2 os. al emisor. Si no hay nada: «eco vacío» con coste (§5). Es una apuesta por lectura de la mesa (suspense) y consume la acción.
### 6.3 Reflejo / protección / desvío
Wards absorben el PRIMER conjuro ofensivo de tier ≤ su tier dirigido a su dueño en C2; si el ward es de menor tier, se rompe y el conjuro entra con potencia −1. Reflejo (C3) devuelve al emisor el conjuro de mayor potencia dirigido al dueño, a potencia −1 (mín. 1) y con su coste `maldito` actual (E:l.739). `pierce` (aspecto vacío) y T4 ignoran wards. Voz ajena sustituye el objetivo ANTES de C4 y el reflejo nuevo se evalúa otra vez (máx. 2 iteraciones).
### 6.4 Resonancia y desbordamiento
- **Resonancia**: ≥2 conjuros ofensivos de la MISMA escuela y el MISMO objetivo en la ronda → el de mayor potencia gana +1 potencia y el resto se «consume» (sin efecto pero no pierden el uso). Avisa a los lanzadores en privado («tu conjuro resonó con otro»: no revela quién).
- **Desbordamiento**: ≥3 conjuros distintos sobre un mismo objetivo → el objetivo recibe solo el efecto del de mayor potencia; los demás lanzadores sufren 1 daño por «marea» (las ofensivas de coalición contra una víctima salen caras). Evita linchamiento arcano y rompe snowball.
- **Disonancia Luz/Sombra**: un ofensivo Sombra y una protección Luz sobre el mismo objetivo → la protección absorbe pero ambos lanzadores +1 os. («la luz se ensucia»).
### 6.5 Ritos colectivos (reutiliza pactos)
Un rito es un pacto secreto nuevo `tipo: "rito"` propuesto por la declaración secreta (E: pactos `activePacts`/`pactTerms`, ya existentes). Cada participante, en su turno privado de la ronda pactada, elige el MISMO conjuro de rito (aparece como acción normal, sin pistas a los demás). C7: si todos los participantes lo lanzaron con éxito → potencia = nº participantes; si alguno falla/no lo lanza → pagan «Todos −3 vit» y el pacto se rompe en privado (no público, igual que hoy). Privacidad: la lista de acciones es idéntica para todos; el rito aparece como una opción más solo a quien lo aceptó.
### 6.6 Simultaneidad propia
- **Preparar/liberar**: modo nuevo `preparar` (E:`spellMode`, l.671) paga el uso y 1 foco y guarda el conjuro (`p.charge={spellId,target,tier}`); en C0 de la ronda siguiente se libera automáticamente sin gastar acción (puede combinarse con otro conjuro). Se cancela si recibes ≥3 daño o aturdimiento.
- **Concentración**: Savia, Aurora (T2) y Ancla pueden sostenerse (`p.conc`) pagando 1 foco por ronda; mientras concentras −1 a tus tiradas de conjuro, se rompe si recibes ≥3 daño, Grillete o Quiebre. Máx. 1 (2 con Maestro).
- **Cadena (doble hechizo)**: con Dominado en una escuela y 2 foco puedes lanzar 2 conjuros en la misma acción: ambos en cola, el segundo con +1 dificultad y +2 os. si es de otra escuela; si ambos son de la misma escuela: «Armonía» +1 potencia al segundo. Máx. 1 cadena por ronda.
- **Rumor de relleno**: en rondas con 0 conjuros T2+, cada ronda hay un 40 % de «palabras antiguas» falsas (para que el rastro no delate el uso); en casos de Cierre/T4 no.
### 6.7 Online / determinismo
`resolveArcane()` solo lee `state.arcane` y estado; no usa `Math.random` salvo en `rollCheck` en `cast` (ya hoy). Se ejecuta en `beginCouncil` cuando todos actuaron, tanto en local como en `server/game.js`. Aturdir/Grillete siguen yendo a la ronda siguiente (la cola se resuelve al final de la ronda: todos «ya actuaron», igual que `order.js` en su regla actual). La orden de llegada solo afecta a QUIÉN llega a tiempo, no al resultado. Efectos inmediatos conservados: gasto de usos, foco, oscuridad, vit. del coste y la tirada. Efectos diferidos: todo lo que toca a otros.
### 6.8 Muertes y objetivos caídos
Si el lanzador muere/moribundo antes de C4 (por acción inmediata de otro, p. ej. cazar) su entrada se anula sin efecto («su magia se apagó»). Si el objetivo muere/moribundo: el conjuro ofensivo se pierde; el defensivo sobre otros fallido (E:`err`).

## 7. Cambios de datos y motor
**data.js**: `SPELL_DB` (id, nombre, escuela, tier, capa, coste, texto, requisitos); constante `SCHOOLS`, `TIERS`; objeto `GRIMORIO_MAYOR` y `LIBRO_SIN_NOMBRE` (kind "tome", tier 3/4); nuevos textos de crónica; `D.VERSION` 1.7.0.
**engine.js**:
- `SPELL_FORMS` + campos `school`, `tier`, `layer`, `cost`; derivación `spellMeta(sp)` (si faltan, mapa por `sp.form` → compatible con partidas antiguas).
- `cast`: separar `castRoll()` (tirada, costes, modo, skill) y `queueArcane()`; `applySpell` pasa a `applyArcane(entry)` llamada por `resolveArcane()`. Mantener los textos de `res.outcome` para el lanzador («queda en pie hasta el amanecer»).
- `beginCouncil` l.2314: `resolveArcane()` antes de `shadowStrike()`; `startRound` l.1557: limpiar `p.reflect/shield/ward` que no sean de la ronda siguiente, ya existe parcialmente.
- `p.conc`, `p.charge`, `p.affinity`, `p.schoolWins{}`; capacidad por peso; `genOptions` (l.~605) elige entre tiers disponibles; `studyOptions/learnSpell` aceptan grimorio mayor (T3) y libro sin nombre (T4).
- Estado `state.arcane = []`, `state.arcaneLog` (solo para exportLog tras desenlace). `exportLog/exportStory`: línea «magia: tier/escuela/capa/resultado» privada hasta el final.
- Modos: añadir `preparar`; `spellInfo` (l.695) devuelve capa, coste, tier, textos de interacciones (`why`).
- Pactos: tipo `rito` en `pactTerms/activePacts`.
**ui.js**: ver §8.
**server**: `view.js` (excluir `state.arcane`, `p.conc`, `p.charge`, wards ajenos; el `spellInfo` ignora los wards ocultos como hoy con `protection`), `game.js` (comando `cast` con `skill`; nuevos `challenge`, `challengeSubmit`), `snapshot.js` (SCHEMA 2; engineId cambia → los blobs viejos se rechazan limpiamente ya implementado), tests de fuga (`leak.test.js`) con la cola.
**Migración**: partida local guardada: `load()` añade `state.arcane = []`, `spells` sin `school/tier` se tratan como T1 por `spellMeta`. Snapshots online: invalidación por hash (409) → desplegar con mesa vacía; documentarlo en README.

## 8. UI mínima (sin abrumar, todos ven lo mismo)
- Pantalla Conjurar (ui.js l.809-845): lista agrupada por escuela con insignia de tier (puntos 1-4), «Lo más útil ahora» fila superior (misma lógica para todos: mayor prob. éxito × relevancia: def si hay herido, off si hay hostil reciente), y chips «Luz/Sombra/…» para saltar. Los conjuros se pliegan tras elegir.
- Selector de modo (`spellLine` l.765): cauto/normal/desatado/**preparar** (solo si ≥T2).
- Panel «Interacciones» de 1 línea al elegir objetivo («Puede ser anulado por contrahechizo»); sin listar lo ya encolado.
- Ficha: columna «Escuelas» con barra de afinidad; capacidad 6.
- Reto (§9) al final del turno.
- Texto veraz siempre; nada de números ocultos nuevos.

## 9. Skill checks (retos de habilidad)
### 9.1 Reglas
1. El reto desplaza la probabilidad base `p` del chequeo en puntos: **delta = −10 + 25·s'** (s' ∈ [0,1] puntuación normalizada: 0 fallo total → −10, 1 perfecto → +15). Omitir o caducar = `delta = 0` (base). Aplicación sin tocar `rollCheck`: tras la tirada normal, si `delta>0` y falló, con prob. `delta/(1−p)` pasa a éxito; si `delta<0` y acertó, con prob. `|delta|/p` pasa a fallo (E:`pSuccess` l.1168 d6; así la media se desplaza exactamente `delta` puntos, el dado sigue pesando). Pifia/crítico solo vienen del dado.
2. **Forma idéntica, dificultad interna**: los 3 prototipos (§9.3) son iguales para todos los turnos; la dificultad sube con el tier por **tolerancia de puntuación** (no por forma visible): `req = {acción sin conjuro:0, T1:.15, T2:.30, T3:.45, T4:.60} − 0.05·maestría`; `s' = clamp((s − req)/(1 − req))`. El jugador ve su puntuación normalizada («muy firme»).
3. Aprender/estudiar/perfeccionar: mismo reto: s' ≥ 0.7 → aprendes limpio (+3 os. como hoy); 0.4-0.7 → +2 os. extra; < 0.4 → fallas: el grimorio se conserva pero «la página se mancha» (+2 os. y no repites hasta la ronda siguiente); omitir = 0.55 (aprendes, +3 os.); ≥0.9 «página limpia»: +1 os. en vez de +3 y ajuste libre extra.
4. **Privacidad**: toda acción privada (también meditar, descansar, explorar, omitir) abre un reto con la MISMA forma y ventana FIJA de 8 s (se puede acabar antes pero la pantalla dura 8 s). En acciones sin tirada el resultado solo da texto («calma/pulso») sin efecto, y la UI lo dice («sin efecto en esta acción»); no hay engaño: es un ritual de turno. Las acciones con tirada usan delta; meditar/descansar/investigar etc. usan el delta en su tirada si la tienen (hoy `act` en E:l.1634 `rollCheck`). Duración y forma idénticas en local y online.
5. **Online**: el cliente pide `challenge` (servidor devuelve `seed`, `type`, `issuedAt` servidor, `window 8 s`); juega localmente y envía `challengeSubmit` con la **traza de entradas** (índices/relojes relativos al inicio del reto); el servidor recalcula la puntuación a partir de `seed` + traza y valida: (a) plausibilidad (n.º de eventos, intervalos mínimos humanos ≥120 ms), (b) que `serverNow − issuedAt ≤ 8 s + gracia 1,5 s` (latencia: los tiempos del reto son relativos al cliente, la red solo cuenta en la gracia), (c) un único envío por `seed`. Si falta o es inválido → base (delta=0), nunca penaliza. El `skill` entra en `cast/act` como el token `{seed,sig}` firmado por el servidor y ya puntuado; el cliente nunca envía `delta`. Límite residual: un script puede resolver memoria/glifo; se acota por el tope +15 y es un juego entre amigos; no se mitiga más.
6. **Accesibilidad / justicia**: ajustes: «Reto sencillo» (mismo tope de bonus, objetivos 2× más grandes y más lentos, misma ventana 8 s); «Sin retos» (delta=0 siempre; la pantalla sigue 8 s con «Respira» para que el tiempo no delate). Nadie tiene menos opciones. Nadie ve diferencias de duración ni de forma.
7. **Bots**: perfil de habilidad `μ` por bot (casual 0.45, normal 0.60, bueno 0.80, perfecto 0.95); `s ~ Beta(μ·k,(1−μ)·k)`, k=8; cuantizado a 0..4 pasos. Medición: ejecutar la batería con `μ ∈ {omitir, 0.45, 0.60, 0.80, 0.95}` y comparar éxito real de conjuros (Δ esperado: omitir→perfecto ≤ +15 pp por tirada; Δ en victorias del asesino entre μ=0.45 y μ=0.80 ≤ 4 pp; si es mayor, bajar el tope).
### 9.2 Resumen de tiempos
Cada turno +8 s (ventana fija). Local 4 jugadores × 8 rondas ≈ +4 min por partida; 10 jugadores ≈ +10 min → por eso opción «solo conjuros» o «desactivado» (decisión 1). El autoturno (15 s + 25 s) cuenta el reto como parte del turno; si caduca → base.
### 9.3 Prototipos (3-6 s activos, ventana 8 s)
A. **Runas de memoria** (≈5 s): se encienden 3-6 runas (0,5 s cada una), luego una cuadrícula de 9; pulsa en orden. s = aciertos en orden / n.
B. **Aguja en la zona verde** (≈4 s): aguja oscilante, toca para frenar dos veces; zona verde 30% (accesible 60%). s = media de cercanías al centro.
C. **Pulso estable** (≈5 s): mantener pulsado un anillo que late y soltar al brillo; s por sincronía de 3 latidos. Alternativa: trazar un glifo de 4-6 puntos (s por distancia).
Cada ronda el tipo se elige por semilla (aleatorio, distinto por jugador y turno); **no** depende de la escuela ni del tier (para no delatar). El texto del conjuro menciona la escuela solo como sabor.

## 10. Bots y balance (f)
**Bots** (`smart.js` l.16: lanza 1 conjuro al azar si es def o dark): añadir selección por escuela (primera escuela según rol/oscuridad), prioridad de Quiebre/Custodia si ve conjuros hostiles recientes, uso de preparar para el hambre, rito si hay pacto; `smart_human.js`/`bh` igual con probabilidad realista de estudiar (≈1 grimorio por jugador a mitad de partida).
**Medición** (N=300 por configuración, ruido ±3 pp):
1. 3 jugadores a 10/12/15 min con `smart_human`, `1dark`, `allgood` y 5-10 jugadores 20/45 min.
2. Línea base v1.4.0: smart_human asesino gana 31,5/48,5/37,5 %; 1dark 37/64/23,5; allgood supervivientes 92,5/85,5/96 %.
**Objetivos**: ΔAsesino gana ≤ ±4 pp respecto a la base; allgood supervivientes ≥ 88 % (las 3 duraciones); asesino emergente 3j/12 min 24,5±5 %; 10j/20 min asesino emergente ≥ 5 % (hoy 0); T2 aprendido por ≥ 35 % de jugadores antes del min 15, T3 ≤ 12 %, T4 ≤ 1 cada 3 partidas; conjuros ≈ 12-25 % de las acciones; muertes por conjuro ≤ 25 % de las muertes; éxito medio de lanzamiento 55-65 %; contrahechizo acierta ≥ 25 % cuando se usa; curación total por partida ≤ base +10 %; partidas por tiempo agotado sin cambio (≈8 %).
**Regla de ajuste**: si el asesino sube >4 pp, subir coste de T3 Sombra (os. +2) antes que tocar capas; si curación sube, reducir potencia de Aurora/Sanar; si T4 aparece más de lo previsto, bajar la probabilidad del Libro sin nombre.

## 11. Plan por fases
| Fase | Contenido | Estimación | Riesgos |
|---|---|---|---|
| F1 datos + motor | `SPELL_DB`, escuelas/tiers, cola `state.arcane`, `resolveArcane`, 13 T1 migrados, T2 (10), costes, concentración/preparar, estudio/mejorar con tiers | 4-5 sesiones `dev` | refactor de `cast` (regresión en cauto/desatado, `spellRise`); mantener determinismo; tests de `spelltest.js` |
| F2 UI | agrupación por escuela, «lo más útil», modos, ficha, retos A/B/C, ajustes de accesibilidad | 3-4 sesiones | sobrecarga visual; táctil real sin probar (WebView) |
| F3 bots y balance | bots por escuela, perfiles de habilidad, baterías de §10 | 3 sesiones | balance 3j largo y T3/T4; ajuste iterativo |
| F4 online | `view.js` (wards ocultos, sin cola), `game.js` comando `challenge`/`skill`, validación de traza, SCHEMA 2, tests de fuga con cola, E2E bots | 3 sesiones | privacidad del reto, tiempos, snapshots |
| F5 pruebas | evtest/health_unit/fuzz, 6-10 jugadores, exportLog/story, Android real | 2 sesiones | sin Android real; revisar con `mecanico` |
Orden recomendado: T1+T2+capas (F1-F3) como v1.7.0; T3 y T4 + ritos en v1.8.0; skill checks en v1.7.1 (opcional) para aislar su medición.

## 12. Decisiones para el usuario
1. **Skill checks**: ¿obligatorios para todos (8 s fijos por turno, ≈4-10 min más por partida) u opcionales por ajuste de mesa/jugador («Sin retos» con pantalla de respiración equivalente)? Recomendado: opcionales, activados por defecto en online y desactivados en local con >5 jugadores. Además: ¿suelo −10 (más riesgo) o −5 (más amable)? Recomendado −6.
2. **Resolución diferida**: ¿aceptas que los efectos de conjuro se vean al final de la ronda (la tirada sigue siendo inmediata)? Es la base de la simultaneidad real; recomiendo sí.
3. **Alcance de la primera entrega**: ¿T1-T2 + capas + contrahechizo/resonancia/desbordamiento en v1.7.0 y T3/T4/ritos en v1.8.0? Recomiendo sí.
4. **Luz↔Sombra opuestas y límite de 6 pesos**: ¿se mantienen la Disonancia y el tope (obliga a especializarse) o se prefiere libertad total?
5. **T4 y Verdad forzada**: ¿se permite una pista absoluta de alineamiento (puede romper el suspense del asesino emergente), o se convierte en pista fuerte (no absoluta)? Recomiendo pista fuerte con 85% de fiabilidad.
