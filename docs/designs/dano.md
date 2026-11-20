# El Umbral — Diseño «Artes de dañar» (v1.7/v1.8, propuesta)

Solo diseño. Código citado: `scratchpad/apk/assets/www/{engine,data,ui}.js` (E/D/UI), servidor `/home/claude/el-umbral/server/*` (S). Complementa `work/magia/DESIGN.md` (M): reutiliza sus capas de resolución y sus skill checks.

## 0. Resumen
1. Hoy el daño no mágico son 4 acciones «con arma» (E:`apunalar/envenenar/maldecir/aturdir`, D:l.105-108), casi planas: apuñalar = 2-4 vit; **envenenar solo sube corrupción** (E:`tickStatus` veneno +3 corr, sin vitalidad); maldecir = −1 tiradas; aturdir = pierde turno. Más cazar/devorar (Asesino), robar, emboscada del Consejo, mano trampa y eventos (lobos, trampa, incendio).
2. Propuesta: una **tabla de «formas de dañar»** (`D.HARM`, 24 formas) con cinco tipos de entrega: **directa** (inmediata), **diferida** (se resuelve al final de la fase privada), **persistente** (por ronda), **plantada** (trampa/cebo que espera a su víctima) y **ambiental** (usa el evento o el entorno). Cada una produce un efecto DISTINTO (herida por zona, veneno con latencia, silencio en el Consejo, equipo estropeado, sospecha falsa, fuego de área…), no «−X vitalidad».
3. **Regla de riesgo** (principio del usuario): solo hay riesgo donde nace de la propia acción (fuerza, fuego, pólvora, trampas, mentiras). Un frasco, un pergamino o un somnífero son dosis fija: **sin dial**; su única decisión es usarlo o no, a quién y cuándo. Cada fila de §1 justifica «por qué tiene riesgo / por qué no».
4. **Dial de riesgo** solo en las formas «de empeño» (13 de 24): **Seguro / Arriesgado / Temerario**, con % y consecuencia visibles antes de confirmar (§2). «Arriesgado» = las cifras actuales (la línea base de balance no se mueve).
5. Skill check (M§9) en ejecución y montaje: bonus −10..+15 pp, omitir = base, mismo reto de 8 s para todas las acciones, validación en servidor; la dificultad interna sube con el nivel de riesgo elegido (§3).
6. Todo efecto diferido se resuelve en capas deterministas independientes del orden de llegada, con las protecciones tal y como estén al cierre de la fase (§5). Online idéntico a local.
7. Desbloqueo por ACCIONES (contadores «oficios» visibles, §6), no por tiempo.

## 1. Catálogo (24 formas)
Leyenda: **D** dial (S/A/T = Seguro/Arriesgado/Temerario; «fijo» = sin dial). Entrega: Dir/Dif/Per/Pla/Amb. Huella = bonus de pista que deja (E:`clueFor` l.1272+: S=0, A=1, T=2 salvo indicación). «Obj» = objeto que se consume (✓ se gasta, ∞ no).
Cifras en columna Efecto = nivel **Arriesgado**; S ≈ 60 % de potencia, T ≈ 150 % (redondeo; detalle §2).

### A. Directas (cuerpo a cuerpo)
| # | Forma | Obj / requisito | Efecto distinto | D | Riesgo (fallo / extra) | Por qué riesgo / por qué no |
|---|---|---|---|---|---|---|
|1|Apuñalar|daga ∞|2-4 vit en torso/brazos; crit 4-5 + sangrado|S/A/T|Fallo: +2 corr (hoy). T fallo: te cortas −2 vit (tu brazos) y tu herida es visible (heridas son públicas)|El filo depende del empeño: golpear a fondo expone tu propio cuerpo. El corte propio delata a un herido sin causa: decisión real|
|2|Aturdir|porra ✓|pierde turno (hoy). S: «conmoción» −1 tiradas 1 ronda. T: pierde turno + 2 vit en cabeza|S/A/T|Fallo: ruido (rumor público sin nombre). T fallo: te ve la víctima (nota «fue X»)|Es un golpe a pulso: forzarlo duele. Pero el objeto se gasta siempre: no se cobra doble|
|3|Zancadilla|sin objeto; req.: 2 Explorar o 1 Enfrentar|1-2 vit en piernas + «cojera» (−1 cuerpo, ronda siguiente). T: 3 vit y la víctima suelta un objeto al azar (queda «en el suelo», 1 ronda)|S/A/T|Fallo: pierdes tu propia acción de explorar la ronda siguiente (te quedas «mirando»); T fallo −1 vit propio|Es la opción sin objeto: debe doler menos y fallar con coste táctico, no corrupción|
|4|Arma improvisada|sin objeto; req.: 2 Explorar|1-3 vit en brazos/cabeza, sin sangrado; huella −1 (no hay daga que te identifique)|S/A/T|Fallo: nada. T fallo: se rompe (no la podrás repetir esta partida) y +1 corr|Es floja y discreta: pocas penas. El único riesgo real aparece en T (decidir si gastar la «única» ocasión)|
|5|Ensañarse|daga ∞ o improvisada; la víctima tiene herida visible; no a moribundos|+1 daño a su zona más lesionada y «infección» 2 rondas (1 vit/ronda y +2 corr)|S/A/T|Fallo: +3 corr y −2 virtud (crueldad conocida por ti); T fallo: la víctima y su pacto lo saben (nota con nombre)|Castigar al ya herido es lo más oscuro del arsenal: es social y moral; sin acceso a heridos intactos|

### B. Venenos, enfermedad y debilitamiento
| # | Forma | Obj / requisito | Efecto distinto | D | Riesgo | Por qué riesgo / por qué no |
|---|---|---|---|---|---|---|
|6|Veneno en la copa|frasco ✓|**Diferido**: sin síntomas la ronda siguiente (latencia); luego 1 vit ×2 rondas «sin zona» + 2 corr. Cura: hierbas/antídoto/ceniza|fijo|Fallo (tirada de discreción): el frasco se derrama (se gasta) y te marca una pista (+1 huella)|**Dosis fija: la dosis no se mejora**; lo que arriesga es que te vean. Fallo = perder el objeto. Sin dial: potenciar un veneno sellado sería un riesgo decorativo|
|7|Cebo envenenado|frasco ✓|**Plantado**: envenenas lo próximo que la víctima tome (vendas, hierbas, ración, elixir, botiquín) en 3 rondas: no cura y sufre veneno lento. Si no lo usa, caduca. No sabes si lo ha usado|fijo|Fallo: la víctima «huele» el cebo y lo descarta (acierta si se cura con Investigar)|Es un frasco: dosis fija; el riesgo real es el desperdicio y que castigues también a una víctima que se cura de verdad por otro|
|8|Hiel de víbora|ampolla ✓ (nuevo)|Veneno rápido: 2 vit inmediato y «temblores» (−1 cuerpo, 1 ronda). Línea pública «X enfermó de golpe» (sin autor)|fijo|Siempre deja rastro público y huella 2 (lo pagas siempre, no hay tirada que lo mitigue)|Es potente e inmediato: el precio es la exposición fija. Un % de fallo extra sería decorativo|
|9|Láudano (somnífero)|frasco ✓ (nuevo, **doble uso**: sedar a un moribundo +1 ronda de gracia)|«Sopor»: la ronda siguiente la víctima no puede acusar/enfrentar ni pactar y −1 Mente. Sin daño|fijo|Fallo: la víctima duerme poco y descubre la autoría si lleva linterna (nota «fue X»)|Silencia el Consejo sin herir: dosis fija. El peligro está en el momento (cuándo callarlo) no en un dial|
|10|Contagiar|estar infectado tú mismo (o «cultivo de moho»)|La víctima recibe infección 2 rondas (1 vit/ronda, +2 corr). El «lazareto» tiene rumor público si ≥2 infectados|fijo|Coste automático: sigues enfermo; si te lo curan, pierdes la fuente. Fallo: te infectas más (+1 ronda)|El riesgo es inherente (la fuente eres tú). Un dial de «más virulencia» sería inventado|
|11|Maldecir|pergamino ✓|−1 tiradas, 2 rondas (hoy). Cuenta como «maldición» (se cura con antídoto/Purga)|fijo|Fallo: +2 corr (hoy)|El pergamino es un conjuro sellado, no admite «cargarlo»: ya cobra corrupción en el fallo (justificación existente)|
|12|Regalo maldito|reliquia/fragmento ✓|Se lo cuelas: +6 corr a la víctima y presión del Umbral (cuenta para la tentación de ELLA). No daña vitalidad|fijo|Siempre: tú pierdes el objeto; fallo: la víctima ve que viene de ti (nota «fue X»)|Daño indirecto, destinatario no avisado: es una decisión grave (empujar a alguien a la oscuridad). Sin dial: ya es un objeto «mancha»|
|13|Sabotear el equipo|ganzúa ∞ o 2 Explorar|Durante 2 rondas la víctima: vendas/hierbas curan la mitad, cota/talismán −1, ceniza se anula. Sin vitalidad|S/A/T|Fallo: tu ganzúa se atasca (pierdes 1 uso) y +1 huella; T fallo: te sorprenden: nota «fue X»|Es sutil y sin daño: el dial decide cuánto rompes (S solo curación, T también protección) frente a cuánto arriesgas ser visto|

### C. Trampas y daño diferido
| # | Forma | Obj / requisito | Efecto distinto | D | Riesgo | Por qué riesgo / por qué no |
|---|---|---|---|---|---|---|
|14|Cepo|cepo ✓ (nuevo; o cuerda+metal)|**Plantada** 2 rondas: salta cuando la víctima Explore/Investigue; 2-3 vit en piernas + cojera. Si nadie lo activa, salta a quien Explore después, **incluido tú**|S/A/T|Auto-activación sobre ti: S 0 % / A 15 % / T 30 % por tu explorar; T: 3-4 vit y sangrado|El dial decide potencia contra posibilidad de caer tú: es riesgo real y legible (la mesa piensa «¿lo puso él?»)|
|15|Cuerda tensada|cuerda ∞|Plantada 1 ronda: el siguiente Explorar/Proteger/Socorrer de la víctima +2 dificultad y pierde foco; 1 vit en cabeza/piernas|S/A/T|Fallo: se ve la cuerda: la víctima sabe «hay una trampa» (no quién)|No mata; riesgo pequeño y justificado (ser visto)|
|16|Pólvora (mecha)|pólvora ✓ (nuevo, raro)|**Diferido**: estalla al cierre de la fase privada: 3-5 vit torso. Línea pública «una explosión sacudió el castillo» sin nombres|S/A/T|Mecha: S segura (4 vit nunca antes de la ronda) / A normal / T doble carga 5-7 vit y 25 % explota en tus manos (3 vit tuyos)|Es el arma más impredecible: el dial es natural (más pólvora = más estruendo y más peligro para ti)|
|17|Cebo para fieras|ración ✓ (+evento «lobos»)|Solo con evento lobos: los lobos van a por tu víctima aunque lleve fuego: 2-3 vit en piernas|fijo|Si la víctima lleva fuego, falla y gastas la ración; los lobos también muerden al más débil si no ocurre|Está atado al evento: no hay tirada extra; el riesgo (que no sirva) ya lo da el fuego|
|18|Empujar al hoyo|sin objeto; solo con evento «hoyo/trampa/incendio»|Caída: 2-4 vit en piernas/torso y pierde la acción de Explorar siguiente. Anula una trampa propia si estaba en el mismo pasillo|S/A/T|Fallo: caes tú (−2 vit) y todos lo oyen|Solo existe con el evento: el riesgo es de oportunidad|
|19|Prender fuego|antorcha/linterna ∞ (aceite ✓ opcional)|**Área**: la víctima 3 vit y todos los demás 0-1 (sin cuerda/fuego propio). Pierde foco. Línea pública «se vio humo»|S/A/T|S: solo la víctima. A: 1 vit a quien no lleva fuego. T: mesa entera 2 vit, y 20 % te quemas −2|Es indiscreto: la lista de «a salvo» (fuego/cuerda) apunta a portadores: delata. Decisión de a quién incendiar|
|20|Embarrar / empapar|sin objeto; ideal con lluvia o pozo|Desactiva ceniza/talismán/prep de la víctima y −1 Explorar/Investigar 1 ronda. Sin vitalidad|fijo|Fallo: te mojas tú (−1 foco). Sin dial|Travesura barata; un dial sería decorativo|

### D. Sociales, de preparación y existentes
| # | Forma | Obj / requisito | Efecto distinto | D | Riesgo | Por qué riesgo / por qué no |
|---|---|---|---|---|---|---|
|21|Sembrar sospecha|sin objeto; req.: 2 Investigar|Rumor FALSO (público, sin nombres de autor) que apunta a X; +1 evidencia contra X en acusaciones 2 rondas|S/A/T|Fallo: la víctima recibe nota «alguien habla mal de ti» con 50 % de que sea fiable el autor; T: si acusan en falso, −virtud para ti (−4)|Es una mentira: debe poder retratarte y descubrirte. Si no, sería gratis y dominante|
|22|Vigilar|sin objeto|Marcas a X 2 rondas: tu próxima forma de dañar contra X tiene −1 dificultad y +1 daño; además te enteras de la categoría de su última acción (verídica)|S/A/T|S: sin riesgo (marca 1 ronda). T: marca de 3 rondas pero con 40 % de que X (si lleva linterna/Guardianas) sepa «alguien te vigila»|Prepara el golpe: es el «vigilar y golpear». El riesgo es ser visto observando|
|23|Preparar emboscada|daga ∞ o improvisada|Tu próximo Enfrentar en el Consejo +1/+2/+3 ataque; la víctima no recibe aviso|S/A/T|Fallo: pierdes la ventaja y la víctima sabe que alguien la planeó (sin nombre)|Es el puente a la fase pública: riesgo coherente con ser descubierto|
|24|Mano envenenada (existente)|mano «trampa»|Acumula 1 carga/ronda; con 2+: −2 vit/ronda hasta 8 rondas (E:l.886)|fijo|Ya cobra +5 corr y ruptura|Es la forma más cara socialmente: se mantiene sin dial|
|ref|Magia ofensiva y sombras|M|Ver M§5 (Rayo, Pesadilla, Plaga, Marchitar, Maleficio…) y E:`sombra_hostiga`, `alzar`|—|—|Mismo presupuesto de letalidad (§7)|

Conteo: 24 formas nuevas/revisadas. **Acciones nuevas para el menú** (resto son variantes): Zancadilla, Arma improvisada, Ensañarse, Contagiar, Sabotear, Cepo, Cuerda, Pólvora, Fuego, Embarrar, Sembrar sospecha, Vigilar, Preparar emboscada. Veneno (copa/cebo/hiel) y láudano pasan a agruparse en «Envenenar» con selección de frasco (misma UI que ahora, nuevas opciones).

### Qué objetos admiten riesgo (decisión y justificación)
- **Con dial (13 formas)**: las que dependen del empeño o de la colocación del jugador: golpes, trampas, fuego, pólvora, sabotaje, vigilancia, sospecha. El riesgo es PROPIO de la acción (te hieres, caes tú, te quemas, te ven).
- **Sin dial (11)**: frasco (6,7), hiel, láudano, contagio, pergamino, regalo maldito, fieras, embarrar, mano trampa. Son «dosis fija» o dependen de otro hecho; su riesgo ya existe en el fallo (te ven, pierdes el objeto) o en el coste inherente (estás enfermo). Añadir un dial sería decorativo.
- **«Mejorar» un objeto fijo** se hace con una VARIANTE (otro objeto: veneno lento / hiel / láudano), no con un riesgo sobre el mismo.

## 2. Niveles de riesgo (dial)
Sobre la dificultad base d0 de la forma y la «potencia» P (daño/duración):
| Nivel | Dificultad | Potencia | Backlash en fallo | Huella | Req. skill (tolerancia) |
|---|---|---|---|---|---|
|Seguro|d0 −1|≈0,6·P (mín 1)|ninguno (solo se gasta el objeto si lo hay)|−1 (mín 0)|0,15|
|Arriesgado|d0 (= reglas actuales)|P|el actual (corr, pista)|+0|0,30|
|Temerario|d0 +1 (fuego/pólvora +2)|≈1,5·P (+ sangrado/zonas)|daño propio o exposición pública|+1|0,45|

Probabilidad base de éxito (d6, 6 siempre acierta, 1 siempre falla; base «d0=5», bonus de atributo+modificadores b):
| b | Seguro (d4) | Arriesgado (d5) | Temerario (d6) |
|---|---|---|---|
|1|67 %|50 %|33 %|
|2|83 %|67 %|50 %|
|3|83 %|83 %|67 %|
Con skill check el % se desplaza −10..+15 pp (M§9.1), siempre antes de la pifia/crítico. Daño esperado por intento (forma 1, b=2): S 83 %×1,5 = **1,2**; A 67 %×3 = **2,0** (+0,3 sangrado); T 50 %×5 = **2,5** menos 0,5×(−2 propio) = **−1,0** neto para el atacante. T solo compensa si la victima ya está tocada o buscas rematar (sin otras fuentes): decisión real.
Consecuencias visibles al elegir: el selector muestra «% de éxito · daño tuyo / daño suyo · qué verá la víctima / la mesa». El resultado muestra el POR QUÉ de la tirada (E:`why[]`, ya existe).

## 3. Skill checks
1. Forma, duración y ventana de 8 s idénticas para TODAS las acciones privadas (M§9.1.4): este diseño no añade retos nuevos ni distintos, solo usa el mismo.
2. Dificultad interna = tolerancia `req` de la tabla §2 (fijas: 0,15; montar trampa/mecha: 0,30; Temerario 0,45), menos 0,05 por «oficio» (§6) hasta −0,10. `s' = clamp((s−req)/(1−req))`, delta = −10+25·s'. Omitir/caducar = delta 0. «Sin retos»/«Reto sencillo» respetados (M§9.1.6).
3. **Dónde se aplica**: (a) a la tirada de ejecución de cada forma; (b) al **montaje** de las plantadas (cepo, cuerda, cebo, mecha): el mismo único reto cubre montar y ejecutar (no se hace dos veces); (c) a la «discreción» de las de dosis fija: delta>0 reduce la huella en 1 con prob. delta/25 (la huella nunca baja de 0), delta<0 no la sube. El skill check **nunca** modifica daño ni dosis (equidad: «dosis fija»).
4. Online: igual que M§9.5 (`challenge` → traza → token firmado `{seed,sig}` en el comando; el cliente nunca manda delta). El servidor aplica delta tras la tirada normal (E:`rollCheck`, sin tocarla).
5. Accesibilidad: sin retos = delta 0 sin penalización alguna; el nivel Temerario sigue disponible (la tolerancia desaparece con delta 0).

## 4. Interacciones
**Pactos.** `pacto_no_agresion` y «silencio» prohíben todas las formas dirigidas (1-23). Romperlos: atacar al socio con cualquiera = ruptura privada (como hoy, E:`resolveAmbush`, sin línea pública). Daño colateral (fuego, pólvora, cepo activado por accidente en el socio) **no rompe** pero el socio queda con nota sin autor; el atacante no puede elegir como objetivo directo a un socio de pacto (error igual que ahora, E:l.1665). Mano trampa (24) es la ruptura social máxima y sigue costando +5 corr.
**Secretos.** *Traición*: recompensa «arma de traidor» amplía su lista a {frasco, pergamino, porra, láudano, hiel} (justificar en la ficha); *Intacto*: se pierde al recibir cualquier daño; las formas diferidas se anuncian como «tu secreto está en peligro» solo si pueden dañarte (aviso privado ya diseñado en corrupción); *Justicia*: Vigilar y Sembrar sospecha no cuentan para el premio (no son acusación). Texto veraz: «Sembrar sospecha» no se vende como prueba.
**Tentación / Asesino.** `AGGR_ACT` (E:l.486): forma con objeto = 2, sin objeto = 1, +1 si Temerario; tope +3 por ronda y jugador (para no inflar el asesino emergente: hoy 43-58 % a 3j). Todas las que dañan a otro cuentan en `DARK_ACTS` (hambre del Umbral) salvo: Embarrar, Vigilar, Preparar emboscada, Cuerda, Arma improvisada «S» (travesuras). El Asesino no tiene ventajas nuevas; no sufre backlash de corrupción (ya es oscuro) pero sí daño propio.
**Magia (M).** Capas: las formas de dañar entran después de M·C4 (daños mágicos) y antes de `shadowStrike`, en dos subcapas H1 (activar plantadas y mechas) y H2 (diferidos y por ronda). Égida absorbe la primera forma dañina diferida; Velo/Contrahechizo no interactúan; **Reflejo** (hechizo) y **Espejo** (objeto) rebotan solo agresiones directas (1-5, 23) y NO plantadas/diferidas (el autor no está presente). Purga/Sanar/Antídoto curan los estados (veneno, infección, sopor, maldito); Sanar sobre sangrado funciona como hoy.
**Defensas.** `protection` = +1 dificultad a todas las dirigidas (E:l.1710) — también a Dir; en Dif/Pla se lee al cierre. Ceniza (`ward`) absorbe un estado nuevo (veneno, infección, sopor, sangrado, aturdido, maldito), **no** daño directo ni trampas de pura vitalidad. `Proteger` declarado en la misma fase cubre efectos diferidos aunque se haya hecho después de plantar (resolución por capas). Linterna/fuego/cuerda detectan plantadas (como el evento «trampa», E:l.1507).
**Curación.** Hierbas/antídoto/Vendas ya curan estados; las nuevas formas no pueden dejar a alguien sin cura (todas tienen una cura nominal): veneno→hierbas/antídoto, infección→botiquín/hierbas, sangrado→vendas, cojera/sopor→una ronda.
**Online simultáneo.** Tirada y reto en el momento (privados); el efecto se encola en `state.harm` y se resuelve al cierre con orden estable (id de jugador barajado por semilla de ronda, no por llegada). «Shielded» = estado de protección en ese instante. La víctima solo ve su vista (`view.js` lista blanca: contadores propios, marcas que ella misma posee, avisos). Aturdir/grillete a ronda siguiente se mantienen (S:`order.js`).
**Privacidad.** *Víctima*: nota genérica por forma («sabor amargo», «algo te frena el pie», «un sueño pesado»); nunca autor ni objeto, salvo fallos que lo digan (indicado por fila: linterna, T fallo). Los síntomas distinguen clase (veneno/trampa/sopor) a propósito: da información útil y no delata autoría. *Público*: crónica solo en formas indiscretas (hiel, fuego, pólvora, contagio ≥2) sin nombres. *Pistas*: huella → bonus en `clueFor` (verídicas, con nombre solo cuando se descubre). *Rumores*: 30 % de las rondas el servidor añade una línea pública de relleno («se oyó un frasco romperse») verdadera o no, para que ninguna línea pruebe nada por sí sola.

## 5. Estado y migración
`state.harm = []` (cola) y `p.oficios = {filo,veneno,trampa,fuego,social}`. Datos: `D.HARM` y 9 objetos nuevos (ampolla/hiel, láudano, cepo, pólvora, cultivo de moho, aceite, odre, cebo preparado, trapo sucio opcionales). Partidas locales guardadas: `harm` ausente = `[]`, nivel de riesgo por defecto «Arriesgado»; envenenar migra de «+3 corr» a «veneno lento 1 vit» (nota en changelog). Online: snapshots se invalidan (409, política ya vigente, E:cambian engine/data): desplegar con mesa vacía; `view.js` y tests de no-fuga ampliados (ni `harm` ajeno ni marcas ajenas visibles).

## 6. Desbloqueo por acciones y contadores (visibles)
Contador por «oficio», mostrado en «Tu historial» y en cada forma bloqueada («te falta: 1 Explorar»):
| Forma | Cómo se consigue | Contador visible |
|---|---|---|
|Apuñalar, Ensañarse|daga + Enfrentar o ≥1 daga usada|Filo 0/2 (2 abre T)|
|Zancadilla|2 Explorar o 1 Enfrentar|Explorar 1/2|
|Arma improvisada|2 Explorar|Explorar 1/2|
|Veneno/cebo/hiel/láudano|frasco/ampolla/frasco (loot oscuro, eventos «boticario», «curandero»), o Traición|Objeto: no hay contador|
|Contagiar|estar infectado|Estado: infectado|
|Sabotear|ganzúa o 2 Explorar + 1 Robar|Robos 1/1|
|Cepo, Cuerda|cepo (evento «cazador/lazo»), cuerda (loot)|Trampas 0/2 para T|
|Pólvora|evento «alquimista/almacén» (raro); nunca antes de la ronda 3|—|
|Fuego|antorcha/linterna|Fuego 0/2 para T|
|Sembrar sospecha|2 Investigar|Investigar 1/2|
|Vigilar|1 Investigar + 1 acción hostil o Corr ≥12|Pistas 0/1|
Temerario siempre requiere 2 usos previos de la familia (exitosos o no; contador «Filo 0/2»). Las formas con objeto no exigen contador. Nadie ve menos acciones que otro: lo bloqueado se lista con su requisito. Premios de secretos y eventos amplían el pool de objetos (rework de eventos pendiente ya anotado).

## 7. Equilibrio y bots
Objetivos (3 jugadores, smart_human): Asesino gana **31,5 / 48,5 / 37,5 % ± 4 pp** a 10/12/15 min; allgood supervivientes ≥88 % (los allgood no usan formas hostiles; el cepo y el fuego son los únicos riesgos externos: validar que sin autores no hay daño); asesino emergente 3j ≤ +5 pp respecto al actual.
Letalidad: **≤1,8 vit/jugador/partida** (3j 12 min) total por formas nuevas; muertes civiles por formas nuevas ≤0,15/partida; **ninguna forma >25 %** del daño nuevo ni <3 % de uso en los bots; Temerario ≤30 % de los usos; cola H limitada a 6 efectos nuevos por víctima y ronda y tope 5 vit por víctima y ronda desde formas nuevas (anti-acoso). Formas nuevas no rematan moribundos (solo apuñalar/cazar/devorar), no matan por sí solas desde vitalidad completa en una ronda.
Bots: puntuación EV(forma, objetivo, nivel) con b real; casual→A, «dark»→T si hp propio > 6 y objetivo herido; «allgood» nunca; μ de skill como M§9.1.7. Medición por forma (3000 partidas) y por nivel; comparar con base. Si el Asesino sube >+4 pp: rebajar potencia T o AGGR; si baja: no tocar (los asesinos humanos reales son menos efectivos).

## 8. Fases (estimación en jornadas de agente)
| Fase | Contenido | Dep. | Est. |
|---|---|---|---|
|F0|`D.HARM`, objetos, contadores `oficios`, textos|—|1|
|F1|Núcleo: `stake` como nivel de riesgo, cola `state.harm`, resolución H1/H2, hook en `beginCouncil`, notas/crónica/pistas, token `skill` (tras M-F skill)|F0|2,5|
|F2|Formas A y B (1-13) + curas + tests unitarios|F1|2,5|
|F3|Formas C y D (14-24), eventos acoplados (lobos/hoyo/incendio)|F1|2,5|
|F4|UI: selector de riesgo con % y consecuencia, contadores, «por qué» de la tirada, bloqueadas con requisito|F2|2|
|F5|Bots (EV/dial), sims, ajuste con mesa objetivo|F2,F3|2|
|F6|view.js/no-fuga, E2E online, snapshot 409, APK|F4,F5|1,5|
Total ≈ 14 j. Recomendado partir en **v1.7** (F0-F2 + UI + bots, formas 1-13) y **v1.8** (formas 14-24).

## 9. Decisiones para el usuario
1. **Frasco de veneno sin dial (propuesto)** con variantes (lento / cebo / hiel / láudano) en lugar de «dilución con riesgo»: ¿confirmas?
2. **«Regalo maldito»** (empujar a otro hacia la oscuridad y la tentación): ¿lo dejamos (1 por partida) o lo quitamos por ser potencialmente injusto?
3. **Temerario con daño propio visible** (heridas públicas delatan): ¿aceptable o prefieres solo exposición privada?
4. **Selector de riesgo**: ¿siempre visible con 3 botones (recomendado) o plegado tras «Ajustar»? Predeterminado: Arriesgado.
5. **Reparto**: ¿v1.7 (13 formas + dial + skill) y v1.8 (trampas/fuego/pólvora/eventos), o todo en una sola entrega?

---
## v1.8.0 (2026-11-20): implementado
Alcance entregado: veneno retardado (frasco, dosis fija, síntomas 2 rondas después, 2 vit x 2 rondas, curable), Poner una trampa (colocada en R, salta al cierre de R+1 sobre quien se mueva; objetivo x3; puede caer inocente o el dueño; linterna/antorcha la evita), Sabotear (objeto al azar de otro; falla y 50 % se vuelve contra él) y firmas internas `state.harm.sigs` (golpe, marca, sintomas, mecanismo, objeto) sin interfaz. Sin dial ni skill check. Cambia engine/data: invalida snapshots (409); desplegar con la mesa vacía.
