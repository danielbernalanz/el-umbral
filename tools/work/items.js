const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
U.createGame(["A","B","C"],{minutes:60});
for(const id of Object.keys(D.ITEMS)){
  const st=U.getState(); const p=U.currentPlayer();
  p.items=[{id}]; p.usedItem=false; p.acted=false; p.wounds=2; p.corr=40; p.virtue=50; p.focus=0; p.roundDefense=0; p.roundAttack=0; p.status=[{id:"sangrado",left:2},{id:"veneno",left:2},{id:"maldito",left:2}];
  const t=st.players[(p.id+1)%3];
  const before={w:p.wounds,c:p.corr,v:p.virtue,f:p.focus,d:p.roundDefense,a:p.roundAttack,s:(p.status||[]).map(x=>x.id).join(),cl:p.clues.length,it:p.items.length};
  const r=U.useItem(p.id,0,t.id);
  const after={w:p.wounds,c:p.corr,v:p.virtue,f:p.focus,d:p.roundDefense,a:p.roundAttack,s:(p.status||[]).map(x=>x.id).join(),cl:p.clues.length,it:p.items.length,tc:t.clues.length};
  const diff=Object.keys(after).filter(k=>before[k]!==after[k]).map(k=>k+":"+before[k]+"→"+after[k]).join(" ");
  console.log(id.padEnd(12),"|",D.ITEMS[id].desc.slice(0,70),"\n   ->",r.ok?r.msg.slice(0,90):"NO:"+r.msg,"|",diff);
}
