const path=process.argv[2]; require(path+"data.js"); const U=require(path+"engine.js");
U.createGame(["A","B","C","D"],{minutes:20}); const st=U.getState();
st.players.forEach(p=>{p.hp=2;}); st.round=1; st.phase="resolution"; U.nextRound();
console.log(st.phase, st.round, st.players.map(p=>p.dead+"/"+p.dying+"/"+p.hp), st.event&&st.event.id);
