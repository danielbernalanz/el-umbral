import sys
P="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/engine.js"
s=open(P,encoding="utf-8").read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    if n!=cnt:
        print("ABORT: matches=%d for: %s"%(n,old[:90])); sys.exit(1)
    s=s.replace(old,new)

# ---- 1. núcleo de salud
rep('''  function addWounds(p, amount) {
    if (!p || p.dead || amount <= 0) return;
    p.wounds = clamp((p.wounds || 0) + amount, 0, 3);
    p.wasHurt = true;
    if (p.wounds >= 3) { p.dead = true; p.status = []; p.cause = "heridas"; killed(p, "heridas"); }
  }
  function killed(p, cause) {
    if (state) state.chronicle.push({ round: state.round, text: "✖ " + p.name + " ha caído (" + cause + ")." });
  }
''','''  /* ---------- salud: vitalidad (hp), zonas del cuerpo, moribundo ---------- */
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
      p.hp = 0; p.dying = true; p.dyingRound = r; p.status = []; out.dying = true;
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
''')

# ---- checkTerminal: moribundos cuentan como vivos; si todos los vivos están moribundos nadie puede socorrer
rep('''    if (!ass.length && alive.length === 1) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }
    if (!alive.length) {''','''    if (!ass.length && alive.length === 1) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;
    }
    if (alive.length && alive.every(function (p) { return p.dying; })) {
      /* Nadie en pie que pueda socorrer: todos se apagan. */
      alive.forEach(function (p) { p.notes.push("Ronda " + state.round + ": no queda nadie que pueda socorrerte."); finish(p, "heridas"); });
      alive = [];
    }
    if (!alive.length) {''')
rep('''    const alive = state.players.filter(function (p) { return !p.dead; });
    const ass = assassinsOf();
    if (ass.length && ass.every(function (p) { return p.dead; })) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;''','''    let alive = state.players.filter(function (p) { return !p.dead; });
    const ass = assassinsOf();
    if (ass.length && ass.every(function (p) { return p.dead; })) {
      state.phase = "ending"; state.ending = computeEnding(); save(); return true;''')

# ---- woundOrCorr
rep('''function woundOrCorr(p) { if (p.wounds < 2 && !p.dead) { addWounds(p, 1); return " Sufres una herida."; }''','''function woundOrCorr(p) { if (p.hp > 4 && !p.dead && !p.dying) { const res = damage(p, rr(2, 3), { src: "gen" }); return " Sales herido" + hitNote(res) + "."; }''')
# ermitaño
rep('''win: function (p) { if (p.wounds > 0) { p.wounds -= 1; return "Vendó tus heridas en silencio. Una cura menos."; } mv(p, 0, -8);''','''win: function (p) { if (p.hp < maxHp(p)) { const h = heal(p, 4); return "Vendó tus heridas en silencio (+" + h + " de vitalidad)."; } mv(p, 0, -8);''')
open(P,"w",encoding="utf-8").write(s)
print("ok1")
