/* Bot "humano-like": estilos pacífico / oportunista / agresivo; acepta la tentación con probabilidad moderada.
   Uso: [NP=n] [WWW=ruta] node smart_human.js N minutos [human|allgood|aggro] */
const NAMES=["Ana","Luis","Marta","Pablo","Eva","Iker","Noa","Leo","Mia","Rut"].slice(0,Number(process.env.NP||4));
const path=(process.env.WWW||"/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www")+"/";
require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
const ansT=(U)=>{const st=U.getState(); if(st&&st.timeAsk){const tp=process.env.TP||"1"; const c=tp==="mix"?[1,2,"end"][Math.floor(Math.random()*3)]:tp==="end"?"end":Number(tp); global.ASK=(global.ASK||0)+1; if(c!=="end")global.EXT=(global.EXT||0)+c; else global.TEND=(global.TEND||0)+1; return U.answerTime(c);} return null;};
const N=Number(process.argv[2]||200), MIN=Number(process.argv[3]||20), MODE=process.argv[4]||"human";
const ACC_T=Number(process.env.ACC_T||0.6); // prob. de aceptar la tentación
const rnd=n=>Math.floor(Math.random()*n), adv=ms=>{while(ms>0){const d=Math.min(ms,5000);U.tick(d);ms-=d;}};
const res={games:0,asesino:0,supers:0,otros:0,tiempo:0,rounds:0,muertes:0,withAss:0,assWin:0,offers:0,accepts:0,gamesWithOffer:0,titles:{},via:{},assRound:0,sombra:{},alzar:0,errs:0};
function can(p,id){const a=D.ACTIONS.find(x=>x.id===id); return a&&U.isUnlocked(p,a)&&!(a.assassinOnly&&p.alignment!=="asesino");}
function act(p,id,t,st){const r=U.act(p.id,id,t,st); if(r.ok&&/^sombra_|alzar/.test(id)) res.sombra[id]=(res.sombra[id]||0)+1; return r.ok;}
let style={};
function pickStyle(){ if(MODE==="allgood") return "pacifico"; if(MODE==="aggro") return "agresivo"; const x=Math.random(); return x<0.40?"pacifico":x<0.75?"oportunista":"agresivo"; }
const CNT={};
function turn(p,s){
  if(process.env.COUNT){ const va=U.visibleActions(p); const k=s.round; const c=CNT[k]=CNT[k]||{n:0,main:0,hid:0,sw:0,swNew:0,max:0}; c.n++; c.main+=va.main.length; c.hid+=va.hidden; c.max=Math.max(c.max,va.total); const all=va.main.concat(...va.more.map(g=>g.acts)); if(all.some(a=>/^sombra_|^alzar/.test(a.id))) c.sw++; }
  const st=style[p.id], hostileP=st==="agresivo"?0.6:st==="oportunista"?0.25:0;
  const al=s.players.filter(x=>x.id!==p.id&&!x.dead); const tgt=al[rnd(al.length)];
  const of=U.getOffer(p.id);
  if(of){ if(of.id==="asesino"){ res.offers++; p._off=1; const ok=Math.random()<(st==="agresivo"?ACC_T:st==="oportunista"?ACC_T*0.8:0.1); if(ok) res.accepts++; U.answerOffer(p.id,ok); } else U.answerOffer(p.id,Math.random()<(MODE==="allgood"?0.1:0.35)); }
  const ho=U.getHandOffer(p.id); if(ho) U.answerHand(p.id,Math.random()<0.5);
  U.getPactOffers(p.id).forEach(o=>U.answerPact(p.id,o.idx,Math.random()<0.5));
  if(p.items.length&&!p.usedItem){ const i=p.items.findIndex(it=>["heal","cleanse","elixir","reflect","ward","defense","fog"].includes(D.ITEMS[it.id].kind)&&(p.wounds>0||D.ITEMS[it.id].kind!=="heal")); if(i>=0&&Math.random()<0.5) U.useItem(p.id,i,null);
    const ti=p.items.findIndex(it=>D.ITEMS[it.id].kind==="tome"); if(ti>=0){const so=U.studyOptions(p.id,ti); if(so.ok) U.learnSpell(p.id,rnd(3),"estable");} }
  const dy=al.find(x=>x.dying);
  if(p.alignment!=="asesino"&&dy&&can(p,"socorrer")&&Math.random()<0.7&&act(p,"socorrer",dy.id)) return;
  if(p.alignment==="asesino"){
    if(can(p,"alzar")&&Math.random()<0.5){ const c=s.players.filter(x=>x.id!==p.id&&((x.dead&&(x.risenBy === undefined || x.risenBy === null)&&x.cause!=="devorado")||x.dying)); if(c.length&&act(p,"alzar",c[0].id)){res.alzar++;return;} }
    if(can(p,"sombra_guarda")&&Math.random()<0.1&&act(p,"sombra_guarda",null)) return;
    if(can(p,"sombra_espia")&&Math.random()<0.1&&tgt&&act(p,"sombra_espia",tgt.id)) return;
    const w=al.slice().sort((a,b)=>(b.dying?9:0)+b.wounds-(a.dying?9:0)-a.wounds)[0];
    if(w&&can(p,"devorar")&&w.wounds>=2&&Math.random()<0.5&&act(p,"devorar",w.id)) return;
    if(w&&Math.random()<0.8&&act(p,"cazar",w.id)) return;
  }
  if(p.spells&&p.spells.length&&Math.random()<0.5){ const sp=p.spells[rnd(p.spells.length)]; if(sp.kind==="def"||Math.random()<hostileP){ const t=sp.target?tgt:null; if(!sp.target||t){ if(U.cast(p.id,sp.id,t?t.id:null).ok) return; } } }
  if(Math.random()<hostileP&&tgt){
    const hs=["apunalar","robar","hechizar","envenenar","maldecir","aturdir","sombra_hostiga"].filter(id=>can(p,id));
    for(const id of hs.sort(()=>Math.random()-0.5)){ if(act(p,id,tgt.id)) return; }
  }
  if(p.corr>=12&&Math.random()<0.15&&can(p,"sombra_espia")&&tgt&&act(p,"sombra_espia",tgt.id)) return;
  if(Math.random()<0.1&&can(p,"sombra_guarda")&&act(p,"sombra_guarda",null)) return;
  const pool=[]; if(p.wounds>0&&can(p,"descansar")) pool.push("descansar","descansar"); if(p.corr>=20) pool.push("meditar"); if(can(p,"entrenar")) pool.push("entrenar"); if(can(p,"tender")&&MODE!=="allgood") pool.push("tender");
  pool.push("investigar","investigar","investigar","explorar","explorar","proteger","meditar");
  const sus=al.slice().sort((a,b)=>b.corr-a.corr)[0];
  for(const id of pool.sort(()=>Math.random()-0.5)){ const a=D.ACTIONS.find(x=>x.id===id); if(id==="investigar"&&sus){ if(act(p,id,(Math.random()<0.6?sus:tgt).id)) return; continue; } if(a.target){ if(!tgt) continue; if(id==="tender"){ if(act(p,id,tgt.id,Math.random()<0.7?"sincera":"trampa")) return; continue; } if(act(p,id,tgt.id)) return; } else if(act(p,id,null)) return; }
  act(p,"meditar",null);
}
for(let g=0;g<N;g++){
  U.createGame(NAMES,{minutes:MIN}); style={}; NAMES.forEach((n,i)=>style[i]=pickStyle()); let guard=0; res.games++;
  while(guard++<3000){
    const s=U.getState(); if(!s||s.phase==="ending") break;
    if(s.phase==="private"){ const p=U.currentPlayer(); if(s.handoff){U.nextTurn();continue;} turn(p,s);
      { const cp=U.currentPlayer(); const en=cp&&U.encounterStart(cp.id); if(en){ const st=style[cp.id]; let opts=en.options; if(st!=="agresivo") opts=opts.filter(o=>!/atacar|matar|atrapar/.test(o.id)); const o=opts[rnd(opts.length)]; const r=U.encounterAct(cp.id,o.id); if(!r.ok) throw new Error('enc '+r.msg);} }
      adv(30000);
      { const cp=U.currentPlayer(); if(cp&&cp.acted&&!cp.dead&&!cp.dying){ const st=style[cp.id]; const al2=s.players.filter(x=>x.id!==cp.id&&!x.dead); let best=null,bs=0; al2.forEach(x=>{const sc=cp.clues.filter(c=>c.about===x.id).reduce((a,c)=>a+c.strength,0); if(sc>bs){bs=sc;best=x;}});
        if(best&&bs>=3&&Math.random()<0.7){ const dr=U.declare(cp.id,"acusacion",best.id); if(dr.ok) res.acc=(res.acc||0)+1; }
        else if(st==="agresivo"&&al2.length&&Math.random()<0.45) U.declare(cp.id,"emboscada",al2[rnd(al2.length)].id); } }
      U.finishTurn(); }
    else if(s.phase==="council"){ for(const x of U.resolveCouncil()) if(x.res.revealedAssassin) res.accok=(res.accok||0)+1; adv(60000); U.endCouncil(); }
    else if(s.phase==="resolution"){ if(U.nextRound()) break; ansT(U); }
  }
  const e=U.getEnding(); const s=U.getState(); if(!e){res.errs++;continue;}
  res.rounds+=s.round; res.titles[e.title]=(res.titles[e.title]||0)+1; if(e.timedOut) res.tiempo++;
  const ass=s.players.filter(p=>p.alignment==="asesino");
  if(ass.length){ res.withAss++; ass.forEach(p=>{res.via[p.asesinoVia]=(res.via[p.asesinoVia]||0)+1; res.assRound+=p.asesinoRound;}); if(e.winner==="asesino") res.assWin++; }
  if(s.players.some(p=>p._off)) res.gamesWithOffer++;
  res.muertes+=s.players.filter(p=>p.dead).length;
  if(e.winner==="asesino") res.asesino++; else if(e.winner==="supervivientes") res.supers++; else res.otros++;
}
if(process.env.COUNT){ console.log("ronda | turnos | principales | en «Más acciones» | total | máx | % con acciones de sombras"); Object.keys(CNT).map(Number).sort((a,b)=>a-b).forEach(k=>{const c=CNT[k]; console.log(String(k).padStart(2),"|",c.n,"|",(c.main/c.n).toFixed(1),"|",(c.hid/c.n).toFixed(1),"|",((c.main+c.hid)/c.n).toFixed(1),"|",c.max,"|",(100*c.sw/c.n).toFixed(0)+"%");}); }
const pc=x=>(100*x/res.games).toFixed(1);
console.log(MODE,"NP",NAMES.length,"min",MIN,"N",res.games,"| asesino emergente",pc(res.withAss)+"%","| gana asesino (de todas)",pc(res.asesino)+"%","| gana asesino (de las con asesino)",(100*res.assWin/Math.max(1,res.withAss)).toFixed(1)+"%","| supers",pc(res.supers)+"%","| ofertas",res.offers,"aceptadas",res.accepts,"| partidas con oferta",pc(res.gamesWithOffer)+"%","| via",JSON.stringify(res.via),"| ronda media conversión",(res.assRound/Math.max(1,res.withAss)).toFixed(1),"| rondas",(res.rounds/res.games).toFixed(1),"muertes",(res.muertes/res.games).toFixed(2),"| sombras",JSON.stringify(res.sombra),"alzar",res.alzar,"acus",res.acc||0,"acusOK",res.accok||0,"tiempo",res.tiempo,"errs",res.errs);
console.log("preguntas de tiempo:",global.ASK||0,"rondas añadidas:",global.EXT||0,"terminar ahora:",global.TEND||0,"tiempoAgotadoSinDesenlace(timedOut):",res.tiempo);
