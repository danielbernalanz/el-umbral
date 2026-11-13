// prueba de eventos: cada evento se aplica con estados variados; se comprueba coherencia y que no lance errores
const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
let bad=0;
function chk(c,m){ if(!c){bad++; console.log("FALLO:",m);} }
const evs=D.EVENTS; console.log("eventos:",evs.length, "ids únicos:",new Set(evs.map(e=>e.id)).size);
chk(new Set(evs.map(e=>e.id)).size===evs.length,"ids duplicados");
for(const mins of [10,20,45]){
  // sin repetición en una partida larga
  U.createGame(["A","B","C","D"],{minutes:mins});
  let st=U.getState(); const seen=[]; 
  for(let r=1;r<=st.maxRounds+30;r++){ 
    st.round=r<=st.maxRounds?r:st.maxRounds; // fuerza más eventos
    // simular startRound lógico vía nextRound: usamos API interna eventForRound indirectamente
    st.phase="resolution"; st.players.forEach(p=>{p.dead=false;p.dying=false;p.hp=U.maxHp(p);});
    st.round=Math.min(r,st.maxRounds-1); const res=U.nextRound(); 
    if(st.state==="ending") break;
    if(!st.event) continue; seen.push(st.event.id); chk(typeof st.event.effectText==="string","effectText no string "+st.event.id);
    chk(!/undefined|NaN|\[object/.test(st.event.text+st.event.effectText),"texto roto "+st.event.id);
    st.round=r; st.phase="resolution";
  }
  const dups=seen.filter((x,i)=>seen.indexOf(x)!==i); console.log("min",mins,"rondas vistas",seen.length,"repetidos antes de agotar:",dups.length? dups.slice(0,3).join(","):"ninguno");
}
// cada evento forzado, con distintos estados
for(const ev of evs){
  for(const variant of ["plain","items","hurt"]){
    U.createGame(["A","B","C","D"],{minutes:20}); const st=U.getState();
    st.players.forEach((p,i)=>{ if(variant!=="plain"){ p.items=[{id:"manto"},{id:"racion"},{id:"mapa"},{id:"cuerda"},{id:"linterna"}]; p.corr=45; p.focus=1;} if(variant==="hurt"){ U._health.damage(p,U.maxHp(p)-2,{src:"gen"}); } });
    // forzar el evento
    st.eventsSeen=D.EVENTS.filter(e=>e.id!==ev.id).map(e=>e.id);
    st.round=1; st.phase="resolution"; 
    const before=JSON.stringify(st.players.map(p=>[p.hp,p.corr,p.virtue,p.focus,p.items.length,p.clues.length,p.notes.length]));
    try{ U.nextRound(); }catch(e){ chk(false,"excepción "+ev.id+" "+e.message); continue; }
    chk((st.event && st.event.id===ev.id) || (variant!=="items" && ev.req),"no salió "+ev.id+" ("+variant+") salió "+(st.event&&st.event.id));
    const eff=st.event.effectText; chk(typeof eff==="string"&&!/undefined|NaN|object/.test(eff),"effectText "+ev.id+": "+eff);
    st.players.forEach(p=>{ chk(p.hp>=0&&p.hp<=U.maxHp(p),"hp fuera de rango "+ev.id); chk(!p.dying||variant==="x"||variant==="hurt","moribundo por evento "+ev.id+" "+variant); chk(p.corr>=0&&p.corr<=100,"corr"); });
    if(variant==="plain") console.log(ev.id.padEnd(12),"|",eff||"(sin efecto público)");
  }
}
console.log("fallos:",bad);
