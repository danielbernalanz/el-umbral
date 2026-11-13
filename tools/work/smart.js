const NAMES=["Ana","Luis","Marta","Pablo","Eva","Iker","Noa","Leo","Mia","Rut"].slice(0,Number(process.env.NP||3));
const path=(process.env.WWW||"/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www")+"/";
require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
const ansT=(U)=>{const st=U.getState(); if(st&&st.timeAsk){const tp=process.env.TP||"1"; const c=tp==="mix"?[1,2,"end"][Math.floor(Math.random()*3)]:tp==="end"?"end":Number(tp); global.ASK=(global.ASK||0)+1; if(c!=="end")global.EXT=(global.EXT||0)+c; else global.TEND=(global.TEND||0)+1; return U.answerTime(c);} return null;};
const N=Number(process.argv[2]||300), MIN=Number(process.argv[3]||20), MODE=process.argv[4]||"1dark";
const rnd=n=>Math.floor(Math.random()*n), adv=ms=>{while(ms>0){const d=Math.min(ms,5000);U.tick(d);ms-=d;}};
const res={asesino:0,supers:0,otros:0,tiempo:0,rounds:0,muertes:0,assassinMade:0,cazar:0,devor:0,titles:{}}; let errs=0;
function can(p,id){const a=D.ACTIONS.find(x=>x.id===id); return a&&U.isUnlocked(p,a)&&!(a.assassinOnly&&p.alignment!=="asesino");}
function act(p,id,t,st){const r=U.act(p.id,id,t,st); if(r.ok&&id==="cazar"){res.cz=(res.cz||0)+1; if(r.success) res.czok=(res.czok||0)+1;} return r.ok;}
function turn(p,dark,s){
  const al=s.players.filter(x=>x.id!==p.id&&!x.dead); const tgt=al[rnd(al.length)];
  const of=U.getOffer(p.id); if(of) U.answerOffer(p.id,dark?true:(Math.random()<0.15));
  const ho=U.getHandOffer(p.id); if(ho) U.answerHand(p.id,true);
  if(p.items.length&&!p.usedItem){ const i=p.items.findIndex(it=>["heal","cleanse","elixir","reflect","ward","defense","fog"].includes(D.ITEMS[it.id].kind)&&(p.wounds>0||D.ITEMS[it.id].kind!=="heal")); if(i>=0&&Math.random()<0.5) U.useItem(p.id,i,null);
    const ti=p.items.findIndex(it=>D.ITEMS[it.id].kind==="tome"); if(ti>=0){const so=U.studyOptions(p.id,ti); if(so.ok) U.learnSpell(p.id,rnd(3),"estable");} }
  if(p.spells&&p.spells.length){ const sp=p.spells[rnd(p.spells.length)]; if(sp.kind==="def"||dark){ const t=sp.target?al[rnd(al.length)]:null; if(!sp.target||t){ if(U.cast(p.id,sp.id,t?t.id:null).ok) return; } } }
  if(process.env.SOC!=="0"&&p.alignment!=="asesino"&&can(p,"socorrer")&&Math.random()<0.8){ const dy=al.find(x=>x.dying); if(dy&&act(p,"socorrer",dy.id)){res.soc=(res.soc||0)+1;return;} }
  if(p.alignment==="asesino"&&process.env.SOMB!=="0"){ if(can(p,"alzar")&&Math.random()<0.7){ const c=s.players.filter(x=>x.id!==p.id&&((x.dead&&(x.risenBy === undefined || x.risenBy === null)&&x.cause!=="devorado")||x.dying)); if(c.length&&act(p,"alzar",c[0].id)){res.alz=(res.alz||0)+1;return;} } if(can(p,"sombra_hostiga")&&Math.random()<0.15&&tgt&&act(p,"sombra_hostiga",tgt.id)){res.hos=(res.hos||0)+1;return;} if(can(p,"sombra_guarda")&&Math.random()<0.1&&act(p,"sombra_guarda",null)) return; }
  if(p.alignment==="asesino"){ const w=al.slice().sort((a,b)=>b.wounds-a.wounds)[0]; if(w&&can(p,"devorar")&&(w.wounds>=2)&&act(p,"devorar",w.id)) {res.devor++;return;} if(w&&act(p,"cazar",w.id)){res.cazar++;return;} }
  const order=dark?["ceder","apunalar","envenenar","robar","hechizar","explorar","investigar"]:(p.wounds>0?["descansar"]:[]).concat(p.corr>=10?["meditar"]:[],["investigar","explorar","proteger","meditar"]);
  for(const id of order){ if(!can(p,id)) continue; const a=D.ACTIONS.find(x=>x.id===id); if(a.target){ if(!tgt) continue; if(a.canTarget&&!a.canTarget(tgt)) continue; if(act(p,id,tgt.id)) return; } else if(act(p,id,null)) return; }
  act(p,"meditar",null);
}
for(let g=0;g<N;g++){
  U.createGame(NAMES,{minutes:MIN}); let guard=0;
  const darkIdx=MODE==="1dark"?rnd(NAMES.length):-1;
  while(guard++<3000){
    const s=U.getState(); if(!s||s.phase==="ending") break;
    if(s.phase==="private"){ const p=U.currentPlayer(); if(s.handoff){U.nextTurn();continue;} turn(p,p.id===darkIdx,s); { const cp=U.currentPlayer(); const en=cp&&U.encounterStart(cp.id); if(en){ const o=en.options[Math.floor(Math.random()*en.options.length)]; const r=U.encounterAct(cp.id,o.id); if(!r.ok) throw new Error('enc '+r.msg);} } adv(30000); { const cp=U.currentPlayer(); if(cp&&cp.acted&&!cp.dead&&!cp.dying&&cp.id!==darkIdx){ const al2=s.players.filter(x=>x.id!==cp.id&&!x.dead); let best=null,bs=0; al2.forEach(x=>{const st=cp.clues.filter(c=>c.about===x.id).reduce((a,c)=>a+c.strength,0); if(st>bs){bs=st;best=x;}}); if(best&&bs>=3&&Math.random()<0.8){ const r=U.declare(cp.id,"acusacion",best.id); if(r.ok) res.acc=(res.acc||0)+1; } } } U.finishTurn(); }
    else if(s.phase==="council"){
      for(const x of U.resolveCouncil()) if(x.res.revealedAssassin) res.accok=(res.accok||0)+1;
      adv(60000); U.endCouncil(); }
    else if(s.phase==="resolution"){ if(U.nextRound()) break; ansT(U); }
  }
  const e=U.getEnding(); const s=U.getState(); if(!e){errs++;continue;}
  res.rounds+=s.round; res.titles[e.title]=(res.titles[e.title]||0)+1; if(e.timedOut) res.tiempo++;
  if(s.players.some(p=>p.alignment==="asesino")) res.assassinMade++; s.players.forEach(p=>{if(p.asesinoVia)res["via_"+p.asesinoVia]=(res["via_"+p.asesinoVia]||0)+1;});
  res.muertes+=s.players.filter(p=>p.dead).length;
  if(e.winner==="asesino") res.asesino++; else if(e.winner==="supervivientes") res.supers++; else res.otros++;
}
console.log(MODE,"min",MIN,"N",N,JSON.stringify({...res,rounds:(res.rounds/N).toFixed(1),muertes:(res.muertes/N).toFixed(2),errs}));
console.log("preguntas de tiempo:",global.ASK||0,"rondas añadidas:",global.EXT||0,"terminar ahora:",global.TEND||0,"tiempoAgotadoSinDesenlace(timedOut):",res.tiempo);
