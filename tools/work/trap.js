const path="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
require(path+"data.js"); const U=require(path+"engine.js");
U.createGame(["A","B","C"],{minutes:30});
const s=U.getState(); s.players[0].corr=20; s.players.forEach(p=>{p.did={explorar:3,proteger:3}});
let log=[];
for(let g=0;g<400&&U.getState().phase!=="ending";g++){
  const st=U.getState();
  if(st.phase==="private"){
    const p=U.currentPlayer();
    if(st.handoff){U.nextTurn();continue;}
    if(p.id===1&&U.getHandOffer(1)) U.answerHand(1,true);
    let r;
    if(p.id===0&&st.round===1) r=U.act(0,"tender",1,"trampa"); else r=U.act(p.id,"meditar",null,null);
    if(!r.ok) log.push("ERR "+r.msg);
    U.finishTurn();
  } else if(st.phase==="council") U.endCouncil();
  else if(st.phase==="resolution"){ const w=st.players[1]; log.push("ronda "+st.round+" B heridas="+w.wounds+" muerto="+w.dead); if(U.nextRound())break; }
}
console.log(log.join("\n"));
