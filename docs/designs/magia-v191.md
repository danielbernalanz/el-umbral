# Magia v1.9.1 — Tier 2 recortado (hecho) y lo que queda para v1.9.2

Base: rama feat-v191 sobre main v1.10.0 (8b71d73). Sigue `plan-v19-v110.md` (alcance «T1+T2, sin T3/T4/ritos/grimorio mayor») y `magia.md`.

## Hecho
- **6 conjuros T2**: Custodia y Aurora (Luz), Zarza (Naturaleza), Eco (Umbral), Olvido (Mente), Mordedura (Sombra). Son formas nuevas de `SPELL_FORMS` (campos `tier`, `layer`, `selfCorr`); siguen usando aspectos, ajuste (potente/estable/sutil) y maestría como los T1. Metadatos de escuela/tier/icono/peso en `D.SPELL_SCHOOLS`.
- **Desbloqueo solo por acciones**: estudiar un grimorio ofrece 3 opciones a todos; si eres Practicante (≥1 éxito) en un conjuro de una escuela, la 3.ª opción es un T2 de esa escuela que no tengas. El ermitaño (explorar) también puede enseñarlo a quien tenga un solo conjuro y sea Practicante. Nada por reloj.
- **Resolución por capas** (`queueArcane` / `resolveArcane`, en `beginCouncil` antes de `resolveHarm` y `shadowStrike`): la tirada y los costes se pagan al lanzar; el efecto se encola en `state.arcane` y se resuelve al abrir el Consejo: C1 Eco (contrahechizo) → C2 Custodia (amparo) → C4 ofensivos (Zarza, Mordedura; orden potencia desc., id de lanzador asc.) → C5 Aurora → C6 Olvido. Independiente del orden de llegada (test con 4 órdenes). El lanzador caído/moribundo apaga su magia; objetivo muerto = conjuro perdido. `state.arcane` se vacía en `startRound`.
- **Firmas**: los conjuros ofensivos (T1 al tener éxito, T2 al resolverse) escriben `harmSig(víctima, autor, "conjurar", "marca")` para Indagar.
- **Tope por peso**: T1 pesa 1, T2 pesa 2; máx. 4 conjuros y 5 de peso (`addSpell`); si no cabe se pierde el de menos usos (como antes).
- **Afinidad** (`p.arcAff`; el campo `p.affinity` ya existía para otra cosa): la primera escuela donde llegas a Practicante da −1 dificultad en tus T2 de esa escuela.
- **Reto de pulso al estudiar**: `learnSpell(pid, i, ajuste, skill)` / `improveSpell(pid, id, skill)`: bonus ≥ +8 = −1 oscuridad, ≤ −3 = +1; sin reto = coste normal (+3). Servidor: `a[2]`/`a[1]` = traza (validada igual que en `cast`). Conjurar ya usaba el reto desde v1.9.0.
- **Privacidad**: la crónica de un T2 ofensivo es siempre «Se oyeron palabras antiguas entre las ruinas.» (nunca nombra objetivo, salga bien o mal); los avisos de Custodia/Eco/Aurora/Olvido son privados y no nombran al lanzador. `state.arcane` no está en la lista blanca de `view.js`. Los snapshots no cambian de formato (`SCHEMA` 1); el hash del motor ya invalida las salas viejas (desplegar con mesa vacía).
- **Costes visibles antes de elegir** (`spellInfo`): Mordedura +3 oscuridad; el Eco al vacío cuesta +2 (texto del conjuro); todos «se resuelven al caer la noche».
- **Bots/NPC**: NPC y `tools/work/smart_human.js` prefieren el T2 si asoma (60 %), amparan/curan al más débil con Custodia/Aurora.

## Para v1.9.2 (no hecho, a propósito)
- T1 sigue siendo **inmediato** (Reflejo, Égida, Velo, Rayo…); por eso Eco/Custodia solo ven T2. Migrarlos a la cola exige rehacer Reflejo/aliado y los tests de spelltest.
- Sin T3/T4, ritos, preparar/liberar, concentración, cadena, Resonancia/Desbordamiento, Disonancia Luz↔Sombra, grimorio mayor, libro sin nombre, Savia/Esporas/Marca/Ancla (los otros 4 del T2 de magia.md).
- Rumor de relleno (falsas «palabras antiguas») no implementado.
- Un conjuro anulado por Eco gasta su uso (magia.md lo reembolsaba).
- Sprites propios para T2 (se reutilizan: Custodia=Égida, Aurora=Sanar, Zarza=Marchitar, Eco=Reflejo, Olvido=Velo, Mordedura=Rayo).
- Poca presencia en simulaciones: con bots, ~1-2 % de las partidas ven un T2 (hace falta ser Practicante y encontrar un grimorio); con T2 forzado en todos (`T2ALL=1`) el Asesino se mueve dentro del ruido.
