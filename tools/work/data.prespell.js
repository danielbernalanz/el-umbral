/* EL UMBRAL — datos del juego (v0.9.3)
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
      passive: { id: "defenseBonus", name: "Veterano", desc: "+2 a tu defensa en emboscadas." }
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
    { id: "combatiente", name: "Combatiente", stats: { cuerpo: 1 }, passive: { id: "attackBonus", name: "Ataque brutal", desc: "+1 al atacar en emboscadas." } },
    { id: "erudito", name: "Erudito", stats: { mente: 1 }, passive: { id: "evidenceBonus", name: "Análisis", desc: "+1 evidencia en tus acusaciones." } },
    { id: "sanadora", name: "Sanadora", stats: { mente: 1 }, passive: { id: "protectBonus", name: "Consuelo", desc: "+4 virtud al proteger a alguien." } },
    { id: "ladron", name: "Ladrón", stats: { sombra: 1 }, passive: { id: "stealDiscount", name: "Manos rápidas", desc: "Robar te mancha menos." } },
    { id: "vidente", name: "Vidente", stats: { mente: 1 }, passive: { id: "extraClue", name: "Presagio", desc: "+1 fuerza a las pistas que obtienes." } },
    { id: "centinela", name: "Centinela", stats: { cuerpo: 1 }, passive: { id: "defenseBonus", name: "Vigilia", desc: "+2 a tu defensa en emboscadas." } }
  ];

  const ITEMS = {
    talisman: { id: "talisman", name: "Talismán de sal", kind: "defense", value: 2, desc: "+2 defensa esta ronda." },
    vendas: { id: "vendas", name: "Vendas limpias", kind: "heal", desc: "Recupera 4 de vitalidad y corta el sangrado." },
    sello: { id: "sello", name: "Sello de testigo", kind: "clue", value: 1, desc: "Pista sobre el jugador que elijas." },
    daga: { id: "daga", name: "Daga ritual", kind: "attack", value: 2, desc: "+2 ataque esta ronda y permite Apuñalar. No se gasta." },
    amuleto: { id: "amuleto", name: "Amuleto de práctica", kind: "focus", value: 1, desc: "+1 foco para tu próxima tirada." },
    reliquia: { id: "reliquia", name: "Reliquia robada", kind: "corruption", value: 8, stat: "sombra", desc: "Te mancha de oscuridad y da +1 Sombra." },
    fragmento: { id: "fragmento", name: "Fragmento umbrío", kind: "corruption", value: 6, stat: "sombra", desc: "Te mancha de oscuridad y da +1 Sombra." },
    bendicion: { id: "bendicion", name: "Bendición menor", kind: "virtue", value: 10, desc: "+10 virtud." },
    mapa: { id: "mapa", name: "Mapa imposible", kind: "reveal", desc: "Pista sobre un jugador al azar." },
    llave: { id: "llave", name: "Llave negra", kind: "clue", value: 2, desc: "Pista fuerte sobre quien elijas." },
    frasco: { id: "frasco", name: "Frasco de veneno", kind: "weapon", desc: "Permite Envenenar a alguien. Se gasta al usarlo." },
    pergamino: { id: "pergamino", name: "Pergamino maldito", kind: "weapon", desc: "Permite Maldecir a alguien. Se gasta al usarlo." },
    porra: { id: "porra", name: "Porra de plomo", kind: "weapon", desc: "Permite Aturdir a alguien. Se gasta al usarla." },
    espejo: { id: "espejo", name: "Espejo de plata", kind: "reflect", desc: "Refleja la próxima agresión directa que recibas: falla y quien atacó queda maldito dos rondas." },
    ceniza: { id: "ceniza", name: "Ceniza de protección", kind: "ward", desc: "Anula el próximo sangrado, veneno, aturdimiento o maldición que te lancen." },
    antidoto: { id: "antidoto", name: "Antídoto", kind: "cleanse", desc: "Quita sangrado, veneno, infección y maldición, y alivia los males sin nombre." },
    aguabendita: { id: "aguabendita", name: "Agua bendita", kind: "purify", value: 8, desc: "Aparta parte de la oscuridad que llevas contigo y te da algo de paz." },
    polvo: { id: "polvo", name: "Polvo cegador", kind: "dust", desc: "Lo lanzas sobre otro jugador: queda maldito (−1 a sus tiradas) una ronda." },
    elixir: { id: "elixir", name: "Elixir de vigor", kind: "elixir", desc: "Recupera 3 de vitalidad y te fortalece dos rondas." },
    grimorio: { id: "grimorio", name: "Grimorio incompleto", kind: "tome", desc: "Páginas con conjuros a medio escribir. Al estudiarlo eliges uno entre tres y le das forma." },
    runa: { id: "runa", name: "Runa de poder", kind: "rune", desc: "Grabada en tu conjuro más gastado, le concede un uso más." },
    cota: { id: "cota", name: "Cota de malla", kind: "defense", value: 3, desc: "+3 defensa esta ronda." },
    vela: { id: "vela", name: "Vela de sebo negro", kind: "ritual", desc: "Un pequeño ritual: +1 foco y +3 virtud." },
    capa: { id: "capa", name: "Capa de niebla", kind: "fog", desc: "Las dos próximas pistas que obtengan sobre ti serán más débiles." },
    coartada: { id: "coartada", name: "Coartada escrita", kind: "shield", desc: "Anula la próxima acusación contra ti." }
  };

  const LOOT_ITEMS = ["talisman", "vendas", "sello", "daga", "amuleto", "mapa", "bendicion", "coartada", "frasco", "pergamino", "porra", "espejo", "ceniza", "antidoto", "aguabendita", "polvo", "elixir", "grimorio", "grimorio", "runa", "cota", "vela", "capa"];
  const DARK_ITEMS = ["reliquia", "fragmento", "daga", "coartada", "llave", "frasco", "pergamino", "grimorio", "runa", "polvo", "espejo"];

  const ACTIONS = [
    { id: "investigar", lore: "Quien sigue rastros acaba viendo lo que otros callan; la práctica afina la mente.", name: "Investigar", tag: "INVESTIGACIÓN", attr: "mente", target: true, diff: 4, risk: true, pushable: true, desc: "Sigue el rastro de otro jugador. +1 pista y +3 virtud." },
    { id: "proteger", lore: "Jurar protección a otros abre la puerta a promesas más delicadas.", name: "Proteger", tag: "PROTECCIÓN", attr: "cuerpo", target: true, diff: 4, risk: true, pushable: false, desc: "Te comprometes a defender a otro. +6 virtud y protección." },
    { id: "explorar", lore: "Entre las ruinas hay más que objetos: algunos libros guardan lo que no debería leerse.", name: "Explorar", tag: "EXPLORACIÓN", attr: "mente", target: false, diff: 5, risk: true, pushable: true, desc: "Registras las ruinas. +1 objeto, a veces una pista, y +2 virtud. A veces alguien te sale al paso: tú decides cómo tratarlo." },
    { id: "meditar", lore: "Aprender a callar los susurros enseña también a escuchar solo lo que quieres.", name: "Meditar", tag: "PURIFICACIÓN", target: false, diff: 0, risk: false, desc: "Rechazas los susurros: la oscuridad se aleja un poco y +6 virtud." },
    { id: "robar", lore: "Las manos ágiles recuerdan todo lo que han tomado.", name: "Robar", tag: "ROBO", attr: "sombra", target: true, diff: 5, risk: true, pushable: true, hostile: true, desc: "Arrebatas un objeto. Te mancha de oscuridad y -4 virtud. Falla si te protegen." },
    { id: "hechizar", lore: "Las palabras prohibidas se pegan a la lengua y piden más.", name: "Hechizar", tag: "MAGIA PROHIBIDA", attr: "sombra", target: true, diff: 5, risk: true, pushable: true, hostile: true, desc: "Marcas a otro con magia. Te mancha de oscuridad, pero obtienes una pista fuerte." },
    { id: "apostar", lore: "Quien juega contra el Umbral aprende cuánto vale su suerte.", name: "Apostar al Umbral", tag: "APUESTA", attr: "sombra", target: false, diff: 5, risk: true, pushable: true, gamble: true, desc: "Arriesgas contra la oscuridad. Tú eliges el envite." },
    { id: "ceder", lore: "Cada concesión hace más persuasivo al siguiente susurro.", name: "Ceder a la tentación", tag: "TENTACIÓN", target: false, diff: 0, risk: false, desc: "Aceptas el poder: +1 atributo, +1 objeto oscuro, mucha oscuridad y 2 de daño." },
    { id: "resistir", lore: "Negarse deja una cicatriz de claridad.", name: "Resistir la tentación", tag: "VIRTUD", target: false, diff: 0, risk: false, desc: "Rechazas el poder: +8 virtud, la oscuridad se aleja un poco y +1 foco." },
    { id: "cazar", lore: "Solo quien ya pertenece a la noche conoce este camino.", name: "Cazar", tag: "CAZA DEL ASESINO", attr: "sombra", target: true, diff: 5, risk: true, pushable: false, hostile: true, assassinOnly: true, desc: "Solo el Asesino puede usar esta acción. Ataca en secreto a un superviviente, que se defiende con su Cuerpo, Mente y objetos. Si vences, le causa 4-6 de daño (6-8 en partidas muy cortas)." },
    { id: "apunalar", lore: "El filo termina enseñando a su dueño.", needs: "daga", consume: false, name: "Apuñalar", tag: "AGRESIÓN", attr: "cuerpo", target: true, diff: 5, risk: true, hostile: true, desc: "Un golpe directo: 2-4 de daño (4-5 si es crítico, y además sangrado). Si fallas, la oscuridad te ensucia." },
    { id: "envenenar", lore: "Los frascos guardan pacientes.", needs: "frasco", name: "Envenenar", tag: "VENENO", attr: "sombra", target: true, diff: 4, risk: true, hostile: true, desc: "Un veneno lento: la víctima se mancha de oscuridad al inicio de cada una de las dos rondas siguientes." },
    { id: "maldecir", lore: "Un pergamino bien leído no se olvida.", needs: "pergamino", name: "Maldecir", tag: "MALDICIÓN", attr: "sombra", target: true, diff: 5, risk: true, hostile: true, desc: "Una maldición: -1 a todas las tiradas de la víctima durante dos rondas. Si fallas, la oscuridad te marca." },
    { id: "aturdir", lore: "La fuerza bruta también tiene sus maneras.", needs: "porra", name: "Aturdir", tag: "GOLPE SECO", attr: "cuerpo", target: true, diff: 6, risk: true, hostile: true, desc: "Dejas a la víctima aturdida: pierde su turno de esta ronda si aún no ha actuado, o el de la siguiente." },
    { id: "devorar", lore: "Hay hambres que no se confiesan.", name: "Devorar", tag: "CANIBALISMO", attr: "cuerpo", target: true, diff: 5, risk: true, hostile: true, canTarget: function (t) { return t.hp <= Math.ceil((7 + t.stats.cuerpo) * 0.4) || ((t.status || []).some(function (s) { return s.id === "aturdido"; }) && t.hp < 7 + t.stats.cuerpo); }, desc: "Solo contra quien tenga 40% de vitalidad o menos, o esté aturdido y herido. Si tienes éxito, eliminas a la víctima, heredas sus objetos, recuperas 3 de vitalidad, la oscuridad te marca, -6 virtud y +1 a un atributo al azar (máximo 6), y te conviertes en Asesino. Si fallas, sufres 3 de daño y te manchas de oscuridad. Si la víctima también es un Asesino, su carne te repugna y no pasa nada más que perder 2 de virtud." },
    { id: "descansar", lore: "Quien sana aprende a esperar.", name: "Descansar", tag: "RECUPERACIÓN", target: false, diff: 0, risk: false, desc: "Reposas y vendas lo peor: +3 de vitalidad y se van el sangrado, el veneno y la infección. El alivio te mancha un poco de oscuridad. Cura al momento, pero no te protege de los golpes que recibas después esa misma ronda." },
    { id: "conjurar", lore: "Cada conjuro bien lanzado se asienta un poco más en tu memoria.", name: "Conjurar", tag: "MAGIA", attr: null, target: false, diff: 0, risk: false, desc: "Lanzas uno de tus conjuros. Cada uno tiene su propio efecto, su riesgo y un número limitado de usos. Los verás todos antes de elegir." },
    { id: "tender", lore: "Una mano abierta puede ser refugio o cebo; solo quien la tiende lo sabe.", name: "Tender la mano", tag: "PROMESA", attr: null, target: true, diff: 0, risk: false, mode: true, desc: "Ofreces ayuda en secreto a otro jugador. Si confía en ti y calla, se abrirá una ventana a su favor. Solo tú sabes cómo es tu mano." },
    { id: "socorrer", lore: "Quien se arrodilla junto al caído descubre de qué está hecha su propia piedad.", name: "Socorrer", tag: "AUXILIO", attr: "mente", target: true, diff: 4, risk: true, pushable: false, canTarget: function (t) { return !!t.dying; }, desc: "Solo sobre un moribundo. Si sale bien, se estabiliza con 2 de vitalidad y tú ganas +5 virtud. Si fallas, quizá sea tarde." },
    { id: "entrenar", lore: "El esfuerzo repetido deja huella en el cuerpo.", name: "Entrenar", tag: "FORTALECIMIENTO", target: false, diff: 0, risk: false, desc: "Te fortaleces durante dos rondas: +1 a todas tus tiradas." }
  ];

  /* Envites de la acción Apostar: dificultad, premio y castigo. */
  const STAKES = [
    { id: 5, name: "Prudente", diff: 5, items: 1, clues: 0, virtue: 3, wound: 0, failCorr: 4, desc: "Poco riesgo, poca gloria." },
    { id: 10, name: "Audaz", diff: 6, items: 1, clues: 1, virtue: 5, wound: 0, failCorr: 7, desc: "Un objeto y una pista." },
    { id: 20, name: "Temeraria", diff: 7, items: 2, clues: 2, virtue: 8, wound: 1, failCorr: 11, desc: "Dos objetos, dos pistas… o un buen golpe." }
  ];

  const EVENTS = [
    [
      { text: "Un cuervo deja una llave negra en el equipaje de alguien. Una voz susurra: «Abre la cripta y conocerás un secreto».", effect: "item", itemId: "llave", effectText: "Alguien ha encontrado una llave negra." },
      { text: "La fuente del pueblo cura las heridas, pero exige un recuerdo a cambio.", effect: "heal", effectText: "Quien estuviera herido recupera 3 de vitalidad." },
      { text: "Huellas frescas terminan ante una pared de piedra. Alguien estuvo aquí antes que vosotros.", effect: "clue", effectText: "Alguien ha encontrado un rastro." }
    ],
    [
      { text: "Una figura encapuchada ofrece poder a cambio de una promesa que aún no debéis pronunciar.", effect: "corruption", effectText: "La oscuridad ha rozado a todos." },
      { text: "Un mercader vende un mapa con una habitación que no existe en el castillo.", effect: "item", itemId: "mapa", effectText: "Alguien ha comprado un mapa imposible." },
      { text: "Un espíritu pide que protejáis a alguien a quien todavía no conocéis.", effect: "virtue", effectText: "Una promesa antigua os reconforta (+3 virtud)." }
    ],
    [
      { text: "La campana suena trece veces. Durante un instante, la sombra de alguien se mueve por sí sola.", effect: "corruption", effectText: "Las sombras se han movido solas." },
      { text: "Una reliquia late como un corazón. Podrías estudiarla o quedártela.", effect: "item", itemId: "reliquia", effectText: "Alguien ha encontrado una reliquia." },
      { text: "Un niño asegura que uno de vosotros habla mientras duerme con una voz distinta.", effect: "clue", effectText: "Alguien ha oído a un testigo." }
    ],
    [
      { text: "La niebla revela un sendero hacia el santuario hundido. Algo os espera allí.", effect: "corruption", effectText: "El santuario os ha visto." },
      { text: "Una presencia ofrece borrar una falta, si aceptáis cargar con otra.", effect: "corruption", effectText: "La presencia cobra su precio a todos." },
      { text: "El pueblo ha cerrado sus puertas. Alguien ha sido señalado como culpable.", effect: "clue", effectText: "Alguien ha recibido un soplo anónimo." }
    ]
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

  const SECRETS = [
    { id: "redentor", text: "Deseas terminar con la conciencia limpia.", check: (p) => p.corr <= 20 },
    { id: "poder", text: "Deseas ser quien más se acerque a la oscuridad.", check: (p, s) => p.corr === Math.max(...s.players.map((x) => x.corr)) },
    { id: "justiciero", text: "Deseas desenmascarar a un culpable.", check: (p) => (p.successfulAccusations || 0) > 0 },
    { id: "superviviente", text: "Deseas salir sin una sola herida.", check: (p) => p.wounds === 0 },
    { id: "sombra", text: "Deseas que alguien pague por tu traición.", check: (p) => (p.betrayals || 0) > 0 },
    { id: "lazo", text: "Deseas que tus pactos sobrevivan a la noche.", check: (p) => (p.keptPacts || 0) >= 2 }
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

  const D = { STATUS, ROLES, AFFINITIES, ITEMS, LOOT_ITEMS, DARK_ITEMS, ACTIONS, STAKES, EVENTS, CLUES, ASSASSIN_CLUES, SECRETS };
  g.UMBRAL_DATA = D;
  if (typeof module !== "undefined") module.exports = D;
})(typeof globalThis !== "undefined" ? globalThis : this);
