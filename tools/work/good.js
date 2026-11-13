const path="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
const rnd=n=>Math.floor(Math.random()*n);
const GOOD=["meditar","resistir","investigar","proteger","explorar"];
function pickAction(p,s,mode){
  if(mode.indexOf("good")===0){
    if(p.wounds>0 && Math.random()<0.5) return ["descansar",null];
    if(p.corr>=15 && Math.random()<0.6) return [Math.random()<0.5?"meditar":"resistir",null];
    const a=GOOD[rnd(GOOD.length)]; const o=s.players.filter(x=>x.id!==p.id&&!x.dead);
    const needsT=D.ACTIONS.find(x=>x.id===a).target; return [a, needsT? o[rnd(o.length)].id : null];
  }
  const acts=D.ACTIONS.filter(a=>!a.assassinOnly||p.alignment==="asesino"); const a=acts[rnd(acts.length)];
  let t=null; if(a.target){ const o=s.players.filter(x=>x.id!==p.id&&!x.dead&&(!a.canTarget||a.canTarget(x))); if(!o.length) return ["meditar",null]; t=o[rnd(o.length)].id; }
  return [a.id,t,a.gamble?5:null];
}
function run(modes,N){
  const R={corrByRound:{},ever20:0,ever50:0,umbral:0,assassin:0,goodAlive:0,games:0,goodN:0};
  for(let g=0;g<N;g++){
    U.createGame(["A","B","C","D","E","F","G","H","I","J"].slice(0,Number(process.env.NP||3))); let guard=0, peak=0, assassin=false, umbral=false;
    while(guard++<2000){
      const s=U.getState(); if(s.phase==="ending")break;
      if(s.phase==="private"){
        const p=U.currentPlayer();
        if(!s.handoff){
          const of=U.getOffer(p.id); if(of && modes[p.id]==="goodcura" && of.id==="cura") U.answerOffer(p.id,true);
          if(of && modes[p.id]==="goodall") U.answerOffer(p.id,true);
          let ok=false; for(let k=0;k<10&&!ok;k++){ const [a,t,st]=pickAction(p,s,modes[p.id]); const r=U.act(p.id,a,t,st===undefined?null:st); ok=r.ok; }
          if(!ok) U.act(p.id,"meditar",null,null);
          U.finishTurn();
        } else U.nextTurn();
      } else if(s.phase==="council") U.endCouncil();
      else if(s.phase==="resolution"){
        s.players.forEach(p=>{ if(modes[p.id].indexOf("good")===0){ (R.corrByRound[s.round]=R.corrByRound[s.round]||[]).push(p.corr); peak=Math.max(peak,p.corr);} });
        if(s.assassinId!==null) assassin=true; if(s.umbralAbierto) umbral=true;
        if(U.nextRound())break;
      }
    }
    R.games++; if(peak>=20)R.ever20++; if(peak>=50)R.ever50++; if(umbral)R.umbral++; if(assassin)R.assassin++;
  }
  const avg=a=>a&&a.length?Math.round(a.reduce((x,y)=>x+y,0)/a.length):null;
  const out={}; Object.keys(R.corrByRound).forEach(k=>out["r"+k]=avg(R.corrByRound[k]));
  return {corrMediaPorRonda:out, pctJuegosBuenoSupera20:Math.round(R.ever20/R.games*100), pctSupera50:Math.round(R.ever50/R.games*100), pctUmbralAbierto:Math.round(R.umbral/R.games*100), pctHayAsesino:Math.round(R.assassin/R.games*100)};
}
console.log("A) 3 buenos que rechazan todo:", JSON.stringify(run(["good","good","good"],1500)));
console.log("B) 3 buenos que aceptan solo curas:", JSON.stringify(run(["goodcura","goodcura","goodcura"],1500)));
console.log("C) 1 bueno que rechaza + 2 aleatorios:", JSON.stringify(run(["good","rand","rand"],1500)));
console.log("D) 3 que aceptan todo:", JSON.stringify(run(["goodall","goodall","goodall"],1500)));
