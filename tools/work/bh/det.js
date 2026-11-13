const L=require('./lib.js'),{playGame}=require('./fuzz.js');const E=L.loadEngine(process.env.ENGDIR||L.W097);
let same=0,diff=0,ex=[];const N=+process.argv[2]||150;
for(let g=0;g<N;g++){const seed=40000+g,rr=L.mulberry(seed*31);const np=3+Math.floor(rr()*8),min=[10,20,30,45,60][Math.floor(rr()*5)];
 const a=playGame(E,{seed,np,minutes:min,mode:'legal',rt:false,pace:1,keep:true});
 const b=playGame(E,{seed,np,minutes:min,mode:'legal',rt:true,pace:1,keep:true});
 // normalizar 'exposed' (bug conocido)
 const nz=s=>JSON.stringify(JSON.parse(s,(k,v)=>k==='exposed'?undefined:v));
 if(nz(a.state)===nz(b.state))same++;else{diff++;if(ex.length<5){const x=nz(a.state),y=nz(b.state);let i=0;while(x[i]===y[i])i++;ex.push(seed+':'+x.slice(i-80,i+60)+' || '+y.slice(i-80,i+60));}}
}
console.log('rt vs no-rt (exposed normalizado) iguales',same,'distintos',diff);ex.forEach(e=>console.log(e));
