const U=require("../apk/assets/www/engine.js");
let errs=0,n=0;const seen={};
for(let g=0;g<300;g++){
  U.createGame?U.createGame(["A","B","C"],{minutes:20}):0;
  const s=U.getState(); const p=U.currentPlayer();
  for(const k of Object.keys(U._npcs)){
    for(const o of U._npcs[k].opts.concat([{id:"irse"}])){
      p.action="explorar";p.enc=null;p.encRound=0;p.dead=false;p.wounds=g%3;p.corr=(g*7)%80;
      p.enc={npc:k,round:s.round};
      const e=U.encounterStart(p.id); if(!e||e.npc!==k){errs++;console.log("nostart",k);continue;}
      const r=U.encounterAct(p.id,o.id); n++;
      if(!r.ok||typeof r.outcome!=="string"||/undefined|NaN|null/.test(r.outcome)){errs++;console.log("bad",k,o.id,r.outcome)}
      if(p.wounds>3||p.corr<0||p.corr>100||p.virtue<0||p.virtue>100||isNaN(p.corr)){errs++;console.log("inv",k,o.id)}
      seen[k+":"+o.id]=r.outcome;
    }
  }
}
console.log("tests",n,"errs",errs);
