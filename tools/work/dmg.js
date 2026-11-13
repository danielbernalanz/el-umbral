const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
const bad={}; let events=0;
function snap(){const s=U.getState(); return s.players.map(p=>({w:p.wounds,n:p.notes.length,dead:p.dead}));}
function check(tag,before,actorId,res,extra){const s=U.getState(); s.players.forEach((p,i)=>{const b=before[i]; if(!b||b.dead)return; if(p.wounds>b.w){events++; const noted=p.notes.length>b.n; const own=(i===actorId)&&res&&/herida|hiere|arcada|sufres|desmay|muer/i.test(String(res.outcome||res.msg||res.text||"")); const pub=false; if(!noted&&!own){const k=tag+(extra?":"+extra:""); bad[k]=(bad[k]||0)+1;}}});}
function pickAct(p){ const s=U.getState(); const acts=D.ACTIONS.filter(a=>U.isUnlocked(p,a)&&a.id!=="conjurar"&&(!a.assassinOnly||p.alignment==="asesino"));
  const a=acts[Math.floor(Math.random()*acts.length)]; let t=null; if(a.target){const c=s.players.filter(x=>x.id!==p.id&&!x.dead&&(!a.canTarget||a.canTarget(x))); if(!c.length) return ["meditar",null,null]; t=c[Math.floor(Math.random()*c.length)].id;} return [a.id,t,a.gamble?"low":a.mode?"trampa":null]; }
const TYPES=["pacto_no_agresion","pacto_silencio","pacto_proteccion","amenaza","revelar","acusacion","emboscada","romper"];
for(let g=0;g<600;g++){ const n=3+(g%4); U.createGame(["A","B","C","D","E","F"].slice(0,n),{minutes:[10,20,45][g%3]});
 for(let it=0;it<500;it++){ let s=U.getState(); if(!s||s.phase==="ending")break;
  if(s.phase==="private"){ if(s.handoff){U.nextTurn();continue;} const p=U.currentPlayer();
   const o=U.getOffer(p.id); if(o&&!o.done){const b=snap(); const r=U.answerOffer(p.id,Math.random()<.5); check("oferta",b,p.id,r);} 
   if(U.getHandOffer&&U.getHandOffer(p.id)){const b=snap(); const r=U.answerHand(p.id,Math.random()<.5); check("mano",b,p.id,r);}
   const [a,t,st]=pickAct(p); const b=snap(); const r=U.act(p.id,a,t,st); check("acción",b,p.id,r,a);
   if(r.ok&&r.pushable&&Math.random()<.5){const b2=snap(); const r2=U.pushLuck(p.id); check("forzar",b2,p.id,r2,a);}
   const en=U.encounterStart(p.id); if(en){const b3=snap(); const op=en.options[Math.floor(Math.random()*en.options.length)]; const r3=U.encounterAct(p.id,op.id); check("npc",b3,p.id,r3,en.npc+"/"+op.id);}
   if(p.items.length&&Math.random()<.4){const b4=snap(); const r4=U.useItem(p.id,0,s.players.find(x=>x.id!==p.id&&!x.dead)?.id); check("objeto",b4,p.id,r4,p.items[0]&&p.items[0].id);}
   const bf=snap(); U.finishTurn(); check("fin-turno",bf,-1,null);
  } else if(s.phase==="council"){ 
   for(let k=0;k<2;k++){const a=Math.floor(Math.random()*n), t=Math.floor(Math.random()*n); const ty=TYPES[Math.floor(Math.random()*TYPES.length)]; const b=snap(); const r=U.registerInteraction(a,ty,t,true); if(r.ok)check("consejo",b,a,r,ty);}
   const b=snap(); U.endCouncil(); check("fin-consejo",b,-1,null);
  } else if(s.phase==="resolution"){ const b=snap(); U.nextRound(); check("inicio-ronda",b,-1,null);} }
}
console.log("subidas de herida",events,"sin aviso:",JSON.stringify(bad,null,1));
