import sys
P="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/engine.js"
s=open(P,encoding="utf-8").read()
def rep(old,new,cnt=1):
    global s
    n=s.count(old)
    if n!=cnt:
        print("ABORT: matches=%d for: %s"%(n,old[:100])); sys.exit(1)
    s=s.replace(old,new)

rep('''p.lastSeen = { n: p.notes.length, w: p.wounds, v: p.virtue };''','''p.lastSeen = { n: p.notes.length, h: p.hp, v: p.virtue };''')
rep('''    if (!notes.length && p.wounds === p.lastSeen.w) return null;
    return { woundsFrom: p.lastSeen.w, woundsNow: p.wounds, notes: notes.slice(-5), more: Math.max(0, notes.length - 5) };''','''    const from = typeof p.lastSeen.h === "number" ? p.lastSeen.h : p.hp;
    if (!notes.length && p.hp === from) return null;
    return { hpFrom: from, hpNow: p.hp, notes: notes.slice(-5), more: Math.max(0, notes.length - 5) };''')
rep('''" cor " + p.corr + " her " + p.wounds + (p.dead ? " MUERTO(" + (p.cause || "?") + ")" : "")''','''" cor " + p.corr + " vit " + p.hp + "/" + maxHp(p) + (p.dying ? " MORIBUNDO(r" + p.dyingRound + ")" : "") + (p.dead ? " MUERTO(" + (p.cause || "?") + ")" : "")''')
rep('''      if (p.wounds > 3 || p.wounds < 0 || [p.virtue, p.corr, p.wounds].some(function (x) { return typeof x !== "number" || isNaN(x); })) an.push("valores raros en " + p.name);''','''      if (p.hp < 0 || p.hp > maxHp(p) || [p.virtue, p.corr, p.hp].some(function (x) { return typeof x !== "number" || isNaN(x); })) an.push("valores raros en " + p.name + " (vitalidad " + p.hp + "/" + maxHp(p) + ")");
      if (ZONES.some(function (z) { return !(p.zones && p.zones[z] >= 0); })) an.push("zonas corporales raras en " + p.name);
      if (p.dying && state.phase !== "ending" && state.round >= (p.dyingRound || 0) + 3) an.push(p.name + " lleva moribundo desde la ronda " + p.dyingRound + " sin resolverse");
      if (p.dying && p.dead) an.push(p.name + " figura a la vez moribundo y muerto");
      if (p.dying && p.hp !== 0) an.push(p.name + " moribundo con vitalidad " + p.hp);''')
rep('''virtue: p.virtue, corr: p.corr, wounds: p.wounds, dead: !!p.dead,''','''virtue: p.virtue, corr: p.corr, wounds: p.wounds, hp: p.hp, maxHp: maxHp(p), dying: !!p.dying && !p.dead, dead: !!p.dead,''')
rep('''if (!p || p.dead || p.acted) return err("Este jugador ya no puede estudiar.");''','''if (!p || p.dead || p.dying || p.acted) return err("Este jugador ya no puede estudiar.");''') if False else None
rep('''state.players.forEach(function (p) { if (typeof p.dead !== "boolean") p.dead = false; if (!Array.isArray(p.notes)) p.notes = []; if (!Array.isArray(p.status)) p.status = []; });''','''state.players.forEach(function (p) { if (typeof p.dead !== "boolean") p.dead = false; if (!Array.isArray(p.notes)) p.notes = []; if (!Array.isArray(p.status)) p.status = []; initHealth(p); });''')
rep('''    getSince: getSince, actionOdds: actionOdds,''','''    maxHp: maxHp, visibleHealth: visibleHealth, healthInfo: healthInfo,
    _health: { damage: damage, heal: heal, finish: finish, stabilize: stabilize, pickZone: pickZone, zoneLvl: zoneLvl, zoneMod: zoneMod, initHealth: initHealth },
    getSince: getSince, actionOdds: actionOdds,''')
# endCouncil terminal check
rep('''    const alive = state.players.filter(function (p) { return !p.dead; });
    const ass = assassinsOf();
    if ((ass.length && ass.every(function (p) { return p.dead; })) || !alive.length || (ass.length && alive.every(isAssassin)) || (!ass.length && alive.length === 1)) {
      state.phase = "ending"; state.ending = computeEnding();
    } else { state.phase = "resolution"; }''','''    if (checkTerminal()) { /* ya en desenlace */ }
    else { state.phase = "resolution"; }''')
open(P,"w",encoding="utf-8").write(s)
print("ok4")
