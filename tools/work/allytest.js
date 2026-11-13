const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
U.createGame(["A","B","C"],{minutes:30}); const st=U.getState(); let ok=0,bad=0; const check=(c,m)=>{c?ok++:(bad++,console.log("FALLO",m))};
const a=st.players[st.turn]; const v=st.players[(st.turn+1)%3]; v.ally=true; a.items.push({id:"daga"});
const hp0=v.hp; const r=U.act(a.id,"robar",v.id); check(r.ok&&/interpone/.test(r.outcome),"aliado bloquea: "+JSON.stringify(r)); check(!v.ally,"aliado consumido"); check(v.hp===hp0,"sin daño");
console.log("outcome:",r.outcome);
// prep: mapa baja dificultad de explorar
U.createGame(["A","B","C"],{minutes:30}); const s2=U.getState(); const p=s2.players[s2.turn]; p.items=[{id:"mapa"}]; 
const o0=U.actionOdds(p.id,"explorar").prob; U.useItem(p.id,0,null); const o1=U.actionOdds(p.id,"explorar").prob; check(o1>o0,"mapa sube prob "+o0+"→"+o1);
const rr=U.act(p.id,"explorar"); check(rr.ok&&!p.prep,"prep consumido tras explorar");
// daga pasiva +2 en emboscada: llevar daga no se consume al usar nada
U.createGame(["A","B","C"],{minutes:30}); const s3=U.getState(); const q=s3.players[s3.turn]; q.items=[{id:"daga"}]; const e=U.useItem(q.id,0,null); check(!e.ok&&q.items.length===1,"daga no usable y no se gasta: "+e.msg);
// cota 2 usos
q.items=[{id:"cota"}]; q.usedItem=false; U.useItem(q.id,0,null); check(q.items.length===1&&q.items[0].left===1,"cota 1er uso"); q.usedItem=false; q.roundDefense=0; U.useItem(q.id,0,null); check(q.items.length===0,"cota se acaba");
// lupa
U.createGame(["A","B","C"],{minutes:30}); const s4=U.getState(); const w=s4.players[s4.turn]; w.items=[{id:"lupa"}]; U.useItem(w.id,0,null); check(w.evBonus===1,"lupa");
// guardado/carga
U.save(); const U2=U.loadGame(); check(U2&&U2.eventsSeen&&U2.eventsSeen.length>=1,"save/load eventsSeen");
console.log("ok",ok,"fallos",bad);
