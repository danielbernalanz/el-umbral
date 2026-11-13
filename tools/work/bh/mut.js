const L=require('./lib.js'),{playGame}=require('./fuzz.js');const E=L.loadEngine(process.env.ENGDIR||L.W097);
const N=+process.argv[2]||200,mode=process.argv[3]||'legal',base=+process.argv[4]||100000;const uniq={};let calls=0,noend=0;
for(let g=0;g<N;g++){const seed=base+g,rr=L.mulberry(seed*31);const np=3+Math.floor(rr()*8),min=[10,20,30,60][Math.floor(rr()*4)];
 const r=playGame(E,{seed,np,minutes:min,mode,rt:true,errcheck:true,deep:true,pace:1,mutate:true});calls+=r.calls;if(!r.ended)noend++;
 r.F.forEach(f=>{const k=f.tag+'|'+f.msg.replace(/ \(tras.*/,'').replace(/\d+/g,'#').slice(0,140);if(!uniq[k])uniq[k]={n:0,f};uniq[k].n++;});}
console.log('mut',mode,N,'calls',calls,'noend',noend);
Object.values(uniq).sort((a,b)=>b.n-a.n).forEach(u=>console.log(u.f.sev,u.f.tag,'x'+u.n,'seed='+u.f.seed,'np='+u.f.np,'min='+u.f.min,u.f.msg.slice(0,420)));
