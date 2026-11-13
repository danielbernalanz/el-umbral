/* EL UMBRAL — motor de juego (v0.9.3)
   Sin DOM. Toda la lógica vive aquí para poder probarla con Node. */
(function (g) {
  "use strict";

  const D = g.UMBRAL_DATA || (typeof require !== "undefined" ? require("./data.js") : null);
  const SAVE_KEY = "umbral.v5.save";
  const LEGACY_SAVE_KEY = "umbral.v4.save";
  const VERSION = 5;
  const MAX_ROUNDS = 7;
  const COUNCIL_SECONDS = 90;
  const MAX_STAT = 6;
  const HUNT_EDGE = Number((typeof process !== "undefined" && process.env && process.env.HUNT_EDGE) || 3);
  const DEFAULT_MINUTES = 20, MIN_MINUTES = 5, MAX_MINUTES = 120, ROUNDS_CAP = 14;
  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = Math.min(6, D.ROLES.length, D.AFFINITIES.length, D.SECRETS.length);
  /* Acciones que cuentan como hostiles para pactos y amenazas. */
  const HOSTILE = ["conjuro_of", "robar", "hechizar", "cazar", "apunalar", "envenenar", "maldecir", "aturdir", "devorar"];

  const LS = (typeof localStorage !== "undefined") ? localStorage : {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  };

  let state = null;

  /* ---------- utilidades ---------- */
  function rnd(n) { return Math.floor(Math.random() * n); }
  function pick(a) { return a[rnd(a.length)]; }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function d6() { return 1 + rnd(6); }
  function shuffle(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); const t = b[i]; b[i] = b[j]; b[j] = t; }
    return b;
  }
  function err(msg) { return { ok: false, msg: msg }; }
  /* ---------- salud: vitalidad (hp), zonas del cuerpo, moribundo ---------- */
  const ZONES = ["cabeza", "torso", "brazos", "piernas"];
  const ZONE_LABEL = { cabeza: "Cabeza", torso: "Torso", brazos: "Brazos", piernas: "Piernas" };
  const ZONE_IN = { cabeza: "en la cabeza", torso: "en el torso", brazos: "en los brazos", piernas: "en las piernas" };
  const ZONE_W = {
    gen: [0.15, 0.40, 0.25, 0.20], cazar: [0.25, 0.50, 0.10, 0.15], magia: [0.30, 0.50, 0.10, 0.10],
    apunalar: [0.10, 0.40, 0.35, 0.15], interno: [0, 1, 0, 0]
  };
  function rr(a, b) { return a + rnd(b - a + 1); }
  function maxHp(p) { return 7 + ((p && p.stats && p.stats.cuerpo) || 0); }
  function pickZone(src) {
    const w = ZONE_W[src] || ZONE_W.gen;
    let x = Math.random();
    for (let i = 0; i < ZONES.length; i++) { x -= w[i]; if (x < 0) return ZONES[i]; }
    return "torso";
  }
  function zoneLvl(p, z) {
    const n = (p && p.zones && p.zones[z]) || 0;
    return n >= 4 ? 2 : n >= 2 ? 1 : 0;
  }
  function legPen(p) { return zoneLvl(p, "piernas") >= 2 ? 1 : 0; }
  function armPen(p) { return zoneLvl(p, "brazos") >= 2 ? 1 : 0; }
  function zoneMod(p, attr) {
    if (attr === "cuerpo") return -armPen(p);
    if (attr === "mente") return zoneLvl(p, "cabeza") >= 2 ? -1 : 0;
    return 0;
  }
  function woundsOf(p) {
    if (p.dead || p.dying) return 3;
    const m = maxHp(p);
    if (p.hp >= m) return 0;
    return p.hp / m >= 0.6 ? 1 : 2;
  }
  /* Deja al jugador con salud coherente (también partidas guardadas con el sistema antiguo de heridas). */
  function initHealth(p) {
    const d = Object.getOwnPropertyDescriptor(p, "wounds");
    const oldW = d && "value" in d ? (Number(d.value) || 0) : 0;
    const max = maxHp(p);
    if (oldW >= 3) p.dead = true;
    if (typeof p.hp !== "number" || isNaN(p.hp)) p.hp = p.dead ? 0 : Math.max(1, max - 3 * oldW);
    p.hp = clamp(Math.round(p.hp), 0, max);
    if (p.dead) { p.hp = 0; p.dying = false; }
    if (!p.zones || typeof p.zones !== "object") p.zones = {};
    ZONES.forEach(function (z) { const n = Number(p.zones[z]); p.zones[z] = isNaN(n) || n < 0 ? 0 : Math.round(n); });
    p.dying = !!p.dying;
    if (p.dying && p.hp !== 0) p.hp = 0;
    Object.defineProperty(p, "wounds", { get: function () { return woundsOf(this); }, set: function () {}, configurable: true, enumerable: false });
  }
  function killed(p, cause) {
    if (state) state.chronicle.push({ round: state.round, text: "✖ " + p.name + " ha caído (" + cause + ")." });
  }
  /* Muerte definitiva. quiet: sin línea de crónica propia (la pone quien llama). */
  function finish(p, cause, quiet) {
    if (!p || p.dead) return;
    p.dead = true; p.dying = false; p.hp = 0; p.status = []; p.cause = cause || "heridas";
    if (!quiet) killed(p, p.cause);
  }
  function stabilize(p) {
    if (!p || p.dead || !p.dying) return false;
    p.dying = false; p.dyingRound = null;
    p.hp = Math.max(p.hp, 2);
    p.healRound = state ? state.round : 0;
    p.hurtRound = state ? state.round : 0;
    return true;
  }
  /* Nuevo sangrado con nota privada (solo si de verdad se aplica). */
  function bleed(p, dur) {
    if (!p || p.dead || p.dying) return false;
    const had = hasStatus(p, "sangrado");
    giveStatus(p, "sangrado", dur);
    if (!had && hasStatus(p, "sangrado")) { p.notes.push("Ronda " + (state ? state.round : "?") + ": la herida sangra y seguirá sangrando unas rondas."); return true; }
    return false;
  }
  /* Daño en puntos de vitalidad. Devuelve {dealt, zone, dying, died}. opts: src, zone, noZone, noBleed. */
  function damage(p, amount, opts) {
    const out = { dealt: 0, zone: null, dying: false, died: false };
    opts = opts || {};
    amount = Math.round(amount);
    if (!p || p.dead || !(amount > 0)) return out;
    const r = state ? state.round : 0;
    p.wasHurt = true; p.hurtRound = r;
    if (p.dying) { finish(p, "heridas"); out.died = true; out.dealt = amount; return out; }
    const zone = opts.noZone ? null : (opts.zone || pickZone(opts.src));
    const dealt = Math.min(amount, p.hp);
    p.hp -= dealt; out.dealt = dealt; out.zone = zone;
    if (zone) p.zones[zone] = (p.zones[zone] || 0) + dealt;
    if (p.hp <= 0) {
      p.hp = 0; p.dying = true; p.dyingRound = r; p.status = []; p.acted = true; out.dying = true;
      if (state) state.chronicle.push({ round: r, text: "✖ " + p.name + " se desploma, moribundo." });
      p.notes.push("Ronda " + r + ": te desplomas, moribundo. Si nadie te socorre antes de que acabe la próxima ronda, morirás; cualquier golpe más te mataría.");
    } else if (!opts.noBleed && amount >= 3 && zone) {
      if (Math.random() < (zone === "torso" ? 0.45 : 0.25)) bleed(p, 2);
    }
    return out;
  }
  function addWounds(p, n) { return damage(p, 3 * n, { src: "gen" }); }
  /* Texto privado del golpe recibido: «en el torso (−5 de vitalidad)». */
  function hitNote(res) {
    if (!res) return "";
    if (res.died) return ": ya estabas moribundo y no lo resististe";
    return (res.zone ? " " + ZONE_IN[res.zone] : "") + " (−" + res.dealt + " de vitalidad)" + (res.dying ? " y caes moribundo" : "");
  }
  function heal(p, amount) {
    if (!p || p.dead || p.dying || !(amount > 0)) return 0;
    const max = maxHp(p), before = p.hp;
    p.hp = Math.min(max, p.hp + Math.round(amount));
    const healed = p.hp - before;
    let left = Math.round(amount);
    ZONES.slice().sort(function (a, b) { return (p.zones[b] || 0) - (p.zones[a] || 0); }).forEach(function (z) {
      const t = Math.min(left, p.zones[z] || 0); p.zones[z] -= t; left -= t;
    });
    if (healed > 0) p.healRound = state ? state.round : 0;
    return healed;
  }
  const ZONE_DESC = {
    cabeza: ["Sin daño.", "Un golpe en la cabeza: te zumban los oídos.", "Conmoción grave: −1 a tus tiradas de mente."],
    torso: ["Sin daño.", "Costillas doloridas.", "Daño grave en el torso: si sangras, pierdes +1 por ronda."],
    brazos: ["Sin daño.", "Brazos magullados.", "Un brazo casi inútil: −1 a tus tiradas de cuerpo y a tu ataque."],
    piernas: ["Sin daño.", "Cojeas un poco.", "Piernas muy dañadas: −1 a tu defensa."]
  };
  function visibleHealth(p) {
    if (!p) return "";
    if (p.dead) return "Eliminado";
    if (p.dying) return "Moribundo";
    const max = maxHp(p), pct = p.hp / max;
    const marks = [];
    if ((p.zones.piernas || 0) >= 2) marks.push("cojea");
    if ((p.zones.brazos || 0) >= 2) marks.push("protege un brazo");
    if ((p.zones.cabeza || 0) >= 2) marks.push("se tambalea");
    if (hasStatus(p, "sangrado")) marks.push("sangra");
    if (hasStatus(p, "infeccion")) marks.push("febril");
    if (p.hp >= max && !marks.length) return "Sin heridas visibles";
    const base = pct >= 0.8 ? "Magullado" : pct >= 0.55 ? "Herido" : pct >= 0.3 ? "Malherido" : "Al borde de caer";
    return [base].concat(marks).join(" · ");
  }
  function shockOf(p) { return !!(p && !p.dead && !p.dying && p.hp <= 0.35 * maxHp(p)); }
  function healthInfo(p) {
    const max = maxHp(p), pct = Math.round(100 * p.hp / max);
    let level = pct >= 100 ? "ileso" : pct >= 80 ? "magullado" : pct >= 55 ? "herido" : pct >= 30 ? "malherido" : "critico";
    if (p.dying) level = "moribundo";
    if (p.dead) level = "muerto";
    return {
      hp: p.hp, max: max, pct: pct, level: level,
      zones: ZONES.map(function (z) { const l = zoneLvl(p, z); return { id: z, name: ZONE_LABEL[z], dmg: p.zones[z] || 0, lvl: l, desc: ZONE_DESC[z][l] }; }),
      status: (p.status || []).map(function (s) { return s.id; }),
      shock: shockOf(p), dying: !!p.dying
    };
  }
  function checkTerminal() {
    if (!state) return false;
    let alive = state.players.filter(function (p) { return !p.dead; });
    const ass = assassinsOf();
    if (ass.length && ass.every(function (p) { return p.dead; })) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }
    if (ass.length && alive.every(isAssassin)) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }
    if (!ass.length && alive.length === 1) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }
    if (alive.length && alive.every(function (p) { return p.dying; })) {
      /* Nadie en pie que pueda socorrer: todos se apagan. */
      alive.forEach(function (p) { p.notes.push("Ronda " + state.round + ": no queda nadie que pueda socorrerte."); finish(p, "heridas"); });
      alive = [];
    }
    if (!alive.length) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }
    return false;
  }
  function hasPassive(p, id) {
    return (p.role && p.role.passive && p.role.passive.id === id) ||
      (p.affinity && p.affinity.passive && p.affinity.passive.id === id);
  }
  /* Asesino = alineación. Puede haber más de uno (p. ej. quien devora a otro jugador). */
  function isAssassin(p) { return !!p && p.alignment === "asesino"; }
  function assassinsOf() { return state.players.filter(isAssassin); }
  /* ---------- duración de la partida ---------- */
  /* Minutos estimados por ronda: ~2,5 con 3 jugadores. Se corrige con el ritmo real. */
  function perRoundMin(n) { return 1 + 0.5 * n; }
  function maxRounds() { return (state && state.maxRounds) || MAX_ROUNDS; }
  /* A partir de esta ronda empieza la "fase tardía" (antes: la ronda 3 de 7). */
  function lateRound() { return Math.max(2, Math.round(maxRounds() * 3 / 7)); }
  function playedMs() { return state ? (state.playedMs !== undefined ? state.playedMs : Date.now() - state.createdAt) : 0; }
  function timeLeftMs() { return state && state.durationMin ? state.durationMin * 60000 - playedMs() : Infinity; }
  /* Solo cuenta el tiempo de juego activo, no el de la partida guardada. */
  function tick(ms) {
    if (!state || state.phase === "ending") return;
    if (state.playedMs === undefined) state.playedMs = Date.now() - state.createdAt;
    state.playedMs += clamp(ms, 0, 5000);
  }
  /* Encuentros con figuras de las ruinas al explorar: eliges cómo tratarlas y el resultado depende de tus habilidades. */
  function woundOrCorr(p) { if (p.hp > 4 && !p.dead && !p.dying) { const res = damage(p, rr(2, 3), { src: "gen" }); return " Sales herido" + hitNote(res) + "."; } p.corr = clamp(p.corr + 4, 0, 100); return " La oscuridad se te pega (+corrupción)."; }
  function npcClue(p, lv) { const o = others(p); if (!o.length) return ""; const t = pick(o); const cl = makeClue(t, lv); if (cl) { p.clues.push(cl); return " Aprendes algo sobre " + t.name + "."; } return ""; }
  function npcItem(p, dark) { const it = dark ? pick(D.DARK_ITEMS) : pick(D.LOOT_ITEMS); p.items.push(mkItem(it)); return " Consigues " + itemName(it) + "."; }
  function mv(p, v, c) { p.virtue = clamp(p.virtue + v, 0, 100); p.corr = clamp(p.corr + (c || 0), 0, 100); }
  const NPCS = {
    peregrina: { name: "Peregrina ciega", intro: "Una peregrina ciega canta entre los arcos. Parece saber más de lo que dice.", opts: [
      { id: "escuchar", label: "Escuchar su canción", attr: "mente", diff: 4, win: function (p) { return "Entiendes la letra: no era una canción, era un aviso." + npcClue(p, 2); }, lose: function (p) { mv(p, 0, 2); return "El canto te marea y no sacas nada en claro."; } },
      { id: "guiar", label: "Guiarla por las ruinas", attr: "cuerpo", diff: 4, win: function (p) { mv(p, 4); return "La acompañas sin incidentes. Agradecida, te susurra algo." + npcClue(p, 1); }, lose: function (p) { mv(p, -2); return "Tropiezas y la pierdes entre los escombros."; } },
      { id: "atacar", label: "Atacarla", attr: "cuerpo", diff: 4, win: function (p) { mv(p, -8, 8); return "Cae sin un sonido. Entre sus cosas hay algo que no debería tener." + npcItem(p, true); }, lose: function (p) { mv(p, -3, 3); return "Su bastón es más duro de lo que parecía." + woundOrCorr(p); } } ] },
    mercader: { name: "Mercader encorvado", intro: "Un mercader encorvado abre su capa: «Todo tiene precio».", opts: [
      { id: "regatear", label: "Regatear", attr: "mente", diff: 5, win: function (p) { return "Le sacas el mejor trato." + npcItem(p, false); }, lose: function (p) { mv(p, -3); return "Se ríe de ti y te cobra por la molestia."; } },
      { id: "comprar", label: "Comprar sin discutir", attr: null, diff: 0, win: function (p) { mv(p, -3); return "Pagas con parte de tu tranquilidad." + npcItem(p, p.corr >= 30); }, lose: null },
      { id: "robar", label: "Robarle", attr: "sombra", diff: 5, win: function (p) { mv(p, -3, 4); return "Tus dedos son más rápidos que su mirada." + npcItem(p, false); }, lose: function (p) { mv(p, -2); return "Te agarra la muñeca y te lanza una maldición." + woundOrCorr(p); } },
      { id: "matar", label: "Matarlo para quedarte con su género", attr: "cuerpo", diff: 5, win: function (p) { mv(p, -8, 7); return "Lo sorprendes por la espalda." + npcItem(p, true) + npcItem(p, false); }, lose: function (p) { mv(p, -3); return "Se defiende con una navaja." + woundOrCorr(p); } } ] },
    ermitano: { name: "Ermitaño", intro: "Un ermitaño remueve unas brasas y te mira sin sorpresa.", opts: [
      { id: "curar", label: "Pedirle ayuda", attr: "mente", diff: 3, win: function (p) { if (p.hp < maxHp(p)) { const h = heal(p, 4); return "Vendó tus heridas en silencio (+" + h + " de vitalidad)."; } mv(p, 0, -8); return "Comparte su fuego y la oscuridad pesa menos."; }, lose: function () { return "No te escucha. Te deja a solas con el humo."; } },
      { id: "ayudar", label: "Ayudarle con la leña", attr: "cuerpo", diff: 4, win: function (p) { mv(p, 5, -4); return "El trabajo duro te limpia la cabeza."; }, lose: function (p) { mv(p, 1); return "Te agotas pronto, pero él lo agradece."; } },
      { id: "amenazar", label: "Amenazarle", attr: "sombra", diff: 4, win: function (p) { mv(p, -3, 6); return "Se encoge de miedo y te da su talismán." + npcItem(p, false); }, lose: function (p) { mv(p, 0, 5); return "Murmura unas palabras y algo frío te recorre la espalda."; } },
      { id: "atacar", label: "Atacarlo", attr: "cuerpo", diff: 3, win: function (p) { mv(p, -8, 6); return "Lo derribas sin esfuerzo y te llevas lo que tenía." + npcItem(p, false); }, lose: function (p) { mv(p, -3, 4); return "Es viejo, pero conoce trucos sucios y su maldición te alcanza." + woundOrCorr(p); } } ] },
    nino: { name: "Niño de ojos huecos", intro: "Un niño de ojos huecos te mira desde un arco roto y te hace señas.", opts: [
      { id: "seguir", label: "Seguirlo en silencio", attr: "sombra", diff: 4, win: function (p) { return "Te lleva a una sala donde alguien ha dejado rastros." + npcClue(p, 2); }, lose: function (p) { mv(p, 0, 4); return "Se ríe y desaparece. Algo de él se te queda pegado."; } },
      { id: "hablar", label: "Hablarle con calma", attr: "mente", diff: 4, win: function (p) { mv(p, 0, -3); return "Te cuenta lo que vio desde lo alto." + npcClue(p, 1); }, lose: function (p) { mv(p, 0, 2); return "No contesta. Solo te mira."; } },
      { id: "atrapar", label: "Atraparlo", attr: "cuerpo", diff: 4, win: function (p) { mv(p, -3, 4); return "Lo sujetas hasta que suelta lo que sabe." + npcClue(p, 1); }, lose: function (p) { mv(p, -2); return "Se te escurre entre las manos y te araña." + woundOrCorr(p); } } ] },
    cultista: { name: "Encapuchado", intro: "Un encapuchado te corta el paso y te tiende algo envuelto en trapos: «De parte de quien escucha».", opts: [
      { id: "aceptar", label: "Aceptar el regalo", attr: null, diff: 0, win: function (p) { mv(p, 0, p.corr >= 30 ? 4 : 7); return "El Umbral lo nota." + npcItem(p, true); }, lose: null },
      { id: "enfrentar", label: "Enfrentarlo", attr: "cuerpo", diff: 5, win: function (p) { mv(p, 4); return "Lo derribas y huye dejando su zurrón." + npcItem(p, false); }, lose: function (p) { mv(p, -2); return "Te supera." + woundOrCorr(p); } },
      { id: "fingir", label: "Fingir que eres de los suyos", attr: "mente", diff: 5, win: function (p) { mv(p, 0, 2); return "Te cree y habla de más." + npcClue(p, 2); }, lose: function (p) { mv(p, 0, 6); return "Huele tu mentira y te marca como suyo."; } },
      { id: "atacar", label: "Atacarlo antes de que invoque nada", attr: "cuerpo", diff: 5, win: function (p) { mv(p, -3, 3); return "Lo golpeas y suelta lo que llevaba." + npcItem(p, true); }, lose: function (p) { mv(p, -3); return "Sus compañeros invisibles te cercan." + woundOrCorr(p); } } ] },
    cazador: { name: "Cazador herido", intro: "Un cazador herido se apoya contra un muro y te pide ayuda con la mirada.", opts: [
      { id: "curar", label: "Curar sus heridas", attr: "mente", diff: 4, win: function (p) { mv(p, 5); return "Te lo agradece con parte de su equipo." + npcItem(p, false); }, lose: function (p) { mv(p, 2); return "Haces lo que puedes. Se marcha cojeando."; } },
      { id: "cargar", label: "Cargarlo hasta un refugio", attr: "cuerpo", diff: 5, win: function (p) { mv(p, 6, -3); return "Lo dejas a salvo. Nadie olvida un gesto así."; }, lose: function (p) { mv(p, 1); return "No llegas muy lejos, pero lo intentas."; } },
      { id: "atacar", label: "Atacarlo y quedarte con su equipo", attr: "cuerpo", diff: 6, win: function (p) { mv(p, -8, 7); return "Aprovechas que está herido y lo despojas." + npcItem(p, false) + npcItem(p, true); }, lose: function (p) { mv(p, -4); return "Aún sabe pelear." + woundOrCorr(p); } } ] },
    sombra: { name: "Figura sin rostro", intro: "Una figura sin rostro se desprende de la pared y avanza hacia ti.", opts: [
      { id: "cara", label: "Plantarle cara", attr: "cuerpo", diff: 5, win: function (p) { mv(p, 4, -3); return "Se disuelve ante tu determinación."; }, lose: function (p) { return "Te atraviesa como un frío." + woundOrCorr(p); } },
      { id: "rendirse", label: "Dejar que te hable", attr: "sombra", diff: 4, win: function (p) { mv(p, 0, 4); return "Susurra lo que la noche ha visto." + npcClue(p, 2); }, lose: function (p) { mv(p, 0, 6); return "Su voz se queda en tu cabeza mucho tiempo."; } },
      { id: "esquivar", label: "Esquivarla", attr: "cuerpo", diff: 3, win: function () { return "Rodeas el muro y la pierdes de vista."; }, lose: function (p) { return "Te alcanza." + woundOrCorr(p); } },
      { id: "atacar", label: "Atacarla", attr: "cuerpo", diff: 5, win: function (p) { mv(p, -2, 3); return "Tu golpe la rasga en jirones de humo y deja un fragmento." + npcItem(p, true); }, lose: function (p) { mv(p, -2); return "Tu golpe solo corta aire." + woundOrCorr(p); } } ] },
    cartografo: { name: "Cartógrafo", intro: "Un cartógrafo dibuja las ruinas a la luz de una vela. Su mapa muestra más de lo que debería.", opts: [
      { id: "estudiar", label: "Estudiar su mapa", attr: "mente", diff: 4, win: function (p) { mv(p, 2); return "Entiendes sus marcas." + npcClue(p, 2); }, lose: function (p) { return "Solo ves garabatos." + npcClue(p, 1); } },
      { id: "copiar", label: "Copiar el mapa a escondidas", attr: "sombra", diff: 5, win: function (p) { mv(p, 0, 3); return "Te llevas el mapa sin que lo note." + npcClue(p, 2) + npcItem(p, false); }, lose: function (p) { mv(p, -3); return "Te sorprende y te echa de su campamento."; } },
      { id: "atacar", label: "Atacarlo y robarle todo", attr: "cuerpo", diff: 4, win: function (p) { mv(p, -6, 5); return "Te quedas con su mapa y su cuaderno." + npcClue(p, 2) + npcItem(p, false); }, lose: function (p) { mv(p, -3); return "Esquiva y te golpea con el trípode." + woundOrCorr(p); } } ] }
  };
  /* Quien explora atrae a figuras afines: los oscuros, a los turbios; los virtuosos, a los de buena fe. */
  function npcWeighted(p) {
    const w = { peregrina: 1, mercader: 1, ermitano: 1, nino: 1, cultista: 1, cazador: 1, sombra: 1, cartografo: 1 };
    if (p.corr >= 30) { w.cultista = 3; w.sombra = 3; w.mercader = 2; w.nino = 2; }
    else if (p.virtue >= 60 && p.corr < 20) { w.peregrina = 3; w.ermitano = 3; w.cazador = 3; w.cartografo = 2; }
    let tot = 0; Object.keys(w).forEach(function (k) { tot += w[k]; });
    let x = Math.random() * tot;
    const ks = Object.keys(w);
    for (let i = 0; i < ks.length; i++) { x -= w[ks[i]]; if (x < 0) return ks[i]; }
    return ks[0];
  }
  function encounterStart(pid) {
    const p = state && state.players[pid];
    if (!p || p.dead || p.action !== "explorar" || state.phase !== "private") return null;
    if (!p.enc) { if (p.encRound === state.round) return null; p.encRound = state.round; if (Math.random() >= (p.exploreOk ? 0.35 : 0.2)) return null; p.enc = { npc: npcWeighted(p), round: state.round }; save(); }
    const n = NPCS[p.enc.npc];
    return { npc: p.enc.npc, name: n.name, intro: n.intro, options: n.opts.map(function (o) { return { id: o.id, label: o.label, attr: o.attr, diff: o.diff }; }).concat([{ id: "irse", label: "Seguir tu camino", attr: null, diff: 0 }]) };
  }
  function encounterAct(pid, optId) {
    const p = state && state.players[pid];
    if (!p || !p.enc) return err("No hay nadie delante de ti.");
    const n = NPCS[p.enc.npc];
    if (optId === "irse") { p.enc = null; save(); return { ok: true, die: 0, success: true, outcome: "Sigues tu camino sin mirar atrás." }; }
    const o = n.opts.find(function (x) { return x.id === optId; });
    if (!o) return err("Opción no válida.");
    p.enc = null;
    if (["atacar", "matar", "atrapar", "robar", "amenazar"].indexOf(optId) !== -1) { p.did = p.did || {}; p.did.violencia = (p.did.violencia || 0) + 1; if (Math.random() < 0.5) state.chronicle.push({ round: state.round, text: "Un grito se oyó entre las ruinas antes de apagarse." }); }
    let r = { die: 0, stat: 0, focus: 0, total: 0, diff: 0, crit: false, fumble: false, success: true };
    const why = [];
    if (o.attr) {
      r = rollCheck(p, o.attr, o.diff);
      why.push("tu " + o.attr + " (" + p.stats[o.attr] + ")");
    }
    const txt = r.success ? o.win(p) : (o.lose ? o.lose(p) : o.win(p));
    p.notes.push("Ronda " + state.round + ": " + n.name + ". " + txt);
    save();
    r.ok = true; r.why = why; r.outcome = txt; r.action = n.name;
    return r;
  }
  /* La caza se ajusta a la duración: en partidas breves golpea más; en las largas, menos. */
  function huntEdge() { const m = maxRounds(); return HUNT_EDGE + (m <= 3 ? 4 : m <= 4 ? 3 : m <= 6 ? 2 : m <= 8 ? 1 : m >= 14 ? -2 : m >= 10 ? -1 : 0); }
  function huntDamage() { return maxRounds() <= 4 ? rr(10, 12) : rr(5, 7); }
  /* Corte duro: al agotarse el tiempo la partida termina, pase lo que pase. */
  function timeUp() { return !!(state && state.phase !== "ending" && state.durationMin && timeLeftMs() <= 0); }
  function forceEnd() {
    if (!state) return null;
    if (state.phase === "ending" && state.ending) return state.ending;
    state.phase = "ending"; state.handoff = false; state.pendingPush = null;
    state.ending = computeEnding(); state.ending.timedOut = true;
    clearSave();
    return state.ending;
  }
  function roundsLeftInclCurrent() { return Math.max(1, maxRounds() - state.round + 1); }
  /* Reparte el tiempo que queda entre las rondas que caben, según el ritmo medido. */
  function planRounds(fresh) {
    if (!state || !state.durationMin) return;
    const est = perRoundMin(state.players.length);
    if (fresh) { state.maxRounds = clamp(Math.round(state.durationMin * 0.9 / est), 3, ROUNDS_CAP); return; }
    const done = state.round;
    const measured = playedMs() / 60000 / Math.max(1, done);
    const per = (est + measured * done) / (1 + done);
    const left = Math.floor(Math.max(0, timeLeftMs() * 0.97) / 60000 / per);
    state.maxRounds = clamp(done + left, done, Math.max(done, ROUNDS_CAP));
  }
  function behindSchedule() {
    if (!state || !state.durationMin) return false;
    return Math.max(0, timeLeftMs()) / 60000 / roundsLeftInclCurrent() < perRoundMin(state.players.length) * 0.75;
  }
  function councilSeconds() {
    if (!state || !state.durationMin) return COUNCIL_SECONDS;
    const budget = Math.max(0, timeLeftMs()) / 60000 / roundsLeftInclCurrent();
    return clamp(Math.round(budget * 60 * 0.4), 40, 180);
  }
  /* ---------- Aprendizaje: acciones y atributos se desbloquean con la práctica ---------- */
  /* Cuanto menos tiempo (rondas) queda, más fácil es aprender. */
  function ease() { return state ? clamp(roundsLeftInclCurrent() / 7, 0.3, 1) : 1; }
  function need(n) { return Math.max(1, Math.round(n * ease())); }
  function didN(p, id) { return (p.did && p.did[id]) || 0; }
  function hasItemId(p, id) { return p.items.some(function (i) { return i.id === id; }); }
  const UNLOCK_HINT = {
    descansar: "Tu cuerpo recuerda el dolor y empieza a pedir una tregua.", entrenar: "Tus músculos piden más de lo que les das.",
    apostar: "Notas un cosquilleo: la suerte parece mirarte de reojo.", tender: "Empiezas a entender que una mano abierta puede ser refugio… o cebo.",
    resistir: "Algo en ti aprende a decir que no.", robar: "Tus dedos empiezan a pensar por su cuenta.",
    hechizar: "Las palabras prohibidas cosquillean en tu lengua.", ceder: "Los susurros del Umbral suenan cada vez más razonables.",
    apunalar: "El peso del filo en tu mano te sugiere cosas.", envenenar: "El frasco parece susurrar cosas amables.",
    maldecir: "Las letras del pergamino se retuercen hacia ti.", aturdir: "La porra pesa como una promesa.",
    devorar: "Un hambre antigua se despierta bajo tus costillas.", cazar: "La noche te reconoce como uno de los suyos.",
    conjurar: "Las páginas aprendidas brillan en la oscuridad, esperando tu voz.",
    socorrer: "Alguien se desangra en el suelo: puedes intentar socorrerlo."
  };
  const ATTR_HINT = { cuerpo: "Tus pasos son más firmes de lo que recordabas.", mente: "Las ideas encajan con menos esfuerzo.", sombra: "La oscuridad te resulta más familiar." };
  const BASE_ACTIONS = ["investigar", "explorar", "proteger", "meditar"];
  const UNLOCK = {
    descansar: function (p) { return !!p.wasHurt; },
    entrenar: function (p, late) { return late || didN(p, "explorar") + didN(p, "investigar") >= need(2); },
    apostar: function (p, late) { return late || didN(p, "explorar") >= need(1); },
    tender: function (p, late) { return late || didN(p, "proteger") >= need(1) || (p.pactsSealed || 0) >= 1 || p.keptPacts >= 1; },
    resistir: function (p, late) { return late || (p.refused || 0) >= 1 || didN(p, "meditar") >= need(2); },
    robar: function (p, late) { return late || hasPassive(p, "stealDiscount") || p.corr >= Math.max(5, Math.round(12 * ease())) || didN(p, "explorar") >= need(2); },
    hechizar: function (p) { return hasPassive(p, "spellDiscount") || p.corr >= Math.max(5, Math.round(12 * ease())) || hasItemId(p, "reliquia") || hasItemId(p, "fragmento"); },
    ceder: function (p) { return p.corr >= Math.max(5, Math.round(12 * ease())) || (p.dealt || 0) >= 1; },
    apunalar: function (p) { return hasItemId(p, "daga"); },
    envenenar: function (p) { return hasItemId(p, "frasco"); },
    maldecir: function (p) { return hasItemId(p, "pergamino"); },
    aturdir: function (p) { return hasItemId(p, "porra"); },
    devorar: function (p) { return isAssassin(p) || p.corr >= 40; },
    cazar: function (p) { return isAssassin(p); },
    conjurar: function (p) { return !!(p.spells && p.spells.length); },
    socorrer: function (p) { return !!state && !p.dying && state.players.some(function (x) { return x.id !== p.id && x.dying && !x.dead; }); }
  };
  function isUnlocked(p, a) {
    if (BASE_ACTIONS.indexOf(a.id) !== -1) return true;
    const f = UNLOCK[a.id];
    return !!(f && f(p, roundsLeftInclCurrent() <= 2));
  }
  /* Devuelve lo recién aprendido (y lo marca como visto). */
  function unlockNotices(p, silent) {
    p.seen = p.seen || {};
    const out = (p.fresh || []).slice();
    p.fresh = [];
    D.ACTIONS.forEach(function (a) {
      if (p.seen[a.id] || BASE_ACTIONS.indexOf(a.id) !== -1) return;
      if (isUnlocked(p, a)) {
        p.seen[a.id] = true;
        if (!silent) { const hint = UNLOCK_HINT[a.id] || "Algo nuevo se abre ante ti."; out.push(hint); p.hints = p.hints || []; p.hints.push(hint); p.notes.push("Ronda " + state.round + ": " + hint); }
      }
    });
    return silent ? [] : out;
  }
  function xpInfo(p) {
    const out = {};
    ["cuerpo", "mente", "sombra"].forEach(function (k) {
      out[k] = { have: Math.min((p.xp && p.xp[k]) || 0, need(3)), need: need(3), grown: (p.grown && p.grown[k]) || 0, capped: ((p.grown && p.grown[k]) || 0) >= 2 || p.stats[k] >= MAX_STAT };
    });
    return out;
  }
  function addXp(p, attr, amt) {
    p.xp = p.xp || {}; p.grown = p.grown || {};
    if ((p.grown[attr] || 0) >= 2 || p.stats[attr] >= MAX_STAT) return;
    p.xp[attr] = (p.xp[attr] || 0) + amt;
    const nd = need(3);
    if (p.xp[attr] >= nd) {
      p.xp[attr] -= nd; p.grown[attr] = (p.grown[attr] || 0) + 1; p.stats[attr] += 1;
      const ah = ATTR_HINT[attr];
      p.notes.push("Ronda " + state.round + ": " + ah);
      p.fresh = p.fresh || []; p.fresh.push(ah); p.hints = p.hints || []; p.hints.push(ah);
    }
  }

  /* ---------- Magia procedural: formas + aspectos + ajuste ---------- */
  const SPELL_FORMS = {
    rayo: { name: "Rayo", kind: "off", attr: "sombra", diff: 5, target: true },
    plaga: { name: "Plaga", kind: "off", attr: "sombra", diff: 4, target: true },
    marchitar: { name: "Marchitar", kind: "off", attr: "sombra", diff: 5, target: true },
    grillete: { name: "Grillete", kind: "off", attr: "mente", diff: 6, target: true },
    maleficio: { name: "Maleficio", kind: "off", attr: "mente", diff: 5, target: true },
    drenar: { name: "Drenar", kind: "off", attr: "mente", diff: 4, target: true },
    pesadilla: { name: "Pesadilla", kind: "off", attr: "sombra", diff: 4, target: true },
    egida: { name: "Égida", kind: "def", attr: "mente", diff: 3, target: false },
    sanar: { name: "Sanar", kind: "def", attr: "mente", diff: 4, target: false },
    velo: { name: "Velo", kind: "def", attr: "sombra", diff: 3, target: false },
    purga: { name: "Purga", kind: "def", attr: "mente", diff: 4, target: false },
    reflejo: { name: "Reflejo", kind: "def", attr: "sombra", diff: 4, target: false },
    presagio: { name: "Presagio", kind: "def", attr: "mente", diff: 3, target: true }
  };
  const SPELL_ASPECTS = {
    fuego: { adj: "ígneo", roll: 1, selfCorr: 3, text: "más certero, pero te mancha un poco" },
    hielo: { adj: "gélido", dur: 1, text: "sus efectos duran una ronda más" },
    sangre: { adj: "de sangre", selfWound: 2, power: 1, text: "te cuesta 2 de vitalidad, pero golpea con más fuerza" },
    sombra: { adj: "umbrío", stealth: true, selfCorr: 2, text: "no deja rastro público, pero te mancha" },
    luz: { adj: "luminoso", roll: -1, selfCorr: -3, text: "limpia algo de tu oscuridad, pero es menos fiable (usa Mente)" },
    vacio: { adj: "del vacío", pierce: true, text: "atraviesa protecciones y reflejos" }
  };
  const SPELL_EPITHETS = ["de Vael", "de Orum", "de la Ceniza", "del Cuervo", "de Ithra", "de la Marea Negra", "de Kesh", "del Último Umbral", "de Mor", "de la Aguja"];
  function spellFormText(id, pw, dur) {
    switch (id) {
      case "rayo": return "Una descarga que hiere al objetivo (" + (pw > 1 ? "5-6 de vitalidad" : "3-4 de vitalidad, 5-6 si es crítico") + ").";
      case "plaga": return "Envenena al objetivo durante " + (2 + dur + (pw > 1 ? 1 : 0)) + " rondas.";
      case "marchitar": return "Abre un sangrado en el objetivo durante " + (1 + dur + (pw > 1 ? 1 : 0)) + " rondas.";
      case "grillete": return "Inmoviliza al objetivo: pierde su turno.";
      case "maleficio": return "Maldice al objetivo: −1 a sus tiradas durante " + (2 + dur + (pw > 1 ? 1 : 0)) + " rondas.";
      case "drenar": return "Arrebatas " + (pw > 1 ? 12 : 8) + " de virtud al objetivo y recuperas la mitad.";
      case "pesadilla": return "Siembra una pesadilla: el objetivo se mancha de oscuridad sin saber por qué.";
      case "egida": return "Una barrera: +" + (3 + 2 * (pw - 1)) + " de defensa esta ronda.";
      case "sanar": return "Recuperas " + (pw > 1 ? 6 : 3) + " de vitalidad.";
      case "velo": return "Un velo: anula la próxima acusación contra ti" + (pw > 1 ? " y debilita las dos próximas pistas sobre ti." : ".");
      case "purga": return "Expulsa " + (10 + 6 * (pw - 1)) + " de oscuridad y limpia sangrado, veneno, infección y maldición.";
      case "reflejo": return "Preparas un reflejo: la próxima agresión directa rebota contra su autor.";
      case "presagio": return "Una visión: obtienes una pista " + (pw > 1 ? "muy fuerte " : "fuerte ") + "sobre el objetivo.";
    }
    return "";
  }
  function finalizeSpell(sp) {
    const f = SPELL_FORMS[sp.form], asp = SPELL_ASPECTS[sp.aspect];
    sp.kind = f.kind; sp.target = f.target;
    sp.power = 1 + (asp.power || 0) + (sp.tune === "potente" ? 1 : 0) + (sp.mastered ? 1 : 0);
    sp.stealth = !!(asp.stealth || sp.tune === "sutil");
    const tn = { potente: "mayor", estable: "perdurable", sutil: "silente" };
    sp.name = f.name + " " + asp.adj + (sp.tune ? " " + tn[sp.tune] : "") + " " + sp.epithet;
    const tuneTxt = sp.tune === "potente" ? " Potenciado: más intensidad, pero te mancha." : sp.tune === "estable" ? " Estable: un uso extra." : sp.tune === "sutil" ? " Sutil: no deja rastro público." : "";
    const mastTxt = sp.mastered ? " Dominado: más intensidad." : "";
    sp.desc = spellFormText(sp.form, sp.power, asp.dur || 0) + " " + asp.text.charAt(0).toUpperCase() + asp.text.slice(1) + "." + tuneTxt + mastTxt;
    return sp;
  }
  function genSpell(kind, avoidForm) {
    const forms = Object.keys(SPELL_FORMS).filter(function (k) { return (!kind || SPELL_FORMS[k].kind === kind) && k !== avoidForm; });
    const sp = { id: "s" + Date.now().toString(36) + rnd(99999), form: pick(forms), aspect: pick(Object.keys(SPELL_ASPECTS)), epithet: pick(SPELL_EPITHETS), uses: 1 + rnd(2), tune: null };
    return finalizeSpell(sp);
  }
  function genOptions() {
    const a = genSpell("off"), b = genSpell("def");
    const c = genSpell(Math.random() < 0.5 ? "off" : "def", null);
    return [a, b, c.form === a.form || c.form === b.form ? genSpell(c.kind, c.form) : c];
  }
  function spellAttr(sp) { return sp.aspect === "luz" ? "mente" : SPELL_FORMS[sp.form].attr; }
  function applySpell(p, sp, t, crit) {
    const pw = sp.power, dur = SPELL_ASPECTS[sp.aspect].dur || 0, r = state.round;
    switch (sp.form) {
      case "rayo": { const big = pw > 1 || crit; const res = damage(t, big ? rr(5, 6) : rr(3, 4), { src: "magia" }); t.notes.push("Ronda " + r + ": una descarga te golpeó desde la nada" + hitNote(res) + "."); return t.name + (res.died ? " ya estaba moribundo y la descarga lo remata." : res.dying ? " cae moribundo bajo la descarga." : " recibe la descarga y queda " + (big ? "muy " : "") + "herido."); }
      case "plaga": giveStatus(t, "veneno", 2 + dur + (pw > 1 ? 1 : 0)); t.notes.push("Ronda " + r + ": un sabor amargo te sube por la garganta."); return t.name + " enferma.";
      case "marchitar": giveStatus(t, "sangrado", 1 + dur + (pw > 1 ? 1 : 0)); t.notes.push("Ronda " + r + ": una herida se abre sola."); return "Un sangrado se abre en " + t.name + ".";
      case "grillete":
        if (!t.acted) { t.acted = true; state.chronicle.push({ round: r, text: "✖ " + t.name + " pierde su turno de esta ronda." }); t.notes.push("Ronda " + r + ": tus miembros se quedaron rígidos."); return t.name + " pierde su turno de esta ronda."; }
        giveStatus(t, "aturdido", 1); t.notes.push("Ronda " + r + ": tus miembros se quedaron rígidos."); return t.name + " perderá su próximo turno.";
      case "maleficio": giveStatus(t, "maldito", 2 + dur + (pw > 1 ? 1 : 0)); t.notes.push("Ronda " + r + ": sientes que la suerte te da la espalda."); return t.name + " queda maldito.";
      case "drenar": { const v = pw > 1 ? 12 : 8; t.virtue = clamp(t.virtue - v, 0, 100); p.virtue = clamp(p.virtue + Math.floor(v / 2), 0, 100); t.notes.push("Ronda " + r + ": algo bueno se apagó dentro de ti."); return "Le arrebatas virtud a " + t.name + "."; }
      case "pesadilla": t.corr = clamp(t.corr + 5 + 2 * (pw - 1), 0, 100); t.notes.push("Ronda " + r + ": una pesadilla te dejó un regusto oscuro."); return t.name + " tendrá pesadillas.";
      case "egida": p.roundDefense += 3 + 2 * (pw - 1); return "Una barrera te rodea esta ronda.";
      case "sanar": { const h = heal(p, pw > 1 ? 6 : 3); return h > 0 ? "Tus heridas se cierran (+" + h + " de vitalidad)." : "No tenías heridas que cerrar: el conjuro se pierde."; }
      case "velo": p.shield = true; if (pw > 1) p.fog = (p.fog || 0) + 2; return "Un velo te cubre.";
      case "purga": p.corr = clamp(p.corr - (10 + 6 * (pw - 1)), 0, 100); dropStatus(p, "sangrado"); dropStatus(p, "veneno"); dropStatus(p, "infeccion"); dropStatus(p, "maldito"); easeHands(p, 99); return "La oscuridad sale de ti.";
      case "reflejo": p.reflect = true; return "Un reflejo te protege de la próxima agresión directa.";
      case "presagio": { const c = makeClue(t, pw > 1 ? 3 : 2); if (c) p.clues.push(c); return c ? "La visión te revela algo sobre " + t.name + "." : "La visión se desvanece."; }
    }
    return "No ocurre nada.";
  }
  function cast(actorId, spellId, targetId) {
    if (!state || state.phase !== "private") return err("Ahora no puedes actuar.");
    if (state.handoff) return err("Primero entrega el móvil.");
    if (state.turn !== actorId) return err("No es tu turno.");
    const p = state.players[actorId];
    if (!p || p.dead) return err("Este jugador ya no puede actuar.");
    if (p.dying) return err("Estás moribundo: no puedes actuar.");
    if (p.acted) return err("Ya has actuado esta ronda.");
    const sp = (p.spells || []).find(function (s) { return s.id === spellId; });
    if (!sp || sp.uses <= 0) return err("Ese conjuro ya no existe.");
    const f = SPELL_FORMS[sp.form], asp = SPELL_ASPECTS[sp.aspect];
    let t = null;
    if (f.target) { t = state.players[targetId]; if (!t || t.id === p.id || t.dead) return err("Debes elegir a otro jugador que siga en la partida."); }
    if (asp.selfWound && p.hp <= 4) return err("No te queda sangre que ofrecer.");
    const off = f.kind === "off";
    if (p.offer && !p.offer.done) resolveOffer(p, false);
    if (handOfferFor(p)) resolveHand(p, false);
    p.did = p.did || {}; p.did.conjurar = (p.did.conjurar || 0) + 1;
    sp.uses -= 1;
    const res = { ok: true, die: 0, stat: 0, focus: 0, status: 0, total: 0, diff: 0, crit: false, fumble: false, success: false, pushable: false, action: "Conjurar" };
    let text, selfTxt = "";
    if (off && t && t.reflect && !asp.pierce) {
      t.reflect = false; giveStatus(p, "maldito", 2);
      t.notes.push("Ronda " + state.round + ": un reflejo plateado devolvió un conjuro dirigido a ti.");
      p.notes.push("Ronda " + state.round + ": tu conjuro rebotó contra un reflejo.");
      text = "Tu conjuro choca contra un reflejo plateado y rebota. Te alcanza una maldición.";
    } else {
      const diff = Math.max(2, f.diff - (asp.roll || 0) + (off && t && t.protection !== null && !asp.pierce ? 1 : 0));
      const r = rollCheck(p, spellAttr(sp), diff);
      res.why = ["tu " + spellAttr(sp) + " (" + p.stats[spellAttr(sp)] + ")"];
      if (asp.roll > 0) res.why.push("el aspecto " + asp.adj + " lo hace más certero");
      if (asp.roll < 0) res.why.push("el aspecto " + asp.adj + " lo hace menos fiable");
      if (off && t && t.protection !== null && !asp.pierce) res.why.push("la víctima está protegida (+1 dificultad)");
      statusWhy(p).forEach(function (x) { res.why.push(x); });
      zoneWhy(p, spellAttr(sp)).forEach(function (x) { res.why.push(x); });
      res.die = r.die; res.stat = r.stat; res.focus = r.focus; res.status = r.status || 0; res.total = r.total; res.diff = r.diff; res.crit = r.crit; res.fumble = r.fumble; res.success = r.success;
      p.corr = clamp(p.corr + (asp.selfCorr || 0) + (sp.tune === "potente" ? 3 : 0), 0, 100);
      if (asp.selfWound) { const sw = damage(p, asp.selfWound, { zone: "brazos" }); selfTxt = " Pagas el hechizo con tu sangre (−" + sw.dealt + " de vitalidad)."; p.notes.push("Ronda " + state.round + ": pagaste un conjuro con tu sangre" + hitNote(sw) + "."); }
      if (r.success) { text = applySpell(p, sp, t, r.crit); addXp(p, spellAttr(sp), r.crit ? 2 : 1); }
      else if (r.fumble) { p.corr = clamp(p.corr + 3, 0, 100); text = "El conjuro se retuerce entre tus dedos y te mancha."; }
      else text = "El conjuro se deshace sin efecto.";
      text += selfTxt;
    }
    if (off && t) {
      if (!sp.stealth) state.chronicle.push({ round: state.round, text: "Se oyeron palabras antiguas cerca de " + t.name + "." });
      p.deeds = p.deeds || [];
      p.deeds.push({ round: state.round, kind: "conjurar", target: t.id, ok: res.success });
    }
    if (res.success) {
      sp.wins = (sp.wins || 0) + 1;
      if (sp.wins >= 2 && !sp.mastered) {
        sp.mastered = true; sp.uses += 1;
        const oldName = sp.name;
        finalizeSpell(sp);
        text += " Las palabras de «" + oldName + "» ya no se te resisten: lo has dominado.";
        p.notes.push("Ronda " + state.round + ": dominaste «" + oldName + "».");
      }
    }
    if (sp.uses <= 0) p.spells = p.spells.filter(function (s) { return s !== sp; });
    p.acted = true; p.action = off ? "conjuro_of" : "conjuro_def"; p.actionTarget = t ? t.id : null;
    state.pendingPush = null;
    res.outcome = text;
    save();
    return res;
  }
  function studyChecks(pid) {
    if (!state || state.phase !== "private" || state.handoff || state.turn !== pid) return "Ahora no puedes estudiar.";
    const p = state.players[pid];
    if (!p || p.dead || p.acted) return "Este jugador ya no puede estudiar.";
    if (p.usedItem) return "Ya has usado un objeto esta ronda.";
    return null;
  }
  function studyOptions(pid, idx) {
    const bad = studyChecks(pid); if (bad) return err(bad);
    const p = state.players[pid];
    const it = p.items[idx];
    if (!it || it.id !== "grimorio") return err("Ese objeto no se puede estudiar.");
    if (!p.study || p.study.idx !== idx) p.study = { idx: idx, opts: genOptions() };
    save();
    return { ok: true, options: p.study.opts };
  }
  function learnSpell(pid, optIdx, tune) {
    const bad = studyChecks(pid); if (bad) return err(bad);
    const p = state.players[pid];
    const st = p.study;
    if (!st || !p.items[st.idx] || p.items[st.idx].id !== "grimorio") return err("No estás estudiando nada.");
    const base = st.opts[optIdx];
    if (!base) return err("Elige un conjuro.");
    if (["potente", "estable", "sutil"].indexOf(tune) === -1) return err("Elige un ajuste.");
    const sp = Object.assign({}, base, { tune: tune, id: "s" + Date.now().toString(36) + rnd(99999) });
    if (tune === "estable") sp.uses += 1;
    finalizeSpell(sp);
    p.spells = p.spells || [];
    if (p.spells.length >= 4) { p.spells.sort(function (x, y) { return x.uses - y.uses; }); p.spells.shift(); }
    p.spells.push(sp);
    p.items.splice(st.idx, 1);
    p.usedItem = true; p.study = null;
    p.notes.push("Ronda " + state.round + ": estudiaste un grimorio y aprendiste «" + sp.name + "».");
    save();
    return { ok: true, spell: sp, msg: "Aprendes «" + sp.name + "»." };
  }

  /* ---------- La mano tendida: ayuda discreta, sincera o trampa ---------- */
  function hands() { return state.hands || (state.hands = []); }
  function handOfferFor(p) {
    if (!state || state.phase !== "private" || p.dead || p.acted) return null;
    return hands().find(function (x) { return x.status === "offered" && x.to === p.id; }) || null;
  }
  function getHandOffer(id) {
    const p = state && state.players[id];
    const x = p ? handOfferFor(p) : null;
    return x ? { from: state.players[x.from].name } : null;
  }
  function resolveHand(p, accept) {
    const x = handOfferFor(p);
    if (!x) return err("No hay ninguna mano tendida.");
    const a = state.players[x.from];
    if (!accept) {
      x.status = "rejected";
      a.notes.push("Ronda " + state.round + ": " + p.name + " rechazó tu mano.");
      save();
      return { ok: true, accepted: false, msg: "Rechazas la mano. Nada cambia." };
    }
    x.status = "active"; x.since = state.round; x.stacks = 0; x.age = 0;
    giveStatus(p, "fortalecido", 2);
    p.focus = Math.min(2, p.focus + 1);
    if (x.mode === "sincera") a.virtue = clamp(a.virtue + 4, 0, 100);
    p.notes.push("Ronda " + state.round + ": aceptaste la mano de " + a.name + " y prometiste callar. Se abre una ventana a tu favor.");
    a.notes.push("Ronda " + state.round + ": " + p.name + " aceptó tu mano y guardará silencio.");
    save();
    return { ok: true, accepted: true, msg: "Aceptas y callas. Una ventana se abre ante ti: +1 foco y fortalecido." };
  }
  function answerHand(pid, accept) {
    if (!state || state.phase !== "private" || state.handoff || state.turn !== pid) return err("Ahora no puedes responder.");
    const p = state.players[pid];
    if (!p || p.dead || p.acted) return err("Este jugador ya no puede responder.");
    return resolveHand(p, !!accept);
  }
  function easeHands(p, n) {
    let eased = false;
    hands().forEach(function (x) {
      if (x.status === "active" && x.mode === "trampa" && x.to === p.id && x.stacks > 0) { x.stacks = Math.max(0, x.stacks - n); eased = true; }
    });
    if (eased) p.notes.push("Ronda " + state.round + ": sientes que un frío antiguo remite, aunque no sabes por qué.");
  }
  function tickHands() {
    hands().forEach(function (x) {
      const a = state.players[x.from], t = state.players[x.to];
      if (x.status === "offered") { if (state.round - x.round >= 2) x.status = "ignored"; return; }
      if (x.status !== "active") return;
      if (a.dead || t.dead) { x.status = "ended"; return; }
      x.age += 1;
      if (x.mode === "trampa") {
        x.stacks += 1;
        if (x.stacks === 1) t.notes.push("Ronda " + state.round + ": un frío extraño te recorre desde la última promesa.");
        else {
          t.notes.push("Ronda " + state.round + ": algo te consume por dentro, sin causa que puedas señalar.");
          const res = damage(t, 2, { src: "interno" });
          t.notes.push("Ronda " + state.round + ": la debilidad te cuesta vitalidad" + hitNote(res) + ".");
          state.chronicle.push({ round: state.round, text: t.name + " se debilita sin causa aparente." });
        }
        if (x.age >= 8 || t.dead) x.status = "ended";
      } else if (x.age >= 3) {
        x.status = "done"; a.keptPacts += 1;
        a.notes.push("Ronda " + state.round + ": tu mano a " + t.name + " fue sincera y la promesa se cumplió.");
      }
    });
  }
  /* Tramos de corrupción: efectos que el jugador no ve; solo nota los síntomas. */
  function tierOf(p) { return isAssassin(p) ? 0 : p.corr >= 60 ? 4 : p.corr >= 40 ? 3 : p.corr >= 25 ? 2 : p.corr >= 12 ? 1 : 0; }
  function corrMod(p, attr) {
    const t = tierOf(p);
    if (attr === "sombra") return t >= 3 ? 2 : t >= 1 ? 1 : 0;
    if (attr === "mente") return t >= 3 ? -1 : t === 2 ? -1 : 0;
    if (attr === "cuerpo") return t >= 3 ? -1 : 0;
    return 0;
  }
  const TIER_NOTES = ["", "Tu sombra empieza a moverse por su cuenta.", "Notas la mirada de los demás más pesada; tus pensamientos se enturbian.",
    "Tu cuerpo ya no te responde como antes. Algo se ha roto dentro de ti.", "Ya no recuerdas dónde acaba tu sombra y dónde empiezas tú."];
  function tierCheck(p) {
    if (p.dead) return;
    const t = tierOf(p), seen = p.tierSeen || 0;
    if (t > seen) {
      p.tierSeen = t;
      p.notes.push("Ronda " + state.round + ": " + TIER_NOTES[t]);
      /* La herida por oscuridad solo ocurre la primera vez que alcanzas ese nivel, y nunca justo tras descansar. */
      const firstTime = t > (p.tierMax || 0);
      p.tierMax = Math.max(p.tierMax || 0, t);
      if (t >= 3 && firstTime && p.restedRound !== state.round - 1 && !p.dying) {
        const res = damage(p, 2, { src: "interno" });
        p.notes.push("Ronda " + state.round + ": algo dentro de ti te golpeó al oscurecerte más" + hitNote(res) + ".");
        state.chronicle.push({ round: state.round, text: p.name + " se desploma un instante, como si algo lo hubiera golpeado desde dentro." });
      }
    } else if (t < seen) { p.tierSeen = t; }
  }
  function hasStatus(p, id) { return !!(p && p.status && p.status.some(function (s) { return s.id === id; })); }
  function giveStatus(p, id, dur) {
    if (!p || p.dead || p.dying) return;
    if (p.ward && ["sangrado", "veneno", "aturdido", "maldito"].indexOf(id) !== -1) { p.ward = false; p.notes.push("Ronda " + (state ? state.round : "?") + ": una ceniza invisible absorbió un mal dirigido a ti."); return; }
    p.status = p.status || [];
    const s = p.status.find(function (x) { return x.id === id; });
    if (s) s.left = Math.max(s.left, dur); else p.status.push({ id: id, left: dur });
  }
  function dropStatus(p, id) { p.status = (p.status || []).filter(function (s) { return s.id !== id; }); }
  function statusMod(p) {
    if (!p) return 0;
    return (hasStatus(p, "fortalecido") ? 1 : 0) - (hasStatus(p, "maldito") ? 1 : 0) - (shockOf(p) ? 1 : 0);
  }
  /* Explicación de los modificadores de estado (vigor, maldición, conmoción por heridas). */
  function statusWhy(p) {
    const out = [];
    if (hasStatus(p, "fortalecido")) out.push("vigor (+1)");
    if (hasStatus(p, "maldito")) out.push("maldición (−1)");
    if (shockOf(p)) out.push("estás tan malherido que apenas te sostienes (−1)");
    return out;
  }
  function zoneWhy(p, attr) {
    if (attr === "cuerpo" && armPen(p)) return ["tus brazos gravemente heridos te estorban (−1)"];
    if (attr === "mente" && zoneLvl(p, "cabeza") >= 2) return ["la conmoción de tu cabeza te nubla (−1)"];
    return [];
  }
  /* Se llama al inicio de cada ronda: aplica el efecto y gasta una ronda de duración. */
  function tickStatus(p) {
    p.status = p.status || [];
    p.status.forEach(function (s) {
      if (p.dead || p.dying) return;
      if (s.id === "sangrado") {
        const n = zoneLvl(p, "torso") >= 2 ? 3 : 2;
        state.chronicle.push({ round: state.round, text: "✖ " + p.name + " sigue sangrando." });
        const res = damage(p, n, { noZone: true, noBleed: true });
        p.notes.push("Ronda " + state.round + ": la herida sigue sangrando (−" + res.dealt + " de vitalidad)" + (res.dying ? " y caes moribundo." : "."));
      }
      if (s.id === "infeccion") {
        const res = damage(p, 1, { noZone: true, noBleed: true });
        p.corr = clamp(p.corr + 2, 0, 100);
        p.notes.push("Ronda " + state.round + ": la infección te consume (−" + res.dealt + " de vitalidad, +corrupción)" + (res.dying ? " y caes moribundo." : "."));
      }
      if (s.id === "veneno") { p.corr = clamp(p.corr + 3, 0, 100); p.notes.push("Ronda " + state.round + ": el veneno te debilita y te oscurece."); }
      s.left -= 1;
    });
    p.status = p.status.filter(function (s) { return s.left > 0 && !p.dead; });
    if (p.dead) p.status = [];
  }
  /* ---------- tratos del Umbral: ofertas individuales y privadas ---------- */
  const OFFERS = {
    cura: { base: 12, text: "El Umbral te arranca del borde de la muerte: +6 de vitalidad y se van el sangrado y el veneno." },
    foco: { base: 5, text: "El Umbral te presta claridad: +2 foco para tus próximas tiradas." },
    pista: { base: 10, text: "El Umbral te susurra los secretos de dos jugadores: una pista fuerte sobre cada uno." },
    objeto: { base: 10, text: "El Umbral te entrega un objeto oscuro." },
    poder: { base: 16, text: "El Umbral te concede +1 a tus dos atributos más débiles, a costa de 4 virtud." }
  };
  function makeOffer(p) {
    /* Selectivo: solo aparece en momentos clave, con pausa entre tratos. */
    const danger = p.hp <= 0.45 * maxHp(p) || (p.hp < maxHp(p) && (hasStatus(p, "sangrado") || hasStatus(p, "veneno")));
    const gap = state.round - (p.lastOffer || -9);
    if (state.round < 2 || gap < (danger ? 2 : 3)) return null;
    if (p.lastDeal && state.round - p.lastDeal < 4) return null;
    if (Math.random() >= (danger ? 0.85 : 0.4)) return null;
    const pool = [];
    if (danger && (p.curas || 0) < 2) pool.push(["cura", 5]);
    if (others(p).length) pool.push(["pista", 1]);
    if (!p.items.length) pool.push(["objeto", 1]);
    if (state.round >= lateRound() && ["cuerpo", "mente", "sombra"].filter(function (k) { return p.stats[k] < MAX_STAT; }).length >= 2) pool.push(["poder", 2]);
    if (!pool.length) return null;
    let roll = rnd(pool.reduce(function (s, x) { return s + x[1]; }, 0));
    let id = pool[0][0];
    for (let i = 0; i < pool.length; i++) { if (roll < pool[i][1]) { id = pool[i][0]; break; } roll -= pool[i][1]; }
    const pressure = p.pressure || 0;
    /* Suelo del precio: la insistencia lo abarata, pero nunca por debajo del 60 % del base. */
    const cost = Math.max(Math.ceil(OFFERS[id].base * 0.6), OFFERS[id].base - 2 * pressure);
    /* Coste de rechazar: nada las dos primeras veces; luego el Umbral se impacienta. */
    const refuse = pressure >= 3 ? 5 : pressure >= 2 ? 3 : 0;
    return { id: id, cost: cost, refuse: refuse, text: OFFERS[id].text, done: false };
  }
  function getOffer(playerId) {
    const p = state && state.players[playerId];
    if (!p || p.dead || p.acted || state.phase !== "private") return null;
    if (p.offer === null || p.offer === undefined) { p.offer = makeOffer(p) || false; if (p.offer) p.lastOffer = state.round; save(); }
    return p.offer || null;
  }
  /* Pactos: términos claros para quien los sella y para quien los acepta. */
  function pactTerms(type, aName, bName) {
    if (type === "pacto_no_agresion") return "Ni " + aName + " ni " + bName + " pueden actuar contra el otro: atacar, robar, hechizar, envenenar, emboscar…";
    if (type === "pacto_silencio") return "Ni " + aName + " ni " + bName + " pueden investigar al otro, acusarlo ni presentar pruebas contra él.";
    return aName + " debe proteger a " + bName + " (acción Proteger sobre él) si le atacan en público.";
  }
  function activePacts(pid) {
    if (!state) return [];
    return state.pacts.filter(function (x) { return !x.done && x.accepted !== false && (x.a === pid || x.b === pid); }).map(function (x) {
      const me = state.players[pid], o = state.players[x.a === pid ? x.b : x.a];
      return { type: x.type, other: o.name, terms: pactTerms(x.type, state.players[x.a].name, state.players[x.b].name), thisRound: x.expires === state.round, label: x.type === "pacto_proteccion" ? "protección" : x.type === "pacto_silencio" ? "silencio" : "no agresión" };
    });
  }
  function resolveOffer(p, accept) {
    const o = p.offer;
    if (!o || o.done) return err("No hay ningún trato pendiente.");
    o.done = true;
    if (accept) {
      p.corr = clamp(p.corr + o.cost, 0, 100);
      p.pressure = 0; p.dealt = (p.dealt || 0) + 1; p.lastDeal = state.round;
      let eff = "";
      if (o.id === "cura") { p.curas = (p.curas || 0) + 1; const h = heal(p, 6); dropStatus(p, "sangrado"); dropStatus(p, "veneno"); easeHands(p, 99); eff = h > 0 ? "Tus heridas se cierran (+" + h + " de vitalidad)." : "Se van el sangrado y el veneno."; }
      else if (o.id === "foco") { p.focus = Math.min(2, p.focus + 2); eff = "Ganas 2 de foco."; }
      else if (o.id === "pista") {
        const ts = shuffle(others(p)).slice(0, 2), names = [];
        ts.forEach(function (t) { const c = makeClue(t, 2); if (c) { p.clues.push(c); names.push(t.name); } });
        eff = names.length ? "Recibes una pista fuerte sobre " + names.join(" y ") + "." : "El secreto se pierde en el aire.";
      }
      else if (o.id === "objeto") { const it = pick(D.DARK_ITEMS); p.items.push(mkItem(it)); eff = "Recibes " + itemName(it) + "."; }
      else if (o.id === "poder") {
        const open = ["cuerpo", "mente", "sombra"].filter(function (k) { return p.stats[k] < MAX_STAT; }).sort(function (a, b) { return p.stats[a] - p.stats[b]; });
        open.slice(0, 2).forEach(function (k) { p.stats[k] += 1; });
        eff = "Aumentan " + open.slice(0, 2).join(" y ") + " (+1 cada uno).";
        p.virtue = clamp(p.virtue - 4, 0, 100);
      }
      p.deeds = p.deeds || [];
      p.deeds.push({ round: state.round, kind: "trato", target: null, ok: true });
      p.notes.push("Ronda " + state.round + ": aceptaste un trato del Umbral (algo en ti se oscurece).");
      save();
      return { ok: true, accepted: true, msg: "Trato cerrado. El Umbral sonríe. " + eff };
    }
    const extra = o.refuse || 0;
    p.pressure = Math.min(3, (p.pressure || 0) + 1); p.refused = (p.refused || 0) + 1;
    p.virtue = clamp(p.virtue + 2, 0, 100);
    if (extra) p.corr = clamp(p.corr + extra, 0, 100);
    p.notes.push("Ronda " + state.round + ": rechazaste un trato del Umbral." + (extra ? " Se impacienta y algo se oscurece en ti." : ""));
    save();
    return { ok: true, accepted: false, msg: "Rechazas el trato (+2 virtud)." + (extra ? " El Umbral se impacienta." : "") };
  }
  function answerOffer(playerId, accept) {
    if (!state || state.phase !== "private" || state.handoff || state.turn !== playerId) return err("Ahora no puedes responder al trato.");
    const p = state.players[playerId];
    if (!p || p.dead || p.acted) return err("Este jugador ya no puede responder.");
    return resolveOffer(p, !!accept);
  }
  function mkItem(id) { return { id: id }; }
  function itemName(id) { return (D.ITEMS[id] && D.ITEMS[id].name) || id; }
  function others(p) { return state.players.filter(function (x) { return x.id !== p.id && !x.dead; }); }
  function pSuccess(bonus, diff) {
    let n = 0;
    for (let d = 1; d <= 6; d++) {
      const ok = d === 6 ? true : d === 1 ? false : (d + bonus >= diff);
      if (ok) n++;
    }
    return Math.round((n / 6) * 100);
  }

  /* Probabilidad real de éxito: mismas reglas que la tirada (atributo, oscuridad, estados, foco y virtud). */
  function actionOdds(pid, aid) {
    const p = state && state.players[pid], a = D.ACTIONS.find(function (x) { return x.id === aid; });
    if (!p || !a || !a.risk || a.gamble || !a.attr) return null;
    const mods = [];
    const cm = corrMod(p, a.attr), sm = statusMod(p), zm = zoneMod(p, a.attr), fo = p.focus > 0 ? p.focus : 0;
    if (cm > 0) mods.push("tu sombra responde (+" + cm + ")"); else if (cm < 0) mods.push("la oscuridad te entorpece (" + cm + ")");
    statusWhy(p).forEach(function (x) { mods.push(x); });
    zoneWhy(p, a.attr).forEach(function (x) { mods.push(x); });
    if (fo) mods.push("foco (+" + fo + ")");
    let diff = a.diff;
    if (["investigar", "proteger", "explorar"].indexOf(a.id) !== -1) {
      if (p.virtue >= 70) { diff -= 1; mods.push("virtud alta (−1 dificultad)"); }
      else if (p.virtue <= 30) { diff += 1; mods.push("virtud baja (+1 dificultad)"); }
    }
    const bonus = p.stats[a.attr] + cm + zm + sm + fo;
    return { prob: pSuccess(bonus, diff), bonus: bonus, diff: diff, mods: mods };
  }

  /* ---------- creación ---------- */
  function makePlayer(name, id, role, affinity, secret) {
    const stats = { cuerpo: 2, mente: 2, sombra: 2 };
    ["cuerpo", "mente", "sombra"].forEach(function (k) {
      stats[k] += (role.stats[k] || 0) + (affinity.stats[k] || 0);
    });
    const p = {
      id: id, name: name, role: role, affinity: affinity,
      secret: { id: secret.id, text: secret.text },
      stats: stats, virtue: 50, corr: 0,
      items: [], clues: [], notes: [],
      dead: false, focus: 0,
      roundDefense: 0, roundAttack: 0, protection: null, shield: false,
      usedItem: false, acted: false, action: null, actionTarget: null,
      spells: [], stolen: [], betrayals: 0, keptPacts: 0, successfulAccusations: 0, status: []
    };
    p.hp = maxHp(p); p.zones = { cabeza: 0, torso: 0, brazos: 0, piernas: 0 }; p.dying = false;
    initHealth(p);
    if (hasPassive(p, "startItem")) p.items.push(mkItem("daga"));
    if (hasPassive(p, "startVendas")) { p.items.push(mkItem("vendas")); p.items.push(mkItem("vendas")); }
    return p;
  }

  function createGame(names, opts) {
    if (!Array.isArray(names) || names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) throw new Error("La partida admite de " + MIN_PLAYERS + " a " + MAX_PLAYERS + " jugadores.");
    const minutes = clamp(Math.round((opts && opts.minutes) || DEFAULT_MINUTES), MIN_MINUTES, MAX_MINUTES);
    const roles = shuffle(D.ROLES).slice(0, names.length);
    const affs = shuffle(D.AFFINITIES).slice(0, names.length);
    const secrets = shuffle(D.SECRETS).slice(0, names.length);
    const used = {};
    const players = names.map(function (n, i) {
      let clean = String(n || "").trim().slice(0, 16) || ("Jugador " + (i + 1));
      while (used[clean.toLowerCase()]) clean = clean + " " + (i + 1);
      used[clean.toLowerCase()] = true;
      return makePlayer(clean, i, roles[i], affs[i], secrets[i]);
    });
    state = {
      v: VERSION, round: 1, turn: 0, phase: "private", handoff: false,
      players: players, chronicle: [], publicClues: [],
      pacts: [], threats: [], council: null, lastResolution: [],
      event: null, umbralAbierto: false, assassinId: null, assassinExposed: false, ending: null,
      createdAt: Date.now(), durationMin: minutes, playedMs: 0, hands: []
    };
    planRounds(true);
    players.forEach(function (p) { if (hasPassive(p, "spellDiscount")) p.spells.push(genSpell(null)); });
    players.forEach(function (p) { unlockNotices(p, true); });
    players.forEach(function (p) {
      if (hasPassive(p, "startClue")) p.clues.push(makeClue(pick(others(p)), 2));
    });
    startRound();
    save();
    return state;
  }

  /* ---------- pistas ---------- */
  /* Pista basada en algo que el objetivo hizo de verdad (se guarda en p.deeds). */
  function deedClue(target) {
    const ds = target.deeds || [];
    if (!ds.length) return null;
    const d = ds[rnd(ds.length)];
    const other = d.target !== null && d.target !== undefined && state.players[d.target] ? state.players[d.target].name : "alguien";
    const n = target.name;
    const pre = "Ronda " + d.round + ": ";
    switch (d.kind) {
      case "robar": return { text: pre + "viste a " + n + " rondando las pertenencias de " + other + ".", bonus: 1 };
      case "hechizar": return { text: pre + "había restos de magia prohibida cerca de " + other + "; el rastro lleva a " + n + ".", bonus: 1 };
      case "cazar": return { text: pre + (d.ok ? "algo atacó a " + other + " en la oscuridad" : "algo acechó a " + other + " sin lograr herirle") + " y las huellas se parecen a las de " + n + ".", bonus: 1 };
      case "proteger": return { text: pre + n + (d.ok ? " se interpuso para defender a " : " intentó proteger a ") + other + ". Habla a su favor.", bonus: -1 };
      case "trato": return { text: pre + "el aire se enrareció alrededor de " + n + ", como si alguien hubiera cerrado un trato en voz baja.", bonus: 1 };
      case "ceder": return { text: pre + "la voz de " + n + " cambió tras la última campanada, como si algo respondiera por ella.", bonus: 1 };
      case "apunalar": return { text: pre + (d.ok ? other + " apareció con una herida reciente y " + n + " tenía sangre en la manga." : n + " rondaba a " + other + " con un arma en la mano."), bonus: 1 };
      case "envenenar": return { text: pre + (d.ok ? other + " enfermó de golpe, justo después de cruzarse con " + n + "." : "un frasco de veneno desapareció cerca de " + n + "."), bonus: 1 };
      case "maldecir": return { text: pre + "se oyó un rezo torcido cerca de " + other + "; la voz era la de " + n + ".", bonus: 1 };
      case "aturdir": return { text: pre + (d.ok ? other + " apareció tambaleándose y " + n + " estaba a su lado." : n + " se acercó a " + other + " con mala intención."), bonus: 1 };
      case "conjurar": return { text: pre + "el aire olía a magia cerca de " + other + "; el eco del conjuro se parecía a la voz de " + n + ".", bonus: 1 };
      case "tender": return d.ok ? { text: pre + n + " sonreía a " + other + " con una amabilidad que no le cuadraba.", bonus: 1 } : { text: pre + n + " le tendió la mano a " + other + " con un gesto franco.", bonus: -1 };
      case "devorar": return { text: pre + "solo quedaron restos cerca de " + other + "; " + n + " tenía la boca manchada.", bonus: 2 };
    }
    return null;
  }

  /* Las pistas se redactan en segunda persona (para quien las obtiene); en público se cuentan en primera. */
  function testimony(actor, text) {
    const t = text.replace(/Has visto/g, "He visto").replace(/Has oído/g, "He oído").replace(/\bviste\b/g, "vi");
    return actor.name + " cuenta: «" + t + "»";
  }
  /* Rumor: frase vaga pero verdadera sobre el estado actual del objetivo. */
  function rumorFor(target) {
    const n = target.name; const opts = [];
    if (target.corr >= 40) opts.push("Una sombra más densa acompaña a " + n + "; la luz le rehúye.");
    if (target.corr >= 25 && target.corr < 40) opts.push("La sombra de " + n + " se mueve a veces por su cuenta.");
    if (target.corr <= 10) opts.push(n + " conserva la calma; la oscuridad apenas le roza.");
    if (target.wounds >= 1) opts.push(n + " se mueve con cuidado, como quien oculta un dolor.");
    if (target.items.length >= 3) opts.push(n + " lleva el equipaje muy cargado.");
    if (target.items.length === 0) opts.push(n + " no lleva nada encima.");
    if (target.virtue >= 70) opts.push(n + " transmite una calma que no parece fingida.");
    if (target.virtue <= 30) opts.push(n + " evita mirar a los ojos.");
    if (!opts.length) opts.push(pick(D.CLUES).replace(/\{name\}/g, n));
    return "Rumor (ronda " + state.round + "): " + pick(opts);
  }

  function makeClue(target, strength) {
    if (!target || target.dead) return null;
    let text;
    let str = strength || 1;
    if (target.fog > 0) { target.fog -= 1; str = Math.max(1, str - 1); }
    const held = (target.stolen || []).filter(function (x) { return target.items.some(function (i) { return i.id === x.item; }); });
    const deed = Math.random() < 0.7 ? deedClue(target) : null;
    if (deed) {
      text = deed.text; str = Math.max(0, str + deed.bonus);
    } else if (held.length && Math.random() < 0.45) {
      const s = held[held.length - 1];
      text = "Has visto a " + target.name + " con " + itemName(s.item) + ", que pertenecía a " + s.fromName + ".";
      str += 1;
    } else if (isAssassin(target) && D.ASSASSIN_CLUES && Math.random() < (str >= 2 ? 0.7 : 0.45)) {
      text = pick(D.ASSASSIN_CLUES).replace(/\{name\}/g, target.name);
    } else if (shadowMimics() && D.ASSASSIN_CLUES && Math.random() < (str >= 2 ? 0.4 : 0.25)) {
      text = pick(D.ASSASSIN_CLUES).replace(/\{name\}/g, target.name);
    } else {
      text = rumorFor(target);
    }
    return { about: target.id, strength: str, text: text };
  }

  /* ---------- ronda y eventos ---------- */
  function eventForRound(round) {
    const pool = D.EVENTS[Math.min(Math.ceil(round * D.EVENTS.length / maxRounds()), D.EVENTS.length) - 1] || D.EVENTS[0];
    return pick(pool);
  }

  function applyEvent(ev) {
    if (!ev || !ev.effect) return;
    const ps = state.players.filter(function (p) { return !p.dead; });
    if (!ps.length) return;
    if (ev.effect === "corruption") ps.forEach(function (p) { p.corr = clamp(p.corr + (state.round > lateRound() ? 4 : 3), 0, 100); });
    else if (ev.effect === "virtue") ps.forEach(function (p) { p.virtue = clamp(p.virtue + 3, 0, 100); });
    else if (ev.effect === "heal") ps.forEach(function (p) { if (!p.dying && p.hp < maxHp(p)) { const h = heal(p, 3); if (h > 0) p.notes.push("Ronda " + state.round + ": la fuente te alivia (+" + h + " de vitalidad)."); } });
    else if (ev.effect === "clue") { if (ps.length > 1) { const t = pick(ps); const clue = makeClue(pick(others(t)), 1); if (clue) t.clues.push(clue); } }
    else if (ev.effect === "item") {
      const t = pick(ps), id = ev.itemId || pick(D.LOOT_ITEMS);
      t.items.push(mkItem(id));
      t.gift = { round: state.round, text: "Entre tus cosas encuentras: " + itemName(id) + "." };
      t.notes.push("Ronda " + state.round + ": " + t.gift.text);
    }
  }

  function startRound() {
    state.phase = "private";
    const nP = state.players.length;
    if (state.firstIdx === undefined) state.firstIdx = rnd(nP);
    state.order = [];
    for (let i = 0; i < nP; i++) state.order.push((state.firstIdx + state.round - 1 + i) % nP);
    state.handoff = false;
    state.pendingPush = null;
    state.council = null;
    /* Un moribundo tiene una ronda completa para ser socorrido. */
    state.players.forEach(function (p) {
      if (!p.dead && p.dying && state.round >= (p.dyingRound || 0) + 2) {
        p.notes.push("Ronda " + state.round + ": nadie te socorrió a tiempo. Mueres.");
        finish(p, "heridas");
      }
    });
    state.players.forEach(function (p) {
      p.acted = !!p.dead || !!p.dying || hasStatus(p, "aturdido");
      p.usedItem = false; p.protection = null;
      p.roundDefense = 0; p.roundAttack = 0;
      p.action = null; p.actionTarget = null;
    });
    state.players.filter(function (p) { return !p.dead && p.acted && !p.dying; }).forEach(function (p) {
      state.chronicle.push({ round: state.round, text: "✖ " + p.name + " pierde su turno (aturdido)." });
    });
    state.players.forEach(function (p) { if (!p.dead) tickStatus(p); });
    tickHands();
    state.players.forEach(tierCheck);
    /* Infección: una zona grave sin curar durante 3 rondas puede infectarse. */
    state.players.forEach(function (p) {
      if (p.dead || p.dying || hasStatus(p, "infeccion")) return;
      if (!ZONES.some(function (z) { return zoneLvl(p, z) >= 2; })) return;
      if (p.healRound !== undefined && p.healRound !== null && state.round - p.healRound < 3) return;
      if (Math.random() < 0.4) { giveStatus(p, "infeccion", 3); if (hasStatus(p, "infeccion")) p.notes.push("Ronda " + state.round + ": una herida grave sin curar se infecta; tienes fiebre."); }
    });
    /* Recuperación natural lenta: +1 en rondas pares si llevas un tiempo sin sufrir daño ni sangrar. */
    if (state.round % 2 === 0) state.players.forEach(function (p) {
      if (p.dead || p.dying || p.hp >= maxHp(p) || hasStatus(p, "sangrado")) return;
      if ((p.hurtRound || 0) >= state.round - 1) return;
      const h = heal(p, 1);
      if (h > 0) p.notes.push("Ronda " + state.round + ": el cuerpo se repone un poco (+" + h + " de vitalidad).");
    });
    state.players.forEach(function (p) { if (p.dying && !p.dead) p.acted = true; });
    state.skipped = state.players.filter(function (p) { return !p.dead && p.acted; }).map(function (p) { return p.id; });
    state.players.forEach(function (p) { p.offer = null; });
    state.event = eventForRound(state.round);
    applyEvent(state.event);
    state.chronicle.push({
      round: state.round,
      text: "☾ " + state.event.text + (state.event.effectText ? " " + state.event.effectText : "")
    });
    if (checkTerminal()) return;
    state.players.forEach(function (p) { if (p.dead) p.acted = true; });
    const first = state.order.find(function (id) { return !state.players[id].dead && !state.players[id].acted; });
    if (first === undefined) { beginCouncil(); return; }
    state.turn = first;
    save();
  }

  /* ---------- tiradas ---------- */
  function rollRaw(bonus, diff) {
    const die = d6();
    const total = die + bonus;
    const crit = die === 6;
    const fumble = die === 1;
    const success = crit ? true : fumble ? false : total >= diff;
    return { die: die, stat: bonus, focus: 0, total: total, diff: diff, crit: crit, fumble: fumble, success: success };
  }

  function rollCheck(p, attr, diff) {
    const die = d6();
    const stat = (attr ? p.stats[attr] + corrMod(p, attr) + zoneMod(p, attr) : 0) + statusMod(p);
    const focus = p.focus > 0 ? p.focus : 0;
    if (focus) p.focus = 0;
    const total = die + stat + focus;
    const crit = die === 6;
    const fumble = die === 1;
    const success = crit ? true : fumble ? false : total >= diff;
    return { die: die, stat: stat, focus: focus, status: statusMod(p), total: total, diff: diff, crit: crit, fumble: fumble, success: success };
  }

  /* ---------- acciones privadas ---------- */
  function act(actorId, actionId, targetId, stakeId) {
    if (timeUp()) { forceEnd(); return err("El tiempo se ha agotado."); }
    if (!state || state.phase !== "private") return err("Ahora no puedes actuar.");
    if (state.handoff) return err("Primero entrega el móvil.");
    if (state.turn !== actorId) return err("No es tu turno.");
    const p = state.players[actorId];
    if (!p || p.dead) return err("Este jugador ya no puede actuar.");
    if (p.dying) return err("Estás moribundo: no puedes actuar.");
    if (p.acted) return err("Ya has actuado esta ronda.");
    const a = D.ACTIONS.find(function (x) { return x.id === actionId; });
    if (!a) return err("Acción desconocida.");
    if (a.assassinOnly && !isAssassin(p)) return err("Esta acción pertenece exclusivamente al Asesino.");
    if (a.id === "conjurar") return err("Elige un conjuro.");
    if (!isUnlocked(p, a)) return err("Aún no puedes hacer eso.");

    let t = null;
    if (a.target) {
      t = state.players[targetId];
      if (!t || t.id === p.id || t.dead) return err("Debes elegir a otro jugador que siga en la partida.");
      if (a.canTarget && !a.canTarget(t)) return err(a.id === "devorar" ? "Ese jugador no puede ser devorado todavía." : "Ese jugador no puede ser objetivo de esa acción.");
    }

    let mode = null;
    if (a.mode) {
      mode = stakeId === "trampa" ? "trampa" : stakeId === "sincera" ? "sincera" : null;
      if (!mode) return err("Elige si tu mano es sincera o una trampa.");
      if (mode === "trampa" && !(isAssassin(p) || p.corr >= 12)) return err("Aún no hay oscuridad suficiente en ti para esa trampa.");
      if (hands().some(function (x) { return x.from === p.id && x.to === t.id && (x.status === "offered" || x.status === "active"); })) return err("Ya le has tendido la mano a " + t.name + ".");
    }
    let stake = null;
    let diff = a.diff || 0;
    if (a.gamble) {
      stake = D.STAKES.find(function (s) { return s.id === Number(stakeId); });
      if (!stake) return err("Elige un envite.");
      diff = stake.diff;
    }
    if (a.hostile && t && t.reflect) {
      t.reflect = false; giveStatus(p, "maldito", 2);
      t.notes.push("Ronda " + state.round + ": un reflejo plateado devolvió una agresión contra ti.");
      p.notes.push("Ronda " + state.round + ": tu agresión chocó contra un reflejo y rebotó sobre ti. Te alcanza una maldición.");
      if (p.offer && !p.offer.done) resolveOffer(p, false);
      if (handOfferFor(p)) resolveHand(p, false);
      if (a.needs && a.consume !== false) { const jx = p.items.findIndex(function (i) { return i.id === a.needs; }); if (jx >= 0) p.items.splice(jx, 1); }
      p.acted = true; p.action = a.id; p.actionTarget = t.id; state.pendingPush = null;
      save();
      return { ok: true, die: 0, stat: 0, focus: 0, status: 0, total: 0, diff: 0, crit: false, fumble: false, success: false, outcome: "Tu agresión choca contra un reflejo plateado y rebota sobre ti. Te alcanza una maldición.", pushable: false, action: a.name };
    }
    if (a.hostile && a.id !== "cazar" && t && t.protection !== null) diff += 1;
    if (a.id === "cazar" && t) {
      /* La víctima se defiende con una tirada propia (como en las emboscadas). */
      const dFocus = t.focus > 0 ? t.focus : 0;
      if (dFocus) t.focus = 0;
      const defBonus = t.stats.cuerpo + Math.floor(t.stats.mente / 2) + t.roundDefense + dFocus + statusMod(t) +
        (hasPassive(t, "defenseBonus") ? 2 : 0) + (t.protection !== null ? 2 : 0) - t.wounds - legPen(t);
      diff = d6() + defBonus - huntEdge() + p.wounds;
    }

    if (a.id === "investigar" || a.id === "proteger" || a.id === "explorar") {
      if (p.virtue >= 70) diff -= 1; else if (p.virtue <= 30) diff += 1;
    }
    if (p.offer && !p.offer.done) resolveOffer(p, false);
    if (handOfferFor(p)) resolveHand(p, false);
    const why = [];
    if (a.attr) {
      why.push("tu " + a.attr + " (" + p.stats[a.attr] + ")");
      const cmod = corrMod(p, a.attr);
      if (cmod > 0) why.push("tu sombra responde con más fuerza (+" + cmod + ")");
      else if (cmod < 0) why.push("algo turbio entorpece tus " + (a.attr === "mente" ? "pensamientos" : "movimientos") + " (" + cmod + ")");
      statusWhy(p).forEach(function (x) { why.push(x); });
      zoneWhy(p, a.attr).forEach(function (x) { why.push(x); });
      if (a.hostile && t && t.protection !== null) why.push("la víctima está protegida (+1 dificultad)");
      if (["investigar", "proteger", "explorar"].indexOf(a.id) !== -1) {
        if (p.virtue >= 70) why.push("tu virtud lo facilita (−1 dificultad)"); else if (p.virtue <= 30) why.push("tu virtud baja lo complica (+1 dificultad)");
      }
    }
    const r = a.risk ? rollCheck(p, a.attr, diff) : { die: 0, stat: 0, focus: 0, total: 0, diff: 0, crit: false, fumble: false, success: true };
    const out = applyAction(p, a, t, r, a.mode ? mode : stake);
    p.did = p.did || {}; p.did[a.id] = (p.did[a.id] || 0) + 1;
    if (a.needs && a.consume !== false) { const ix = p.items.findIndex(function (i) { return i.id === a.needs; }); if (ix >= 0) p.items.splice(ix, 1); }
    if (a.attr && r.success) addXp(p, a.attr, r.crit ? 2 : 1);
    if (!r.blocked && ["robar", "hechizar", "cazar", "proteger", "ceder", "apunalar", "envenenar", "maldecir", "aturdir", "devorar", "tender", "conjurar"].indexOf(a.id) !== -1) {
      p.deeds = p.deeds || [];
      p.deeds.push({ round: state.round, kind: a.id, target: t ? t.id : null, ok: a.id === "tender" ? mode === "trampa" : !!r.success });
    }

    p.acted = true;
    p.action = a.id;
    p.actionTarget = t ? t.id : null;

    if (a.pushable && r.success) {
      state.pendingPush = { actorId: p.id, actionId: a.id, targetId: t ? t.id : null, attr: a.attr, diff: diff, stake: stake ? stake.id : null };
    } else {
      state.pendingPush = null;
    }
    save();
    return {
      ok: true, die: r.die, stat: r.stat, focus: r.focus, status: r.status || 0, total: r.total, diff: r.diff,
      crit: r.crit, fumble: r.fumble, success: r.success, why: why,
      outcome: out.text, pushable: !!(a.pushable && r.success), action: a.name
    };
  }

  function applyAction(p, a, t, r, stake) {
    switch (a.id) {
      case "investigar": {
        if (r.success) {
          let str = 1 + (r.crit ? 1 : 0) + (hasPassive(p, "extraClue") ? 1 : 0) + (p.stats.mente >= 4 ? 1 : 0);
          const clue = makeClue(t, str); if (clue) p.clues.push(clue);
          p.virtue = clamp(p.virtue + 3, 0, 100);
          return {
            text: (isAssassin(p) && isAssassin(t) ? "Os habéis pasado la noche siguiéndoos el uno al otro en círculos, con mucho sigilo y ninguna vergüenza. " : "") + "Sigues el rastro de " + t.name + ". Reúnes una pista (fuerza " + str + ")." + (r.crit ? " El Umbral te muestra más de lo esperado." : ""),
            log: "Alguien ha investigado los movimientos de " + t.name + "."
          };
        }
        p.corr = clamp(p.corr + 2, 0, 100);
        return { text: "Pierdes el rastro de " + t.name + ". La frustración te acerca a la oscuridad.", log: "Alguien ha fracasado siguiendo el rastro de " + t.name + "." };
      }
      case "proteger": {
        if (!r.success) {
          p.corr = clamp(p.corr + 2, 0, 100);
          return { text: "No consigues establecer la protección sobre " + t.name + ".", log: "Alguien intentó proteger a " + t.name + " pero no lo consiguió." };
        }
        const yaProt = t.protection !== null && t.protection !== p.id;
        t.protection = p.id;
        const gain = 6 + (hasPassive(p, "protectBonus") ? 4 : 0);
        p.virtue = clamp(p.virtue + gain, 0, 100);
        t.notes.push("Ronda " + state.round + ": " + p.name + " juró protegerte.");
        return { text: (yaProt ? t.name + " ya tenía a alguien protegiéndole; ahora tiene dos guardaespaldas discutiendo y un poco de agobio. " : "") + "Te comprometes a proteger a " + t.name + ". +" + gain + " virtud.", log: "Alguien ha jurado proteger a " + t.name + " esta noche." };
      }
      case "explorar": {
        if (r.success) {
          const it = Math.random() < 0.2 ? "grimorio" : pick(D.LOOT_ITEMS);
          p.items.push(mkItem(it));
          const possible = others(p);
          const o = possible.length ? pick(possible) : null;
          let got = false;
          if (o && (r.crit || Math.random() < 0.5)) { const cl = makeClue(o, 1 + (r.crit ? 1 : 0)); if (cl) { p.clues.push(cl); got = true; } }
          p.virtue = clamp(p.virtue + 2, 0, 100);
          p.exploreOk = true;
          return { text: "Registras las ruinas y encuentras " + itemName(it) + "." + (got ? " También descubres algo sobre " + o.name + "." : r.crit ? "" : " Nada más llama tu atención."), log: "Alguien ha explorado las ruinas y ha encontrado algo." };
        }
        p.corr = clamp(p.corr + 2, 0, 100);
        p.exploreOk = false;
        if (r.fumble && p.hp > 3) { const res = damage(p, rr(1, 2), { zone: "piernas" }); return { text: "Un suelo podrido cede bajo tus pies y te hieres las piernas (−" + res.dealt + " de vitalidad)" + (res.dying ? " y caes moribundo" : "") + ". Algo te observa desde las sombras.", log: "Alguien ha registrado las ruinas sin éxito." }; }
        return { text: "Las ruinas estaban vacías. Solo polvo y una presencia que te ha visto.", log: "Alguien ha registrado las ruinas sin éxito." };
      }
      case "meditar": {
        p.corr = clamp(p.corr - 12, 0, 100);
        p.virtue = clamp(p.virtue + 6, 0, 100);
        return { text: isAssassin(p) ? "Un asesino meditando: la oscuridad se ríe un buen rato antes de apartarse un poco. +6 virtud." : p.corr <= 3 ? "Meditas con la conciencia tan limpia que te quedas dormido. Al menos descansas: +6 virtud." : "Meditas y rechazas los susurros: la oscuridad se aleja un poco, +6 virtud.", log: "Alguien ha pasado la noche en meditación." };
      }
      case "robar": {
        if (t.protection !== null) {
          p.corr = clamp(p.corr + 4, 0, 100);
          p.virtue = clamp(p.virtue - 3, 0, 100);
          return { text: t.name + " estaba protegida o protegido: te retiras antes de que te vean.", log: "Un intento de robo contra " + t.name + " ha fracasado." };
        }
        if (!r.success) {
          p.corr = clamp(p.corr + 6, 0, 100);
          p.virtue = clamp(p.virtue - 8, 0, 100);
          return { text: "Te han descubierto. Todos sabrán que intentaste robar a " + t.name + ".", log: p.name + " ha intentado robar a " + t.name + " y todos lo saben." };
        }
        if (!t.items.length) {
          p.corr = clamp(p.corr + 3, 0, 100);
          return { text: "Le registras los bolsillos a " + t.name + ": pelusa, un botón y cero objetos. La noche se ha desperdiciado.", log: "Alguien ha registrado las pertenencias de " + t.name + "." };
        }
        const idx = rnd(t.items.length);
        const it = t.items.splice(idx, 1)[0];
        p.items.push(it);
        p.stolen.push({ fromName: t.name, item: it.id });
        const gain = 8 - (hasPassive(p, "stealDiscount") ? 4 : 0);
        p.corr = clamp(p.corr + gain, 0, 100);
        p.virtue = clamp(p.virtue - 4, 0, 100);
        t.notes.push("Ronda " + state.round + ": alguien te ha robado " + itemName(it.id) + ".");
        return { text: "Robas " + itemName(it.id) + " a " + t.name + ". La oscuridad te marca.", log: "A " + t.name + " le falta " + itemName(it.id) + "." };
      }
      case "hechizar": {
        if (r.success) {
          t.corr = clamp(t.corr + 6, 0, 100);
          const clue = makeClue(t, 2 + (r.crit ? 1 : 0)); if (clue) p.clues.push(clue);
          const gain = 10 - (hasPassive(p, "spellDiscount") ? 4 : 0);
          p.corr = clamp(p.corr + gain, 0, 100);
          p.virtue = clamp(p.virtue - 3, 0, 100);
          t.notes.push("Ronda " + state.round + ": una magia prohibida te ha marcado.");
          return { text: "Marcas a " + t.name + " con magia prohibida. Obtienes una pista fuerte. La oscuridad te marca.", log: "Una magia prohibida ha dejado marca en " + t.name + "." };
        }
        p.corr = clamp(p.corr + 8, 0, 100);
        p.virtue = clamp(p.virtue - 5, 0, 100);
        const hres = damage(p, 3, { src: "magia" });
        return { text: "La magia se vuelve contra ti y te hiere" + hitNote(hres) + ".", log: "Alguien ha perdido el control de una magia prohibida." };
      }
      case "apostar": {
        const s = stake || D.STAKES[1];
        if (r.success) {
          const got = [];
          for (let i = 0; i < s.items; i++) { const it = pick(D.DARK_ITEMS); p.items.push(mkItem(it)); got.push(itemName(it)); }
          const seen = [];
          const possible = others(p);
          for (let i = 0; i < s.clues && possible.length; i++) { const o = pick(possible); const clue = makeClue(o, 2); if (clue) { p.clues.push(clue); seen.push(o.name); } }
          p.virtue = clamp(p.virtue + s.virtue, 0, 100);
          let txt = "El Umbral paga. Ganas " + (got.length ? got.join(", ") : "nada material") + ".";
          if (seen.length) txt += " Pistas sobre " + seen.join(" y ") + ".";
          txt += " +" + s.virtue + " virtud.";
          return { text: txt, log: "Alguien ha apostado contra el Umbral y ha ganado." };
        }
        p.corr = clamp(p.corr + s.failCorr, 0, 100);
        const ares = s.wound ? damage(p, s.wound * 3, { src: "gen" }) : null;
        return { text: "El Umbral cobra su precio" + (ares ? " y te hiere" + hitNote(ares) + "." : "."), log: "Alguien ha apostado contra el Umbral y ha perdido." };
      }
      case "ceder": {
        const openStats = ["cuerpo", "mente", "sombra"].filter(function (k) { return p.stats[k] < MAX_STAT; });
        const stat = openStats.length ? pick(openStats) : null;
        if (stat) p.stats[stat] += 1;
        p.corr = clamp(p.corr + 14, 0, 100);
        p.virtue = clamp(p.virtue - 2, 0, 100);
        let woundTxt = "";
        if (p.hp > 4) { const cres = damage(p, 2, { src: "gen" }); woundTxt = " El poder te hiere" + hitNote(cres) + "."; }
        const it = pick(D.DARK_ITEMS);
        p.items.push(mkItem(it));
        let transformation = "";
        if (state.assassinId === null && p.corr >= 14) {
          state.assassinId = p.id;
          p.alignment = "asesino"; p.asesinoRound = state.round; p.asesinoVia = "ceder";
          transformation = " El Umbral te reclama: te conviertes en el Asesino. Tu objetivo es eliminar a los demás sin ser derrotado.";
        }
        return { text: "Cedes. " + (stat ? "Tu " + stat + " aumenta (+1) y recibes " : "Tus atributos ya están al máximo; recibes ") + itemName(it) + ". El poder deja su marca." + woundTxt + transformation, log: transformation ? p.name + " ha aceptado voluntariamente convertirse en el Asesino." : "La marca de alguien se ha intensificado." };
      }
      case "resistir": {
        p.virtue = clamp(p.virtue + 8, 0, 100);
        p.corr = clamp(p.corr - 6, 0, 100);
        p.focus += 1;
        return { text: p.corr <= 3 ? "Resistes una tentación que ni siquiera habías notado. Mérito dudoso, pero +8 virtud y +1 foco igualmente." : "Resistes. +8 virtud, la oscuridad se aleja un poco y +1 foco para tu próxima tirada.", log: "Alguien ha rechazado un susurro." };
      }
      case "cazar": {
        if (!isAssassin(p)) return { text: "La caza no responde a tu voluntad.", log: null };
        if (p.huntBlocked) {
          p.huntBlocked = false; r.success = false; r.crit = false; r.blocked = true;
          return { text: "La asamblea te vigila tras la acusación: no te atreves a salir esta noche. Pierdes la caza.", log: null };
        }
        if (r.success) {
          const hres = damage(t, huntDamage(), { src: "cazar" });
          t.notes.push("Ronda " + state.round + ": una sombra te atacó durante la noche" + (hres.died ? hitNote(hres) : " y te hirió" + hitNote(hres)) + ".");
          return { text: "La caza alcanza a " + t.name + (hres.died ? ", que ya estaba moribundo: queda eliminada o eliminado." : hres.dying ? ": cae moribundo." : (hres.zone ? " " + ZONE_IN[hres.zone] + ": queda " + visibleHealth(t).split(" · ")[0].toLowerCase() + "." : ".")), log: null };
        }
        p.corr = clamp(p.corr + 3, 0, 100);
        p.virtue = clamp(p.virtue - 2, 0, 100);
        t.notes.push("Ronda " + state.round + ": oíste algo acechando cerca, pero no lograste distinguir quién era.");
        return { text: "Tu presa escapa. La caza deja un rastro.", log: null };
      }
      case "apunalar": {
        if (r.success) {
          const ares = damage(t, r.crit ? rr(4, 5) : rr(2, 4), { src: "apunalar" });
          if (r.crit) bleed(t, 2);
          t.notes.push("Ronda " + state.round + ": alguien te hirió con un arma blanca" + hitNote(ares) + ".");
          return { text: "Hieres a " + t.name + (ares.zone ? " " + ZONE_IN[ares.zone] : "") + " (−" + ares.dealt + " de vitalidad)." + (hasStatus(t, "sangrado") ? " La herida sangra." : "") + (t.dead ? " Cae, eliminado." : t.dying ? " Cae moribundo." : ""), log: null };
        }
        p.corr = clamp(p.corr + 2, 0, 100);
        t.notes.push("Ronda " + state.round + ": pasos apresurados en la oscuridad, pero nadie te alcanzó.");
        return { text: "Tu golpe no alcanza a " + t.name + ": has apuñalado el aire con mucho estilo, pero solo el aire.", log: null };
      }
      case "envenenar": {
        if (r.success) {
          giveStatus(t, "veneno", 2);
          t.notes.push("Ronda " + state.round + ": un sabor amargo y una debilidad creciente.");
          return { text: "Envenenas a " + t.name + ". El veneno le durará dos rondas.", log: null };
        }
        return { text: "El veneno se derrama antes de llegar a " + t.name + ".", log: null };
      }
      case "maldecir": {
        if (r.success) {
          giveStatus(t, "maldito", 2);
          t.notes.push("Ronda " + state.round + ": una maldición pesa sobre tus manos y tu mente.");
          return { text: "Maldices a " + t.name + ". Sufrirá -1 en sus tiradas durante dos rondas.", log: null };
        }
        p.corr = clamp(p.corr + 2, 0, 100);
        return { text: "La maldición se rompe en tus labios.", log: null };
      }
      case "aturdir": {
        if (r.success) {
          if (!t.acted) {
            /* Aún le toca esta ronda: pierde ese turno. */
            t.acted = true;
            state.chronicle.push({ round: state.round, text: "✖ " + t.name + " pierde su turno de esta ronda." });
            t.notes.push("Ronda " + state.round + ": un golpe seco te deja sin turno.");
            return { text: t.name + " pierde su turno de esta ronda.", log: null };
          }
          giveStatus(t, "aturdido", 1);
          t.notes.push("Ronda " + state.round + ": un golpe seco te deja sin sentido un instante.");
          return { text: t.name + " queda aturdida o aturdido: perderá su próximo turno.", log: null };
        }
        return { text: t.name + " esquiva el golpe.", log: null };
      }
      case "devorar": {
        if (isAssassin(p) && isAssassin(t)) {
          p.virtue = clamp(p.virtue - 2, 0, 100);
          t.notes.push("Ronda " + state.round + ": alguien intentó morderte, pero tu carne le repugnó.");
          return { text: "Le hincas el diente a " + t.name + " y descubres que la carne de un caníbal sabe a caníbal. Escupes. Tu orgullo profesional queda herido.", log: null };
        }
        if (r.success) {
          const loot = t.items.slice();
          p.items = p.items.concat(loot);
          t.items = [];
          finish(t, "devorado", true);
          t.notes.push("Ronda " + state.round + ": alguien te devoró.");
          const hh = heal(p, 3);
          p.corr = clamp(p.corr + 6, 0, 100);
          p.virtue = clamp(p.virtue - 6, 0, 100);
          const openSt = ["cuerpo", "mente", "sombra"].filter(function (k) { return p.stats[k] < MAX_STAT; });
          const st = openSt.length ? pick(openSt) : null;
          if (st) p.stats[st] += 1;
          let conv = "";
          if (!isAssassin(p)) {
            p.alignment = "asesino"; p.asesinoRound = state.round; p.asesinoVia = "devorar";
            if (state.assassinId === null) state.assassinId = p.id;
            conv = " Has cruzado la línea: ahora eres un Asesino.";
          }
          state.chronicle.push({ round: state.round, text: "✖ " + t.name + " ha sido devorado." });
          return { text: "Devoras a " + t.name + ": heredas " + (loot.length ? loot.length + " objeto(s)" : "nada") + (hh > 0 ? ", recuperas " + hh + " de vitalidad" : "") + " y pierdes 6 de virtud; la oscuridad te marca" + (st ? " y +1 " + st : "") + "." + conv, log: null };
        }
        const dres = damage(p, 3, { src: "gen" });
        p.corr = clamp(p.corr + 4, 0, 100);
        return { text: "La carne de " + t.name + " te repugna y te dan arcadas: sufres daño" + hitNote(dres) + " y la oscuridad te marca.", log: null };
      }
      case "descansar": {
        p.restedRound = state.round;
        const gone = ["sangrado", "veneno", "infeccion"].filter(function (id) { return hasStatus(p, id); });
        const nothing = p.hp >= maxHp(p) && !gone.length;
        const dh = heal(p, 3);
        p.corr = clamp(p.corr + 3, 0, 100);
        gone.forEach(function (id) { dropStatus(p, id); });
        easeHands(p, 2);
        if (!nothing) p.healRound = state.round;
        const goneTxt = gone.length ? " Se va" + (gone.length > 1 ? "n" : "") + " " + gone.map(function (id) { return id === "infeccion" ? "la infección" : id === "sangrado" ? "el sangrado" : "el veneno"; }).join(", ").replace(/, ([^,]*)$/, " y $1") + "." : "";
        return { text: nothing ? "Te vendas una herida que no tienes. Muy aparatoso y poco útil, pero el alivio deja su marca igualmente." : "Vendas las heridas y te recuperas" + (dh > 0 ? " (+" + dh + " de vitalidad)" : "") + "." + goneTxt + " El alivio deja su marca en ti.", log: null };
      }
      case "tender": {
        hands().push({ from: p.id, to: t.id, mode: stake, status: "offered", round: state.round });
        if (stake === "trampa") p.corr = clamp(p.corr + 5, 0, 100);
        return { text: "Tiendes la mano a " + t.name + " en secreto. Solo " + t.name + " lo sabrá. " + (stake === "trampa" ? "Tu sonrisa esconde algo." : "Tu gesto es sincero."), log: null };
      }
      case "socorrer": {
        if (!t.dying) return { text: t.name + " ya no necesita socorro.", log: null };
        if (r.success) {
          stabilize(t);
          p.virtue = clamp(p.virtue + 5, 0, 100);
          t.notes.push("Ronda " + state.round + ": " + p.name + " te socorrió y te sacó del borde de la muerte. Sigues con vida, muy débil.");
          state.chronicle.push({ round: state.round, text: "Alguien ha socorrido a " + t.name + ": sigue con vida." });
          return { text: "Estabilizas a " + t.name + ": respira de nuevo, aunque muy débil. +5 virtud.", log: null };
        }
        return { text: "No consigues estabilizar a " + t.name + ". Sigue moribundo y aún queda poco tiempo.", log: null };
      }
      case "entrenar": {
        giveStatus(p, "fortalecido", 2);
        return { text: "Entrenas con rabia contenida. Fortalecido durante dos rondas (+1 a tus tiradas).", log: null };
      }
      default:
        return { text: "No ocurre nada.", log: null };
    }
  }

  function pushLuck(actorId) {
    if (!state || state.phase !== "private" || state.handoff || state.turn !== actorId || !state.pendingPush || state.pendingPush.actorId !== actorId) return err("No hay una apuesta pendiente válida para este turno.");
    const pp = state.pendingPush;
    const p = state.players[actorId];
    if (!p || p.dead || p.dying) return err("Este jugador ya no puede forzar el destino.");
    const r = rollCheck(p, pp.attr, pp.diff + 1);
    let text;
    if (r.success) {
      switch (pp.actionId) {
        case "investigar": {
          const t = state.players[pp.targetId];
          if (!t || t.dead) { text = "El rastro se ha perdido; no hay pista adicional."; break; }
          const clue = makeClue(t, 2); if (clue) p.clues.push(clue);
          p.virtue = clamp(p.virtue + 2, 0, 100);
          text = "El Umbral te concede otra visión sobre " + t.name + ". Pista adicional.";
          break;
        }
        case "robar": {
          const t = state.players[pp.targetId];
          if (t && !t.dead && t.items.length) {
            const it = t.items.splice(rnd(t.items.length), 1)[0];
            p.items.push(it);
            text = "Consigues un segundo objeto: " + itemName(it.id) + ".";
          } else { p.corr = clamp(p.corr + 3, 0, 100); text = "No queda nada que robar."; }
          break;
        }
        case "hechizar": {
          const t = state.players[pp.targetId];
          if (!t || t.dead) { text = "El objetivo ya no está en juego; la marca se disipa."; break; }
          t.corr = clamp(t.corr + 4, 0, 100);
          const clue = makeClue(t, 2); if (clue) p.clues.push(clue);
          text = "La marca se profundiza. " + t.name + " se mancha de oscuridad y tú otra pista.";
          break;
        }
        case "explorar": {
          const it = pick(D.LOOT_ITEMS);
          p.items.push(mkItem(it));
          text = "Encuentras un escondite: " + itemName(it) + ".";
          break;
        }
        case "apostar": {
          const it = pick(D.DARK_ITEMS);
          p.items.push(mkItem(it));
          const possible = others(p);
          const o = possible.length ? pick(possible) : null;
          if (o) { const clue = makeClue(o, 2); if (clue) p.clues.push(clue); }
          p.virtue = clamp(p.virtue + 4, 0, 100);
          text = "El Umbral dobla el pago: " + itemName(it) + (o ? " y una pista sobre " + o.name + "." : ".");
          break;
        }
        default:
          p.virtue = clamp(p.virtue + 5, 0, 100);
          text = "El Umbral te sonríe (+5 virtud).";
      }
    } else {
      p.corr = clamp(p.corr + 10, 0, 100);
      const pres = damage(p, 3, { src: "gen" });
      text = "El Umbral cobra su precio y te hiere" + hitNote(pres) + ".";
    }
    state.pendingPush = null;
    checkTerminal();
    save();
    return { ok: true, die: r.die, stat: r.stat, focus: r.focus, total: r.total, diff: r.diff, crit: r.crit, fumble: r.fumble, success: r.success, outcome: text, pushed: true };
  }

  /* ---------- objetos ---------- */
  function useItem(playerId, index, targetId) {
    if (!state || state.phase !== "private") return err("Ahora no puedes usar objetos.");
    if (state.turn !== playerId) return err("No es tu turno.");
    const p = state.players[playerId];
    if (!p || p.dead) return err("Este jugador ya no puede usar objetos.");
    if (p.dying) return err("Estás moribundo: no puedes usar objetos.");
    if (p.usedItem) return err("Ya has usado un objeto esta ronda.");
    const it = p.items[index];
    if (!it) return err("Ese objeto no existe.");
    const def = D.ITEMS[it.id];
    if (!def) return err("Objeto desconocido.");
    let msg = "";
    switch (def.kind) {
      case "defense": p.roundDefense += def.value; msg = "+" + def.value + " defensa esta ronda."; break;
      case "attack": p.roundAttack += def.value; msg = "+" + def.value + " ataque esta ronda."; break;
      case "heal": {
        if (p.hp >= maxHp(p) && !hasStatus(p, "sangrado")) return err("No tienes heridas que curar.");
        const h = heal(p, 4); const sg = hasStatus(p, "sangrado"); dropStatus(p, "sangrado");
        msg = (h > 0 ? "+" + h + " de vitalidad" : "Vendas la herida") + (sg ? (h > 0 ? " y se corta el sangrado." : ": se corta el sangrado.") : "."); break;
      }
      case "focus": p.focus += def.value; msg = "+" + def.value + " foco."; break;
      case "corruption":
        p.corr = clamp(p.corr + def.value, 0, 100);
        if (def.stat && p.stats[def.stat] < MAX_STAT) p.stats[def.stat] += 1;
        msg = "Algo oscuro te recorre: +1 " + def.stat + "."; break;
      case "virtue": p.virtue = clamp(p.virtue + def.value, 0, 100); msg = "+" + def.value + " virtud."; break;
      case "clue": {
        const t = state.players[targetId];
        if (!t || t.id === p.id || t.dead) return err("Elige a otro jugador que siga en la partida.");
        { const cl = makeClue(t, def.value); if (cl) p.clues.push(cl); } msg = "Obtienes una pista sobre " + t.name + "."; break;
      }
      case "reveal": {
        const possible = others(p);
        if (!possible.length) return err("No hay otro jugador en pie sobre quien obtener una pista.");
        const t = pick(possible);
        const clue = makeClue(t, 2); if (clue) p.clues.push(clue); msg = "El mapa revela algo sobre " + t.name + "."; break;
      }
      case "reflect": p.reflect = true; msg = "Un reflejo plateado te envuelve. La próxima agresión directa rebotará."; break;
      case "ward": p.ward = true; msg = "Una ceniza invisible te envuelve."; break;
      case "cleanse": dropStatus(p, "sangrado"); dropStatus(p, "veneno"); dropStatus(p, "infeccion"); dropStatus(p, "maldito"); easeHands(p, 99); msg = "Te sientes más limpio por dentro."; break;
      case "purify": p.corr = clamp(p.corr - def.value, 0, 100); p.virtue = clamp(p.virtue + 2, 0, 100); msg = "Algo oscuro se aparta de ti."; break;
      case "dust": {
        const dt = state.players[targetId];
        if (!dt || dt.id === p.id || dt.dead) return err("Elige a otro jugador que siga en la partida.");
        if (dt.reflect) { dt.reflect = false; giveStatus(p, "maldito", 1); msg = "El polvo rebota en un reflejo y te nubla la vista a ti."; }
        else { giveStatus(dt, "maldito", 1); dt.notes.push("Ronda " + state.round + ": un polvo cegador te nubló la vista."); msg = dt.name + " queda con la vista nublada."; }
        break;
      }
      case "elixir": { const eh = heal(p, 3); giveStatus(p, "fortalecido", 2); msg = "Tu cuerpo se renueva y se llena de vigor" + (eh > 0 ? " (+" + eh + " de vitalidad)." : "."); break; }
      case "ritual": p.focus = Math.min(2, p.focus + 1); p.virtue = clamp(p.virtue + 3, 0, 100); msg = "La llama negra te serena: +1 foco y +3 virtud."; break;
      case "fog": p.fog = (p.fog || 0) + 2; msg = "La niebla te cubre; costará leerte."; break;
      case "rune": {
        const rs = (p.spells || []).slice().sort(function (x, y) { return x.uses - y.uses; })[0];
        if (!rs) return err("No conoces ningún conjuro.");
        rs.uses += 1; msg = "Tu conjuro «" + rs.name + "» gana un uso."; break;
      }
      case "tome": return err("Estudia el grimorio para aprender un conjuro.");
      case "shield": p.shield = true; msg = "Una coartada te protegerá de la próxima acusación."; break;
      default: return err("Ese objeto no se puede usar ahora.");
    }
    if (it.id !== "daga") p.items.splice(index, 1);
    p.usedItem = true;
    save();
    return { ok: true, msg: msg };
  }

  /* ---------- flujo de turnos ---------- */
  function finishTurn() {
    if (!state) return;
    if (checkTerminal()) return;
    const current = state.players[state.turn];
    if (current && !current.dead && !current.acted) return err("Debes resolver tu acción antes de entregar el turno.");
    state.handoff = true;
    state.pendingPush = null;
    save();
  }

  function nextTurn() {
    if (!state) return "none";
    if (checkTerminal()) return "ending";
    if (timeUp()) { forceEnd(); return "ending"; }
    const current = state.players[state.turn];
    if (current && !current.dead && !current.acted) { state.handoff = false; return "blocked"; }
    state.handoff = false;
    state.pendingPush = null;
    const ord = state.order || state.players.map(function (p) { return p.id; });
    let next = ord.indexOf(state.turn) + 1;
    while (next < ord.length && (state.players[ord[next]].dead || state.players[ord[next]].acted)) next++;
    if (next >= ord.length) { const opened = beginCouncil(); return opened && opened.ok === false ? "blocked" : "council"; }
    state.turn = ord[next];
    save();
    return "private";
  }

  /* ---------- consejo ---------- */
  /* La Sombra: mientras no haya Asesino, desde la ronda 3 la oscuridad ataca sola, igual que Cazar,
     para que los jugadores crean que hay uno. Es un secreto: solo se revela en el desenlace. */
  function shadowMimics() { return !!(state.shadow && state.shadow.strikes > 0 && assassinsOf().length === 0); }
  function shadowStrike() {
    if (state.round < lateRound() || assassinsOf().length) return;
    const sh = state.shadow = state.shadow || { strikes: 0, last: null };
    let pool = state.players.filter(function (p) { return !p.dead; });
    if (pool.length > 1) pool = pool.filter(function (p) { return p.id !== sh.last; });
    if (pool.some(function (p) { return !p.dying; })) pool = pool.filter(function (p) { return !p.dying; });
    if (!pool.length) return;
    const t = pick(pool);
    sh.last = t.id; sh.strikes += 1;
    const dFocus = t.focus > 0 ? t.focus : 0;
    if (dFocus) t.focus = 0;
    const defBonus = t.stats.cuerpo + Math.floor(t.stats.mente / 2) + t.roundDefense + dFocus + statusMod(t) +
      (hasPassive(t, "defenseBonus") ? 2 : 0) + (t.protection !== null ? 2 : 0) - t.wounds - legPen(t);
    const r = rollRaw(3, d6() + defBonus);
    if (r.success) {
      const sres = damage(t, rr(4, 6), { src: "cazar" });
      t.notes.push("Ronda " + state.round + ": una sombra te atacó durante la noche" + (sres.died ? hitNote(sres) : " y te hirió" + hitNote(sres)) + ".");
    } else {
      t.notes.push("Ronda " + state.round + ": oíste algo acechando cerca, pero no lograste distinguir quién era.");
    }
  }

  function beginCouncil() {
    if (timeUp()) { forceEnd(); return state; }
    if (!state || state.phase !== "private" || state.players.some(function (p) { return !p.dead && !p.acted; })) return err("No puede abrirse el Consejo hasta que todos los supervivientes hayan actuado.");
    shadowStrike();
    if (checkTerminal()) return state;
    state.phase = "council";
    state.turn = 0;
    state.handoff = false;
    state.council = { interactions: [], ambushes: [], used: {} };
    state.players.forEach(function (p) {
      state.council.used[p.id] = { accuse: 0, pact: 0, plot: 0, reveal: 0 };
    });
    save();
    return state;
  }

  function councilPrompt() {
    const exposed = assassinsOf().filter(function (p) { return p.exposed && !p.dead; });
    if (exposed.length) return (exposed.length > 1 ? "Los Asesinos han sido identificados: " : "El Asesino ha sido identificado: ") + exposed.map(function (p) { return p.name; }).join(", ") + ". Los supervivientes pueden unirse para detenerle; ya no hay secretos que proteger.";
    return ""; /* Sin mensaje de ambiente: solo se muestra información que cambia lo que puedes hacer. */
  }

  function registerInteraction(actorId, type, targetId, targetAccepted) {
    if (!state || state.phase !== "council") return err("El consejo no está abierto.");
    if (!state.council || !state.council.used) return err("El Consejo no está preparado.");
    const allowed = ["pacto_no_agresion", "pacto_silencio", "pacto_proteccion", "amenaza", "revelar", "acusacion", "emboscada", "romper"];
    if (allowed.indexOf(type) === -1) return err("Interacción desconocida.");
    const actor = state.players[actorId];
    const target = state.players[targetId];
    if (!actor || !target || actor.id === target.id || actor.dead || target.dead) return err("Elige a dos jugadores que sigan en juego.");
    if (actor.dying) return err(actor.name + " está moribundo y no puede intervenir en el Consejo.");
    const used = state.council.used[actor.id];
    if (!used) return err("Jugador desconocido.");

    const isPact = type.indexOf("pacto_") === 0;
    if (isPact && target.dying) return err(target.name + " está moribundo y no puede aceptar un pacto.");
    if (isPact && targetAccepted !== true) return err("El pacto no se ha registrado: " + target.name + " no lo ha aceptado expresamente.");
    const isPlot = type === "amenaza" || type === "emboscada";
    if (type === "amenaza" && state.round >= maxRounds()) return err("En la última ronda ya no hay mañana: la amenaza no tendría efecto.");
    if (isPact && used.pact >= 1) return err(actor.name + " ya ha sellado un pacto en este consejo.");
    if (type === "acusacion" && used.accuse >= 1) return err(actor.name + " ya ha acusado en este consejo.");
    if (isPlot && used.plot >= 1) return err(actor.name + " ya ha tramado algo en este consejo.");
    if (type === "revelar" && used.reveal >= 1) return err(actor.name + " ya ha presentado una prueba.");

    if (type === "emboscada" && actor.dead) return err("Un jugador eliminado no puede actuar.");
    let brokenHand = null;
    if (type === "romper") {
      brokenHand = hands().find(function (x) { return x.status === "active" && x.from === target.id && x.to === actor.id; });
      if (!brokenHand) return err(actor.name + " no ha recibido ninguna mano de " + target.name + " que pueda romper.");
      if ((used.brk || 0) >= 1) return err(actor.name + " ya ha roto un silencio en este consejo.");
    }
    if (type === "revelar" && !actor.clues.some(function (c) { return c.about === target.id; })) return err("No tienes pruebas sobre " + target.name + ".");

    let result = { ok: true, kind: "text", text: "", log: null };
    const entry = { actor: actor.id, type: type, target: target.id };

    if (isPact) {
      used.pact += 1;
      actor.pactsSealed = (actor.pactsSealed || 0) + 1; target.pactsSealed = (target.pactsSealed || 0) + 1;
      const finalRound = state.round >= maxRounds();
      state.pacts.push({
        a: actor.id, b: target.id, type: type, round: state.round,
        expires: finalRound ? state.round : state.round + 1, done: finalRound, accepted: true
      });
      const label = type === "pacto_proteccion" ? "protección" : type === "pacto_silencio" ? "silencio" : "no agresión";
      if (finalRound) {
        actor.virtue = clamp(actor.virtue + 4, 0, 100);
        target.virtue = clamp(target.virtue + 4, 0, 100);
        actor.keptPacts += 1;
        target.keptPacts += 1;
        result.text = "Pacto de " + label + " sellado entre " + actor.name + " y " + target.name +
          ". En la última ronda se sella de inmediato: +4 virtud para ambos.";
      } else {
        result.text = "Pacto de " + label + " sellado entre " + actor.name + " y " + target.name +
          ". Se evaluará al final de la próxima ronda.";
      }
      result.log = actor.name + " y " + target.name + " han sellado un pacto de " + label + ".";
    } else if (type === "amenaza") {
      used.plot += 1;
      target.virtue = clamp(target.virtue - 4, 0, 100);
      actor.corr = clamp(actor.corr + 5, 0, 100);
      actor.virtue = clamp(actor.virtue - 3, 0, 100);
      state.threats.push({ from: actor.id, to: target.id, round: state.round, done: false });
      result.text = actor.name + " amenaza a " + target.name + " en público. " + target.name + " pierde 4 virtud; " + actor.name + " se mancha de oscuridad.";
      result.log = actor.name + " ha amenazado a " + target.name + " en público.";
    } else if (type === "revelar") {
      const clue = actor.clues.filter(function (c) { return c.about === target.id; }).sort(function (x, y) { return y.strength - x.strength; })[0];
      if (!clue) return err("No tienes ninguna pista sobre " + target.name + " que presentar.");
      used.reveal += 1;
      state.publicClues.push({ round: state.round, text: testimony(actor, clue.text), about: target.id });
      actor.virtue = clamp(actor.virtue + 2, 0, 100);
      result.text = "Presentas una prueba contra " + target.name + ": «" + clue.text + "»";
      result.log = actor.name + " ha presentado una prueba contra " + target.name + ".";
    } else if (type === "acusacion") {
      used.accuse += 1;
      const res = resolveAccusation(actor, target);
      result.kind = "roll";
      result.roll = res.roll;
      result.text = res.text;
      result.log = res.log;
      result.revealedAssassin = !!res.revealedAssassin;
      entry.resolved = true;
    } else if (type === "emboscada") {
      used.plot += 1;
      const res = resolveAmbush(actor, target);
      state.council.ambushes.push({ attacker: actor.id, target: target.id, success: res.success });
      result.kind = "roll";
      result.roll = res.roll;
      result.duel = res.duel;
      result.text = res.text;
      result.log = res.log;
      entry.resolved = true;
    } else if (type === "romper") {
      used.brk = (used.brk || 0) + 1;
      brokenHand.status = "broken";
      brokenHand.stacks = 0;
      dropStatus(actor, "fortalecido");
      actor.virtue = clamp(actor.virtue - 4, 0, 100);
      if (brokenHand.mode === "sincera") target.virtue = clamp(target.virtue + 2, 0, 100);
      target.notes.push("Ronda " + state.round + ": " + actor.name + " rompió su silencio ante todos.");
      actor.notes.push("Ronda " + state.round + ": rompiste tu promesa. La ventana se cerró.");
      result.kind = "text";
      result.text = actor.name + " rompe su silencio y afirma que " + target.name + " le tendió la mano. Nadie puede comprobarlo.";
      result.log = actor.name + " rompe su silencio: dice que " + target.name + " le tendió la mano.";
      entry.resolved = true;
    } else {
      return err("Interacción desconocida.");
    }

    state.council.interactions.push(entry);
    if (result.log) state.chronicle.push({ round: state.round, text: result.log });
    save();
    return result;
  }

  function resolveAccusation(actor, target) {
    const clues = actor.clues.filter(function (c) { return c.about === target.id; });
    let evidence = clues.reduce(function (s, c) { return s + c.strength; }, 0);
    if (hasPassive(actor, "evidenceBonus")) evidence += 1;
    if (actor.focus) { evidence += actor.focus; actor.focus = 0; }
    const shielded = !!target.shield;
    const diff = Math.max(2, 6 - Math.floor(target.corr / 20));
    const r = rollRaw(evidence, diff);
    if (shielded) {
      target.shield = false;
      r.success = false; r.crit = false; r.shielded = true;
    }

    const isAss = isAssassin(target);
    if (r.success && isAss) {
      target.corr = clamp(target.corr + 6, 0, 100);
      target.virtue = clamp(target.virtue - 6, 0, 100);
      actor.virtue = clamp(actor.virtue + 4, 0, 100);
      actor.successfulAccusations += 1;
      const best = clues.slice().sort(function (a, b) { return b.strength - a.strength; })[0];
      if (best) state.publicClues.push({ round: state.round, text: testimony(actor, best.text), about: target.id });
      state.assassinExposed = true;
      target.exposed = true;
      target.huntBlocked = true;
      target.notes.push("Ronda " + state.round + ": " + actor.name + " te acusó y la asamblea te identificó como Asesino.");
      return {
        success: true, roll: r, revealedAssassin: true,
        text: "La acusación da en el blanco. " + target.name + " es el Asesino. Su identidad queda revelada y no podrá cazar la próxima ronda.",
        log: actor.name + " ha desenmascarado al Asesino: " + target.name + "."
      };
    }
    if (r.success && !isAss) {
      r.success = false; r.crit = false; r.falseAccusation = true;
    }
    actor.corr = clamp(actor.corr + 5, 0, 100);
    actor.virtue = clamp(actor.virtue - 5, 0, 100);
    target.virtue = clamp(target.virtue + 2, 0, 100);
    if (!isAss) state.falseAccusations = (state.falseAccusations || 0) + 1;
    target.notes.push("Ronda " + state.round + ": " + actor.name + " te acusó sin demostrar que fueras el Asesino.");
    return {
      success: false, roll: r, revealedAssassin: false,
      text: r.falseAccusation
        ? "La prueba parecía convincente, pero has señalado a un inocente. La sospecha recae sobre ti."
        : (shielded ? "La coartada de " + target.name + " absorbe la acusación: estaba escrita con tan buena letra que da vergüenza discutirla. La sospecha recae sobre ti." : "Tus pruebas no convencen a la asamblea. La duda cae sobre ti."),
      log: actor.name + " acusó a " + target.name + ", pero no logró desenmascarar al Asesino."
    };
  }

  function resolveAmbush(actor, target) {
    const atkFocus = actor.focus > 0 ? actor.focus : 0;
    const defFocus = target.focus > 0 ? target.focus : 0;
    if (atkFocus) actor.focus = 0;
    if (defFocus) target.focus = 0;
    const atkBonus = actor.stats.cuerpo + Math.floor(actor.stats.sombra / 2) + actor.roundAttack + atkFocus + statusMod(actor) +
      (actor.corr >= 40 ? 2 : 0) + (hasPassive(actor, "attackBonus") ? 1 : 0) - actor.wounds - armPen(actor);
    const defBonus = target.stats.cuerpo + Math.floor(target.stats.mente / 2) + target.roundDefense + defFocus + statusMod(target) +
      (hasPassive(target, "defenseBonus") ? 2 : 0) + (target.protection !== null ? 2 : 0) - target.wounds - legPen(target);
    const a = rollRaw(atkBonus, 0);
    const d = rollRaw(defBonus, 0);
    const attackerWins = !!target.dying || a.total > d.total || (a.total === d.total && a.die > d.die);

    const duel = { attacker: { die: a.die, bonus: atkBonus, total: a.total, name: actor.name }, defender: { die: d.die, bonus: defBonus, total: d.total, name: target.name } };

    if (attackerWins) {
      let loot = "";
      if (target.items.length) {
        const it = target.items.splice(rnd(target.items.length), 1)[0];
        actor.items.push(it);
        loot = " Le arrebata " + itemName(it.id) + ".";
        target.notes.push("Ronda " + state.round + ": " + actor.name + " te emboscó y te quitó " + itemName(it.id) + ".");
      } else {
        target.notes.push("Ronda " + state.round + ": " + actor.name + " te emboscó.");
      }
      const wasDying = !!target.dying;
      const ares = damage(target, (isAssassin(actor) || isAssassin(target)) ? rr(5, 6) : rr(3, 4), {});
      if (target.dead) {
        target.notes.push("Ronda " + state.round + ": has caído y quedas fuera de la partida.");
      }
      actor.corr = clamp(actor.corr + 8, 0, 100);
      actor.virtue = clamp(actor.virtue - 3, 0, 100);
      target.virtue = clamp(target.virtue + 2, 0, 100);
      target.notes.push("Ronda " + state.round + ": " + actor.name + " te emboscó en el Consejo y te hirió" + hitNote(ares) + ".");
      if (target.protection !== null) {
        const prot = state.players[target.protection];
        if (prot) { prot.virtue = clamp(prot.virtue + 5, 0, 100); prot.notes.push("Ronda " + state.round + ": tu protección sobre " + target.name + " no bastó, pero no lo abandonaste."); }
      }
      return {
        success: true, roll: a, duel: duel,
        text: actor.name + " cae sobre " + target.name + "." + loot + " " + target.name + (target.dead ? " ha sido eliminado." : target.dying ? " cae moribundo." : " queda " + visibleHealth(target).split(" · ")[0].toLowerCase() + "."),
        log: target.name + " ha sido emboscado en la oscuridad."
      };
    }
    actor.virtue = clamp(actor.virtue - 8, 0, 100);
    actor.corr = clamp(actor.corr + 6, 0, 100);
    target.virtue = clamp(target.virtue + 4, 0, 100);
    target.notes.push("Ronda " + state.round + ": repeliste la emboscada de " + actor.name + ".");
    return {
      success: false, roll: a, duel: duel,
      text: target.name + " repele la emboscada. " + actor.name + " queda al descubierto.",
      log: actor.name + " tendió una emboscada a " + target.name + " y fracasó. Todos lo han visto."
    };
  }

  function endCouncil() {
    if (!state || state.phase !== "council") return [];
    if (timeUp()) { forceEnd(); return []; }
    const out = [];
    const push = function (t) { out.push(t); state.chronicle.push({ round: state.round, text: t }); };

    state.pacts.forEach(function (pact) {
      if (pact.accepted === false || pact.done || pact.expires !== state.round) return;
      pact.done = true;
      const a = state.players[pact.a];
      const b = state.players[pact.b];
      if (!a || !b || a.dead || b.dead) { pact.done = true; return; }
      const hostileA = HOSTILE.indexOf(a.action) !== -1 && a.actionTarget === b.id;
      const hostileB = HOSTILE.indexOf(b.action) !== -1 && b.actionTarget === a.id;
      const spiedA = a.action === "investigar" && a.actionTarget === b.id;
      const spiedB = b.action === "investigar" && b.actionTarget === a.id;
      const accusedA = state.council.interactions.some(function (i) { return i.actor === a.id && i.target === b.id && (i.type === "acusacion" || i.type === "revelar"); });
      const accusedB = state.council.interactions.some(function (i) { return i.actor === b.id && i.target === a.id && (i.type === "acusacion" || i.type === "revelar"); });
      const attackedB = state.council.ambushes.some(function (x) { return x.target === b.id; });
      const protectedB = b.protection === a.id || (a.action === "proteger" && a.actionTarget === b.id);

      let broken = false;
      let breaker = null;
      if (pact.type === "pacto_no_agresion") {
        if (hostileA || state.council.ambushes.some(function (x) { return x.attacker === a.id && x.target === b.id; })) { broken = true; breaker = a; }
        else if (hostileB || state.council.ambushes.some(function (x) { return x.attacker === b.id && x.target === a.id; })) { broken = true; breaker = b; }
      } else if (pact.type === "pacto_silencio") {
        if (spiedA || accusedA) { broken = true; breaker = a; }
        else if (spiedB || accusedB) { broken = true; breaker = b; }
      } else if (pact.type === "pacto_proteccion") {
        if (attackedB && !protectedB) { broken = true; breaker = a; }
      }

      if (broken && breaker) {
        breaker.corr = clamp(breaker.corr + 8, 0, 100);
        breaker.virtue = clamp(breaker.virtue - 6, 0, 100);
        breaker.betrayals += 1;
        const victim = breaker.id === a.id ? b : a;
        victim.virtue = clamp(victim.virtue + 3, 0, 100);
        victim.notes.push("Ronda " + state.round + ": " + breaker.name + " rompió el pacto que teníais.");
        push("⚔ " + breaker.name + " ha roto el pacto con " + victim.name + ". La traición deja marca.");
      } else {
        a.virtue = clamp(a.virtue + 3, 0, 100);
        b.virtue = clamp(b.virtue + 3, 0, 100);
        a.keptPacts += 1; b.keptPacts += 1;
        push("✦ " + a.name + " y " + b.name + " han respetado su pacto.");
      }
    });

    state.threats.forEach(function (th) {
      if (th.done || th.round !== state.round - 1) return;
      th.done = true;
      const from = state.players[th.from];
      const to = state.players[th.to];
      if (!from || !to || from.dead || to.dead) { th.done = true; return; }
      const attacked = (HOSTILE.indexOf(to.action) !== -1 && to.actionTarget === from.id) ||
        state.council.ambushes.some(function (x) { return x.attacker === to.id && x.target === from.id; });
      if (attacked) {
        to.corr = clamp(to.corr + 8, 0, 100);
        to.virtue = clamp(to.virtue - 8, 0, 100);
        from.virtue = clamp(from.virtue + 4, 0, 100);
        push("⚔ La amenaza de " + from.name + " se cumplió: " + to.name + " pagó por desafiarla.");
      } else {
        from.corr = clamp(from.corr + 4, 0, 100);
        from.virtue = clamp(from.virtue - 3, 0, 100);
        push("La amenaza de " + from.name + " a " + to.name + " quedó en nada: mucho bufido y ningún zarpazo. La sombra se alimenta de la intimidación.");
      }
    });

    const livingPlayers = state.players.filter(function (p) { return !p.dead; });
    if (!state.umbralAbierto && livingPlayers.length && livingPlayers.every(function (p) { return p.corr >= 50; })) {
      state.umbralAbierto = true;
      push("✧ El Umbral se ha abierto: todos habéis cedido. La oscuridad ya no tienta; ahora compite.");
    }

    if (state.round >= lateRound()) {
      state.players.forEach(function (p) {
        if (p.dead) return;
        const sec = D.SECRETS.find(function (s) { return s.id === p.secret.id; });
        if (sec && sec.check(p, state) && p.focus < 2) {
          p.focus += 1;
          p.notes.push("Ronda " + state.round + ": tu secreto se cumple y el Umbral te concede foco (+1).");
        }
      });
    }
    planRounds(false);
    state.lastResolution = out;
    if (checkTerminal()) { /* ya en desenlace */ }
    else { state.phase = "resolution"; }
    save();
    return out;
  }

  function nextRound() {
    if (!state) return null;
    if (timeUp()) return forceEnd();
    planRounds(false);
    if (state.phase === "ending" || state.round >= maxRounds() || state.players.every(function (p) { return p.dead || p.corr >= 85; })) {
      state.phase = "ending";
      state.ending = computeEnding();
      clearSave();
      return state.ending;
    }
    state.round += 1;
    startRound();
    return state.phase === "ending" ? state.ending : null;
  }


  /* ---------- registro de partida (para analizar partidas reales), historia final y resumen entre turnos ---------- */
  function glog(k, o) {
    if (!state) return;
    state.glog = state.glog || [];
    if (state.glog.length >= 2500) return;
    const e = { r: state.round, t: Math.round(playedMs() / 1000), k: k };
    Object.keys(o || {}).forEach(function (x) { e[x] = o[x]; });
    state.glog.push(e);
  }
  function wrapLog(name, fn) {
    return function () {
      const args = Array.prototype.slice.call(arguments);
      const res = fn.apply(null, args);
      try {
        if (state && res && res.ok !== undefined) {
          glog(name, { a: args.map(function (x) { return x === null || x === undefined ? "-" : x; }).join(","), ok: res.ok ? 1 : 0, die: res.die, tot: res.total, dif: res.diff, win: res.success === undefined ? undefined : res.success ? 1 : 0, x: String(res.msg || res.text || res.outcome || "").slice(0, 170), l: res.log ? String(res.log).slice(0, 120) : undefined, n: name === "encounterAct" ? res.action : undefined });
          if ((name === "act" || name === "pushLuck" || name === "encounterAct") && res.ok && args[0] !== undefined && state.players[args[0]]) {
            const p = state.players[args[0]];
            p.lastSeen = { n: p.notes.length, h: p.hp, v: p.virtue };
          }
        }
      } catch (e) { /* el registro nunca debe romper el juego */ }
      return res;
    };
  }
  function noteError(msg) { try { glog("ERROR", { x: String(msg).slice(0, 200) }); } catch (e) { /* nada */ } }
  /* Qué te ha pasado desde tu último turno (según lo que tú puedes saber). */
  function getSince(pid) {
    const p = state && state.players[pid];
    if (!p || !p.lastSeen || p.dead) return null;
    const notes = p.notes.slice(p.lastSeen.n);
    const from = typeof p.lastSeen.h === "number" ? p.lastSeen.h : p.hp;
    if (!notes.length && p.hp === from) return null;
    return { hpFrom: from, hpNow: p.hp, notes: notes.slice(-5), more: Math.max(0, notes.length - 5) };
  }
  const ACT_STORY = {
    investigar: ["{a} siguió el rastro de {t} y reunió una pista", "{a} perdió el rastro de {t}"],
    proteger: ["{a} juró proteger a {t}", "{a} no logró proteger a {t}"],
    explorar: ["{a} registró las ruinas y salió con un botín", "{a} volvió de las ruinas con las manos vacías"],
    meditar: ["{a} pasó la noche meditando", "{a} pasó la noche meditando"],
    robar: ["{a} le robó algo a {t}", "{a} fue descubierto intentando robar a {t}"],
    hechizar: ["{a} marcó a {t} con magia prohibida", "{a} perdió el control de una magia prohibida"],
    apostar: ["{a} apostó contra el Umbral y ganó", "{a} apostó contra el Umbral y perdió"],
    ceder: ["{a} cedió a la tentación", "{a} cedió a la tentación"],
    resistir: ["{a} resistió la tentación", "{a} resistió la tentación"],
    cazar: ["{a} cazó a {t} en la oscuridad", "{t} escapó de la caza de {a}"],
    apunalar: ["{a} apuñaló a {t}", "{a} apuñaló el aire frente a {t}"],
    envenenar: ["{a} envenenó a {t}", "{a} falló al envenenar a {t}"],
    maldecir: ["{a} maldijo a {t}", "{a} falló al maldecir a {t}"],
    aturdir: ["{a} aturdió a {t}", "{a} falló al aturdir a {t}"],
    devorar: ["{a} devoró a {t}", "{a} no pudo con la carne de {t}"],
    descansar: ["{a} descansó y se vendó las heridas", "{a} descansó"],
    entrenar: ["{a} se entrenó", "{a} se entrenó"],
    tender: ["{a} tendió la mano a {t} en secreto", "{a} tendió la mano a {t}"],
    conjurar: ["{a} lanzó un conjuro", "{a} lanzó un conjuro que se torció"]
  };
  function buildStory() {
    if (!state) return [];
    const nm = function (id) { const q = state.players[Number(id)]; return q ? q.name : "alguien"; };
    const out = [];
    const rounds = {};
    (state.glog || []).forEach(function (e) { (rounds[e.r] = rounds[e.r] || []).push(e); });
    const chron = {};
    (state.chronicle || []).forEach(function (c) { (chron[c.round] = chron[c.round] || []).push(c.text); });
    Object.keys(rounds).map(Number).sort(function (a, b) { return a - b; }).forEach(function (r) {
      const parts = [];
      rounds[r].forEach(function (e) {
        if (e.k === "act" && e.ok) {
          const ar = String(e.a).split(","), a = nm(ar[0]), tmpl = ACT_STORY[ar[1]];
          if (tmpl) parts.push(tmpl[e.win === 0 ? 1 : 0].replace("{a}", a).replace("{t}", ar[2] && ar[2] !== "-" ? nm(ar[2]) : "alguien"));
        } else if (e.k === "encounterAct" && e.ok && e.n) {
          const ar = String(e.a).split(",");
          parts.push(nm(ar[0]) + " se topó en las ruinas con " + e.n.toLowerCase() + (ar[1] === "irse" ? " y siguió su camino" : " (optó por «" + ar[1] + "») y " + (e.win === 0 ? "salió mal parado" : "salió airoso")));
        } else if (e.k === "registerInteraction" && e.ok && e.l) parts.push(e.l.replace(/\.$/, ""));
      });
      (chron[r] || []).forEach(function (t) { if (/^[✖⚔✦✧]/.test(t) || /pacto|amenaza/i.test(t)) { const c = t.replace(/^[✖⚔✦✧]\s*/, ""); if (parts.indexOf(c.replace(/\.$/, "")) === -1) parts.push(c.replace(/\.$/, "")); } });
      if (parts.length) out.push({ round: r, text: parts.join(". ").replace(/\.{2,}/g, ".") + "." });
    });
    const ass = state.players.filter(function (p) { return p.asesinoRound; });
    if (ass.length) out.push({ round: null, text: ass.map(function (p) { return p.name + " se convirtió en el Asesino en la ronda " + p.asesinoRound + (p.asesinoVia === "devorar" ? ", tras devorar a otro jugador" : ", al ceder a la tentación"); }).join("; ") + "." });
    return out;
  }
  function exportLog() {
    if (!state) return "";
    const e = state.ending || {};
    const L = [];
    L.push("EL UMBRAL · registro de partida · v0.9.3 · formato 1");
    L.push("fecha: " + new Date().toISOString() + " · duración elegida: " + (state.durationMin || "-") + " min · jugada: " + Math.round(playedMs() / 60000) + " min · rondas: " + state.round + "/" + maxRounds());
    L.push("final: " + (e.title || "(sin final)") + " · ganador: " + (e.winner || "-") + (e.timedOut ? " · TIEMPO AGOTADO" : ""));
    state.players.forEach(function (p) {
      L.push("J" + p.id + " " + p.name + " | " + p.role.name + "/" + p.affinity.name + " | " + (p.alignment === "asesino" ? "ASESINO(r" + p.asesinoRound + ")" : "inocente") + " | vir " + p.virtue + " cor " + p.corr + " vit " + p.hp + "/" + maxHp(p) + (p.dying ? " MORIBUNDO(r" + p.dyingRound + ")" : "") + (p.dead ? " MUERTO(" + (p.cause || "?") + ")" : "") + " | secreto: " + (p.secret && p.secret.id));
    });
    const an = [];
    state.players.forEach(function (p) {
      if (p.hp < 0 || p.hp > maxHp(p) || [p.virtue, p.corr, p.hp].some(function (x) { return typeof x !== "number" || isNaN(x); })) an.push("valores raros en " + p.name + " (vitalidad " + p.hp + "/" + maxHp(p) + ")");
      if (ZONES.some(function (z) { return !(p.zones && p.zones[z] >= 0); })) an.push("zonas corporales raras en " + p.name);
      if (p.dying && state.phase !== "ending" && state.round >= (p.dyingRound || 0) + 3) an.push(p.name + " lleva moribundo desde la ronda " + p.dyingRound + " sin resolverse");
      if (p.dying && p.dead) an.push(p.name + " figura a la vez moribundo y muerto");
      if (p.dying && p.hp !== 0) an.push(p.name + " moribundo con vitalidad " + p.hp);
    });
    const perRound = {};
    (state.glog || []).forEach(function (x) {
      if (x.k === "ERROR") an.push("error de app en ronda " + x.r + ": " + x.x);
      if (x.k === "act" && x.ok) { const key = x.r + ":" + String(x.a).split(",")[0]; perRound[key] = (perRound[key] || 0) + 1; if (perRound[key] > 1) an.push("jugador " + String(x.a).split(",")[0] + " actuó " + perRound[key] + " veces en la ronda " + x.r); }
      if (/undefined|NaN|\[object/.test(String(x.x || "") + String(x.l || ""))) an.push("texto roto en ronda " + x.r + ": " + String(x.x).slice(0, 80));
    });
    if (state.durationMin && playedMs() > state.durationMin * 60000 + 5000) an.push("la partida superó el tiempo elegido");
    L.push("ANOMALÍAS: " + (an.length ? an.join(" | ") : "ninguna detectada"));
    L.push("--- eventos (r=ronda t=seg) ---");
    (state.glog || []).forEach(function (x) {
      L.push("r" + x.r + " t" + x.t + " " + x.k + (x.a !== undefined ? " [" + x.a + "]" : "") + (x.die ? " d" + x.die + "→" + x.tot + "/" + x.dif : "") + (x.win !== undefined ? (x.win ? " OK" : " FALLO") : "") + (x.ok === 0 ? " RECHAZADO" : "") + (x.x ? " «" + x.x + "»" : "") + (x.l ? " (público: " + x.l + ")" : ""));
    });
    L.push("--- crónica pública ---");
    (state.chronicle || []).forEach(function (c) { L.push("r" + c.round + " " + c.text); });
    const txt = L.join("\n");
    try {
      if (typeof localStorage !== "undefined") {
        const key = "umbral_logs", arr = JSON.parse(localStorage.getItem(key) || "[]");
        if (!arr.length || arr[arr.length - 1].id !== state.createdAt) arr.push({ id: state.createdAt, txt: txt }); else arr[arr.length - 1].txt = txt;
        while (arr.length > 4) arr.shift();
        localStorage.setItem(key, JSON.stringify(arr));
      }
    } catch (er) { /* sin almacenamiento */ }
    return txt;
  }
  function lastLogs() { try { return JSON.parse(localStorage.getItem("umbral_logs") || "[]"); } catch (e) { return []; } }

  /* ---------- desenlace ---------- */
  function computeEnding() {
    if (!state || !Array.isArray(state.players) || !state.players.length) {
      return { title: "Sin partida", text: "No hay una partida que resolver.", winner: "draw", players: [], avgCorruption: 0, betrayals: 0, durationMin: 0, publicClues: [] };
    }
    const ps = state.players;
    const betrayals = ps.reduce(function (sum, p) { return sum + p.betrayals; }, 0);
    const avg = Math.round(ps.reduce(function (sum, p) { return sum + p.corr; }, 0) / ps.length);

    let title, text;
    const assassins = ps.filter(isAssassin);
    const names = function (l) { return l.map(function (p) { return p.name; }).join(", "); };
    const alive = ps.filter(function (p) { return !p.dead; });
    let winner = "draw";
    if (!alive.length) {
      title = "Silencio bajo la piedra";
      text = "Nadie ha sobrevivido. El Umbral se cierra sobre todos y la partida termina sin vencedor.";
    } else if (assassins.length && assassins.every(function (p) { return p.dead; })) {
      winner = "supervivientes";
      title = "El Umbral ha sido derrotado";
      text = names(assassins) + (assassins.length > 1 ? " cayeron. Los supervivientes han vencido a los Asesinos" : " cayó. Los supervivientes han vencido al Asesino") + " y han cerrado el paso a la oscuridad.";
    } else if (assassins.length && alive.every(isAssassin)) {
      winner = "asesino";
      title = "La última sombra";
      text = names(alive) + (alive.length > 1 ? " han eliminado a sus adversarios. Los Asesinos dominan el Umbral." : " ha eliminado a sus adversarios. El Asesino domina el Umbral.");
    } else if (assassins.length && (function () { const non = ps.filter(function (p) { return !isAssassin(p); }); return non.length && non.filter(function (p) { return p.dead || p.dying; }).length >= Math.ceil(non.length / 2); })()) {
      winner = "asesino";
      title = "La noche cobró su tributo";
      text = names(assassins.filter(function (p) { return !p.dead; })) + " sigue en pie al amanecer y ya ha cobrado su tributo: la noche es suya.";
    } else if (assassins.length) {
      const liveAss = alive.filter(isAssassin);
      winner = "supervivientes";
      title = "La noche no pudo devorarlos";
      text = names(liveAss) + (liveAss.length > 1 ? " no consiguieron" : " no consiguió") + " eliminar a todos antes del amanecer. Los supervivientes vencen por resistencia.";
    } else if (state.shadow && state.shadow.strikes > 0) {
      winner = "supervivientes";
      title = "Nunca hubo un Asesino";
      const fa = state.falseAccusations || 0;
      text = "No había ningún Asesino entre vosotros: era la Sombra, la oscuridad cazando sola mientras os sospechabais." +
        (fa ? " Hubo " + fa + (fa > 1 ? " acusaciones falsas." : " acusación falsa.") : " Nadie llegó a acusar a un inocente.");
    } else if (alive.length === 1) {
      winner = "supervivientes";
      title = "El último en pie";
      text = alive[0].name + " es el único que queda. Sin Asesino, la noche se cobró a todos los demás.";
    } else {
      winner = "supervivientes";
      title = "La llama que no se apaga";
      text = "Nadie ha aceptado convertirse en el Asesino. Habéis resistido las tentaciones y sobrevivido juntos.";
    }

    const players = ps.map(function (p) {
      const sec = D.SECRETS.find(function (s) { return s.id === p.secret.id; });
      const fulfilled = sec ? !!sec.check(p, state) : false;
      return {
        name: p.name, role: p.role.name, affinity: p.affinity.name,
        virtue: p.virtue, corr: p.corr, wounds: p.wounds, hp: p.hp, maxHp: maxHp(p), dying: !!p.dying && !p.dead, dead: !!p.dead, cause: p.dead ? (p.cause || "heridas") : null, alignment: p.alignment || "superviviente",
        items: p.items.map(function (i) { return itemName(i.id); }),
        clues: p.clues.length, secret: p.secret.text, fulfilled: fulfilled,
        betrayals: p.betrayals, keptPacts: p.keptPacts
      };
    });

    return {
      title: title, text: text, winner: winner, players: players,
      avgCorruption: avg, betrayals: betrayals,
      durationMin: Math.max(1, Math.round(playedMs() / 60000)), plannedMin: state.durationMin || null,
      publicClues: state.publicClues.slice()
    };
  }

  /* ---------- persistencia ---------- */
  function save() {
    if (!state) return;
    try { LS.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* sin espacio o sin permiso */ }
  }

  function loadGame() {
    try {
      let raw = LS.getItem(SAVE_KEY);
      let data = raw ? JSON.parse(raw) : null;
      if (!data) {
        raw = LS.getItem(LEGACY_SAVE_KEY);
        data = raw ? JSON.parse(raw) : null;
        if (data && data.v === 4 && data.players && data.players.length === 3) {
          data.v = VERSION;
          data.players.forEach(function (p) { if (p.wounds >= 3) p.dead = true; });
          data.players.forEach(function (p) { if (typeof p.dead !== "boolean") p.dead = false; });
          LS.setItem(SAVE_KEY, JSON.stringify(data));
        }
      }
      if (!data || data.v !== VERSION || !data.players || data.players.length < MIN_PLAYERS || data.players.length > MAX_PLAYERS) return null;
      state = data;
      if (!state.chronicle) state.chronicle = [];
      if (!state.pacts) state.pacts = [];
      if (!state.threats) state.threats = [];
      if (!state.publicClues) state.publicClues = [];
      if (!state.lastResolution) state.lastResolution = [];
      state.players.forEach(function (p) { if (typeof p.dead !== "boolean") p.dead = false; if (!Array.isArray(p.notes)) p.notes = []; if (!Array.isArray(p.status)) p.status = []; initHealth(p); });
      if (typeof state.assassinExposed !== "boolean") state.assassinExposed = false;
      if (state.assassinExposed && state.assassinId !== null && state.players[state.assassinId]) state.players[state.assassinId].exposed = true;
      if (state.phase === "council" && !state.council) {
        state.council = { interactions: [], ambushes: [], used: {} };
        state.players.forEach(function (p) {
          state.council.used[p.id] = { accuse: 0, pact: 0, plot: 0, reveal: 0 };
        });
      }
      return state;
    } catch (e) { return null; }
  }

  function hasSave() {
    try {
      const raw = LS.getItem(SAVE_KEY) || LS.getItem(LEGACY_SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || (data.v !== VERSION && data.v !== 4)) return null;
      return { names: data.players.map(function (p) { return p.name; }).join(" · "), round: data.round, phase: data.phase };
    } catch (e) { return null; }
  }

  function clearSave() { try { LS.removeItem(SAVE_KEY); LS.removeItem(LEGACY_SAVE_KEY); } catch (e) {} }

  /* ---------- API ---------- */
  const API = {
    VERSION: VERSION, MIN_PLAYERS: MIN_PLAYERS, MAX_PLAYERS: MAX_PLAYERS, MAX_ROUNDS: MAX_ROUNDS, COUNCIL_SECONDS: COUNCIL_SECONDS, D: D,
    createGame: createGame, loadGame: loadGame, hasSave: hasSave, clearSave: clearSave, save: save,
    getState: function () { return state; },
    currentPlayer: function () { return state ? state.players[state.turn] : null; },
    act: wrapLog("act", act), pushLuck: wrapLog("pushLuck", pushLuck), useItem: wrapLog("useItem", useItem),
    maxHp: maxHp, visibleHealth: visibleHealth, healthInfo: healthInfo,
    _health: { damage: damage, heal: heal, finish: finish, stabilize: stabilize, pickZone: pickZone, zoneLvl: zoneLvl, zoneMod: zoneMod, initHealth: initHealth },
    getSince: getSince, actionOdds: actionOdds, buildStory: buildStory, exportLog: exportLog, lastLogs: lastLogs, noteError: noteError,
    finishTurn: finishTurn, nextTurn: nextTurn,
    beginCouncil: beginCouncil, councilPrompt: councilPrompt,
    registerInteraction: wrapLog("registerInteraction", registerInteraction), endCouncil: endCouncil,
    nextRound: nextRound, computeEnding: computeEnding,
    getEnding: function () { return state ? state.ending : null; },
    pSuccess: pSuccess, statusMod: statusMod, hasStatus: hasStatus, getOffer: getOffer, answerOffer: wrapLog("answerOffer", answerOffer), getHandOffer: getHandOffer, xpInfo: xpInfo, _makeClue: makeClue, timeUp: timeUp, forceEnd: forceEnd, cast: wrapLog("cast", cast), studyOptions: studyOptions, learnSpell: wrapLog("learnSpell", learnSpell), isUnlocked: isUnlocked, activePacts: activePacts, pactTerms: pactTerms, encounterStart: encounterStart, encounterAct: wrapLog("encounterAct", encounterAct), _npcs: NPCS, unlockNotices: unlockNotices, answerHand: wrapLog("answerHand", answerHand),
    elapsedMin: function () { return state ? Math.floor(playedMs() / 60000) : 0; },
    maxRounds: maxRounds, tick: tick, timeLeftMs: timeLeftMs, councilSeconds: councilSeconds, behindSchedule: behindSchedule
  };
  g.UMBRAL = API;
  if (typeof module !== "undefined") module.exports = API;
})(typeof globalThis !== "undefined" ? globalThis : this);
