const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
U.createGame(["Ana","Luis","Marta"],{minutes:20});
for(let it=0;it<300;it++){let s=U.getState(); if(!s||s.phase==="ending")break;
 if(s.phase==="private"){ if(s.handoff){U.nextTurn();continue;} const p=U.currentPlayer(); const acts=["investigar","explorar","proteger","meditar"]; const a=acts[Math.floor(Math.random()*4)]; const t=s.players.find(x=>x.id!==p.id&&!x.dead).id; U.act(p.id,a,D.ACTIONS.find(x=>x.id===a).target?t:null); const en=U.encounterStart(p.id); if(en)U.encounterAct(p.id,en.options[0].id); U.finishTurn(); }
 else if(s.phase==="council"){ U.registerInteraction(0,"pacto_silencio",1,true); U.endCouncil(); } else if(s.phase==="resolution"){U.nextRound();}
}
console.log(U.buildStory().slice(0,4).map(x=>(x.round||"")+": "+x.text).join("\n")); const L=U.exportLog(); console.log(L.split("\n").slice(0,9).join("\n")); console.log("líneas",L.split("\n").length,"bytes",L.length);
