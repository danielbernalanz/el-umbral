/* EL UMBRAL — datos del juego (v1.7.0)
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
    fragmento: { id: "fragmento", name: "Fragmento umbrío", kind: "corruption", value: 6, stat: "sombra", desc: "Te mancha de oscuridad (+6) y da +1 Sombra." },
    /* Objetos de «Artes de dañar» (v1.8, F0). Aún sin resolución propia: F1 los conectará a D.HARM. */
    ampolla: { id: "ampolla", name: "Ampolla de hiel de víbora", kind: "weapon", desc: "Una ampolla de cristal con hiel de víbora: permite usar Hiel de víbora (veneno rápido, 2 de daño y temblores). Se gasta al usarla." },
    laudano: { id: "laudano", name: "Láudano", kind: "sedative", desc: "Somnífero de dosis fija: permite dar Sopor a alguien (no podrá acusar, enfrentar ni pactar la ronda siguiente). También puede dar una ronda de gracia a un moribundo. Se gasta al usarlo." },
    cepo: { id: "cepo", name: "Cepo de cazador", kind: "trap", desc: "Un cepo de hierro dentado: permite montar una trampa plantada que atrapa la pierna de quien explore. Puede saltar sobre ti si nadie más lo activa. Se gasta al montarlo." },
    polvora: { id: "polvora", name: "Pólvora de mecha", kind: "explosive", desc: "Un saquito de pólvora con mecha: estalla al cerrar la fase privada. Muy potente e indiscreto; más carga también puede estallarte en las manos. Se gasta al usarla." },
    moho: { id: "moho", name: "Cultivo de moho", kind: "infection", desc: "Un tarro con moho de los pantanos: permite contagiar a otro sin estar infectado tú. La infección dura dos rondas. Se gasta al usarlo." },
    aceite: { id: "aceite", name: "Aceite de lámpara", kind: "prep", acts: { fuego: 1 }, left: 1, desc: "Un frasco de aceite: tu próximo Prender fuego tiene −1 de dificultad y alcanza mejor. También sirve para avivar una llama. Se gasta al usarlo." },
    odre: { id: "odre", name: "Odre de agua", kind: "heal", value: 1, virtue: 1, desc: "Un trago de agua limpia: si estás herido recupera 1 de vitalidad y te reanima (+1 virtud). Quien te vea beber puede pensar que es otra cosa." },
    cebo: { id: "cebo", name: "Cebo preparado", kind: "bait", desc: "Carne y hierbas olorosas: permite atraer a las fieras hacia tu víctima (solo con el evento de lobos). Se gasta al usarlo." },
    trapo: { id: "trapo", name: "Trapo sucio", kind: "dirty", desc: "Un trapo con pus y barro: permite contagiar la infección a otro sin gastar tu propio estado. Se gasta al usarlo." }
  };

  const LOOT_ITEMS = ["talisman", "vendas", "hierbas", "racion", "botiquin", "sello", "daga", "amuleto", "mapa", "bendicion", "coartada", "frasco", "pergamino", "porra", "espejo", "ceniza", "antidoto", "aguabendita", "polvo", "elixir", "grimorio", "runa", "cota", "vela", "capa", "antorcha", "linterna", "cuerda", "ganzua", "brujula", "lupa", "manto", "ampolla", "laudano", "cepo", "polvora", "moho", "aceite", "odre", "cebo", "trapo"];
  const DARK_ITEMS = ["reliquia", "fragmento", "daga", "coartada", "llave", "frasco", "pergamino", "grimorio", "runa", "polvo", "espejo", "ganzua", "ampolla", "laudano", "cepo", "polvora", "moho", "trapo"];
  const UTIL_ITEMS = ["antorcha", "linterna", "cuerda", "ganzua", "brujula", "lupa", "manto", "aceite", "odre", "cebo"];
  const MEDIC_ITEMS = ["vendas", "hierbas", "racion", "antidoto", "botiquin", "laudano", "odre"];

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
    { id: "envenenar", lore: "Los frascos guardan pacientes.", needs: "frasco", name: "Envenenar", tag: "VENENO", attr: "sombra", target: true, diff: 4, risk: true, hostile: true, desc: "Un veneno lento: la víctima se mancha de oscuridad al inicio de cada una de las dos rondas siguientes." },
    { id: "maldecir", lore: "Un pergamino bien leído no se olvida.", needs: "pergamino", name: "Maldecir", tag: "MALDICIÓN", attr: "sombra", target: true, diff: 5, risk: true, hostile: true, desc: "Una maldición: -1 a todas las tiradas de la víctima durante dos rondas. Si fallas, la oscuridad te marca." },
    { id: "aturdir", lore: "La fuerza bruta también tiene sus maneras.", needs: "porra", name: "Aturdir", tag: "GOLPE SECO", attr: "cuerpo", target: true, diff: 6, risk: true, hostile: true, desc: "Dejas a la víctima aturdida: pierde su próximo turno." },
    { id: "devorar", lore: "Hay hambres que no se confiesan.", name: "Devorar", tag: "CANIBALISMO", attr: "cuerpo", target: true, diff: 5, risk: true, hostile: true, canTarget: function (t) { return t.hp <= Math.ceil((7 + t.stats.cuerpo) * 0.4) || ((t.status || []).some(function (s) { return s.id === "aturdido"; }) && t.hp < 7 + t.stats.cuerpo); }, desc: "Solo contra quien tenga 40% de vitalidad o menos, o esté aturdido y herido. Si tienes éxito, eliminas a la víctima, heredas sus objetos, recuperas 3 de vitalidad, la oscuridad te marca, -6 virtud y +1 a un atributo al azar (máximo 6), y te conviertes en Asesino. Si fallas, sufres 3 de daño y te manchas de oscuridad. Si la víctima también es un Asesino, su carne te repugna y no pasa nada más que perder 2 de virtud." },
    { id: "descansar", lore: "Quien sana aprende a esperar.", name: "Descansar", tag: "RECUPERACIÓN", target: false, diff: 0, risk: false, desc: "Reposas y vendas lo peor: +3 de vitalidad y se van el sangrado, el veneno y la infección. El alivio te mancha un poco de oscuridad. Cura al momento, pero no te protege de los golpes que recibas después esa misma ronda." },
    { id: "conjurar", lore: "Cada conjuro bien lanzado se asienta un poco más en tu memoria.", name: "Conjurar", tag: "MAGIA", attr: null, target: false, diff: 0, risk: false, desc: "Lanzas uno de tus conjuros. Primero eliges cuál (y sobre quién); luego, con cuánto empeño: con cautela (más fácil, no pierdes el uso si falla), normal, o desatado (más potente, pero más difícil, te mancha y si falla te estalla en las manos). Verás el % de éxito de cada opción antes de decidir. Los usos son limitados; Meditar repone uno." },
    { id: "tender", lore: "Una mano abierta puede ser refugio o cebo; solo quien la tiende lo sabe.", name: "Tender la mano", tag: "PROMESA", attr: null, target: true, diff: 0, risk: false, mode: true, desc: "Ofreces ayuda en secreto a otro jugador. Si confía en ti y calla, se abrirá una ventana a su favor. Solo tú sabes cómo es tu mano." },
    { id: "socorrer", lore: "Quien se arrodilla junto al caído descubre de qué está hecha su propia piedad.", name: "Socorrer", tag: "AUXILIO", attr: "mente", target: true, diff: 4, risk: true, pushable: false, canTarget: function (t) { return !!t.dying; }, desc: "Solo sobre un moribundo. Si sale bien, se estabiliza con 2 de vitalidad y tú ganas +5 virtud. Si fallas, quizá sea tarde." },
    { id: "sombra_espia", lore: "Una sombra bien enseñada recoge lo que la luz deja caer.", name: "Sombras espías", tag: "SOMBRAS", attr: "sombra", target: true, diff: 4, risk: true, pushable: false, desc: "Mandas a tus sombras tras otro jugador: obtienes una pista sobre él (más fuerte con dominio alto). Cuesta +2 de oscuridad (0 con dominio de Señor). No deja rastro público. Practicarlas sube tu dominio de las sombras." },
    { id: "sombra_guarda", lore: "Las sombras no duermen, y tampoco te dejan hacerlo a ti.", name: "Sombras guardianas", tag: "SOMBRAS", attr: "sombra", target: false, diff: 4, risk: true, pushable: false, desc: "Tus sombras te rodean esta ronda: +3 de defensa (+4 con dominio Domador, +5 Señor). Con dominio Domador o más, si alguien te agrede en privado antes de que acabe la ronda sabrás quién fue. Cuesta +2 de oscuridad (0 como Señor)." },
    { id: "sombra_hostiga", lore: "Hay susurros que solo sirven para arruinarle la noche a alguien.", name: "Sombras hostigadoras", tag: "SOMBRAS", attr: "sombra", target: true, diff: 5, risk: true, pushable: false, hostile: true, desc: "Tus sombras acosan a otro jugador: queda maldito (−1 a sus tiradas) una ronda (dos con dominio Domador) y se mancha de oscuridad (+3). Tú pagas +3 de oscuridad y −2 de virtud. En público solo se ve que las sombras se agitaron alrededor de la víctima, no quién las mandó." },
    { id: "alzar", lore: "Los muertos aguantan peor el aburrimiento que los vivos; aceptan casi cualquier trabajo.", name: "Alzar a un caído", tag: "NIGROMANCIA", attr: "sombra", target: true, diff: 5, risk: true, pushable: false, canTarget: function (t, p) { return (!!t.dead && (t.risenBy === undefined || t.risenBy === null) && t.cause !== "devorado") || (!!t.dying && !!p && p.alignment === "asesino"); }, desc: "Levantas como sombra servidora a un jugador eliminado (el Asesino puede rematar a un moribundo para alzarlo). Si sale bien, cada ronda te susurra una pista, te da +2 de defensa y, si eres Asesino, te facilita la caza (−1 dificultad). Coste: −2 de vitalidad, +8 de oscuridad y −6 de virtud (si fallas, +4 y −3). En público se sabrá que una sombra se alzó, no quién la manda. Máx. 1 sombra alzada (2 con dominio Señor)." },
    { id: "bendecir", lore: "Quien cura sin descanso aprende a pedir lo que la oscuridad no puede dar.", name: "Bendecir", tag: "PURIFICACIÓN", attr: "mente", target: false, diff: 5, risk: true, pushable: false, desc: "Invocas una bendición sobre ti: la oscuridad se aparta bastante (−10; −14 si es crítico), +8 virtud, +3 de vitalidad y se va cualquier maldición. Si falla, solo +3 virtud. Se abre a fuerza de curar (vendajes, hierbas, descansos o socorros)." },
    { id: "entrenar", lore: "El esfuerzo repetido deja huella en el cuerpo.", name: "Entrenar", tag: "FORTALECIMIENTO", target: false, diff: 0, risk: false, desc: "Te fortaleces durante dos rondas: +1 a todas tus tiradas." },
    /* Acciones nuevas de «Artes de dañar» (v1.8, F0). Catálogo y requisito visible; F1 implementa su resolución.
       No están en UNLOCK: hasta F1 el motor las reconoce pero las mantiene cerradas, así no aparecen en la mesa ni en los bots. */
    { id: "zancadilla", lore: "El suelo es un arma que nadie registra.", name: "Zancadilla", tag: "AGRESIÓN", attr: "cuerpo", target: true, diff: 5, risk: true, hostile: true, family: "filo", req: "2 Explorar o 1 Enfrentar", desc: "Sin objeto: 1-2 de daño en las piernas y cojera. Temerario: 3 de daño y la víctima suelta un objeto al azar. Requiere 2 Explorar o 1 Enfrentar." },
    { id: "arma_improvisada", lore: "Cualquier cosa pesada sirve si el brazo no tiembla.", name: "Arma improvisada", tag: "AGRESIÓN", attr: "cuerpo", target: true, diff: 4, risk: true, hostile: true, family: "filo", req: "2 Explorar", desc: "Sin objeto: 1-3 de daño en brazos o cabeza, sin sangrado y con poca huella. Temerario: se rompe y no puedes repetirla. Requiere 2 Explorar." },
    { id: "ensanarse", lore: "La crueldad se aprende mirando una herida abierta.", name: "Ensañarse", tag: "CRUELDAD", attr: "cuerpo", target: true, diff: 5, risk: true, hostile: true, family: "filo", req: "Daga o arma improvisada; la víctima debe tener una herida visible", desc: "Solo contra alguien con una herida visible y nunca contra un moribundo: +1 de daño en su zona más lesionada e infección dos rondas." },
    { id: "contagiar", lore: "La enfermedad no distingue amigos; quien la lleva, sí.", name: "Contagiar", tag: "ENFERMEDAD", attr: "sombra", target: true, diff: 5, risk: false, hostile: true, family: "veneno", req: "Estar infectado, o gastar un cultivo de moho", desc: "Solo si estás infectado (o gastas un cultivo de moho): la víctima recibe infección dos rondas. Si sois dos o más infectados, se corre la voz del lazareto." },
    { id: "sabotear", lore: "Un equipo roto hiere más que una daga: deja sola a su dueño.", name: "Sabotear", tag: "SABOTAJE", attr: "sombra", target: true, diff: 5, risk: true, hostile: true, family: "trampa", req: "Ganzúa o 2 Explorar", desc: "Dos rondas: sus vendas y hierbas curan la mitad, y su cota o talismán pierden fuerza. No hace daño directo. Ganzúa o 2 Explorar." },
    { id: "cepo", lore: "El cazador sonríe cuando oye el chasquido.", name: "Cepo", tag: "TRAMPA", attr: "sombra", target: true, diff: 5, risk: true, hostile: true, family: "trampa", req: "Cepo de cazador (se gasta)", desc: "Monta un cepo plantado dos rondas: 2-3 de daño en la pierna y cojera al saltar. Si nadie lo activa, puede atraparte a ti." },
    { id: "cuerda", lore: "Una cuerda bien tensada no necesita filos.", name: "Tensar una cuerda", tag: "TRAMPA", attr: "sombra", target: true, diff: 4, risk: true, hostile: true, family: "trampa", req: "Cuerda (no se gasta)", desc: "Planta una cuerda una ronda: el siguiente Explorar, Proteger o Socorrer de la víctima pierde el foco y sube +2 de dificultad; 1 de daño en cabeza o piernas." },
    { id: "polvora", lore: "La pólvora no pregunta a quién debe respetar.", name: "Pólvora", tag: "EXPLOSIVO", attr: "sombra", target: true, diff: 6, risk: true, hostile: true, family: "fuego", req: "Pólvora de mecha (se gasta)", desc: "Carga diferida: estalla al cerrar la fase privada y hace 3-5 de daño en el torso. Indiscreto; el Temerario puede estallarte en las manos." },
    { id: "fuego", lore: "El fuego limpia y delata a partes iguales.", name: "Prender fuego", tag: "FUEGO", attr: "sombra", target: true, diff: 6, risk: true, hostile: true, family: "fuego", req: "Antorcha o linterna; aceite opcional", desc: "Área: 3 de daño a la víctima y 0-1 a los demás, que pierden el foco. Se ve el humo. Necesitas antorcha o linterna; el aceite lo hace más difícil de esquivar." },
    { id: "embarrar", lore: "El barro arruina más planes que una maldición.", name: "Embarrar", tag: "TRAVESURA", attr: "sombra", target: true, diff: 4, risk: false, hostile: true, family: "trampa", req: "Sin objeto; ideal con lluvia o pozo", desc: "Desactiva la ceniza, el talismán y los preparados de la víctima, y le baja Explorar e Investigar una ronda. No hace daño." },
    { id: "sembrar_sospecha", lore: "Una mentira bien puesta pesa más que una prueba.", name: "Sembrar sospecha", tag: "SOSPECHA", attr: "mente", target: true, diff: 5, risk: true, hostile: true, family: "social", req: "2 Investigar", desc: "Rumor falso: +1 evidencia contra la víctima en las acusaciones durante dos rondas. Si se descubre, puede volverse contra ti. Requiere 2 Investigar." },
    { id: "vigilar", lore: "Conocer la rutina de alguien es empezar a ser su sombra.", name: "Vigilar", tag: "VIGILANCIA", attr: "sombra", target: true, diff: 4, risk: true, hostile: true, family: "social", req: "Sin objeto", desc: "Marcas a la víctima dos rondas: tu próxima forma de dañarla tiene −1 dificultad y +1 daño, y ves la categoría de su última acción. El Temerario alarga la marca pero puede delatarte." },
    { id: "preparar_emboscada", lore: "La ventaja se gana antes de que suene la campana.", name: "Preparar emboscada", tag: "EMBOSCADA", attr: "cuerpo", target: true, diff: 5, risk: false, hostile: true, family: "social", req: "Daga o arma improvisada", desc: "Prepara tu próximo Enfrentar en el Consejo: +1, +2 o +3 de ataque. La víctima no recibe aviso." }
  ];

  /* «Artes de dañar» (v1.8, F0): catálogo de las 24 formas de dañar de docs/designs/dano.md §1.
     delivery: directa (inmediata) / diferida (al cierre de la fase privada) / persistente (por ronda) / plantada (espera a su víctima) / ambiental (usa evento o entorno).
     d0 = dificultad base; P = potencia base (daño o duración representativa); dial = admite Seguro/Arriesgado/Temerario.
     lethal = puede rematar a un moribundo (solo Apuñalar; §7). object/consume = objeto que se gasta o no; req = requisito visible.
     victim = nota genérica de la víctima (nunca autor ni objeto); public = línea de crónica solo si la forma es indiscreta (§4), sin nombres. */
  const HARM = [
    { id: "apunalar", name: "Apuñalar", delivery: "directa", object: "daga", consume: false, req: "Daga ritual (no se gasta)", d0: 5, P: 3, dial: true, lethal: true, family: "filo", effect: "2-4 de vitalidad en torso o brazos; crítico 4-5 y sangrado.", victim: "Sientes un dolor agudo y la ropa empapada: alguien te ha herido.", public: null },
    { id: "aturdir", name: "Aturdir", delivery: "directa", object: "porra", consume: true, req: "Porra de plomo (se gasta)", d0: 6, P: 1, dial: true, lethal: false, family: "filo", effect: "La víctima pierde su próximo turno; Temerario añade 2 de daño en la cabeza.", victim: "La cabeza te da vueltas; el mundo se apaga un instante.", public: null },
    { id: "zancadilla", name: "Zancadilla", delivery: "directa", object: null, consume: null, req: "Sin objeto; 2 Explorar o 1 Enfrentar", d0: 5, P: 2, dial: true, lethal: false, family: "filo", effect: "1-2 de vitalidad en las piernas y cojera; Temerario 3 y suelta un objeto al azar.", victim: "Algo te frena el pie y caes: te duele la pierna.", public: null },
    { id: "arma_improvisada", name: "Arma improvisada", delivery: "directa", object: null, consume: null, req: "Sin objeto; 2 Explorar", d0: 4, P: 2, dial: true, lethal: false, family: "filo", effect: "1-3 de vitalidad en brazos o cabeza, sin sangrado y con menos huella.", victim: "Un golpe seco te alcanza; no ves de dónde vino.", public: null },
    { id: "ensanarse", name: "Ensañarse", delivery: "directa", object: "daga", consume: false, req: "Daga o arma improvisada; la víctima debe tener una herida visible", d0: 5, P: 2, dial: true, lethal: false, family: "filo", effect: "+1 de daño en su zona más lesionada e infección dos rondas; nunca contra moribundos.", victim: "Tu herida se abre de nuevo, y arde como fuego.", public: null },
    { id: "veneno_copa", name: "Veneno en la copa", delivery: "diferida", object: "frasco", consume: true, req: "Frasco de veneno (se gasta)", d0: 4, P: 2, dial: false, lethal: false, family: "veneno", effect: "Latencia una ronda; luego 1 de vitalidad por ronda dos rondas y +2 de oscuridad. Cura: hierbas, antídoto o ceniza.", victim: "Un sabor amargo te queda en la boca; algo no sentó bien.", public: null },
    { id: "cebo_envenenado", name: "Cebo envenenado", delivery: "plantada", object: "frasco", consume: true, req: "Frasco de veneno (se gasta)", d0: 4, P: 2, dial: false, lethal: false, family: "veneno", effect: "Envenena lo próximo que la víctima tome en tres rondas: no cura y sufre veneno lento. Caduca sin avisar.", victim: "Lo que acabas de tomar sabía raro. Demasiado tarde.", public: null },
    { id: "hiel_vibora", name: "Hiel de víbora", delivery: "directa", object: "ampolla", consume: true, req: "Ampolla de hiel de víbora (se gasta)", d0: 5, P: 2, dial: false, lethal: false, family: "veneno", effect: "2 de vitalidad inmediata y temblores (−1 cuerpo una ronda). Deja rastro público y huella alta siempre.", victim: "Un pinchazo y un ardor recorren tu brazo; te tiemblan las manos.", public: "Alguien enfermó de golpe, sin causa aparente." },
    { id: "laudano", name: "Láudano", delivery: "directa", object: "laudano", consume: true, req: "Láudano (se gasta)", d0: 5, P: 1, dial: false, lethal: false, family: "veneno", effect: "Sopor: la ronda siguiente no puede acusar, enfrentar ni pactar, y −1 Mente. Sin daño. También da una ronda de gracia a un moribundo.", victim: "Un sueño pesado te envuelve; te cuesta reunir las palabras.", public: null },
    { id: "contagiar", name: "Contagiar", delivery: "persistente", object: "moho", consume: true, req: "Estar infectado, o gastar un cultivo de moho", d0: 5, P: 2, dial: false, lethal: false, family: "veneno", effect: "Infección dos rondas (1 de vitalidad por ronda y +2 de oscuridad). Con dos o más infectados hay rumor público de lazareto.", victim: "Te sientes arder por dentro; la fiebre te pesa.", public: "Se habla de un lazareto: varios han enfermado." },
    { id: "maldecir", name: "Maldecir", delivery: "persistente", object: "pergamino", consume: true, req: "Pergamino maldito (se gasta)", d0: 5, P: 2, dial: false, lethal: false, family: "social", effect: "−1 a todas sus tiradas dos rondas. Se cura con antídoto o Purga; fallar mancha de oscuridad.", victim: "Sientes un peso extraño en la nuca: algo te frena.", public: null },
    { id: "regalo_maldito", name: "Regalo maldito", delivery: "directa", object: "reliquia", consume: true, req: "Reliquia o fragmento umbrío (se gasta)", d0: 4, P: 0, dial: false, lethal: false, family: "social", effect: "+6 de oscuridad a la víctima y presión del Umbral para ella; no hace daño de vitalidad. Si falla, sabe que viene de ti.", victim: "Un escalofrío te recorre al tocar el regalo; algo oscuro se pega a ti.", public: null },
    { id: "sabotear", name: "Sabotear el equipo", delivery: "persistente", object: "ganzua", consume: false, req: "Ganzúa (no se gasta) o 2 Explorar", d0: 5, P: 0, dial: true, lethal: false, family: "trampa", effect: "Dos rondas: vendas y hierbas curan la mitad, cota y talismán −1, la ceniza se anula. Sin daño directo.", victim: "Tus remedios no curan como deberían; el equipo está estropeado.", public: null },
    { id: "cepo", name: "Cepo", delivery: "plantada", object: "cepo", consume: true, req: "Cepo de cazador (se gasta) o cuerda y metal", d0: 5, P: 3, dial: true, lethal: false, family: "trampa", effect: "Plante dos rondas: 2-3 de vitalidad en las piernas y cojera. Si nadie lo activa, salta a quien explore después, incluido tú.", victim: "Un chasquido y un dolor en la pierna: algo te ha atrapado.", public: null },
    { id: "cuerda_tensada", name: "Cuerda tensada", delivery: "plantada", object: "cuerda", consume: false, req: "Cuerda (no se gasta)", d0: 4, P: 1, dial: true, lethal: false, family: "trampa", effect: "Una ronda: el siguiente Explorar, Proteger o Socorrer de la víctima sube +2 de dificultad y pierde foco; 1 de vitalidad.", victim: "Algo te frena el paso y pierdes el hilo de lo que hacías.", public: null },
    { id: "polvora", name: "Pólvora", delivery: "diferida", object: "polvora", consume: true, req: "Pólvora de mecha (se gasta)", d0: 6, P: 4, dial: true, lethal: false, family: "fuego", effect: "Estalla al cerrar la fase privada: 3-5 de vitalidad en el torso. Temerario: doble carga, 5-7 y puede estallar en tus manos.", victim: "Una explosión te sacude y te deja sin aliento.", public: "Una explosión sacudió el castillo." },
    { id: "cebo_fieras", name: "Cebo para fieras", delivery: "ambiental", object: "racion", consume: true, req: "Ración (se gasta); solo con el evento de lobos", d0: 5, P: 3, dial: false, lethal: false, family: "trampa", effect: "Solo con lobos: van a por tu víctima aunque lleve fuego; 2-3 de vitalidad en las piernas. Si lleva fuego, no sirve y gastas el cebo.", victim: "Unos ojos brillan entre la maleza y se lanzan hacia ti.", public: null },
    { id: "empujar_hoyo", name: "Empujar al hoyo", delivery: "ambiental", object: null, consume: null, req: "Sin objeto; solo con evento de hoyo, trampa o incendio", d0: 4, P: 3, dial: true, lethal: false, family: "trampa", effect: "Caída: 2-4 de vitalidad en piernas o torso y pierde su siguiente Explorar. Si fallas, caes tú.", victim: "El suelo cede bajo tus pies y caes al vacío.", public: null },
    { id: "prender_fuego", name: "Prender fuego", delivery: "ambiental", object: "antorcha", consume: false, req: "Antorcha o linterna (no se gasta); aceite opcional", d0: 6, P: 3, dial: true, lethal: false, family: "fuego", effect: "Área: 3 de vitalidad a la víctima y 0-1 a los demás sin fuego o cuerda; pierden foco. Temerario: 2 a toda la mesa y riesgo de quemarte.", victim: "El humo te rodea y el calor te alcanza.", public: "Se vio humo salir de una de las alas." },
    { id: "embarrar", name: "Embarrar", delivery: "ambiental", object: null, consume: null, req: "Sin objeto; ideal con lluvia o pozo", d0: 4, P: 0, dial: false, lethal: false, family: "trampa", effect: "Desactiva ceniza, talismán y preparados de la víctima, y le baja Explorar e Investigar una ronda. Sin vitalidad.", victim: "Te empapan de barro: el agua estropea tus preparados.", public: null },
    { id: "sembrar_sospecha", name: "Sembrar sospecha", delivery: "persistente", object: null, consume: null, req: "Sin objeto; 2 Investigar", d0: 5, P: 0, dial: true, lethal: false, family: "social", effect: "Rumor falso sin autor: +1 evidencia contra la víctima en acusaciones dos rondas. Fallar puede retratarte.", victim: "Notas miradas raras: alguien ha hablado mal de ti.", public: null },
    { id: "vigilar", name: "Vigilar", delivery: "persistente", object: null, consume: null, req: "Sin objeto", d0: 4, P: 0, dial: true, lethal: false, family: "social", effect: "Marca dos rondas: tu próxima forma contra ella tiene −1 dificultad y +1 daño; ves la categoría de su última acción. Temerario: más duración, riesgo de ser visto.", victim: "Sientes que alguien te observa desde la sombra.", public: null },
    { id: "preparar_emboscada", name: "Preparar emboscada", delivery: "diferida", object: "daga", consume: false, req: "Daga o arma improvisada (no se gasta)", d0: 5, P: 0, dial: false, lethal: false, family: "social", effect: "Tu próximo Enfrentar en el Consejo gana +1/+2/+3 de ataque; la víctima no recibe aviso. Fallar pierde la ventaja y la delata sin nombre.", victim: "Presientes una trampa en el Consejo, pero no sabes de quién.", public: null },
    { id: "mano_envenenada", name: "Mano envenenada", delivery: "persistente", object: null, consume: null, req: "Mano «trampa» (ya existente)", d0: 0, P: 2, dial: false, lethal: false, family: "veneno", effect: "Acumula 1 carga por ronda; con 2 o más, −2 de vitalidad por ronda hasta 8 rondas. Coste social ya existente.", victim: "Un escozor recorre tu mano; el veneno se extiende.", public: null }
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
    veneno: { name: "Veneno", desc: "Te mancha de oscuridad al inicio de cada ronda (dos rondas). Se corta con Descansar." },
    aturdido: { name: "Aturdido", desc: "Pierde su próximo turno." },
    maldito: { name: "Maldito", desc: "-1 a todas las tiradas (dos rondas)." },
    fortalecido: { name: "Fortalecido", desc: "+1 a todas las tiradas (dos rondas)." }
  };

  /* NPC (jugadores controlados por la app): perfiles y nombres. */
  const NPC_PROFILES = { prudente: "Prudente", agresivo: "Agresivo", curandero: "Curandero", oscuro: "Oscuro" };
  const NPC_NAMES = ["Brisa", "Cuervo", "Dara", "Elan", "Fenn", "Gaia", "Hael", "Ibis", "Jora", "Kael", "Lumi", "Mirt", "Nox", "Orla", "Pyra", "Quill", "Rhea", "Sable", "Tilo", "Vesta"];

  const D = { VERSION: "1.7.0", NPC_PROFILES, NPC_NAMES, STATUS, ROLES, AFFINITIES, ITEMS, LOOT_ITEMS, DARK_ITEMS, UTIL_ITEMS, MEDIC_ITEMS, ACTIONS, HARM, STAKES, EVENTS, CLUES, ASSASSIN_CLUES, SECRETS };
  g.UMBRAL_DATA = D;
  if (typeof module !== "undefined") module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
