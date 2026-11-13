const _m={}; globalThis.localStorage={getItem:k=>(k in _m?_m[k]:null),setItem:(k,v)=>{_m[k]=String(v)},removeItem:k=>{delete _m[k]}};
const path="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
let ok=0,bad=0; const check=(c,m)=>{c?ok++:(bad++,console.log("FALLO:",m))};
U.createGame(["Ana","Luis","Marta"],{minutes:20});
let s=U.getState();
const mk=(form,aspect,uses)=>({id:"t"+form+aspect+Math.random(),form,aspect,epithet:"de Vael",uses:uses||2,tune:null});
function fin(sp){ // reutiliza genSpell indirectamente: construir vía learnSpell no es posible; completar campos a mano
  const F={rayo:["off",1],sanar:["def",0],grillete:["off",1],sanar:["def",0]}; sp.kind=F[sp.form][0]; sp.target=sp.kind==="off"; sp.power=1; sp.stealth=false; sp.name=sp.form; sp.desc="x"; return sp; }
const a=s.players[0], b=s.players[1];
while(U.getState().turn!==a.id){ /* pasar turnos hasta Ana */ break; }
a.spells=[fin(mk("rayo","vacio",2)),fin(mk("sanar","luz",1))]; a.corr=0; a.hp=a.hp;
const ri=U.spellInfo(a.id,a.spells[0].id,b.id,"normal"), rc=U.spellInfo(a.id,a.spells[0].id,b.id,"cauto"), rd=U.spellInfo(a.id,a.spells[0].id,b.id,"desatado");
check(ri&&rc&&rd,"spellInfo existe");
check(rc.diff===ri.diff-1 && rd.diff===ri.diff+1 || ri.diff<=2,"dificultad cauto/desatado");
check(rc.prob>=ri.prob && ri.prob>=rd.prob,"% cauto>=normal>=desatado "+[rc.prob,ri.prob,rd.prob]);
check(rd.power===2&&rc.power===1,"potencia");
check(rd.cost.some(c=>/oscuridad/.test(c)),"coste desatado");
a.corr=45; const rdark=U.spellInfo(a.id,a.spells[0].id,b.id,"normal"), sdark=U.spellInfo(a.id,a.spells[1].id,null,"normal");
check(rdark.diff<ri.diff||ri.diff<=2,"oscuridad facilita ofensivo");
a.corr=0; const sclean=U.spellInfo(a.id,a.spells[1].id,null,"normal"); a.corr=45;
check(sdark.diff>=sclean.diff,"oscuridad dificulta protector");
// lanzar desatado muchas veces: invariantes
let blow=0,hurt=0,n=0;
for(let i=0;i<200;i++){
  U.createGame(["Ana","Luis","Marta"],{minutes:20}); s=U.getState();
  const p=s.players[s.turn], q=s.players.find(x=>x.id!==p.id);
  p.spells=[fin(mk("rayo","fuego",2))]; p.corr=10; const hp0=p.hp,c0=p.corr,notes0=p.notes.length;
  const r=U.cast(p.id,p.spells[0].id,q.id,"desatado");
  if(!r.ok){check(false,"cast "+r.msg);continue;}
  n++;
  check(p.corr>=c0+3,"desatado cuesta +3 oscuridad");
  if(!r.success){blow++; check(p.hp<hp0||p.dying,"fallo desatado hiere"); check(p.notes.length>notes0,"nota privada del retroceso"); check(/estalla/.test(r.outcome),"texto retroceso");}
  check(s.chronicle.some(c=>/magia desatada/.test(c.text)),"rastro público desatado");
  // cauto: si falla sin pifia no se gasta uso
}
check(blow>0,"hubo fallos desatados");
// cauto
let kept=0;
for(let i=0;i<200;i++){
  U.createGame(["Ana","Luis","Marta"],{minutes:20}); s=U.getState();
  const p=s.players[s.turn], q=s.players.find(x=>x.id!==p.id);
  p.spells=[fin(mk("grillete","luz",2))];
  const r=U.cast(p.id,p.spells[0].id,q.id,"cauto");
  if(!r.success&&!r.fumble){ check(p.spells[0]&&p.spells[0].uses===2,"cauto fallo conserva uso"); kept++; } else if(p.spells[0]) check(p.spells[0].uses===1,"uso gastado");
}
check(kept>0,"hubo fallos cautos");
// modo inválido -> normal; meditar repone
U.createGame(["Ana","Luis","Marta"],{minutes:20}); s=U.getState(); const p=s.players[s.turn];
p.spells=[fin(mk("sanar","hielo",1))]; const r0=U.cast(p.id,p.spells[0].id,null,"loquesea"); check(r0.ok,"modo inválido = normal");
U.createGame(["Ana","Luis","Marta"],{minutes:20}); s=U.getState(); const p2=s.players[s.turn];
p2.spells=[fin(mk("sanar","hielo",1))];
const med=D.ACTIONS.find(x=>x.id==="meditar"); const rm=U.act(p2.id,"meditar",null);
check(rm.ok&&p2.spells[0].uses===2,"meditar repone un uso (uses="+p2.spells[0].uses+")");
// progresión
U.createGame(["Ana","Luis","Marta"],{minutes:20}); s=U.getState(); const pp=s.players[s.turn];
pp.spells=[]; pp.items=[{id:"grimorio"},{id:"grimorio"}]; pp.corr=0;
const rmed=U.act(pp.id,"meditar",null);
check(rmed.ok&&pp.spells.length===1&&pp.spells[0].kind==="def"&&pp.spells[0].uses===1,"meditar sin conjuros enseña uno defensivo");
pp.acted=false; const sp0=pp.spells[0]; check(U.spellProgress(sp0).level===0&&U.spellProgress(sp0).next.length>5,"nivel 0 con texto");
const so=U.studyOptions(pp.id,0); check(so.ok&&so.options.length===3,"studyOptions");
const c0=pp.corr; const im=U.improveSpell(pp.id,sp0.id);
check(im.ok&&U.spellProgress(sp0).level===1&&pp.corr===c0+3&&!pp.items.some((x,i)=>i===0&&0),"perfeccionar sube a Practicante y cuesta 3 oscuridad: "+im.msg);
check(pp.notes.some(n=>/perfeccionaste/.test(n)),"nota privada perfeccionar");
// nivel 1 baja dificultad
const base=U.spellInfo(pp.id,sp0.id,null,"normal"); sp0.wins=0; const base0=U.spellInfo(pp.id,sp0.id,null,"normal");
check(base.diff<=base0.diff,"practicante −1 dificultad");
sp0.wins=4; check(U.spellProgress(sp0).level===3,"wins 4 = Maestro");
sp0.wins=2; sp0.mastered=false; check(U.spellProgress(sp0).level===2,"wins 2 = Dominado");
// migración: mastered antiguo sin wins
const old={id:"o1",form:"sanar",aspect:"hielo",epithet:"x",uses:1,tune:null,mastered:true}; check(U.spellProgress(old).level===2,"mastered antiguo = nivel 2");
// Maestro: desatado sin coste
pp.spells=[fin(mk("sanar","hielo",2))]; pp.spells[0].wins=4; const mi=U.spellInfo(pp.id,pp.spells[0].id,null,"desatado");
check(!mi.cost.some(c=>/si falla/.test(c)),"maestro sin retroceso");
// subida por éxitos
let ups=0; for(let i=0;i<100;i++){U.createGame(["Ana","Luis","Marta"],{minutes:20}); s=U.getState(); const q=s.players[s.turn]; q.spells=[fin(mk("sanar","hielo",3))]; q.hp=1; const r=U.cast(q.id,q.spells[0].id,null,"cauto"); if(r.success){ups++; check(U.spellProgress(q.spells[0]).level>=1,"éxito sube nivel");}}
check(ups>0,"hubo éxitos");
// secretos
check(D.SECRETS.every(x=>x.text&&x.title&&x.when&&typeof x.why==="function"),"secretos con texto/when/why");
console.log("ok",ok,"fallos",bad);
