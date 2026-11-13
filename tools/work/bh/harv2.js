const L=require("/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/work/bh/lib.js");
const F=require("/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/work/bh/fuzz.js");
const E=L.loadEngine(process.env.ENGDIR);
const cnt={}; 
for(let g=0;g<60;g++){ const r=F.playGame(E,{seed:900+g,np:3+g%8,minutes:[10,20,45][g%3],mode:"legal",keep:true,pace:1}); const st=JSON.parse(r.state);
 st.chronicle.forEach(c=>{ let t=c.text; st.players.forEach(p=>{t=t.split(p.name).join("<N>")}); t=t.replace(/\d+/g,"#"); cnt[t]=(cnt[t]||0)+1; }); }
Object.entries(cnt).sort((a,b)=>b[1]-a[1]).forEach(([t,n])=>console.log(n,t.slice(0,200)));
