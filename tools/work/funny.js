const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js");
let n=0; for(let g=0;g<40;g++){U.createGame(["A","B","C"],{minutes:20});const s=U.getState();
 for(const [aid,fn] of [["meditar",(p)=>{p.alignment="asesino";s.assassinId=p.id;p.corr=0}],["resistir",(p)=>{p.corr=0}],["descansar",(p)=>{p.wounds=0}]]){
  const p=U.currentPlayer(); p.acted=false; fn(p); const r=U.act(p.id,aid,null); if(r.ok&&/undefined|NaN/.test(r.outcome))console.log("MAL",r.outcome); else if(r.ok)n++; }}
console.log("ok",n);
