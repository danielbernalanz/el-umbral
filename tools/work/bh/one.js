const L=require('./lib.js'),{playGame}=require('./fuzz.js');
const [seed,np,min,mode,rt,pace]=[+process.argv[2],+process.argv[3],+process.argv[4],process.argv[5]||'legal',process.argv[6]==='1',+(process.argv[7]||1)];
const E=L.loadEngine(process.env.ENG==='092'?L.W092:L.W097);
const r=playGame(E,{seed,np,minutes:min,mode,rt,errcheck:process.env.ERRC==='1',deep:process.env.DEEP==='1',pace});
r.F.forEach(f=>console.log(f.sev,f.tag,f.msg.slice(0,500)));console.log('ended',r.ended,r.end,r.calls);
