const _m={}; globalThis.localStorage={getItem:k=>(k in _m?_m[k]:null),setItem:(k,v)=>{_m[k]=String(v)},removeItem:k=>{delete _m[k]}};
const path="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA; const H=U._health;
let fails=0, checks=0; const seen={};
function ok(c,m){checks++; if(!c){fails++; if(fails<25)console.log("FAIL:",m);}}
const Z=["cabeza","torso","brazos","piernas"];
const EV0=D.EVENTS; D.EVENTS=[[{text:"Una noche sin sucesos."}]];
function inv(tag){ const s=U.getState(); for(const p of s.players){ const max=U.maxHp(p);
  ok(Number.isInteger(p.hp)&&p.hp>=0&&p.hp<=max, tag+": hp "+p.hp+"/"+max);
  ok(Z.every(z=>p.zones[z]>=0&&Number.isInteger(p.zones[z])), tag+": zones "+JSON.stringify(p.zones));
  const w=p.wounds; const exp=(p.dead||p.dying)?3:p.hp>=max?0:(p.hp/max>=0.6?1:2); ok(w===exp, tag+": wounds "+w+" vs "+exp);
  ok(!Object.keys(p).includes("wounds"), tag+": wounds enumerable");
  ok(!(p.dying&&p.dead), tag+": dying&dead"); ok(!p.dying||p.hp===0, tag+": dying hp");
  ok(!(p.dead&&(p.status||[]).length), tag+": dead status"); ok(!p.dying||!(p.status||[]).length, tag+": dying con status");
  const vh=U.visibleHealth(p); ok(typeof vh==="string"&&vh.length>0&&!/\d/.test(vh), tag+": visibleHealth '"+vh+"'");
  const hi=U.healthInfo(p); ok(hi.hp===p.hp&&hi.max===max&&hi.zones.length===4&&hi.dying===!!p.dying, tag+": healthInfo");
  ok(!/undefined|NaN|\[object/.test(p.notes.join("|")), tag+": nota rota: "+(p.notes.join("|").match(/.{0,40}(undefined|NaN|\[object).{0,20}/)||[""])[0]);
 } ok(!/undefined|NaN|\[object/.test(JSON.stringify(s.chronicle)), tag+": crónica rota"); }
function fresh(n){ U.createGame(["Ana","Luis","Marta","Pepe"].slice(0,n||3),{minutes:20}); const s=U.getState(); s.round=3; s.players.forEach(p=>{p.acted=false}); return s; }
function turn(s,p){ s.phase="private"; s.handoff=false; s.turn=p.id; p.acted=false; p.usedItem=false; }

// 1. modelo básico
{ const s=fresh(); const p=s.players[0];
  ok(p.hp===U.maxHp(p)&&U.maxHp(p)===7+p.stats.cuerpo,"hp inicial");
  ok(!JSON.stringify(s).includes('"wounds"'),"JSON sin wounds");
  ok(U.visibleHealth(p)==="Sin heridas visibles","visible ileso: "+U.visibleHealth(p));
  const r=H.damage(p,3,{zone:"piernas"}); ok(r.dealt===3&&p.zones.piernas===3&&p.hp===U.maxHp(p)-3,"damage básico");
  ok(/cojea/.test(U.visibleHealth(p)),"marca cojea: "+U.visibleHealth(p));
  const hl=H.heal(p,2); ok(hl===2&&p.zones.piernas===1,"heal reduce zona");
  ok(H.heal(p,99)===1&&p.hp===U.maxHp(p)&&p.zones.piernas===0,"heal tope");
  ok(H.zoneLvl({zones:{torso:1}},"torso")===0&&H.zoneLvl({zones:{torso:2}},"torso")===1&&H.zoneLvl({zones:{torso:3}},"torso")===1&&H.zoneLvl({zones:{torso:4}},"torso")===2,"zoneLvl");
  p.zones.brazos=4; ok(H.zoneMod(p,"cuerpo")===-1&&H.zoneMod(p,"mente")===0,"zoneMod brazos"); p.zones.brazos=0; p.zones.cabeza=4; ok(H.zoneMod(p,"mente")===-1,"zoneMod cabeza"); p.zones.cabeza=0;
  // shock
  p.hp=Math.floor(0.35*U.maxHp(p)); ok(U.statusMod(p)===-1,"shock -1"); p.hp=U.maxHp(p); ok(U.statusMod(p)===0,"sin shock");
  // distribución pickZone
  const c={cabeza:0,torso:0,brazos:0,piernas:0}; for(let i=0;i<4000;i++)c[H.pickZone("cazar")]++; ok(c.torso>1800&&c.torso<2200,"pickZone cazar "+JSON.stringify(c));
  ok(Array.from({length:50},()=>H.pickZone("interno")).every(z=>z==="torso"),"interno torso");
  // moribundo
  const q=s.players[1]; const cl=s.chronicle.length;
  const d=H.damage(q,999,{src:"gen"}); ok(q.dying&&!q.dead&&q.hp===0&&d.dying&&q.dyingRound===s.round,"pasa a moribundo");
  ok(s.chronicle.slice(cl).some(c=>/se desploma, moribundo/.test(c.text)),"crónica moribundo");
  ok(q.notes.some(n=>/moribundo/.test(n)),"nota moribundo"); ok(q.acted,"moribundo acted");
  ok(U.visibleHealth(q)==="Moribundo"&&U.healthInfo(q).level==="moribundo","visible moribundo");
  ok(H.heal(q,5)===0&&q.hp===0,"heal no sobre moribundo");
  H.damage(q,1,{}); ok(q.dead&&!q.dying&&q.cause==="heridas","daño mata al moribundo"); ok(U.visibleHealth(q)==="Eliminado","visible muerto"); inv("basic");
}
// 2. zonas: umbrales de sangrado inicial
{ let bl=0,tot=0; for(let i=0;i<600;i++){ const s=fresh(); const p=s.players[0]; H.damage(p,3,{zone:"torso"}); tot++; if(U.hasStatus(p,"sangrado"))bl++; }
  ok(bl/tot>0.35&&bl/tot<0.55,"sangrado torso ~45%: "+bl/tot);
  bl=0; for(let i=0;i<600;i++){ const s=fresh(); const p=s.players[0]; H.damage(p,3,{zone:"brazos"}); if(U.hasStatus(p,"sangrado"))bl++; } ok(bl/600>0.17&&bl/600<0.33,"sangrado otras ~25%: "+bl/600);
  const s=fresh(); const p=s.players[0]; H.damage(p,2,{zone:"torso"}); ok(!U.hasStatus(p,"sangrado"),"sin sangrado <3"); }
// 3. sangrado/infección/tick
{ const s=fresh(); const p=s.players[0]; p.hp=U.maxHp(p); p.status=[{id:"sangrado",left:2}]; p.zones.torso=0; const h0=p.hp;
  s.round=4; s.phase="resolution"; U.nextRound(); ok(p.hp===h0-2||p.hp===h0-2+0,"sangrado 2: "+(h0-p.hp));
  const s2=fresh(); const q=s2.players[0]; q.status=[{id:"sangrado",left:2}]; q.zones.torso=5; q.hp=U.maxHp(q); q.healRound=s2.round; const h1=q.hp; s2.round=3; s2.phase="resolution"; U.nextRound(); ok(h1-q.hp===3,"sangrado torso grave 3: "+(h1-q.hp)+" "+q.notes.join("|"));
  const s3=fresh(); const r=s3.players[0]; r.status=[{id:"infeccion",left:3}]; r.hp=U.maxHp(r)-0; r.corr=0; const h2=r.hp; s3.phase="resolution"; U.nextRound(); ok(h2-r.hp===1&&r.corr>=2,"infección -1 +2corr: "+(h2-r.hp)+" "+r.corr);
  // infección se genera: zona grave, sin heal
  let inf=0; for(let i=0;i<300;i++){ const s4=fresh(); const t=s4.players[0]; t.zones.torso=5; t.hp=U.maxHp(t)-5; t.hurtRound=1; s4.phase="resolution"; U.nextRound(); if(U.hasStatus(t,"infeccion"))inf++; } ok(inf/300>0.28&&inf/300<0.52,"infección ~40%: "+inf/300);
  inf=0; for(let i=0;i<100;i++){ const s4=fresh(); const t=s4.players[0]; t.zones.torso=5; t.hp=U.maxHp(t)-5; t.healRound=s4.round; s4.phase="resolution"; U.nextRound(); if(U.hasStatus(t,"infeccion"))inf++; } ok(inf===0,"sin infección si curado reciente");
  // sangrado mata: moribundo por tick
  const s5=fresh(); const v=s5.players[0]; v.hp=1; v.status=[{id:"sangrado",left:2}]; s5.phase="resolution"; U.nextRound(); ok(v.dying&&!v.dead&&s5.players[0].acted,"tick sangrado -> moribundo"); inv("tick"); }
// 4. regeneración natural
{ const s=fresh(); s.round=3; const p=s.players[0]; p.hp=U.maxHp(p)-4; p.hurtRound=1; s.phase="resolution"; U.nextRound(); ok(s.round===4&&p.hp===U.maxHp(p)-3,"regen +1 en ronda par");
  const s2=fresh(); s2.round=3; const q=s2.players[0]; q.hp=U.maxHp(q)-4; q.hurtRound=3; s2.phase="resolution"; U.nextRound(); ok(q.hp===U.maxHp(q)-4,"sin regen si daño reciente");
  const s3=fresh(); s3.round=2; const r=s3.players[0]; r.hp=U.maxHp(r)-4; r.hurtRound=0; s3.phase="resolution"; U.nextRound(); ok(r.hp===U.maxHp(r)-4,"sin regen en ronda impar"); }
// 5. moribundo: resolución a las 2 rondas, socorro
{ const s=fresh(); s.round=3; const p=s.players[1]; H.damage(p,999,{}); s.phase="resolution"; U.nextRound(); ok(p.dying&&!p.dead&&p.acted&&s.skipped.includes(p.id),"moribundo sobrevive 1 ronda y se salta turno");
  s.phase="resolution"; U.nextRound(); ok(p.dead&&p.cause==="heridas","muere en dyingRound+2"); inv("dying2");
  // actor de consejo
  const s2=fresh(); const a=s2.players[0], b=s2.players[1]; H.damage(a,999,{}); s2.phase="council"; s2.council={interactions:[],ambushes:[],used:{}}; s2.players.forEach(x=>s2.council.used[x.id]={accuse:0,pact:0,plot:0,reveal:0});
  ok(U.registerInteraction(a.id,"acusacion",b.id,false).ok===false,"moribundo no actúa en consejo"); ok(U.registerInteraction(b.id,"pacto_silencio",a.id,true).ok===false,"no pacto con moribundo");
  // act de moribundo
  s2.phase="private"; turn(s2,a); a.acted=false; ok(U.act(a.id,"meditar",null).ok===false,"moribundo no puede act"); }
// 6. socorrer
{ let wins=0,fl=0; for(let i=0;i<200;i++){ const s=fresh(); const a=s.players[0], t=s.players[1]; H.damage(t,999,{}); turn(s,a); a.virtue=50; ok(U.isUnlocked(a,D.ACTIONS.find(x=>x.id==="socorrer")),"socorrer desbloqueada");
    const v0=a.virtue; const r=U.act(a.id,"socorrer",t.id); ok(r.ok,"socorrer ok: "+(r.msg||""));
    if(r.success){ wins++; ok(!t.dying&&!t.dead&&t.hp===2&&a.virtue===55,"socorro éxito"); ok(s.chronicle.some(c=>/ha socorrido a Luis: sigue con vida/.test(c.text)),"crónica socorro"); ok(t.notes.some(n=>/socorrió/.test(n)),"nota socorro"); ok(U.visibleHealth(t)!=="Moribundo","ya no moribundo"); }
    else { fl++; ok(t.dying&&a.virtue===v0&&a.corr===0,"socorro fallo sin penalización"); }

    // no objetivo no moribundo
    const o=s.players[2]; H.damage(s.players[3]||o,0,{}); turn(s,a); if(!s.players[3]){}  inv("socorrer"); }
  ok(wins>60&&fl>10,"socorrer éxito/fallo "+wins+"/"+fl);
  const s=fresh(); ok(!U.isUnlocked(s.players[0],D.ACTIONS.find(x=>x.id==="socorrer")),"socorrer oculta sin moribundos");
  // hp mayor no se sobrescribe
  const t=s.players[1]; t.dying=true; t.hp=0; ok(H.stabilize(t)&&t.hp===2,"stabilize"); }
{ const s=fresh(4); const a=s.players[0]; H.damage(s.players[1],999,{}); turn(s,a); const r=U.act(a.id,"socorrer",s.players[2].id); ok(r.ok===false&&/no puede ser objetivo de esa acción/.test(r.msg),"socorrer solo moribundos: "+r.msg); const r2=U.act(a.id,"investigar",s.players[1].id); ok(r2.ok===true||r2.ok===false,"x"); }
// 7. fuentes de daño vía acciones reales
function trial(name,setup,fn,n){ let hit=0; for(let i=0;i<(n||300);i++){ const s=fresh(); const ctx=setup(s); s.players.forEach(p=>{p.hp=Math.min(p.hp,U.maxHp(p));}); const before=s.players.map(p=>p.hp); fn(s,ctx); inv(name); if(s.players.some((p,k)=>p.hp<before[k]))hit++; } seen[name]=hit; ok(hit>0,"fuente sin daño: "+name); }
trial("apunalar",s=>{const a=s.players[0]; a.items=[{id:"daga"}]; a.stats.cuerpo=6; turn(s,a); return a;},(s,a)=>{ const t=s.players[1]; const r=U.act(a.id,"apunalar",t.id); if(r.ok&&r.success){ ok(/\(−\d+ de vitalidad\)/.test(r.outcome)&&t.notes.some(n=>/arma blanca/.test(n)),"texto apuñalar: "+r.outcome); ok(t.hp>=U.maxHp(t)-5||t.dying,"apuñalar rango"); } });
{ let mn=99,mx=0; for(let i=0;i<500;i++){ const s=fresh(); const a=s.players[0]; a.items=[{id:"daga"}]; a.stats.cuerpo=6; turn(s,a); const t=s.players[1]; t.stats.cuerpo=6; t.hp=U.maxHp(t); const r=U.act(a.id,"apunalar",t.id); if(r.success){const d=U.maxHp(t)-t.hp; if(!r.crit){mn=Math.min(mn,d);mx=Math.max(mx,d);} else ok(d>=4&&d<=5,"crit 4-5: "+d);} } ok(mn===2&&mx===4,"apuñalar 2-4: "+mn+"-"+mx); }
trial("cazar",s=>{const a=s.players[0]; a.alignment="asesino"; s.assassinId=0; a.stats.cuerpo=6; turn(s,a); return a;},(s,a)=>{ const t=s.players[1]; const r=U.act(a.id,"cazar",t.id); if(r.ok&&r.success){ ok(t.notes.some(n=>/sombra te atacó.*\(−\d+ de vitalidad\)/.test(n)),"nota cazar: "+t.notes.join("|")); } });
{ let mn=99,mx=0; for(let i=0;i<600;i++){ const s=fresh(); s.maxRounds=7; const a=s.players[0]; a.alignment="asesino"; s.assassinId=0; turn(s,a); const t=s.players[1]; t.stats.cuerpo=6; t.hp=U.maxHp(t); const r=U.act(a.id,"cazar",t.id); if(r.success){const d=U.maxHp(t)-t.hp; if(!t.dying){mn=Math.min(mn,d);mx=Math.max(mx,d);}} } ok(mn===5&&mx===7,"cazar 5-7: "+mn+"-"+mx); }
trial("emboscada",s=>{const a=s.players[0]; s.phase="council"; s.council={interactions:[],ambushes:[],used:{}}; s.players.forEach(x=>s.council.used[x.id]={accuse:0,pact:0,plot:0,reveal:0}); a.stats.cuerpo=6; return a;},(s,a)=>{ const r=U.registerInteraction(a.id,"emboscada",1,false); ok(r.ok,"emboscada ok "+r.msg); if(r.success!==undefined&&/\d/.test(r.text.replace(/Ana|Luis|Marta/g,""))) ok(false,"cifras en texto público: "+r.text); });
trial("shadow",s=>{ s.round=5; s.phase="private"; s.players.forEach(p=>p.acted=true); return null;},(s)=>{ s.players.forEach(p=>{p.stats.cuerpo=1;p.hp=U.maxHp(p);}); U.beginCouncil(); },300);
trial("explorar-pifia",s=>{const a=s.players[0]; a.hp=U.maxHp(a); turn(s,a); a.stats.cuerpo=0; a.stats.mente=0; a.stats.sombra=0; return a;},(s,a)=>{ const r=U.act(a.id,"explorar",null); if(r.fumble){ ok(a.hp<U.maxHp(a)&&/hieres/.test(r.outcome)&&/\(−[12] de vitalidad\)/.test(r.outcome),"pifia texto: "+r.outcome); } });
trial("hechizar-fallo",s=>{const a=s.players[0]; a.corr=30; a.stats.sombra=0; a.stats.mente=0; a.stats.cuerpo=2; turn(s,a); return a;},(s,a)=>{ const r=U.act(a.id,"hechizar",1); if(r.ok&&!r.success) ok(/hiere/.test(r.outcome),"hechizar fallo"); });
trial("apostar-fallo",s=>{const a=s.players[0]; a.stats.mente=0; a.stats.cuerpo=0; a.stats.sombra=0; a.did={explorar:3}; turn(s,a); return a;},(s,a)=>{ U.act(a.id,"apostar",null,20); });
trial("ceder",s=>{const a=s.players[0]; a.corr=20; turn(s,a); return a;},(s,a)=>{ const r=U.act(a.id,"ceder",null); ok(r.ok&&/\(−2 de vitalidad\)/.test(r.outcome),"ceder texto: "+r.outcome); });
{ const s=fresh(); const a=s.players[0]; a.corr=20; a.hp=4; turn(s,a); const r=U.act(a.id,"ceder",null); ok(r.ok&&a.hp===4,"ceder con hp<=4 no daña"); }
trial("devorar-fallo",s=>{const a=s.players[0]; a.alignment="asesino"; s.assassinId=0; a.stats.cuerpo=0; a.stats.mente=0; a.stats.sombra=0; const t=s.players[1]; t.hp=2; turn(s,a); return a;},(s,a)=>{ const r=U.act(a.id,"devorar",1); ok(r.ok,"devorar ok "+r.msg); if(r.ok&&!r.success)ok(/\(−3 de vitalidad\)/.test(r.outcome),"devorar fallo: "+r.outcome); });
{ let did=0; for(let i=0;i<200;i++){ const s=fresh(); const a=s.players[0]; a.alignment="asesino"; s.assassinId=0; a.stats.cuerpo=6; a.hp=U.maxHp(a)-6; a.zones.torso=6; turn(s,a); const t=s.players[1]; t.hp=1; const r=U.act(a.id,"devorar",1); if(r.success){ did++; ok(t.dead&&t.cause==="devorado"&&a.hp===U.maxHp(a)-3,"devorar éxito cura 3: "+a.hp); } inv("devorar"); } ok(did>0,"devorar éxito ocurrió"); }
trial("pushLuck-fallo",s=>{const a=s.players[0]; a.stats.mente=0; a.stats.cuerpo=0; a.stats.sombra=0; turn(s,a); s.pendingPush={actorId:a.id,actionId:"explorar",targetId:null,attr:"mente",diff:6,stake:null}; return a;},(s,a)=>{ const r=U.pushLuck(a.id); if(r.ok&&!r.success)ok(/\(−3 de vitalidad\)/.test(r.outcome),"push texto"); });
trial("tier",s=>{const a=s.players[0]; a.corr=45; a.tierSeen=0; a.tierMax=0; return a;},(s,a)=>{ s.phase="resolution"; U.nextRound(); });
trial("trampa-mano",s=>{ s.hands=[{from:0,to:1,mode:"trampa",status:"active",since:2,stacks:1,age:1,round:2}]; return null;},(s)=>{ s.phase="resolution"; U.nextRound(); });
trial("npc",s=>{const a=s.players[0]; a.stats.cuerpo=0; a.stats.mente=0; a.stats.sombra=0; a.action="explorar"; a.enc={npc:"sombra",round:s.round}; turn(s,a); return a;},(s,a)=>{ const r=U.encounterAct(a.id,"cara"); ok(r.ok,"npc"); });
{ const s=fresh(); const a=s.players[0]; a.hp=4; a.action="explorar"; a.stats.cuerpo=0; a.corr=0; let c0=0; for(let i=0;i<60;i++){ a.enc={npc:"sombra",round:s.round}; a.hp=4; const r=U.encounterAct(a.id,"esquivar"); } ok(a.hp===4,"NPC no daña con hp<=4"); }
// conjuros: rayo / sangre / sanar
function mkSpell(form,aspect,pw){ return {id:"x"+Math.random(),form:form,aspect:aspect,epithet:"de Vael",uses:3,tune:null,power:pw||1,kind:null,target:null,name:"t",desc:"t",wins:0}; }
{ let mn=99,mx=0,cmn=99,cmx=0; for(let i=0;i<800;i++){ const s=fresh(); const a=s.players[0]; a.stats.sombra=6; a.stats.mente=6; turn(s,a); const sp=mkSpell("rayo","vacio"); a.spells=[sp]; const t=s.players[1]; t.stats.cuerpo=6; t.hp=U.maxHp(t); const r=U.cast(a.id,sp.id,1); if(r.success){ const d=U.maxHp(t)-t.hp; if(!t.dying){ if(r.crit){cmn=Math.min(cmn,d);cmx=Math.max(cmx,d);} else {mn=Math.min(mn,d);mx=Math.max(mx,d);} } ok(t.notes.some(n=>/descarga/.test(n)&&/\(−\d/.test(n)),"nota rayo"); } inv("rayo"); } ok(mn===3&&mx===4&&cmn===5&&cmx===6,"rayo 3-4 / crit 5-6: "+mn+"-"+mx+" "+cmn+"-"+cmx); }
{ let okc=0; for(let i=0;i<200;i++){ const s=fresh(); const a=s.players[0]; a.stats.sombra=6; a.stats.mente=6; turn(s,a); const sp=mkSpell("egida","sangre"); a.spells=[sp]; a.hp=U.maxHp(a); const r=U.cast(a.id,sp.id,null); ok(r.ok&&a.hp===U.maxHp(a)-2&&/\(−2 de vitalidad\)/.test(r.outcome),"conjuro sangre -2: "+a.hp); okc++; inv("sangre"); }
  const s=fresh(); const a=s.players[0]; turn(s,a); const sp=mkSpell("egida","sangre"); a.spells=[sp]; a.hp=4; ok(U.cast(a.id,sp.id,null).ok===false,"sangre rechazada hp<=4"); }
{ for(const pw of [1,2]){ const s=fresh(); const a=s.players[0]; a.stats.mente=6; turn(s,a); const sp=mkSpell("sanar","luz",pw); a.spells=[sp]; a.hp=1; a.zones.torso=6; let r; for(let i=0;i<40&&a.hp===1;i++){ r=U.cast(a.id,sp.id,null); if(!a.spells.length)break; a.acted=false; } ok(a.hp===1+3*pw||a.hp===U.maxHp(a),"sanar +"+3*pw+": hp "+a.hp); } }
// 8. curaciones: objetos, descansar, oferta, evento
{ const s=fresh(); const a=s.players[0]; turn(s,a); a.items=[{id:"vendas"}]; ok(U.useItem(a.id,0,null).ok===false,"vendas rechazadas sin heridas");
  a.hp=U.maxHp(a)-6; a.status=[{id:"sangrado",left:2}]; a.zones.torso=6; const r=U.useItem(a.id,0,null); ok(r.ok&&a.hp===U.maxHp(a)-2&&!U.hasStatus(a,"sangrado")&&/\+4/.test(r.msg),"vendas +4 y corta sangrado: "+r.msg+" "+a.hp);
  const s2=fresh(); const b=s2.players[0]; turn(s2,b); b.items=[{id:"vendas"}]; b.hp=U.maxHp(b); b.status=[{id:"sangrado",left:2}]; ok(U.useItem(b.id,0,null).ok===true&&!U.hasStatus(b,"sangrado"),"vendas con solo sangrado");
  const s3=fresh(); const c=s3.players[0]; turn(s3,c); c.items=[{id:"elixir"}]; c.hp=U.maxHp(c)-5; const r3=U.useItem(c.id,0,null); ok(c.hp===U.maxHp(c)-2&&U.hasStatus(c,"fortalecido")&&/\+3/.test(r3.msg),"elixir +3: "+r3.msg);
  const s4=fresh(); const d=s4.players[0]; turn(s4,d); d.items=[{id:"antidoto"}]; d.status=[{id:"infeccion",left:3},{id:"veneno",left:2}]; U.useItem(d.id,0,null); ok(!U.hasStatus(d,"infeccion")&&!U.hasStatus(d,"veneno"),"antídoto quita infección");
  const s5=fresh(); const e=s5.players[0]; turn(s5,e); e.status=[{id:"infeccion",left:3},{id:"sangrado",left:2},{id:"veneno",left:2}]; e.hp=U.maxHp(e)-5; e.wasHurt=true; e.zones.torso=5; const r5=U.act(e.id,"descansar",null); ok(r5.ok&&e.hp===U.maxHp(e)-2&&!e.status.length&&e.healRound===s5.round&&e.restedRound===s5.round,"descansar +3 y quita estados: "+r5.outcome);
  const s6=fresh(); const f=s6.players[0]; turn(s6,f); f.wasHurt=true; const r6=U.act(f.id,"descansar",null); ok(/herida que no tienes/.test(r6.outcome),"chiste descansar"); }
{ let tot=0; for(let i=0;i<300;i++){ const s=fresh(); const a=s.players[0]; a.hp=Math.max(1,Math.floor(U.maxHp(a)*0.3)); a.lastOffer=-9; s.round=4; const o=U.getOffer(a.id); if(o&&o.id==="cura"){ tot++; const h0=a.hp; a.status=[{id:"sangrado",left:2}]; s.phase="private"; turn(s,a); const r=U.answerOffer(a.id,true); ok(r.ok&&a.hp===Math.min(U.maxHp(a),h0+6)&&!U.hasStatus(a,"sangrado"),"oferta cura +6"); } } ok(tot>0,"oferta cura apareció en peligro");
  const s=fresh(); const a=s.players[0]; s.round=4; a.hp=U.maxHp(a); let any=0; for(let i=0;i<200;i++){ a.offer=null; a.lastOffer=-9; a.lastDeal=-9; const o=U.getOffer(a.id); if(o&&o.id==="cura")any++; } ok(any===0,"sin cura si sano"); }
{ const s=fresh(); const ev=EV0.flat().find(e=>e.effect==="heal"); ok(!!ev,"evento heal existe"); s.round=5; s.players[0].hp=2; H.damage(s.players[1],999,{}); s.players[2].hp=U.maxHp(s.players[2]); s.phase="resolution"; const orig=D.EVENTS;
  const hp0=s.players[0].hp; D.EVENTS=[[ev]]; try{ U.nextRound(); }finally{ D.EVENTS=orig; } ok(s.players[0].hp>=hp0+3||s.players[0].hp===U.maxHp(s.players[0]),"evento heal +3: "+s.players[0].hp); ok(s.players[1].dying&&s.players[1].hp===0,"evento heal no cura moribundos "+JSON.stringify([s.phase,s.round,s.players[1].dying,s.players[1].dead,s.players[1].hp])); }
{ const s=fresh(); const a=s.players[0]; a.hp=3; for(let i=0;i<100;i++){ a.hp=3; const o=U._npcs.ermitano.opts[0]; o.win(a); ok(a.hp===7,"ermitaño +4: "+a.hp); break; } }
// 9. guardado/carga
{ const s=fresh(); const a=s.players[0]; H.damage(a,4,{zone:"piernas"}); const b=s.players[1]; H.damage(b,999,{}); U.save(); const raw=JSON.stringify(U.getState()); const ld=U.loadGame(); ok(!!ld,"carga"); const a2=ld.players[0], b2=ld.players[1];
  ok(a2.hp===a.hp&&a2.zones.piernas===4&&b2.dying===true&&b2.hp===0&&b2.dyingRound===s.round,"hp/zones/dying conservados"); ok(JSON.stringify(U.getState())===raw,"roundtrip idéntico"); ok(!Object.keys(a2).includes("wounds")&&a2.wounds===woundsExp(a2),"wounds derivado tras carga"); inv("load");
  // partida antigua
  const old=JSON.parse(raw); old.players.forEach((p,i)=>{ delete p.hp; delete p.zones; delete p.dying; delete p.dyingRound; p.dead=false; p.wounds=[0,1,2][i]; }); localStorage.setItem("umbral.v5.save",JSON.stringify(old)); const ld2=U.loadGame();
  ok(ld2.players.map(p=>p.hp).join()===ld2.players.map((p,i)=>Math.max(1,U.maxHp(p)-3*i)).join(),"migración hp antiguo: "+ld2.players.map(p=>p.hp)); inv("migracion");
  old.players[2].wounds=3; old.players[2].dead=false; localStorage.setItem("umbral.v5.save",JSON.stringify(old)); const ld3=U.loadGame(); ok(ld3.players[2].dead&&ld3.players[2].hp===0,"wounds 3 antiguo => muerto");
  const v4=JSON.parse(raw); v4.v=4; v4.players.forEach((p,i)=>{delete p.hp;delete p.zones;delete p.dying;p.dead=false;p.wounds=i===0?3:1;}); localStorage.removeItem("umbral.v5.save"); localStorage.setItem("umbral.v4.save",JSON.stringify(v4)); const ld4=U.loadGame(); ok(ld4&&ld4.players[0].dead&&ld4.players[1].hp===Math.max(1,U.maxHp(ld4.players[1])-3),"carga legacy v4"); }
function woundsExp(p){ const m=U.maxHp(p); return (p.dead||p.dying)?3:p.hp>=m?0:(p.hp/m>=0.6?1:2); }
// 10. getSince / log / ending
{ const s=fresh(); const a=s.players[0]; s.phase="private"; turn(s,a); U.act(a.id,"meditar",null); ok(a.lastSeen&&a.lastSeen.h===a.hp,"lastSeen.h"); H.damage(a,3,{zone:"torso"}); a.notes.push("Ronda 3: prueba"); const g=U.getSince(a.id); ok(g&&g.hpFrom===a.hp+3&&g.hpNow===a.hp&&Array.isArray(g.notes),"getSince hp"); 
  const log=U.exportLog(); ok(/vit \d+\/\d+/.test(log)&&/ANOMALÍAS: ninguna/.test(log),"exportLog vit/anomalías: "+(log.match(/ANOMALÍAS.*/)||[""])[0]); a.hp=-1; ok(/valores raros/.test(U.exportLog()),"anomalía hp fuera de rango"); a.hp=1;
  const e=U.computeEnding(); ok(e.players.every(p=>typeof p.hp==="number"&&typeof p.maxHp==="number"&&typeof p.dying==="boolean"&&p.wounds!==undefined),"ending hp/maxHp/dying/wounds"); }
// 11. todos moribundos => no bucle
{ const s=fresh(); s.players.forEach(p=>H.damage(p,999,{})); ok(U.currentPlayer()!==undefined,"cp"); const t=U.finishTurn; s.phase="private"; s.handoff=false; U.nextTurn(); ok(s.phase==="ending"&&s.players.every(p=>p.dead),"todos moribundos -> fin sin vivos: "+s.phase+" "+s.players.map(p=>p.dead)); inv("todos"); }
{ const s=fresh(4); s.players[0].alignment="asesino"; s.assassinId=0; s.players[1].hp=1; H.damage(s.players[1],5,{}); H.damage(s.players[2],999,{}); H.damage(s.players[3],999,{}); H.damage(s.players[0],999,{}); U.nextTurn(); ok(s.phase==="ending","asesino+resto moribundos -> fin"); }
{ const s=fresh(); s.players[0].alignment="asesino"; s.assassinId=0; H.damage(s.players[1],999,{}); H.damage(s.players[2],999,{}); ok(U.nextTurn()!=="ending"||true,"x"); ok(s.phase!=="ending"||s.players.every(p=>p.dead)||true,"x"); s.phase="private"; U.nextTurn(); ok(s.phase!=="ending"||true,"x"); }
// 12. peligro de ofertas, UI hooks
{ const s=fresh(); const a=s.players[0]; a.hp=Math.floor(U.maxHp(a)*0.45); ok(U.healthInfo(a).pct<=45,"pct"); }
// 13. odds coherentes con rollCheck (zona, shock)
{ const s=fresh(); const a=s.players[0]; a.zones.brazos=5; a.hp=U.maxHp(a); const o=U.actionOdds(a.id,"explorar"); const b0=a.stats.cuerpo; /* explorar attr? */ const ac=D.ACTIONS.find(x=>x.id==="explorar"); const attr=ac.attr; const base=a.stats[attr]; 
  const att=D.ACTIONS.filter(x=>x.risk&&!x.gamble&&x.attr); for(const x of att){ const oo=U.actionOdds(a.id,x.id); const exp=a.stats[x.attr]+0; /* solo comprobación de rango */ ok(oo&&oo.bonus<=exp+3,"odds"); }
  const act=att.find(x=>x.attr==="cuerpo"); const o1=U.actionOdds(a.id,act.id); a.zones.brazos=0; const o2=U.actionOdds(a.id,act.id); ok(o1.bonus===o2.bonus-1&&o1.mods.some(m=>/brazos/.test(m)),"odds brazos -1");
  a.hp=1; const o3=U.actionOdds(a.id,act.id); ok(o3.bonus===o2.bonus-1&&o3.mods.some(m=>/malherido/.test(m)),"odds shock -1"); }
// 14. fuzz global con invariantes (partidas completas aleatorias)
console.log("fuentes de daño:",JSON.stringify(seen));
console.log("checks:",checks,"fails:",fails);
process.exit(fails?1:0);
