const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
for(const variant of ["items","hurt"]){
U.createGame(["A","B","C","D"],{minutes:20}); const st=U.getState();
st.players.forEach(p=>{p.items=[{id:"manto"}];p.corr=45;p.focus=1;if(variant==="hurt")p.hp=2;});
st.eventsSeen=D.EVENTS.filter(e=>e.id!=="rencilla").map(e=>e.id); st.round=1; st.phase="resolution"; U.nextRound();
console.log(variant, st.event.id, st.phase, st.round, st.players.map(p=>p.dead+"/"+p.dying));}
