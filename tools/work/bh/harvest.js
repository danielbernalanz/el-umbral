const L=require('./lib.js'),{playGame,NAMES}=require('./fuzz.js');
const E=L.loadEngine(L.W097);const {U}=E;
const pub={},priv={},clue={},res={};
const norm=t=>{let x=String(t);NAMES.forEach(n=>{x=x.replace(new RegExp('\\b'+n+'\\b','g'),'N')});return x.replace(/\d+/g,'#').replace(/«.*»/,'«…»')};
const N=+process.argv[2]||300;
for(let g=0;g<N;g++){const seed=9000+g;const rr=L.mulberry(seed*31);const np=3+Math.floor(rr()*8),min=[10,15,20,30,45,60][Math.floor(rr()*6)];
 const r=playGame(E,{seed,np,minutes:min,mode:g%3?'legal':'mixed',pace:1,keep:true});
 const st=JSON.parse(r.state);
 st.chronicle.forEach(c=>{const k=norm(c.text);pub[k]=(pub[k]||0)+1});
 st.publicClues.forEach(c=>{const k=norm(c.text);clue[k]=(clue[k]||0)+1});
 st.players.forEach(p=>p.notes.forEach(n=>{const k=norm(n.replace(/^Ronda #?\d+: /,''));priv[k]=(priv[k]||0)+1}));
}
const dump=(o,f)=>require('fs').writeFileSync(f,Object.entries(o).sort((a,b)=>b[1]-a[1]).map(([k,v])=>v+'\t'+k).join('\n'));
dump(pub,'pub.txt');dump(priv,'priv.txt');dump(clue,'clue.txt');
console.log(Object.keys(pub).length,Object.keys(priv).length,Object.keys(clue).length);
