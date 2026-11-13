const path="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
require(path+"data.js"); const U=require(path+"engine.js");
const seen={};
for(let g=0;g<400;g++){
  U.createGame(["Ana","Luis","Marta"],{minutes:30});
  const s=U.getState(), p=s.players[1];
  p.deeds=[{round:1,kind:"robar",target:2,ok:true},{round:1,kind:"tender",target:2,ok:true},{round:1,kind:"tender",target:2,ok:false},{round:2,kind:"conjurar",target:0,ok:true},{round:2,kind:"proteger",target:0,ok:true},{round:2,kind:"trato",target:null,ok:true},{round:2,kind:"cazar",target:0,ok:false},{round:2,kind:"devorar",target:2,ok:true},{round:2,kind:"apunalar",target:0,ok:true},{round:2,kind:"envenenar",target:0,ok:false}];
  p.corr=[5,30,45][g%3]; p.wounds=g%2; p.stolen=[{fromName:"Ana",item:"daga"}]; p.items=[{id:"daga"}];
  if(g%4===0){ s.shadow={strikes:1,last:null}; } else if (g%4===1) { p.alignment="asesino"; s.assassinId=1; }
  for(let k=0;k<10;k++){ const c=U._makeClue(p,1+(k%3)); const key=c.text.replace(/Ronda \d+/,"Ronda N").replace(/\(ronda \d+\)/,"(ronda N)"); seen[key]=(seen[key]||{n:0,str:new Set()}); seen[key].n++; seen[key].str.add(c.strength); }
}
Object.entries(seen).sort((a,b)=>b[1].n-a[1].n).forEach(([t,v])=>console.log(v.n,[...v.str].join("/"),t));
