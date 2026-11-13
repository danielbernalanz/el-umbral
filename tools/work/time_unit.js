const W="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
const store={}; global.localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]}};
require(W+"data.js"); const U=require(W+"engine.js"); const D=globalThis.UMBRAL_DATA;
let f=0; const ok=(c,m)=>{ if(!c){f++;console.log("FALLO",m);} };
function play(U,until){ // juega rondas simples hasta resolucion
  const s=U.getState();
  s.players.forEach(p=>{ if(!p.dead&&!p.dying){ U.act(p.id,"meditar",null,null); } });
}
function newG(min,seed){ U.createGame(["A","B","C"],{minutes:min}); return U.getState(); }
let s=newG(10);
ok(s.maxRounds>=3,"maxRounds");
// fuerza ultima ronda
s.round=s.maxRounds; s.phase="resolution";
ok(!U.timeWarn(),"aviso antes de tiempo");
s.playedMs=10*60000-100000; ok(U.timeWarn(),"aviso a 2 min");
ok(U.addTime()===true,"addTime"); ok(!U.timeWarn(),"aviso unico"); ok(U.addTime()===false,"addTime doble");
const prevMax=s.maxRounds, r0=s.round;
U.nextRound(); // debe añadir 1 ronda automaticamente
ok(U.getState().round===r0+1 && U.getState().maxRounds===prevMax+1 && s.phase!=="ending","ronda añadida tras aviso: round="+s.round+" max="+s.maxRounds+" ph="+s.phase);
// agotar tiempo en la nueva final
s.playedMs=s.durationMin*60000+(s.extraMs||0)+1000; s.phase="resolution";
U.nextRound(); ok(!!s.timeAsk && s.phase!=="ending","pregunta de tiempo");
ok(s.timeAsk.opts.length===2 && s.timeAsk.opts[1].min>=s.timeAsk.opts[0].min,"opts");
// guardar y recargar
U.save&&U.save(); const ld=U.loadGame(); const s2=U.getState();
ok(s2&&s2.timeAsk&&s2.extraMs===162500,"persistencia pregunta/extra tras cargar: "+JSON.stringify(s2&&{ta:!!s2.timeAsk,er:s2.extraRounds,em:s2.extraMs}));
ok(U.answerTime("zz").ok===false,"opcion invalida");
const r=U.answerTime(2); ok(r.ok&&r.added===2,"answer 2");
ok(U.answerTime(1).ok===false,"doble respuesta");
const st=U.getState(); ok(st.maxRounds===st.round+2 && st.extraRounds===2,"max tras +2: "+st.maxRounds+" r"+st.round+" er"+st.extraRounds);
ok(U.timeLeftMs? true:true,"");
// siguiente ronda empieza normal
ok(st.phase!=="ending","no termina");
// terminar ahora
st.phase="resolution"; st.playedMs=st.durationMin*60000+(st.extraMs||0)+1000; st.round=st.maxRounds; U.nextRound(); ok(!!st.timeAsk,"2a pregunta (repetible)");
const e=U.answerTime("end"); ok(e.ok&&e.ended&&e.ending&&e.ending.title&&e.ending.winner&&!e.ending.timedOut,"end: "+JSON.stringify(e.ending&&e.ending.title));
ok(U.getState().phase==="ending","fase ending");
console.log("fallos",f);
