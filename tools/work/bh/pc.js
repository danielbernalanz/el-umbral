const L=require('./lib.js'),{playGame}=require('./fuzz.js');const E=L.loadEngine(L.W097);const seen={};
for(let g=0;g<250;g++){const r=playGame(E,{seed:90000+g,np:3+g%8,minutes:30,mode:'legal',pace:1,keep:true});const st=JSON.parse(r.state);
 st.publicClues.forEach(c=>{const k=c.text.replace(/Ana|Luis|Marta|Pablo|Eva|Iker|Noa|Leo|Mia|Rut/g,'N').replace(/\d+/g,'#');seen[k]=(seen[k]||0)+1;});}
Object.entries(seen).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(v,k));
