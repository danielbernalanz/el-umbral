/* EL UMBRAL — datos del juego (v1.8.2)
   Roles, afinidades, objetos, acciones, eventos, secretos y pistas. */
(function (g) {
  "use strict";

  const ROLES = [
    {
      id: "cartografa", name: "Cartógrafa", desc: "Lee caminos que otros no ven.",
      stats: { mente: 1 },
      passive: { id: "extraClue", name: "Ojo de caminante", desc: "+1 fuerza a las pistas que obtienes." }
    },
    {
      id: "taumaturgo", name: "Aprendiz de taumaturgia", desc: "La magia le obedece… casi siempre.",
      stats: { sombra: 1 },
      passive: { id: "spellDiscount", name: "Vena arcana", desc: "Los hechizos te cuestan menos oscuridad y empiezas con un conjuro." }
    },
    {
      id: "guardia", name: "Guardia exiliado", desc: "Sobrevivió a cosas peores que esta noche.",
      stats: { cuerpo: 2 },
      passive: { id: "defenseBonus", name: "Veterano", desc: "+2 a tu defensa al enfrentarte a alguien." }
    },
    {
      id: "herbolaria", name: "Herbolaria", desc: "Conoce remedios para el cuerpo y para el alma.",
      stats: { mente: 1 },
      passive: { id: "startVendas", name: "Bolsa de remedios", desc: "Empiezas con dos vendas." }
    },
    {
      id: "cronista", name: "Cronista", desc: "Ha escrito mentiras que luego se cumplieron.",
      stats: { mente: 1, sombra: 1 },
      passive: { id: "startClue", name: "Memoria del mundo", desc: "Empiezas con una pista sobre alguien." }
    },
    {
      id: "cazador", name: "Cazador de reliquias", desc: "Huele el poder antes de verlo.",
      stats: { cuerpo: 1, sombra: 1 },
      passive: { id: "startItem", name: "Último encargo", desc: "Empiezas con una daga." }
    }
  ];

  const AFFINITIES = [
    { id: "combatiente", name: "Combatiente", stats: { cuerpo: 1 }, passive: { id: "attackBonus", name: "Ataque brutal", desc: "+1 al atacar al enfrentarte a alguien." } },
    { id: "erudito", name: "Erudito", stats: { mente: 1 }, passive: { id: "evidenceBonus", name: "Análisis", desc: "+1 evidencia en tus acusaciones." } },
    { id: "sanadora", name: "Sanadora", stats: { mente: 1 }, passive: { id: "protectBonus", name: "Consuelo", desc: "+4 virtud al proteger a alguien." } },
    { id: "ladron", name: "Ladrón", stats: { sombra: 1 }, passive: { id: "stealDiscount", name: "Manos rápidas", desc: "Robar te mancha menos." } },
    { id: "vidente", name: "Vidente", stats: { mente: 1 }, passive: { id: "extraClue", name: "Presagio", desc: "+1 fuerza a las pistas que obtienes." } },
    { id: "centinela", name: "Centinela", stats: { cuerpo: 1 }, passive: { id: "defenseBonus", name: "Vigilia", desc: "+2 a tu defensa al enfrentarte a alguien." } }
  ];

  /* Objetos. kind decide el efecto; uses = usos antes de gastarse (por defecto 1); passive = actúa solo mientras lo llevas.
     heal: value = vitalidad, cures = estados que quita, virtue = virtud extra.
     prep: acts = {acción: rebaja de dificultad} que se aplica a esa acción (una vez) durante left rondas. */
  const ITEMS = {
    talisman: { id: "talisman", name: "Talismán de sal", kind: "defense", value: 2, desc: "Una bolsita de sal bendita que aleja lo malo: +2 defensa esta ronda. Se gasta al usarlo." },
    cota: { id: "cota", name: "Cota de malla", kind: "defense", value: 3, uses: 2, desc: "Te la pones para el Consejo: +3 defensa esta ronda. Aguanta dos usos; luego queda tan abollada que no sirve." },
    manto: { id: "manto", name: "Manto de lana", kind: "passive", desc: "Pasivo: mientras lo lleves, el frío y la lluvia no te afectan y amortigua un poco los golpes (+1 defensa al ser emboscado). No se gasta ni se usa: basta con llevarlo." },
    vendas: { id: "vendas", name: "Vendas limpias", kind: "heal", value: 4, cures: ["sangrado"], desc: "Cierran la herida: recupera 4 de vitalidad y corta el sangrado." },
    hierbas: { id: "hierbas", name: "Hierbas medicinales", kind: "heal", value: 2, cures: ["veneno", "infeccion"], desc: "Un manojo de hierbas amargas: recupera 2 de vitalidad y quita el veneno y la infección." },
    botiquin: { id: "botiquin", name: "Botiquín de campaña", kind: "heal", value: 6, cures: ["sangrado", "infeccion"], desc: "Vendas, aguja e hilo: recupera 6 de vitalidad y corta el sangrado y la infección." },
    racion: { id: "racion", name: "Ración de viaje", kind: "heal", value: 2, virtue: 2, desc: "Pan duro y queso: si estás herido, recupera 2 de vitalidad, y te anima un poco (+2 virtud). Si no tienes heridas no tiene sentido comer." },
    antidoto: { id: "antidoto", name: "Antídoto", kind: "cleanse", desc: "Quita sangrado, veneno, infección y maldición, y alivia los males sin nombre." },
    elixir: { id: "elixir", name: "Elixir de vigor", kind: "elixir", desc: "Recupera 3 de vitalidad y te fortalece (+1 a tus tiradas) dos rondas." },
    aguabendita: { id: "aguabendita", name: "Agua bendita", kind: "purify", value: 8, desc: "Aparta parte de la oscuridad que llevas contigo (−8) y te da algo de paz (+2 virtud)." },
    bendicion: { id: "bendicion", name: "Estampa bendita", kind: "virtue", value: 10, desc: "Una estampa con una oración: +10 virtud." },
    vela: { id: "vela", name: "Vela de sebo negro", kind: "ritual", desc: "Su luz serena el ánimo: +1 foco (se suma a tu próxima tirada, como −1 dificultad) y +3 virtud." },
    amuleto: { id: "amuleto", name: "Amuleto de enfoque", kind: "focus", value: 1, desc: "Te ayuda a concentrarte: +1 foco (se suma a tu próxima tirada, como −1 dificultad). Máx. 2 de foco." },
    sello: { id: "sello", name: "Testimonio sellado", kind: "clue", value: 1, desc: "La declaración jurada de un testigo: pista sobre el jugador que elijas." },
    llave: { id: "llave", name: "Llave negra", kind: "clue", value: 2, msg: "Abres la cripta con la llave negra y revuelves sus legajos: encuentras algo sobre ", desc: "Abre la cripta bajo el castillo, donde se guardan legajos antiguos: pista fuerte sobre el jugador que elijas. Se gasta al abrir." },
    mapa: { id: "mapa", name: "Mapa del castillo", kind: "prep", acts: { explorar: 2 }, left: 2, desc: "Un plano con pasadizos marcados: tu próximo Explorar tiene −2 de dificultad (hoy o la ronda siguiente)." },
    brujula: { id: "brujula", name: "Brújula de hierro frío", kind: "prep", acts: { investigar: 2 }, left: 2, desc: "La aguja se inquieta cerca de los rastros: tu próxima Investigación tiene −2 de dificultad (hoy o la ronda siguiente)." },
    antorcha: { id: "antorcha", name: "Antorcha", kind: "prep", acts: { investigar: 1, explorar: 1 }, left: 2, desc: "Con luz se ve mejor: tu próxima Investigación y tu próximo Explorar tienen −1 de dificultad (hoy o la ronda siguiente). Además, quien lleva fuego espanta a las fieras y no pierde el foco con la tormenta." },
    linterna: { id: "linterna", name: "Linterna de aceite", kind: "lantern", desc: "Ilumina tu entorno esta ronda: si alguien te agrede en privado, sabrás quién fue. Quien lleva fuego también se libra de trampas y de la tormenta, y espanta a las fieras." },
    cuerda: { id: "cuerda", name: "Cuerda", kind: "prep", acts: { socorrer: 2, proteger: 1 }, left: 3, desc: "Sirve para sacar a alguien de un hoyo o ponerlo a cubierto: tu próximo Socorrer tiene −2 de dificultad y tu próximo Proteger −1 (durante tres rondas). También te salva del fuego." },
    ganzua: { id: "ganzua", name: "Ganzúa", kind: "prep", acts: { robar: 2, explorar: 1 }, left: 3, desc: "Abre cerraduras y bolsillos: tu próximo Robar tiene −2 de dificultad y tu próximo Explorar −1 (durante tres rondas)." },
    lupa: { id: "lupa", name: "Lupa de cronista", kind: "lens", desc: "Examinas los detalles: tu próxima acusación cuenta con +1 evidencia. Se gasta al usarla (la lente se agrieta)." },
    daga: { id: "daga", name: "Daga ritual", kind: "passive", desc: "Pasivo: mientras la lleves permite Apuñalar y te da +2 de ataque si enfrentas a alguien en el Consejo. No se gasta ni hay que usarla." },
    frasco: { id: "frasco", name: "Frasco de veneno", kind: "weapon", desc: "Permite Envenenar a alguien. Se gasta al usarlo." },
    pergamino: { id: "pergamino", name: "Pergamino maldito", kind: "weapon", desc: "Permite Maldecir a alguien. Se gasta al usarlo." },
    porra: { id: "porra", name: "Porra de plomo", kind: "weapon", desc: "Permite Aturdir a alguien. Se gasta al usarla." },
    polvo: { id: "polvo", name: "Polvo cegador", kind: "dust", desc: "Lo lanzas a la cara de otro jugador: queda maldito (−1 a sus tiradas) una ronda." },
    espejo: { id: "espejo", name: "Espejo de plata", kind: "reflect", desc: "Refleja la próxima agresión directa que recibas: falla y quien atacó queda maldito dos rondas." },
    ceniza: { id: "ceniza", name: "Ceniza de protección", kind: "ward", desc: "Anula el próximo sangrado, veneno, aturdimiento o maldición que te lancen." },
    capa: { id: "capa", name: "Capa de niebla", kind: "fog", desc: "Las dos próximas pistas que obtengan sobre ti serán más débiles." },
    coartada: { id: "coartada", name: "Coartada escrita", kind: "shield", desc: "Un papel firmado por testigos: anula la próxima acusación contra ti." },
    grimorio: { id: "grimorio", name: "Grimorio incompleto", kind: "tome", desc: "Páginas con conjuros a medio escribir. Al estudiarlo (+3 oscuridad) aprendes uno de tres dándole forma, o perfeccionas un conjuro que ya conoces (sube un nivel de maestría)." },
    runa: { id: "runa", name: "Runa de poder", kind: "rune", desc: "Grabada en tu conjuro más gastado, le concede un uso más." },
    reliquia: { id: "reliquia", name: "Reliquia robada", kind: "corruption", value: 8, stat: "sombra", desc: "Te mancha de oscuridad (+8) y da +1 Sombra." },
    fragmento: { id: "fragmento", name: "Fragmento umbrío", kind: "corruption", value: 6, stat: "sombra", desc: "Te mancha de oscuridad (+6) y da +1 Sombra." }
  };

  const LOOT_ITEMS = ["talisman", "vendas", "hierbas", "racion", "botiquin", "sello", "daga", "amuleto", "mapa", "bendicion", "coartada", "frasco", "pergamino", "porra", "espejo", "ceniza", "antidoto", "aguabendita", "polvo", "elixir", "grimorio", "runa", "cota", "vela", "capa", "antorcha", "linterna", "cuerda", "ganzua", "brujula", "lupa", "manto"];
  const DARK_ITEMS = ["reliquia", "fragmento", "daga", "coartada", "llave", "frasco", "pergamino", "grimorio", "runa", "polvo", "espejo", "ganzua"];
  const UTIL_ITEMS = ["antorcha", "linterna", "cuerda", "ganzua", "brujula", "lupa", "manto"];
  const MEDIC_ITEMS = ["vendas", "hierbas", "racion", "antidoto", "botiquin"];

  const ACTIONS = [
    { id: "investigar", lore: "Quien sigue rastros acaba viendo lo que otros callan; la práctica afina la mente.", name: "Investigar", tag: "INVESTIGACIÓN", attr: "mente", target: true, diff: 4, risk: true, pushable: true, desc: "Sigue el rastro de otro jugador. +1 pista y +3 virtud." },
    { id: "proteger", lore: "Jurar protección a otros abre la puerta a promesas más delicadas.", name: "Proteger", tag: "PROTECCIÓN", attr: "cuerpo", target: true, diff: 4, risk: true, pushable: false, desc: "Te comprometes a defender a otro. +6 virtud y protección." },
    { id: "explorar", lore: "Entre las ruinas hay más que objetos: algunos libros guardan lo que no debería leerse.", name: "Explorar", tag: "EXPLORACIÓN", attr: "mente", target: false, diff: 5, risk: true, pushable: true, desc: "Registras las ruinas. +1 objeto, a veces una pista, y +2 virtud. A veces alguien te sale al paso: tú decides cómo tratarlo." },
    { id: "meditar", lore: "Aprender a callar los susurros enseña también a escuchar solo lo que quieres.", name: "Meditar", tag: "PURIFICACIÓN", target: false, diff: 0, risk: false, desc: "Rechazas los susurros: la oscuridad se aleja un poco y +6 virtud. Además repasas tus grimorios: un conjuro casi agotado recupera un uso. Si no sabes ningún conjuro, la primera vez que meditas aprendes uno defensivo sencillo." },
    { id: "robar", lore: "Las manos ágiles recuerdan todo lo que han tomado.", name: "Robar", tag: "ROBO", attr: "sombra", target: true, diff: 5, risk: true, pushable: true, hostile: true, desc: "Arrebatas un objeto. Te mancha de oscuridad y -4 virtud. Falla si te protegen." },
    { id: "hechizar", lore: "Las palabras prohibidas se pegan a la lengua y piden más.", name: "Hechizar", tag: "MAGIA PROHIBIDA", attr: "sombra", target: true, diff: 5, risk: true, pushable: true, hostile: true, desc: "Magia sucia sin grimorio: marcas a otro, obtienes una pista fuerte y te manchas bastante de oscuridad. Si falla, te muerde (3 de daño). No es lo mismo que Conjurar, que usa tus conjuros aprendidos." },
    { id: "apostar", lore: "Quien juega contra el Umbral aprende cuánto vale su suerte.", name: "Apostar al Umbral", tag: "APUESTA", attr: "sombra", target: false, diff: 5, risk: true, pushable: true, gamble: true, desc: "Arriesgas contra la oscuridad. Tú eliges el envite." },
    { id: "ceder", lore: "Cada concesión hace más persuasivo al siguiente susurro.", name: "Ceder a la tentación", tag: "TENTACIÓN", target: false, diff: 0, risk: false, desc: "Aceptas el poder: +1 atributo, +1 objeto oscuro, mucha oscuridad y 2 de daño." },
    { id: "resistir", lore: "Negarse deja una cicatriz de claridad.", name: "Resistir la tentación", tag: "VIRTUD", target: false, diff: 0, risk: false, desc: "Rechazas el poder: +8 virtud, la oscuridad se aleja un poco y +1 foco." },
    { id: "cazar", lore: "Solo quien ya pertenece a la noche conoce este camino.", name: "Cazar", tag: "CAZA DEL ASESINO", attr: "sombra", target: true, diff: 5, risk: true, pushable: false, hostile: true, assassinOnly: true, desc: "Solo el Asesino puede usar esta acción. Ataca en secreto a un superviviente, que se defiende con su Cuerpo, Mente y objetos. Si vences, le causa 4-6 de daño (+2 si es crítico; 10-12 en partidas de 4 rondas o menos) y te alimentas de su miedo (+2 de vitalidad). Si la víctima ya está moribunda, la rematas sin tirada. En partidas de menos de 10 rondas, a quien dejes moribundo solo le queda lo que reste de la ronda para que alguien lo socorra." },
    { id: "apunalar", lore: "El filo termina enseñando a su dueño.", needs: "daga", consume: false, name: "Apuñalar", tag: "AGRESIÓN", attr: "cuerpo", target: true, diff: 5, risk: true, hostile: true, desc: "Un golpe directo: 2-4 de daño (4-5 si es crítico, y además sangrado). Si fallas, la oscuridad te ensucia." },
    { id: "envenenar", lore: "Los frascos guardan pacientes.", needs: "frasco", name: "Envenenar", tag: "VENENO", attr: "sombra", target: true, diff: 4, risk: true, hostile: true, desc: "Veneno retardado, de dosis fija (no se puede potenciar ni arriesgar más). La víctima no nota nada la ronda siguiente; dos rondas después empieza a sufrir 2 de daño por ronda durante dos rondas, salvo que se cure (hierbas, antídoto, descansar o Purga). El frasco se gasta aunque falles; una ceniza de protección lo anula." },
    { id: "maldecir", lore: "Un pergamino bien leído no se olvida.", needs: "pergamino", name: "Maldecir", tag: "MALDICIÓN", attr: "sombra", target: true, diff: 5, risk: true, hostile: true, desc: "Una maldición: -1 a todas las tiradas de la víctima durante dos rondas. Si fallas, la oscuridad te marca." },
    { id: "aturdir", lore: "La fuerza bruta también tiene sus maneras.", needs: "porra", name: "Aturdir", tag: "GOLPE SECO", attr: "cuerpo", target: true, diff: 6, risk: true, hostile: true, desc: "Dejas a la víctima aturdida: pierde su próximo turno." },
    { id: "trampa", lore: "Quien ha recorrido muchas veces las ruinas sabe dónde un paso en falso duele de verdad.", name: "Poner una trampa", tag: "TRAMPA", attr: null, target: true, diff: 0, risk: false, harm: true, desc: "Escondes una trampa pensando en alguien. Salta al cierre de la ronda SIGUIENTE sobre quien se haya movido por las ruinas (explorar, investigar, robar, proteger...): quien esperas tiene el triple de probabilidades, pero si se queda quieto (meditar, descansar, entrenar) o lleva antorcha o linterna, puede caer otro, un inocente, o incluso tú si te mueves. 2-3 de daño en las piernas. Sin tirada ni objeto: tu único coste es la acción. Si nadie la pisa, se pierde; solo puedes tener una." },
    { id: "sabotear", lore: "Una cerradura forzada a tiempo, un frasco aguado: las manos ágiles saben estropear sin romper.", name: "Sabotear", tag: "SABOTAJE", attr: "mente", target: true, diff: 5, risk: true, harm: true, desc: "Estropeas en secreto un objeto de otro jugador (no sabes cuál: se elige al azar entre los que se gastan, no los pasivos). La próxima vez que lo use, fallará y la mitad de las veces se le volverá en contra (1-2 de daño). Si no lleva nada que estropear, pierdes la noche. Si fallas la tirada, solo nota que alguien rebuscó en sus cosas." },
    { id: "devorar", lore: "Hay hambres que no se confiesan.", name: "Devorar", tag: "CANIBALISMO", attr: "cuerpo", target: true, diff: 5, risk: true, hostile: true, canTarget: function (t) { return t.hp <= Math.ceil((7 + t.stats.cuerpo) * 0.4) || ((t.status || []).some(function (s) { return s.id === "aturdido"; }) && t.hp < 7 + t.stats.cuerpo); }, desc: "Solo contra quien tenga 40% de vitalidad o menos, o esté aturdido y herido. Si tienes éxito, eliminas a la víctima, heredas sus objetos, recuperas 3 de vitalidad, la oscuridad te marca, -6 virtud y +1 a un atributo al azar (máximo 6), y te conviertes en Asesino. Si fallas, sufres 3 de daño y te manchas de oscuridad. Si la víctima también es un Asesino, su carne te repugna y no pasa nada más que perder 2 de virtud." },
    { id: "indagar", lore: "Los rastros hablan bajo, pero no mienten: solo callan casi todo.", name: "Indagar", tag: "INVESTIGACIÓN", attr: null, target: false, diff: 0, risk: false, desc: "Gastas el turno en examinar las heridas y muertes de las últimas rondas. Obtienes una pista veraz pero parcial (el tipo de rastro y la ronda aproximada, y a veces un detalle vago); nunca dice quién fue. Todos pueden indagar. Si no hay nada que examinar, no encuentras nada. Solo la ves tú." },
    { id: "descansar", lore: "Quien sana aprende a esperar.", name: "Descansar", tag: "RECUPERACIÓN", target: false, diff: 0, risk: false, desc: "Reposas y vendas lo peor: +3 de vitalidad y se van el sangrado, el veneno y la infección. El alivio te mancha un poco de oscuridad. Cura al momento, pero no te protege de los golpes que recibas después esa misma ronda." },
    { id: "conjurar", lore: "Cada conjuro bien lanzado se asienta un poco más en tu memoria.", name: "Conjurar", tag: "MAGIA", attr: null, target: false, diff: 0, risk: false, desc: "Lanzas uno de tus conjuros. Primero eliges cuál (y sobre quién); luego, con cuánto empeño: con cautela (más fácil, no pierdes el uso si falla), normal, o desatado (más potente, pero más difícil, te mancha y si falla te estalla en las manos). Verás el % de éxito de cada opción antes de decidir. Los usos son limitados; Meditar repone uno." },
    { id: "tender", lore: "Una mano abierta puede ser refugio o cebo; solo quien la tiende lo sabe.", name: "Tender la mano", tag: "PROMESA", attr: null, target: true, diff: 0, risk: false, mode: true, desc: "Ofreces ayuda en secreto a otro jugador. Si confía en ti y calla, se abrirá una ventana a su favor. Solo tú sabes cómo es tu mano." },
    { id: "socorrer", lore: "Quien se arrodilla junto al caído descubre de qué está hecha su propia piedad.", name: "Socorrer", tag: "AUXILIO", attr: "mente", target: true, diff: 4, risk: true, pushable: false, canTarget: function (t) { return !!t.dying; }, desc: "Solo sobre un moribundo. Si sale bien, se estabiliza con 2 de vitalidad y tú ganas +5 virtud. Si fallas, quizá sea tarde." },
    { id: "sombra_espia", lore: "Una sombra bien enseñada recoge lo que la luz deja caer.", name: "Sombras espías", tag: "SOMBRAS", attr: "sombra", target: true, diff: 4, risk: true, pushable: false, desc: "Mandas a tus sombras tras otro jugador: obtienes una pista sobre él (más fuerte con dominio alto). Cuesta +2 de oscuridad (0 con dominio de Señor). No deja rastro público. Practicarlas sube tu dominio de las sombras." },
    { id: "sombra_guarda", lore: "Las sombras no duermen, y tampoco te dejan hacerlo a ti.", name: "Sombras guardianas", tag: "SOMBRAS", attr: "sombra", target: false, diff: 4, risk: true, pushable: false, desc: "Tus sombras te rodean esta ronda: +3 de defensa (+4 con dominio Domador, +5 Señor). Con dominio Domador o más, si alguien te agrede en privado antes de que acabe la ronda sabrás quién fue. Cuesta +2 de oscuridad (0 como Señor)." },
    { id: "sombra_hostiga", lore: "Hay susurros que solo sirven para arruinarle la noche a alguien.", name: "Sombras hostigadoras", tag: "SOMBRAS", attr: "sombra", target: true, diff: 5, risk: true, pushable: false, hostile: true, desc: "Tus sombras acosan a otro jugador: queda maldito (−1 a sus tiradas) una ronda (dos con dominio Domador) y se mancha de oscuridad (+3). Tú pagas +3 de oscuridad y −2 de virtud. En público solo se ve que las sombras se agitaron alrededor de la víctima, no quién las mandó." },
    { id: "alzar", lore: "Los muertos aguantan peor el aburrimiento que los vivos; aceptan casi cualquier trabajo.", name: "Alzar a un caído", tag: "NIGROMANCIA", attr: "sombra", target: true, diff: 5, risk: true, pushable: false, canTarget: function (t, p) { return (!!t.dead && (t.risenBy === undefined || t.risenBy === null) && t.cause !== "devorado") || (!!t.dying && !!p && p.alignment === "asesino"); }, desc: "Levantas como sombra servidora a un jugador eliminado (el Asesino puede rematar a un moribundo para alzarlo). Si sale bien, cada ronda te susurra una pista, te da +2 de defensa y, si eres Asesino, te facilita la caza (−1 dificultad). Coste: −2 de vitalidad, +8 de oscuridad y −6 de virtud (si fallas, +4 y −3). En público se sabrá que una sombra se alzó, no quién la manda. Máx. 1 sombra alzada (2 con dominio Señor)." },
    { id: "bendecir", lore: "Quien cura sin descanso aprende a pedir lo que la oscuridad no puede dar.", name: "Bendecir", tag: "PURIFICACIÓN", attr: "mente", target: false, diff: 5, risk: true, pushable: false, desc: "Invocas una bendición sobre ti: la oscuridad se aparta bastante (−10; −14 si es crítico), +8 virtud, +3 de vitalidad y se va cualquier maldición. Si falla, solo +3 virtud. Se abre a fuerza de curar (vendajes, hierbas, descansos o socorros)." },
    { id: "entrenar", lore: "El esfuerzo repetido deja huella en el cuerpo.", name: "Entrenar", tag: "FORTALECIMIENTO", target: false, diff: 0, risk: false, desc: "Te fortaleces durante dos rondas: +1 a todas tus tiradas." }
  ];

  /* Envites de la acción Apostar: dificultad, premio y castigo. */
  const STAKES = [
    { id: 5, name: "Prudente", diff: 5, items: 1, clues: 0, virtue: 3, wound: 0, failCorr: 4, desc: "Poco riesgo, poca gloria." },
    { id: 10, name: "Audaz", diff: 6, items: 1, clues: 1, virtue: 5, wound: 0, failCorr: 7, desc: "Un objeto y una pista." },
    { id: 20, name: "Temeraria", diff: 7, items: 2, clues: 2, virtue: 8, wound: 1, failCorr: 11, desc: "Dos objetos, dos pistas… o un buen golpe." }
  ];

  /* Eventos de ronda. w = peso por fase de la partida [inicio, mitad, final]. fx = efecto que aplica el motor (engine.js, EVFX).
     text = lo que se cuenta a la mesa; effectText = lo que ocurre de verdad (el motor lo ajusta según el resultado real).
     Cada partida no repite evento hasta agotar la lista. */
  const EVENTS = [
    /* --- clásicos --- */
    { id: "llave", w: [3, 1, 0], text: "Un cuervo deja una llave negra en el equipaje de alguien. Una voz susurra: «Abre la cripta y conocerás un secreto».", fx: "item", itemId: "llave", gift: "Llave negra. Úsala desde tu ficha: abre la cripta y te da una pista fuerte sobre quien elijas.", effectText: "Alguien ha recibido una llave negra (abre la cripta: pista fuerte)." },
    { id: "fuente", w: [1, 3, 2], text: "La fuente del pueblo cura las heridas, pero exige un recuerdo a cambio.", fx: "heal", effectText: "Quien estuviera herido recupera 3 de vitalidad." },
    { id: "biblioteca", w: [3, 2, 0], text: "Entre las cenizas de una biblioteca quemada asoma un libro a medio escribir. Alguien lo ha visto antes que los demás.", fx: "item", itemId: "grimorio", effectText: "Alguien ha encontrado un grimorio entre las cenizas." },
    { id: "huellas", w: [3, 2, 1], text: "Huellas frescas terminan ante una pared de piedra. Alguien estuvo aquí antes que vosotros.", fx: "clue", effectText: "Alguien ha encontrado un rastro." },
    { id: "encapuchado", w: [1, 3, 1], text: "Una figura encapuchada ofrece poder a cambio de una promesa que aún no debéis pronunciar.", fx: "corruption", effectText: "La oscuridad ha rozado a todos." },
    { id: "mercader", w: [2, 3, 1], text: "Un mercader vende un plano del castillo con pasadizos que nadie recordaba.", fx: "item", itemId: "mapa", gift: "Mapa del castillo. Úsalo desde tu ficha: tu próximo Explorar será más fácil.", effectText: "Alguien ha comprado un plano del castillo." },
    { id: "espiritu", w: [1, 3, 2], text: "Un espíritu pide que protejáis a alguien a quien todavía no conocéis.", fx: "virtue", effectText: "Una promesa antigua os reconforta (+3 virtud)." },
    { id: "campana", w: [0, 2, 3], text: "La campana suena trece veces. Durante un instante, la sombra de alguien se mueve por sí sola.", fx: "corruption", effectText: "Las sombras se han movido solas." },
    { id: "reliquia", w: [0, 2, 2], text: "Una reliquia late como un corazón. Podrías estudiarla o quedártela.", fx: "item", itemId: "reliquia", effectText: "Alguien ha encontrado una reliquia." },
    { id: "copista", w: [0, 3, 2], text: "Un copista moribundo deja caer su cuaderno: páginas con conjuros sin terminar. Solo uno de vosotros llega a tiempo de cogerlo.", fx: "item", itemId: "grimorio", effectText: "Alguien ha recogido el cuaderno de un copista." },
    { id: "nino", w: [0, 2, 3], text: "Un niño asegura que uno de vosotros habla mientras duerme con una voz distinta.", fx: "clue", effectText: "Alguien ha oído a un testigo." },
    { id: "santuario", w: [0, 1, 3], text: "La niebla revela un sendero hacia el santuario hundido. Algo os espera allí.", fx: "corruption", effectText: "El santuario os ha visto." },
    { id: "presencia", w: [0, 1, 3], text: "Una presencia ofrece borrar una falta, si aceptáis cargar con otra.", fx: "corruption", effectText: "La presencia cobra su precio a todos." },
    { id: "pueblo", w: [0, 1, 3], text: "El pueblo ha cerrado sus puertas. Alguien ha sido señalado como culpable.", fx: "clue", effectText: "Alguien ha recibido un soplo anónimo." },
    /* --- clima --- */
    { id: "helada", w: [1, 3, 3], text: "Una helada inesperada cae sobre el castillo y entumece las manos.", fx: "cold" },
    { id: "tormenta", w: [2, 2, 1], text: "Una tormenta apaga las velas y borra los rastros en el barro.", fx: "storm" },
    { id: "luna", w: [2, 2, 2], text: "La luna llena ilumina el patio con una luz clara y un poco inquietante.", fx: "moon", effectText: "Quien sigue en pie gana 1 de foco; a quien ya cargaba 40 o más de oscuridad, la luna le pesa (+2 de oscuridad)." },
    { id: "amanecer", w: [0, 1, 4], text: "Un amanecer falso aclara el cielo y calma los nervios.", fx: "dawn", effectText: "Quien sigue en pie recupera 1 de vitalidad y pierde 2 de oscuridad." },
    { id: "incendio", w: [1, 2, 2], text: "Se incendia un ala del castillo y alguien queda atrapado entre el humo.", fx: "fire" },
    /* --- hallazgos --- */
    { id: "cofre", w: [3, 2, 1], text: "Un cofre medio podrido asoma del lodo. Alguien llega primero.", fx: "item", pool: "loot", effectText: "Alguien ha abierto un cofre y se ha quedado con lo que había." },
    { id: "viajero", w: [2, 2, 1], text: "Un viajero yace junto al camino con la mochila intacta y los remedios a la vista.", fx: "item", pool: "medic", effectText: "Alguien ha registrado la mochila del viajero." },
    { id: "pozo", w: [2, 2, 1], text: "Un pozo antiguo asegura cumplir deseos a quien arroje una moneda.", fx: "wish", effectText: "Alguien ha pedido un deseo: +6 de virtud y +1 de foco." },
    { id: "herreria", w: [2, 2, 1], text: "Entre los restos de una herrería hay filos y mallas olvidados.", fx: "item", pool: ["daga", "cota", "porra"], effectText: "Alguien ha recogido un arma o una armadura." },
    { id: "botica", w: [1, 3, 2], text: "La botica abandonada aún guarda frascos sin romper.", fx: "item", pool: ["hierbas", "botiquin", "antidoto", "vendas"], effectText: "Alguien ha recogido remedios de la botica." },
    { id: "almacen", w: [3, 2, 1], text: "El almacén del castillo guarda aperos de viaje que nadie reclama.", fx: "item", pool: "util", effectText: "Alguien se ha hecho con un aparejo de viaje." },
    { id: "buhonero", w: [3, 2, 1], text: "Un buhonero vende cachivaches a buen precio junto a la puerta.", fx: "item", pool: ["elixir", "amuleto", "polvo", "vela", "talisman", "capa"], effectText: "Alguien ha comprado un remedio o un amuleto al buhonero." },
    { id: "tesoro", w: [1, 3, 2], req: "mapa", text: "Un montículo reciente brilla bajo la luna. Quien sepa leer un mapa sabrá qué esconde.", fx: "treasure", effectText: "Quien llevaba un mapa o una brújula ha desenterrado un tesoro." },
    /* --- gente, rumores y ofertas --- */
    { id: "rumor", w: [2, 3, 2], req: "rumor", text: "Un buhonero susurra un rumor sobre quién carga con más oscuridad.", fx: "rumor", effectText: "Alguien ha oído el rumor del buhonero (veraz)." },
    { id: "testigos", w: [2, 2, 2], text: "Dos aldeanos aseguran haber visto algo raro anoche.", fx: "witnesses", effectText: "Dos de vosotros han oído un testimonio, cada uno sobre alguien distinto." },
    { id: "mendigo", w: [1, 1, 1], req: "racion", text: "Un mendigo pide un trozo de pan a quien lleve comida.", fx: "beggar", effectText: "Alguien compartió su ración con el mendigo, que le pagó con un secreto." },
    { id: "apuesta", w: [2, 2, 1], text: "Se organiza una pelea de gallos y alguien apuesta fuerte.", fx: "bet", effectText: "Alguien ha apostado en la pelea de gallos: o gana un objeto o pierde uno." },
    { id: "ladron", w: [1, 2, 2], req: "items", text: "Un ratero se cuela de noche entre las mochilas.", fx: "thief" },
    /* --- festivales y rituales --- */
    { id: "cosecha", w: [2, 3, 1], text: "Los aldeanos celebran la cosecha y reparten pan y vino a quien pasa.", fx: "feast", effectText: "Quien sigue en pie come caliente: +2 de vitalidad (si estaba herido) y +2 de virtud." },
    { id: "mascaras", w: [1, 3, 2], text: "Es noche de máscaras: nadie reconoce a nadie.", fx: "masks", effectText: "La próxima pista que consigan sobre cada uno será una fuerza más débil." },
    { id: "feria", w: [1, 3, 2], req: "swap", text: "Una feria de trueques cruza el patio: todo el mundo cambia algo con su vecino.", fx: "swap", effectText: "Cada jugador con objetos ha cambiado uno, al azar, con otro: mirad vuestra mochila." },
    { id: "penitentes", w: [1, 2, 3], text: "Una procesión de penitentes cruza el patio cantando salmos.", fx: "penitents", effectText: "Quien cargaba 30 o más de oscuridad se libra de 5; el resto gana 2 de virtud." },
    { id: "sacerdote", w: [1, 3, 2], text: "Un sacerdote errante bendice a alguien al azar.", fx: "priest", effectText: "Alguien ha sido bendecido: −8 de oscuridad y +4 de virtud." },
    { id: "circulo", w: [1, 2, 2], text: "Un círculo de piedras canta bajito. Alguien entra y siente que algo le enseña.", fx: "circle", effectText: "Alguien ha aprendido o perfeccionado un conjuro entre las piedras, a cambio de algo de oscuridad." },
    { id: "altar", w: [1, 2, 3], req: "altar", text: "Un altar manchado exige un tributo a quien más carga.", fx: "altar", effectText: "Alguien ha cambiado un objeto por uno oscuro." },
    { id: "eclipse", w: [0, 1, 3], text: "Un eclipse apaga el sol por un momento y la oscuridad pesa más.", fx: "eclipse", effectText: "+2 de oscuridad para todos; quien sepa magia recupera un uso de su conjuro más gastado." },
    /* --- animales, trampas, enfermedades, rivalidades --- */
    { id: "perro", w: [2, 2, 1], text: "Un perro vagabundo se pega a las piernas de alguien y no se va.", fx: "dog", effectText: "Alguien tiene un perro guardián: +2 de defensa esta ronda y +2 de virtud." },
    { id: "lobos", w: [0, 2, 3], text: "Los lobos aúllan en el bosque y rondan el castillo.", fx: "wolves" },
    { id: "trampa", w: [2, 2, 1], text: "Alguien pisa un lazo oculto en el pasillo.", fx: "trap" },
    { id: "fiebre", w: [1, 3, 2], text: "La fiebre de los pantanos corre por el castillo: alguien amanece ardiendo.", fx: "fever" },
    { id: "aguas", w: [2, 2, 1], text: "Alguien bebe de un charco que parecía limpio.", fx: "water", effectText: "Alguien está envenenado." },
    { id: "rencilla", w: [2, 3, 2], req: "three", text: "Dos de vosotros discuten por una vieja ofensa y se van enfadados.", fx: "feud" }
  ];

  const ASSASSIN_CLUES = [
    "La sombra de {name} se orientó hacia la salida, aunque la luz venía del otro lado.",
    "Al pronunciar el nombre del Umbral, {name} respondió antes de que nadie lo dijera.",
    "Una marca oscura apareció en la muñeca de {name} y desapareció al mirarla.",
    "Has oído a {name} hablar en sueños con una voz que no parecía suya."
  ];

  const CLUES = [
    "{name} guardó silencio más de lo habitual.",
    "{name} miró hacia la puerta cuando sonó la campana.",
    "{name} escuchó el consejo sin decir demasiado.",
    "{name} se quedó mirando el fuego."
  ];

  /* Objetivos secretos. text = qué tienes que conseguir (frase directa); when = cuándo se comprueba; why(p, s, ok) = explicación para el desenlace.
     reward = premio concreto que se entrega UNA vez, al cumplirse el objetivo (lo aplica y anuncia el motor). kind "event": se cumple en cuanto ocurre; kind "state": se comprueba al cerrar cada ronda de la segunda mitad en adelante. */
  const SECRETS = [
    { id: "redentor", kind: "state", reward: { title: "Purificación", text: "−8 de oscuridad, +4 de virtud y se va cualquier maldición." }, title: "Conciencia limpia", text: "OBJETIVO: terminar la partida con la oscuridad baja (20 o menos de 100).", when: "Se comprueba al cerrar cada ronda de la segunda mitad y en el desenlace; el premio llega la primera vez que se cumple.", check: (p) => p.corr <= 20,
      why: (p, s, ok) => ok ? "Acabaste con la oscuridad en " + p.corr + " (límite 20)." : "Acabaste con la oscuridad en " + p.corr + ": te pasaste de 20." },
    { id: "poder", kind: "state", reward: { title: "Poder oscuro", text: "+1 Sombra (hasta 6) y un objeto oscuro del Umbral." }, title: "Sed de oscuridad", text: "OBJETIVO: ser, al final, el jugador con MÁS oscuridad de la mesa.", when: "Se comprueba al cerrar cada ronda de la segunda mitad y en el desenlace; el premio llega la primera vez que se cumple.", check: (p, s) => p.corr === Math.max(...s.players.map((x) => x.corr)),
      why: (p, s, ok) => ok ? "Tu oscuridad (" + p.corr + ") era la más alta." : "Alguien tenía más oscuridad que tú (" + p.corr + ")." },
    { id: "justiciero", kind: "event", reward: { title: "Pista fuerte", text: "una pista de fuerza 3 sobre otro jugador, al azar." }, title: "Justicia", text: "OBJETIVO: acusar con éxito al Asesino en el Consejo, al menos una vez.", when: "Se cumple en cuanto una acusación tuya acierta (necesitas pruebas).", check: (p) => (p.successfulAccusations || 0) > 0,
      why: (p, s, ok) => ok ? "Acusaste con éxito al Asesino." : "Ninguna acusación tuya acertó contra el Asesino." },
    { id: "superviviente", kind: "state", reward: { title: "Resistencia extra", text: "una cota de malla y una ceniza que anula el próximo mal (veneno, sangrado, maldición…)." }, title: "Intacto", text: "OBJETIVO: terminar vivo y con la vitalidad AL MÁXIMO (sin ninguna herida pendiente).", when: "Se comprueba al cerrar cada ronda de la segunda mitad y en el desenlace: si en ese momento tu vitalidad está al máximo, cuenta; el premio llega la primera vez.", check: (p) => p.wounds === 0,
      why: (p, s, ok) => ok ? "Terminaste con la vitalidad al máximo." : (p.dead ? "Moriste." : "Terminaste herido (vitalidad " + p.hp + "): no estaba al máximo.") },
    { id: "sombra", kind: "event", reward: { title: "Arma de traidor", text: "veneno, pergamino maldito o porra de plomo (uno, al azar)." }, title: "Traición", text: "OBJETIVO: romper al menos un pacto (traicionar a alguien con quien tengas un trato).", when: "Se cumple en cuanto se rompe un pacto por tu culpa. Cuesta oscuridad y virtud.", check: (p) => (p.betrayals || 0) > 0,
      why: (p, s, ok) => ok ? "Rompiste un pacto." : "No rompiste ningún pacto." },
    { id: "lazo", kind: "event", reward: { title: "Un aliado", text: "una vez, alguien se interpone y bloquea la próxima agresión directa que recibas." }, title: "Palabra dada", text: "OBJETIVO: cumplir al menos 2 pactos hasta el final (sin romperlos).", when: "Cada pacto cuenta cuando se cumple, normalmente al final de la ronda siguiente.", check: (p) => (p.keptPacts || 0) >= 2,
      why: (p, s, ok) => ok ? "Cumpliste " + p.keptPacts + " pactos." : "Solo cumpliste " + (p.keptPacts || 0) + " pacto(s); hacían falta 2." }
  ];


  /* Estados: se aplican con acciones y se resuelven al inicio de cada ronda. */
  const STATUS = {
    sangrado: { name: "Sangrado", desc: "-2 vitalidad al inicio de cada ronda (dos rondas). Se corta con Descansar o Vendas." },
    infeccion: { name: "Infección", desc: "Una zona grave sin curar se infecta: -1 vitalidad y +2 corrupción por ronda (3 rondas). La quitan Descansar, Antídoto y Purga." },
    veneno: { name: "Veneno", desc: "Te mancha de oscuridad y, si viene de un frasco, te hiere 2 de vitalidad al inicio de cada ronda (dos rondas). Se corta con Descansar, hierbas o antídoto." },
    aturdido: { name: "Aturdido", desc: "Pierde su próximo turno." },
    maldito: { name: "Maldito", desc: "-1 a todas las tiradas (dos rondas)." },
    fortalecido: { name: "Fortalecido", desc: "+1 a todas las tiradas (dos rondas)." }
  };

  /* NPC (jugadores controlados por la app): perfiles y nombres. */
  const NPC_PROFILES = { prudente: "Prudente", agresivo: "Agresivo", curandero: "Curandero", oscuro: "Oscuro" };
  const NPC_NAMES = ["Brisa", "Cuervo", "Dara", "Elan", "Fenn", "Gaia", "Hael", "Ibis", "Jora", "Kael", "Lumi", "Mirt", "Nox", "Orla", "Pyra", "Quill", "Rhea", "Sable", "Tilo", "Vesta"];

  const D = { VERSION: "1.8.2", NPC_PROFILES, NPC_NAMES, STATUS, ROLES, AFFINITIES, ITEMS, LOOT_ITEMS, DARK_ITEMS, UTIL_ITEMS, MEDIC_ITEMS, ACTIONS, STAKES, EVENTS, CLUES, ASSASSIN_CLUES, SECRETS };
  g.UMBRAL_DATA = D;
  if (typeof module !== "undefined") module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
