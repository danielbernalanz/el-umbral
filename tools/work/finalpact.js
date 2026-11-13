const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js");
U.createGame(["A","B","C"],{minutes:5}); const N=U.maxRounds(); console.log("rondas",N);
function priv(propose){ for(let k=0;k<9;k++){ let s=U.getState(); if(s.phase!=="private")break; if(s.handoff){U.nextTurn();continue;}
  const p=U.currentPlayer(); U.getPactOffers(p.id).forEach(o=>U.answerPact(p.id,o.idx,true));
  U.act(p.id,"meditar",null); if(propose&&p.id===0){console.log("declara",U.declare(0,"pacto_no_agresion",1).ok);} U.finishTurn(); }
  let g=0; while(U.getState().handoff&&g++<5)U.nextTurn(); }
for(let r=1;r<N;r++){ priv(r===N-1); let s=U.getState(); if(s.phase==="council"){U.endCouncil();} if(U.getState().phase==="ended"||U.getState().ended)break; U.nextRound(); }
console.log("fase",U.getState().phase,"ronda",U.getState().round);
priv(false);
const before=[0,1].map(i=>[U.getState().players[i].keptPacts,U.getState().players[i].virtue]);
console.log("pactos",JSON.stringify(U.getState().pacts));
const o=U.endCouncil(); console.log("tras",[0,1].map(i=>[U.getState().players[i].keptPacts,U.getState().players[i].virtue]),"antes",before);
