p='engine.js'
s=open(p,encoding='utf-8').read()
def rep(old,new,cnt=1):
    global s
    assert s.count(old)==cnt, (s.count(old), old[:90])
    s=s.replace(old,new)

# story
rep('''(p.asesinoVia === "devorar" ? ", tras devorar a otro jugador" : ", al ceder a la tentación"); }''','''(p.asesinoVia === "devorar" ? ", tras devorar a otro jugador" : p.asesinoVia === "tentacion" ? ", al aceptar la tentación del Umbral" : ", al ceder a la tentación"); }''')

# exportLog header + player lines
rep('''L.push("EL UMBRAL · registro de partida · v1.0.0 · formato 1");''','''L.push("EL UMBRAL · registro de partida · v1.0.0 · formato 2 (agresividad, tentación, sombras)");''')
rep(''' + " | secreto: " + (p.secret && p.secret.id));
    });''',''' + " | secreto: " + (p.secret && p.secret.id) + " | agr " + (p.aggr || 0) + (aggrSummary(p) ? " (" + aggrSummary(p) + ")" : "") + " | dominio sombras " + domLevel(p) + " (" + ((p.dom && p.dom.wins) || 0) + " éxitos)" + ((p.risen || []).length ? " | alzados: " + p.risen.map(function (id) { return state.players[id] ? state.players[id].name : "?"; }).join(",") : "") + (p.risenBy !== undefined && p.risenBy !== null ? " | ALZADO por J" + p.risenBy : "") + ((p.tempOffers || 0) ? " | tentaciones ofrecidas " + p.tempOffers : ""));
    });''')

# computeEnding players
rep('''        betrayals: p.betrayals, keptPacts: p.keptPacts
      };''','''        betrayals: p.betrayals, keptPacts: p.keptPacts,
        risenBy: p.risenBy !== undefined && p.risenBy !== null && ps[p.risenBy] ? ps[p.risenBy].name : null, via: p.asesinoVia || null
      };''')

# loadGame migration
rep('''if (!Array.isArray(p.status)) p.status = []; initHealth(p); });''','''if (!Array.isArray(p.status)) p.status = []; if (typeof p.aggr !== "number") p.aggr = 0; if (!p.agg || typeof p.agg !== "object") p.agg = {}; if (!p.dom || typeof p.dom !== "object") p.dom = { wins: 0 }; if (!Array.isArray(p.risen)) p.risen = []; initHealth(p); });''')

# API
rep('''    maxRounds: maxRounds, tick: tick,''','''    domInfo: domInfo, riseCount: riseCount, aggrSummary: aggrSummary, DOM_NAMES: DOM_NAMES, declare: wrapLog("declare", declare),
    maxRounds: maxRounds, tick: tick,''')
open(p,'w',encoding='utf-8').write(s)
print("ok")
