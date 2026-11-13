const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js");
let propose=null;
function round(acts){ // acts: {id:[action,target]}
  let s=U.getState();
  for(let k=0;k<s.players.length;k++){ s=U.getState(); if(s.phase!=="private")break; if(s.handoff){U.nextTurn();k--;continue;}
    const p=U.currentPlayer(); U.getPactOffers(p.id).forEach(o=>{const ar=U.answerPact(p.id,o.idx,true); console.log("  acepta",o.from,o.label,ar.ok,ar.msg);});
    const a=acts[p.id]||["meditar",null]; const r=U.act(p.id,a[0],a[1]); if(!r.ok)console.log("act fail",a,r.msg);
    if(propose&&p.id===0){const d=U.declare(0,propose,1); console.log("  declara",propose,d.ok,d.text||d.msg); propose=null;} U.finishTurn(); }
  let g=0; while(U.getState().handoff&&g++<5)U.nextTurn();
}
let res={};
for(const [type,acts,label] of [
 ["pacto_no_agresion",{0:["meditar",null],1:["meditar",null],2:["meditar",null]},"cumple"],
 ["pacto_silencio",{0:["investigar",1],1:["meditar",null],2:["meditar",null]},"rompe"],
 ["pacto_proteccion",{0:["proteger",1],1:["meditar",null],2:["meditar",null]},"cumple-protege"]]){
  U.createGame(["A","B","C"],{minutes:60}); 
  // ronda 1: privado + consejo con pacto
  propose=type; round({});
  let s=U.getState(); if(s.phase!=="council"){ console.log("fase",s.phase); }
  U.endCouncil(); U.nextRound();
  console.log(type,"(propuesto en R1; B decide en R2) vigentes A antes:",U.activePacts(0).length);
  round(acts); let out=U.endCouncil(); if(U.activePacts(0).length){U.nextRound(); round(acts); out=out.concat(U.endCouncil());} console.log(" ",label,"->",out.filter(x=>/pacto/i.test(x)).join(" | ")||"(sin línea de pacto)", "vigentes tras:",U.activePacts(0).length,"traiciones A:",U.getState().players[0].betrayals,"notas B:",JSON.stringify(U.getState().players[1].notes.filter(n=>/pacto/.test(n)).slice(-1)));
}
