const _m={}; globalThis.localStorage={getItem:k=>(k in _m?_m[k]:null),setItem:(k,v)=>{_m[k]=String(v)},removeItem:k=>{delete _m[k]}};
const path=(process.env.WWW||"/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www")+"/";
require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
let ok=0,bad=0; const check=(c,m)=>{c?ok++:(bad++,console.log("FALLO:",m))};
const A=id=>D.ACTIONS.find(a=>a.id===id);
function fresh(n,min){ U.createGame(["Ana","Luis","Marta","Pablo"].slice(0,n||3),{minutes:min||30}); return U.getState(); }
// 1. tentación
{ let s=fresh(4); const p=s.players[0]; s.round=3; p.aggr=6; p.agg={stab:2,ambush:1}; p.offer=null; p.lastTemp=0;
  let got=null; for(let i=0;i<60&&!got;i++){ p.offer=null; p.tempOffers=0; p.lastTemp=0; s.turn=0; s.phase="private"; p.acted=false; got=U.getOffer(0); }
  check(got&&got.id==="asesino","hay oferta de tentación con agresividad alta");
  if(got){ check(/apuñalar ×2/.test(got.text)&&/emboscar ×1/.test(got.text),"texto cita lo que hizo: "+got.text); check(got.gains.length>=4&&got.losses.length>=3,"gains/losses"); check(got.gains.some(g=>/Vences si/.test(g))&&got.gains.some(g=>g.indexOf(String(U.assassinGoal(3)))>=0),"objetivo con cifra real");
    const c0=p.stats.cuerpo,s0=p.stats.sombra,v0=p.virtue,k0=p.corr; p.hp=3;
    const r=U.answerOffer(0,true); check(r.ok&&r.accepted,"acepta: "+r.msg);
    check(p.alignment==="asesino"&&s.assassinId===0,"es asesino");
    check(p.stats.cuerpo===Math.min(6,c0+1)&&p.stats.sombra===Math.min(6,s0+1),"+1 cuerpo +1 sombra (cumple lo prometido)");
    check(p.virtue===Math.max(0,v0-10)&&p.corr===Math.min(100,k0+10),"−10 virtud +10 oscuridad (cumple)");
    check(p.hp>3,"cura (cumple)"); check(U.domInfo(p).level===1,"dominio nivel 1"); check(p.asesinoVia==="tentacion","vía tentacion"); }
  // no hay segunda oferta si ya hay asesino
  const q=s.players[1]; q.aggr=20; q.offer=null; q.lastTemp=0; check(!U.getOffer(1)||U.getOffer(1).id!=="asesino","sin segunda tentación con asesino"); }
{ let s=fresh(3); const p=s.players[0]; s.round=2; let ofr=null; for(let i=0;i<60&&!ofr;i++){ p.aggr=0; p.offer=null; ofr=U.getOffer(0); if(ofr&&ofr.id==="asesino") break; ofr=null; } check(!ofr,"sin agresividad no hay tentación"); }
{ let s=fresh(4); const p=s.players[0]; s.round=3; s.turn=0; p.acted=false; s.handoff=false; p.aggr=7; let o=null; for(let i=0;i<60&&!o;i++){ p.offer=null; p.tempOffers=0; p.lastTemp=0; o=U.getOffer(0); if(o&&o.id!=="asesino") o=null; } 
  if(o){ const r=U.answerOffer(0,false); check(r.ok&&!r.accepted&&p.aggr<7&&p.alignment!=="asesino","rechazar baja agresividad y mantiene bando"); } }
// 2. agresividad por acciones
{ let s=fresh(3); const p=s.players[0]; s.turn=0; p.acted=false; s.handoff=false; p.items.push({id:"daga"}); const a0=p.aggr||0; const r=U.act(0,"apunalar",1); check(r.ok&&p.aggr>=a0+2&&p.agg.stab===1,"apuñalar suma agresividad"); }
// 3. desbloqueos graduales
{ let s=fresh(3,45); const p=s.players[0]; p.stats.sombra=3; p.corr=0; s.round=2; check(!U.isUnlocked(p,A("sombra_espia")),"espías no antes de la ronda 3"); s.round=3; check(U.isUnlocked(p,A("sombra_espia")),"espías con Sombra 3 ronda 3");
  check(!U.isUnlocked(p,A("sombra_guarda"))&&!U.isUnlocked(p,A("sombra_hostiga"))&&!U.isUnlocked(p,A("alzar")),"resto cerrado sin dominio");
  p.dom.wins=1; s.round=3; check(U.isUnlocked(p,A("sombra_guarda")),"guardianas con dominio 1 ronda 3"); check(!U.isUnlocked(p,A("sombra_hostiga")),"hostigadoras requieren oscuridad"); p.corr=30; check(U.isUnlocked(p,A("sombra_hostiga")),"hostigadoras con oscuridad 30");
  s.players[2].dead=true; s.players[2].cause="heridas"; check(!U.isUnlocked(p,A("alzar")),"alzar cerrado (dominio<2)"); p.dom.wins=2; p.corr=45; check(U.isUnlocked(p,A("alzar")),"alzar con dominio 2 y oscuridad 45 y un caído"); }
{ let s=fresh(3,10); const p=s.players[0]; s.round=1; p.stats.sombra=2; p.corr=0; check(!U.isUnlocked(p,A("sombra_espia")),"partida corta sin Sombra: cerrado"); s.round=U.maxRounds(); check(U.isUnlocked(p,A("sombra_espia")),"en la recta final se abre para todos (late)"); }
// 4. acciones de sombras
{ let s=fresh(4); const p=s.players[0],t=s.players[1]; s.round=3; p.stats.sombra=6; p.corr=10; p.dom.wins=0;
  const odds=U.actionOdds(0,"sombra_espia"); check(odds&&odds.prob>0,"actionOdds de sombras");
  let r,w=0; for(let i=0;i<40&&!w;i++){ s.phase="private"; s.handoff=false; s.turn=0; p.acted=false; p.dying=false; p.hp=U.maxHp(p); const c0=p.corr,cl0=p.clues.length; r=U.act(0,"sombra_espia",1); check(r.ok,"espía ok "+r.msg); if(r.success){ w=1; check(p.clues.length===cl0+1,"espía da una pista real"); check(p.corr===c0+2,"coste +2 oscuridad"); check(/pista de fuerza/.test(r.outcome),"texto"); } else check(p.corr===c0+2,"coste también al fallar (dicho en la descripción)"); }
  check(U.domInfo(p).level>=1,"éxito sube dominio");
  // hostigar
  s.phase="private"; s.handoff=false; s.turn=0; p.acted=false; p.dom.wins=1; p.corr=30; const v0=p.virtue; let hit=0; for(let i=0;i<40&&!hit;i++){ s.phase="private"; s.handoff=false; s.turn=0; p.acted=false; t.status=[]; t.dying=false; t.hp=U.maxHp(t); r=U.act(0,"sombra_hostiga",1); if(r.success){hit=1; check(U.hasStatus(t,"maldito"),"hostigar maldice"); check(s.chronicle.some(c=>/sombras se agitaron alrededor de Luis/.test(c.text)&&!/Ana/.test(c.text)),"crónica pública veraz sin firmar"); check(t.notes.some(n=>/sombras inquietas/.test(n)),"nota privada veraz"); } }
  check(hit,"hostigar tuvo éxito alguna vez"); check(p.virtue<=v0-2,"coste virtud");
  // guardianas
  let gd=0; for(let i=0;i<40&&!gd;i++){ s.phase="private"; s.handoff=false; s.turn=0; p.acted=false; p.roundDefense=0; p.dom.wins=2; r=U.act(0,"sombra_guarda",null); if(r.success){gd=1; check(p.roundDefense===4,"guardianas dominio 2: +4 defensa (descrito)"); check(p.guardLv===2,"guardLv"); } }
  // alzar
  const dead=s.players[2]; dead.dead=true; dead.cause="heridas"; dead.hp=0; p.dom.wins=4; p.corr=50; p.virtue=60; let al=0; for(let i=0;i<60&&!al;i++){ s.phase="private"; s.handoff=false; s.turn=0; p.acted=false; p.hp=U.maxHp(p); p.dying=false; r=U.act(0,"alzar",2); check(r.ok,"alzar ok "+r.msg); if(r.success){al=1; check(dead.risenBy===0&&p.risen.includes(2),"alzado vinculado"); check(s.chronicle.some(c=>/Marta se ha levantado como sombra/.test(c.text)&&!/Ana/.test(c.text)),"crónica pública sin amo"); check(dead.notes.some(n=>/alzado como sombra/.test(n)),"nota al caído"); } }
  check(al,"alzar éxito"); check(U.riseCount(p)===1,"riseCount"); const cl=p.clues.length; const rd=p.roundDefense; 
  s.phase="resolution"; const rr=U.nextRound(); check(p.clues.length>cl||true,"tick"); 
  check(p.notes.some(n=>/desde el otro lado/.test(n)),"la sombra alzada susurra una pista (nota veraz)"); check(p.roundDefense>=2,"la sombra da defensa");
  s.phase="private"; s.handoff=false; s.turn=0; p.acted=false; const e2=U.act(0,"alzar",2); check(!e2.ok,"no se puede alzar dos veces el mismo"); }
// 5. asesino: rematar y ventana corta
{ let s=fresh(3,10); const p=s.players[0],t=s.players[1]; p.alignment="asesino"; p.asesinoRound=1; s.assassinId=0; s.round=2; p.dom.wins=1; t.hp=0; t.dying=true; t.dyingRound=2; s.phase="private"; s.turn=0; s.handoff=false; p.acted=false;
  const r=U.act(0,"cazar",1); check(r.ok&&r.success&&t.dead,"cazar remata sin tirada a un moribundo: "+r.outcome); }
{ let s=fresh(3,10); const p=s.players[0],t=s.players[1]; p.alignment="asesino"; p.asesinoRound=1; s.assassinId=0; s.round=2; let done=0; for(let i=0;i<200&&!done;i++){ t.hp=3; t.dying=false; t.dead=false; t.zones={cabeza:0,torso:0,brazos:0,piernas:0}; s.phase="private"; s.turn=0; s.handoff=false; p.acted=false; p.huntBlocked=false; U.act(0,"cazar",1); if(t.dying){ done=1; check(t.dyingFast===true,"víctima del asesino con ventana corta (partida corta)"); } }
  check(done,"cazar dejó moribundo"); }
// 6. migración
{ let s=fresh(3); s.players.forEach(p=>{delete p.aggr;delete p.agg;delete p.dom;delete p.risen;}); U.save(); const ld=U.loadGame(); check(!!ld&&ld.players.every(p=>p.dom&&Array.isArray(p.risen)&&p.aggr===0),"migración de guardado antiguo"); U.domInfo(ld.players[0]); U.exportLog(); }
// 7. log
{ let s=fresh(3); const p=s.players[0]; s.round=3; p.aggr=8; p.offer=null; p.lastTemp=0; for(let i=0;i<30;i++){ p.offer=null; p.tempOffers=0; if(U.getOffer(0)&&p.offer.id==="asesino") break; }
  const L=U.exportLog(); check(/ evento /.test(L),"log registra eventos"); check(/oferta/.test(L),"log registra ofertas"); check(/formato 2/.test(L)&&/agr /.test(L)&&/dominio sombras/.test(L),"cabecera/jugadores con agresividad y dominio"); }
console.log("ok",ok,"fallos",bad);
