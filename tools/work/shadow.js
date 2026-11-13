const path="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
const rnd=n=>Math.floor(Math.random()*n); const GOOD=["meditar","resistir","investigar","proteger","explorar"];
function goodAction(p,s){
  if(p.wounds>0 && Math.random()<0.5) return ["descansar",null];
  if(p.corr>=15 && Math.random()<0.6) return [Math.random()<0.5?"meditar":"resistir",null];
  const a=GOOD[rnd(GOOD.length)]; const o=s.players.filter(x=>x.id!==p.id&&!x.dead); if(!o.length) return ["meditar",null];
  return [a, D.ACTIONS.find(x=>x.id===a).target ? o[rnd(o.length)].id : null];
}
const N=2000, T={}, st={deaths:0,strikes:0,rounds:0,becameAssassin:0,allDead:0,fakeClues:0,realClueTexts:0};
let wounds=0, finalAlive=0;
for(let g=0; g<N; g++){
  U.createGame(["A","B","C"]); let guard=0;
  while(guard++<2000){
    const s=U.getState(); if(s.phase==="ending")break;
    if(s.phase==="private"){
      const p=U.currentPlayer();
      if(!s.handoff){
        const of=U.getOffer(p.id);
        let ok=false; for(let k=0;k<10&&!ok;k++){ const [a,t]=goodAction(p,s); ok=U.act(p.id,a,t,null).ok; }
        if(!ok) U.act(p.id,"meditar",null,null);
        U.finishTurn();
      } else U.nextTurn();
    } else if(s.phase==="council") U.endCouncil();
    else if(s.phase==="resolution"){ if(U.nextRound()) break; }
  }
  const s=U.getState(), e=U.getEnding();
  T[e.title]=(T[e.title]||0)+1; st.rounds+=s.round; st.strikes+=(s.shadow?s.shadow.strikes:0);
  if(s.players.some(p=>p.dead)) st.deaths++; if(s.players.every(p=>p.dead)) st.allDead++;
  if(s.players.some(p=>p.alignment==="asesino")) st.becameAssassin++;
  s.players.forEach(p=>{ wounds+=p.wounds; if(!p.dead) finalAlive++; });
}
console.log("Finales con 3 jugadores buenos (la Sombra activa):",JSON.stringify(T));
console.log(JSON.stringify({partidas:N,mediaRondas:(st.rounds/N).toFixed(2),ataquesSombraPorPartida:(st.strikes/N).toFixed(2),pctConAlgunaMuerte:Math.round(st.deaths/N*100),pctTodosMuertos:Math.round(st.allDead/N*100),pctSurgeAsesinoReal:Math.round(st.becameAssassin/N*100),heridasMediasPorJugador:(wounds/(N*3)).toFixed(2),vivosFinalesMedios:(finalAlive/N).toFixed(2)}));
// Pistas falsas: con la Sombra activa, ¿investigar señala a inocentes con pistas de Asesino?
let fake=0, tot=0;
for(let i=0;i<3000;i++){
  U.createGame(["A","B","C"]); const s=U.getState(); s.round=4; s.shadow={strikes:2,last:null}; s.phase="private"; s.handoff=false; s.turn=0;
  s.players.forEach(p=>{p.acted=false;p.status=[];p.offer=null;}); s.players[0].stats.mente=6;
  U.act(0,"investigar",1,null);
  const c=s.players[0].clues[s.players[0].clues.length-1]; if(c){ tot++; if(D.ASSASSIN_CLUES.some(t=>c.text===t.replace(/\{name\}/g,"B"))) fake++; }
}
console.log("pistas falsas de Asesino sobre un inocente:",fake,"de",tot,"("+Math.round(fake/tot*100)+" %)");
