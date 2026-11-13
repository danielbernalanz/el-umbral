# El Umbral — Diseño del Sistema de Salud hiperrealista («Anatomía») v1.8 (propuesta)

Solo diseño. Código actual: E=`engine.js` (ZONES l.46, `damage` l.120, `heal` l.150, `visibleHealth` l.168, `healthInfo` l.185, `tickStatus` l.993, `giveStatus` l.966, `descansar` l.2014, `socorrer` l.2031, caducidad moribundo l.1566, hambre del Umbral l.911-940), D=`data.js` (STATUS l.219, ítems médicos l.55-59), S=`server/view.js` (l.10 `PUBLIC_PLAYER_KEYS`, l.69 `q.health`, l.157 `visibleHealth`). Hermano: `work/magia/DESIGN.md` (capas de resolución §6, reto único §9). `work/dano/DESIGN.md` NO existe aún: puntos de integración en §11.
Estado: PROPUESTA (decisiones en §13).

## 0. Resumen
1. Se conserva `hp` (vitalidad 8-13) como ÚNICO número de supervivencia. La profundidad nueva es **una lesión por zona** (6 zonas) con tipo, nivel y banderas de tratamiento, más 4 estados sistémicos. Nada de segundo recurso «sangre».
2. Toda la evolución por ronda es **determinista y explicable** (se quita el azar 25/45 % de sangrado de `damage` l.139): el jugador puede ver «a este ritmo caes en 2 rondas». El azar queda solo en tratar (tirada + reto).
3. Cada tratamiento tiene riesgo SOLO si genera una decisión real (§6 tabla «por qué tiene riesgo / por qué no»). Probabilidad y consecuencia se muestran ANTES de elegir.
4. Público = solo signos narrativos de un vocabulario cerrado y ambiguo (misma señal ← varias causas, incluida corrupción y enfermedad). Privado = números, incubación, hemorragia interna.
5. Nadie ve menos opciones: tratamientos sin objeto («presionar», «descansar») siempre disponibles; los niveles de oficio Sanador solo mejoran probabilidad y precisión, nunca desbloquean.
6. Presupuesto: el daño total esperado por herida NO sube respecto a hoy (se redistribuye en curva visible y tratable). Entrega en 3 versiones (§12).

## 1. Modelo anatómico
Zonas (6, tocables en la silueta): `cabeza, torso, brazo_i, brazo_d, pierna_i, pierna_d`. (Hoy: 4 zonas; `brazos`/`piernas` se parten por lado; el lado se elige al azar 50 % salvo golpe dirigido.)
Lesión por zona `p.inj[z] = { t, n, bleed, inf, tx }`:
- `t` tipo local dominante: **corte, perforación, contusión, quemadura, fractura** (fractura solo en brazos/piernas/torso=costillas).
- `n` nivel 1-3 (**leve** 1 = 1-2 de daño acumulado, **seria** 2 = 3-4, **grave** 3 = ≥5; coincide con umbrales actuales `zoneLvl` 2/4). Cabeza/torso con n=3 y hp bajo = crítico.
- `bleed` 0-3 hemorragia: 0 ninguna, 1 goteo, 2 sangrado, 3 hemorragia (corte/perforación; quemadura no sangra; torso con perforación n≥2 = **interna** (invisible)).
- `inf` 0-3 infección: 0 limpia, 1 sucia (herida abierta sin limpiar), 2 incipiente, 3 sepsis.
- `tx` {vendada, torniquete(rondas), entablillada, cauterizada, limpia, sutura}.
Reglas de fusión: un nuevo golpe en una zona con lesión SUBE `n` y puede cambiar el tipo (contusión n≥2 en miembro → fractura; corte + perforación → perforación). Máximo 6 lesiones, normalmente 1-2 → nunca una lista larga.
Sistémicos (privados hasta que muestran signos): **veneno** (`tipo`: ponzoña | toxina; `fase` latente→síntomas→grave), **enfermedad** (fiebre, evento «fiebre»), **hipotermia** (1 tiritona, 2 entumecido, 3 crítica), **maldito** (existente, no físico). «Intoxicación» = veneno tipo toxina (agua/comida mala). «Maldición» sigue en STATUS.
Derivados (no almacenados): **dolor** = Σ n de lesiones sin analgesia/tratar (≥3 → −1 a tiradas, ≥6 → −2); **shock** = hp ≤35 % o hemorragia 3 (ya existe `shockOf`); **desmayo** (pierdes el turno 1 ronda); **agonía** = moribundo actual. Tope global de penalizadores −2 y nunca dos desmayos seguidos (anti-espiral de muerte).
Órganos clave: opcional v2.0 (perforación torso n=3 = «órgano»: solo cirugía lo cierra). No entra en 1.8.

### Consecuencias funcionales (reales, concretas)
| Zona | n=1 | n=2 | n=3 |
|---|---|---|---|
| Brazo | dolor | −1 ataque con ese brazo; fractura: sin objetos de dos manos (porra, grimorio grande: marcar `dosManos`) | inútil: sin objetos con esa mano; con ambos n≥2: tratarte a ti mismo +2 dificultad («necesitas ayuda») |
| Pierna | cojera leve (público) | −1 defensa y a huir/emboscar | no puedes correr: emboscar/cazar +1 dif., no puedes huir en encuentros |
| Cabeza | zumbido | conmoción: −1 mente y tus pistas son dudosas (privado lo avisa) | 35 % de desmayo al inicio de ronda (con enfriamiento) |
| Torso | costillas, dolor | −1 cuerpo en esfuerzo; perforación → hemorragia interna | crítico: moribundo en ≤2 rondas sin cirugía/Socorro |
Mapea `zoneMod`/`armPen`/`legPen`/`ZONE_DESC` actuales (E l.65-78, l.162): son el subconjunto n≥2.

## 2. Evolución por ronda (curvas; se ejecuta en `tickStatus`, orden fijo)
Rondas ≈2-3 min → todas las curvas caben en 1-3 rondas.
1. **Hemorragia**: pierde `bleed` hp al inicio de ronda (goteo 1, sangrado 2, hemorragia 3). Leve corte (n=1) sangra 1 ronda y para solo. n≥2 no para sola. Interna: igual pero invisible y sin vendaje que la alcance (solo cirugía, Socorro, magia, botiquín+reto).
2. **Infección**: herida abierta (corte/perforación/quemadura n≥2) sin LIMPIAR en 2 rondas → `inf=1 sucia` (sin síntomas); +1 ronda → `2 incipiente` (privado: «la herida late»; público: sudor/fiebre); +2 rondas → `3 sepsis` (−2 hp/ronda y shock). Ventana de oro: limpiar dentro de 2 rondas lo evita; hierbas/antídoto lo revierte hasta fase 2; fase 3 solo botiquín+reto, purga o magia. Sustituye «infección» actual (aleatoria, E l.1512).
3. **Veneno**: latente 1 ronda (SIN síntomas, solo el propio jugador sabe si le avisó el evento), luego síntomas (−1 hp/ronda, náuseas públicas), luego grave (−2). Tipo decide antídoto (§6).
4. **Fiebre/enfermedad**: 3 rondas: −1 a tiradas y −1 hp en la última; la corta descanso+hierbas.
5. **Hipotermia**: nivel sube cada ronda a la intemperie sin fuego/manto: 1 (−1 cuerpo), 2 (sin objetos finos, −1 hp), 3 (desmayo). Fuego/descansar/manto la baja.
6. **Dolor/shock/desmayo/agonía** (curva global): hp ≤35 % → shock; hp ≤2 con hemorragia → desmayo al inicio de la ronda siguiente; hp 0 → agonía = moribundo con ventana actual (2 rondas, 1 si golpe `fast`), `stabilize` la detiene.
Previsión explicable (privado, determinista): «Al ritmo actual: caes en N rondas / mueres en M». Es el «riesgo de muerte explicable»: se calcula simulando el tick con las reglas, sin azar.
Presupuesto de daño: hoy sangrado = 2 hp×2 rondas=4 (±infección 3). Nuevo: goteo 1×1, sangrado 2×2, hemorragia 3×2 pero TRATABLE con acción corta; tope por ronda y jugador 4 hp de efectos de estado (nunca muerte por tick en una sola ronda desde hp ≥5).

## 3. Diagnóstico (examinar)
- **Ver tu propio cuerpo**: gratis y exacto en el panel privado (números, previsión).
- **Examinar a otro** (acción «Atender» → Examinar, o gratis y solo cualitativo mirando la silueta pública): reto único de la magia §9 (forma/duración idénticas). Puntuación s' (omitir=0.55):
  - s'≥0.7 **preciso**: por zona tipo+nivel exactos, `bleed`/`inf` presentes, veneno (aunque latente: «hay algo en su sangre, tipo ponzoña»), previsión.
  - 0.4-0.7 **aproximado**: nivel ±1 («seria o grave»), «sangra por dentro o está en shock», fase de infección sin tipo.
  - <0.4 **vago**: «está mal, algo en el torso»; 25 % de dar una causa plausible y errónea marcada siempre con «podría ser» (veraz: nunca se afirma falso; el lector sabe que es hipótesis).
  - Oficio Sanador N2 +1 nivel de precisión; N3 detecta latentes.
- El examinado NO recibe aviso (consistente con acciones secretas); el examinador puede obtener una **pista circunstancial** de fuerza 1 sobre el arma («corte limpio: filo» / «contusión: algo contundente», nunca el autor) usable por Justicia (§11). Tope 1 pista por herida.

## 4. Oficio Sanador (desbloqueo por acciones, no por tiempo)
Nivel `p.med` 0-3 por **tratamientos con éxito** sobre heridas reales (1/3/6; propio cuenta mitad). N1: −1 dif. a tratar; N2: diagnóstico +1 precisión, torniquete sin riesgo de aflojar; N3: cirugía −2 dif., sin fallo crítico. Nunca bloquea acciones: sin nivel todo es posible con dificultad base. Premio visible en ficha («Sanador: Aprendiz»).

## 5. Flujo de turno (no alarga el turno)
1. Ranura **«usar objeto»** (existente, 1/ronda, SIN reto, resultado base): ahora el objeto se aplica a una ZONA (venda → vendar zona, hierbas → limpiar/antitoxina…). Mantiene el comportamiento actual de ítems.
2. Acción **«Atender»** (nueva, 1 acción): elige paciente (tú u otro), toca zona, elige TÉCNICA (§6) con probabilidad y consecuencia a la vista; usa el reto común. Una lesión por acción (botiquín: hasta 2).
3. `Descansar` y `Socorrer` siguen (Socorrer = técnica sobre moribundo, ver §6).
Resolución determinista: en **capa «salud»** al final de la fase privada, tras daño de esa ronda y de la cola arcana de magia (coincide con las capas del §6 de magia): primero entran los golpes, luego los tratamientos, así «la venda llega a tiempo» y el resultado no depende del orden de llegada online. Aturdir/grillete: sin cambio.

## 6. Tratamientos. Por qué tiene riesgo / por qué NO (regla: riesgo solo si crea decisión)
Ítem existente en cursiva; (N) nuevo. Probabilidad = tirada normal (`pSuccess`) ± reto (−10…+15 pp) ± oficio; se muestra «~70 % · si falla: …».
| Técnica | Efecto | Riesgo | Por qué tiene riesgo / por qué no |
|---|---|---|---|
| **Presionar con las manos** (sin objeto) | −1 `bleed` esta ronda | NINGUNO | Es lo mínimo que cualquiera puede hacer; riesgo aquí sería castigar a quien no tiene nada y rompe «nadie con menos opciones». Coste: usa la acción. |
| **Vendar** (*vendas*) herida leve/seria | cierra `bleed`≤2, +1 hp (como hoy +4 a hp total vía `heal`), `limpia` si se limpió antes | NINGUNO en leve; en grave 1 solo: si no se limpió antes, vendas la suciedad (`inf=1`) | Es el tratamiento seguro; el riesgo vive solo en saltarse limpiar: decisión real (rapidez vs. higiene), avisada antes de elegir. Vendar leve sin riesgo: nada que arriesgar. |
| **Limpiar** (N *aguardiente*/agua; *hierbas* sirven peor) | `inf`→0 si ≤1; arde (dolor +1 una ronda) | Dolor, certero y avisado | Dolor es el precio visible y no aleatorio; sin él nunca no-limpiarías. |
| **Torniquete** (N cinturón: todos tienen uno; solo miembro) | `bleed`→0 al instante aunque sea 3 | **Sí, aflojar-o-perder**: tras 2 rondas puesto sin soltar (soltar = otra acción) el miembro queda n=3 «dañado». Con Sanador N2: sin riesgo | Riesgo natural y con decisión: salvas la vida YA y pagas con el miembro si te olvidas; la ventana (2 rondas) se ve en la silueta propia. |
| **Entablillar** (N *férula* o vendas) fractura | n baja a 1 funcional | Si falla (reto malo): cura torcida → queda n=2 permanente hasta Descansar 2 veces. Probabilidad visible | Riesgo realista: mal alineada. Si hay férula y alguien habilidoso, bajo. Sin riesgo en fracturas leves (n=1): no hay qué torcer. |
| **Cauterizar** (N *brasas/antorcha* o daga caliente) | `bleed`→0 e `inf`→0 siempre (no falla) | Dolor fuerte (−1 tirada una ronda, +1 quemadura leve en la zona) pero ÉXITO garantizado | Es el atajo del desesperado: decisión «seguro y feo» vs. «vendar con riesgo de infección». El riesgo no es de fallo sino de coste, explícito. Requiere fuego → escasez natural. |
| **Antídoto** (*antidoto*) | veneno tipo ponzoña → curado; toxina → 50 % | Nada si aciertas el tipo (diagnóstico); si no, efecto parcial | El riesgo es de información (¿qué veneno es?), no de dados: aquí premia examinar. |
| **Hierbas** (*hierbas*) | quita toxina/fiebre; ralentiza ponzoña; revierte `inf`≤2 | Sin riesgo de daño; el «error» es perder el objeto con efecto nulo («no ayuda») | Hierbas equivocadas nunca dañan (sería castigo oculto); el coste es desperdicio y tiempo perdido con veneno corriendo. |
| **Descansar** | +3 hp, fiebre−1, goteo cortado; no cura fractura/n≥2 abierta | Ninguno de salud; mantiene coste actual de oscuridad +3 (ya existe E l.2018) | Es la base segura; riesgo extra sería decorativo. |
| **Cirugía improvisada** (daga+fuego+*botiquín*/hilo, solo hemorragia interna, perforación torso/flecha) | cierra `bleed` interno, n−1 | **Sí, alto**: fallo −2 hp y n+1; fallo crítico → moribundo. Prob. y consecuencia en pantalla | Decisión real: si no, mueres; si fallas, aceleras. Sin ella es muerte segura → el riesgo está justificado. Nivel N3 elimina el crítico. |
| **Socorrer** (moribundo) | estabiliza (`stabilize`); hp 2 | Como hoy: tirada; NO añadir castigo al fallar (ya cuesta tu acción y la ventana corre) | La tensión ya es la ventana; sumar riesgo al socorredor lo disuadiría de lo más heroico. |
| **Curación mágica** (Sanar/Aurora, ver magia) | n−1 en zona elegida, nunca cura fractura sin maestría ≥2 ni limpia | Sella en falso: si la herida estaba sucia, `inf`=1 oculta (privado la avisa tras Examinar) | Riesgo coherente con «la magia cierra por fuera»; la decisión: limpiar antes (1 acción) o apostar. |
| **Examinar** | §3 | NINGUNO físico | Sólo información; el «error» es la imprecisión. |
Descartados por decorativos: fallo crítico al vendar leve; penalizar hierbas «equivocadas»; infección aleatoria tras descansar; aviso al examinado; efectos secundarios de analgésicos.

## 7. Qué es PÚBLICO (observable) y qué PRIVADO
**Público**: por zona un signo de un vocabulario CERRADO (enum, sin números) + aspecto global. Cada signo puede venir de ≥3 causas, incluida la corrupción (herida normal) y enfermedades, así que no delata roles.
| Signo (enum) | Lo producen | Frase |
|---|---|---|
| `cojea` | pierna n≥2 (corte, fractura, contusión, trampa, corrupción) | «cojea del pie izquierdo» |
| `cabestrillo` / `brazo_vendado` | brazo n≥2 tratado / vendada cualquier zona | «lleva el brazo en cabestrillo» |
| `protege_brazo` | brazo n≥2 sin tratar | «protege el brazo derecho» |
| `sangre` | bleed≥2 visible (no interna) | «mancha de sangre en la manga» |
| `vendajes` | tx.vendada/sutura | «vendado en el costado» (revela que se curó) |
| `palido` | shock, hemorragia interna, veneno fase≥1, fiebre, sepsis, maldición alta → MISMO signo | «pálido y sudoroso» |
| `tiembla` | hipotermia, dolor≥6, fiebre, veneno | «tiembla» |
| `tambalea` | cabeza n≥2, desmayo previo, veneno grave | «se tambalea» |
| `aliento` | n/a (descartado) | — |
Aspecto global (existente `visibleHealth`): Sin heridas visibles / Magullado / Herido / Malherido / Al borde / Moribundo (ya público: `dying`, `dead`). Granularidad: máximo 3 signos a la vez y orden fijo → no hay fingerprint. No se muestra: tipo exacto, nivel, hp, `inf`, veneno latente, interna, causa, fase de maldición, qué ítem usó (solo «vendajes»).
**Privado (solo el propio jugador, `q.health`)**: números reales, tipo/nivel/bleed/inf/tx por zona, previsión «caes en N rondas», incubación, latencia, dolor, causa de cada herida (incluye «el Umbral»: solo nota privada, como hoy), oficio.
**Reglas anti-delación** (test de fuga): (a) los signos son función de buckets de (zona, nivel, flags) y NUNCA de `corr`, `alignment`, `cause`, `hungerOn`, `dyingByUmbral`, `src`; (b) herida de corrupción se genera con tipo/zona de la tabla «accidente» (contusión/corte leve) → idéntica a una herida normal; (c) infección por devorar/cazar no tiene signo propio; (d) examinar preciso solo informa a quien examina; (e) tiempos: efectos de estado aparecen siempre en el tick, nunca antes.
**Vista filtrada**: `view.js` añade `look: U.publicLook(x)` = `{ aspecto, signos: [{z, s}] }` a `PUBLIC_PLAYER_KEYS` (lista blanca, cadenas de enum). `visibleHealth` se deriva de `look` (compat UI actual). `q.health` crece a `{ hp,max, zonas:[{z,t,n,bleed,inf,tx}], sist:[…], dolor, prevision:{caer,morir}, urgentes:[…] }` (solo el propio). `q.treatOptions(zona, paciente)` calculado en servidor (sin fuga: usa lo que el actor puede saber: para otro paciente, solo lo derivado de su examen más lo público). Tests: 48 partidas × todas las configuraciones comparando `look` entre jugadores con hidden-state distinto; harness de fuga existente (139k vistas) + nuevo caso «cuerpo idéntico, corr distinta → mismo look».

## 8. Retos de habilidad (reutilizan magia §9)
Un único reto por turno con la misma forma/ventana fija para todas las acciones; delta −10…+15 pp con tope; omitir/caducar = base; el servidor emite `seed/issuedAt`, valida traza (`challengeSubmit`). En salud solo afecta a: Atender (probabilidad de éxito), Examinar (precisión), cirugía/entablillar (fallo crítico). Sin retos = «Sin retos» del ajuste. No se añade pantalla ni duración extra (mismo reto).

## 9. UI móvil
- Silueta SVG (CSS tokens) con 6 zonas tocables; propia: color por nivel (borde discontinuo = sin tratar, sólido = tratada) + icono por tipo/estado; ajena: solo signos públicos (sin colores de nivel, para no filtrar).
- Panel **«Qué te pasa y qué hacer»** (máx. 3 líneas ordenadas por urgencia; resto plegado): `[icono] Pierna derecha rota: cojeas. → Entablillar (~70 %)`; `Hemorragia en brazo: pierdes 2/ronda, caes en 2 rondas. → Torniquete / Vendar`. Botón «Tratar» preselecciona zona y técnica; misma lógica para todos.
- Selector de técnica: cada fila muestra efecto, `~%` con color simple, «si falla: …» y requisito («falta: férula»; las imposibles aparecen atenuadas con cómo conseguirlas). Sin cifras ocultas.
- Iconos existentes (`sprites.svg`): `z_cabeza`, `z_brazos`, `s_sangrado`, `s_veneno`, `s_moribundo`, `s_herido`, `i_vendas`, `i_fragmento`(broken-bone), `e_helada`, `e_incendio`, `st_vitalidad`. Candidatos game-icons presentes en el repo clonado (añadir a `work/sp/map.txt` + `build_sprites.py` + `inline_sprites.py`): `lorc/stitched-wound`, `delapouite/arm-sling`, `delapouite/leg`, `delapouite/first-aid-kit`, `lorc/syringe`, `delapouite/herbs-bundle`, `lorc/knife-thrust`, `lorc/drop`, `carl-olsen/flame`, `lorc/snowflake-1`. NO existen en repo: tourniquet, thermometer, crutch (usar `bandaged`/`snowflake`/`leg`).
- Ficha de otro: línea narrativa de signos («cojea · pálido»), nunca números.

## 10. Bots y balance (h)
**Bots**: Atender si hay `bleed`≥2/riesgo de caer en ≤2 rondas (smart_human: 70 %; allgood: 100 %; 1dark: 20 %); limpiar tras herida abierta con 50 %; usan Socorrer a moribundos amigos (idea abierta); perfil de habilidad de magia (μ) para el reto.
**Línea base** (v1.4.0/1.6.0, N≥300, ruido ±3 pp): smart_human 3j asesino gana 31,5/48,5/37,5 % a 10/12/15 min; 1dark 37/64/23,5; allgood supervivientes 92,5/85,5/96 %. F0: medir además muertes por causa (sangrado/infección/veneno/Umbral/cazar), % de partidas con moribundo, rondas medias con lesión sin tratar.
**Objetivos**: ΔAsesino gana ≤ ±4 pp vs base en las 3 duraciones (si sube >4 pp: bajar daño de cazar o subir ventana de Socorrer; si baja: hacer que la herida de víctima pase menos desapercibida, no al revés); allgood supervivientes ≥ 88 %; muertes **naturales** (sangrado/infección/veneno sin Asesino implicado) ≤ 0,25 por partida a 3j/12 min (hoy ≈ por medir en F0); ≥ 65 % de moribundos socorridos o estabilizados en allgood; mediana de acciones de salud por jugador-turno ≤ 0,25 (no se come la partida); tiempo medio de tratamiento (elegir técnica) ≤ 10 s en humano-like (panel «qué hacer»); duración de partida igual ±0,5 min; 100 % de partidas con desenlace; asesino emergente 3j/12 min 24,5 ± 5 %.
**Migración**: `p.zones`/`hp` se conservan; `initHealth` convierte lesiones antiguas (`zones` numérico → lesiones tipo contusión/corte); STATUS `sangrado/infeccion/veneno` → `bleed/inf/veneno`; `SCHEMA`+1 → snapshots online se invalidan (409), desplegar con mesa vacía; partidas locales guardadas migran sin pérdida.

## 11. Integración
- **Corrupción**: el cobro del Umbral usa `damage` con fuente `accidente` (contusión/corte leve, zona al azar); signo público idéntico a una herida normal; anticorrupción sigue previniendo muerte y avisa privado antes (previsión determinista la muestra: «el Umbral podría matarte»). Curar el cuerpo NO baja la corrupción; Purga sí limpia `inf`/veneno y baja corrupción.
- **Asesino/cazar/devorar**: cazar = perforación/contusión zona dirigida (torso 50 %), puede dejar hemorragia interna (dramático: víctima pálida sin sangre visible); devorar = corte + `inf=1` sucia en la víctima; sin signo propio. Remate a moribundo sin tirada se mantiene.
- **Daño del otro diseño** (pendiente): contrato `damage(p, amount, {src, zone, tipo, nivelMin, noBleed})`; tabla `src→tipo` ampliable (arma→corte/perforación, porra→contusión, fuego→quemadura, caída→fractura/contusión, magia→quemadura/contusión, accidente). El otro diseño debe indicar tipo y zona; si no, el motor usa `ZONE_W` actual.
- **Magia curativa**: ver §6 (Sanar/Aurora bajan n; Purga limpia sistémicos; capa «salud» tras la cola arcana). Hechizos de daño (rayo, marchitar) → quemadura/ hemorragia.
- **Pactos**: pacto de protección/curación abre «Atender sin reto base +0» gratis entre pactados; romper pacto atacando al socio deja herida que el socio puede examinar (pista fuerte privada de arma). Pactos siguen secretos.
- **Secretos**: «Intacto» = acabar sin lesión n≥3 sin tratar ni agonía (pista dinámica: «tienes brazo roto: entabíllalo»); «Justicia» → examinar heridas da pista circunstancial; «Palabra dada» → aliado Sanador (Atender gratis una vez).
- **Eventos**: frío→hipotermia, fiebre→`inf`/enfermedad, agua mala→toxina, lazo/trampa→fractura pierna o perforación, incendio→quemadura, lobos→corte+`inf=1`; botica/cripta añaden férula/aguardiente/cinturón al loot (variedad de objetos pedida).
- **Desbloqueo**: por acciones (§4). **Online simultáneo**: capa «salud» determinista, previsión calculada en servidor, `treatOptions` filtrado; reto como en magia. **Autoturno**: si caduca, aplica `Descansar` o `Presionar` según urgencia (nunca malgasta ítem).

## 12. Fases y estimación
| Fase | Contenido | Sesiones `dev` |
|---|---|---|
| F0 | Línea base de muertes por causa/duración + instrumentación (`mecanico`) | 1 |
| F1 | Modelo `p.inj`, `damage/heal` nuevos, tick determinista, previsión, migración, SCHEMA | 4 |
| F2 | Atender + técnicas + ítems nuevos (férula, aguardiente, cinturón, brasas) + Examinar | 4 |
| F3 | `publicLook`, `view.js`, tests de fuga | 2 |
| F4 | UI silueta + panel + sprites | 4 |
| F5 | Integración (corrupción, cazar/devorar, eventos, secretos, pactos, magia) | 3 |
| F6 | Retos (depende de magia §9) | 1-2 |
| F7 | Bots + balance (baterías 3j 10/12/15, 5-10j) | 3-4 |
| F8 | Online E2E + regresión + Android real | 2 |
Total ≈ 24-26 sesiones. Entregas: **v1.8** (F0-F4 + Presionar/Vendar/Limpiar/Descansar/Socorrer, sin retos), **v1.9** (torniquete, férula, cauterizar, antídoto, diagnóstico, retos, eventos), **v2.0** (cirugía, órganos, oficio completo). Cambios de engine/data → desplegar con mesa vacía.

## 13. Decisiones para el usuario
1. **Cuánto realismo sacrificar**: Opción A (recomendada): 6 zonas, una lesión por zona, 5 tipos, hp único. Opción B: varias lesiones por zona, sangre como recurso aparte y órganos (más realista, ≈+40 % de pantallas y riesgo de abrumar en móvil). 
2. **Azar vs. determinismo**: tick de estados determinista y con previsión «caes en N rondas» (recomendado; el suspense viene de no saber quién te herirá y si llegarán a tiempo) o mantener azar parcial.
3. **Examinar**: ¿el examinado se entera? (recomiendo no) y ¿la pista de arma («filo/contundente») para Justicia se permite (recomiendo sí, tope 1)?
4. **Señales públicas ambiguas**: «pálido» sirve a shock, fiebre, veneno y maldición alta (protege roles pero resta claridad). Alternativa: signos más específicos que ayudan a diagnosticar y delatan más. Recomiendo ambiguo + examinar para resolver.
5. **Cirugía/torniquete**: ¿disponibles para todos con dificultad alta (recomendado) o solo con oficio N≥2? Y ¿entrega en 3 versiones o todo junto en 2.0?
