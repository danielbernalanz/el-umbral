const L=require('./lib.js'),{playGame}=require('./fuzz.js');const fs=require('fs');
const E=L.loadEngine(process.env.ENGDIR||L.W097);
for(const ver of ['092','095']){
 const saves=JSON.parse(fs.readFileSync('out/saves_'+ver+'.json'));const all={};let n=0,ended=0,calls=0;
 saves.forEach((sv,i)=>{ if(i%(+process.argv[2]||1))return; n++;
  for(const mode of ['legal','mixed']){
  const r=playGame(E,{seed:1000+i,np:3,minutes:20,mode,rt:true,errcheck:false,deep:true,pace:1,resume:sv.raw,from:ver+'#'+i});
  calls+=r.calls; if(r.ended)ended++;
  r.F.forEach(f=>{const k=f.tag+'|'+f.msg.replace(/\d+/g,'#').slice(0,110);if(!all[k])all[k]={n:0,f,i,mode};all[k].n++;});}
 });
 console.log(ver,'saves',n,'runs',n*2,'ended',ended,'calls',calls);
 Object.values(all).sort((a,b)=>b.n-a.n).slice(0,25).forEach(u=>console.log(' ',u.f.sev,u.f.tag,'x'+u.n,'save#'+u.i,u.mode,u.f.msg.slice(0,330)));
}
