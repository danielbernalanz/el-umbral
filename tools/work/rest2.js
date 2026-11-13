const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
let where={},tot=0,imm=0,notNet=0,causes={}; 
function pickAct(p){ const s=U.getState(); const acts=D.ACTIONS.filter(a=>!a.assassinOnly||U.isAssassin&&0).filter(a=>U.isUnlocked(p,a)&&a.id!=="conjurar"&&a.id!=="tender");
  if(p.wounds>0&&acts.some(a=>a.id==="descansar")&&Math.random()<0.8) return [D.ACTIONS.find(a=>a.id==="descansar"),null,null];
  const a=acts[Math.floor(Math.random()*acts.length)]; if(!a) return [D.ACTIONS[3],null,null];
  let t=null; if(a.target){const c=s.players.filter(x=>x.id!==p.id&&!x.dead&&(!a.canTarget||a.canTarget(x))); if(!c.length) return [D.ACTIONS.find(x=>x.id==="meditar"),null,null]; t=c[Math.floor(Math.random()*c.length)].id;}
  return [a,t,a.gamble?"low":a.mode?"sincera":null]; }
function watch(ph){const st=U.getState(); if(!st)return; for(const id in rec){const p=st.players[id]; if(p&&!p.dead&&p.wounds>rec[id].w){const k=ph+' +'+(p.wounds-rec[id].w); where[k]=(where[k]||0)+1;} if(p) rec[id].w=p.wounds;}}
let rec={};
for(let g=0;g<400;g++){ rec={};
  U.createGame(["A","B","C","D"],{minutes:30}); 
  for(let it=0;it<400;it++){ let s=U.getState(); if(!s||s.phase==="ending")break;
    if(s.phase==="private"){ if(s.handoff){U.nextTurn();continue;} const p=U.currentPlayer(); 
      if(rec[p.id]){ const r=rec[p.id]; tot++; if(p.wounds>=r.before){notNet++; const why=p.notes.slice(r.n).map(x=>x.replace(/Ronda \d+: /,"").slice(0,48)); const k=why.join(" | ")||"(sin nota)"; causes[k]=(causes[k]||0)+1;} delete rec[p.id]; }
      const [a,t,st]=pickAct(p); const before=p.wounds, n=p.notes.length; const r=U.act(p.id,a.id,t,st); 
      if(r.ok&&a.id==="descansar"){ if(before>0&&p.wounds>=before)imm++; rec[p.id]={before,n,w:p.wounds,ph:'tras-descansar'}; }
      U.finishTurn(); watch('finish'); }
    else if(s.phase==="council"){watch('pre-consejo');U.endCouncil();watch('endCouncil');}
    else if(s.phase==="resolution"){U.nextRound();watch('nextRound');}
  }
}
console.log(JSON.stringify(where));console.log("descansos medidos",tot,"| no bajaron al instante",imm,"| sin mejora neta al siguiente turno",notNet);
console.log(Object.entries(causes).sort((a,b)=>b[1]-a[1]).slice(0,8).map(x=>x[1]+"× "+x[0]).join("\n"));
