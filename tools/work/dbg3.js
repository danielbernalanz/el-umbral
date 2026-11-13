const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
U.createGame(["A","B","C","D"],{minutes:20}); const st=U.getState();
st.players.forEach(p=>{p.hp=2;p.corr=45;}); 
st.eventsSeen=D.EVENTS.filter(e=>e.id!=="trampa").map(e=>e.id); st.round=1; st.phase="resolution";
const o=U.nextRound; console.log(JSON.stringify(st.chronicle.slice(-3)));
U.nextRound(); console.log(st.phase, st.chronicle.slice(-6).map(c=>c.text).join(" | "), st.players.map(p=>p.cause));
