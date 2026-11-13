const L=require("./lib.js"); const F=require("./fuzz.js"); const E=L.loadEngine(process.env.ENGDIR);
const c={}; const N=+process.argv[2]||60;
for(let g=0;g<N;g++){ const r=F.playGame(E,{seed:3000+g,np:3+g%8,minutes:[10,20,45][g%3],mode:"legal",keep:true,pace:1}); const st=JSON.parse(r.state);
 (st.glog||[]).forEach(e=>{ let k=e.k; if(k==="act") k="act:"+String(e.a).split(",")[1]+(e.ok?"":"(fail)"); c[k]=(c[k]||0)+1;});
 st.players.forEach(p=>{ if(p.ally)c.ally=(c.ally||0)+1; if(p.secretPaid)c.secretPaid=(c.secretPaid||0)+1; if(p.risenBy!=null)c.risen=(c.risen||0)+1; if(p.asesinoVia)c["via:"+p.asesinoVia]=(c["via:"+p.asesinoVia]||0)+1;});
}
console.log(Object.entries(c).sort().map(([k,v])=>k+"="+v).join("  "));
