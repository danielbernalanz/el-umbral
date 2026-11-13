const L=require('./lib.js');
const E=L.loadEngine(process.env.ENGDIR||L.W097);const {U,D}=E;
const NM=["Ana","Luis","Marta","Pablo","Eva","Iker","Noa","Leo","Mia","Rut"];
function mk(np,min,seed){Math.random=L.mulberry(seed||1);L.resetClock();Object.keys(L.mem).forEach(k=>delete L.mem[k]);U.createGame(NM.slice(0,np),{minutes:min||30});return U.getState();}
const log=(...a)=>console.log(...a);
function inv(tag){const o=L.invState(E,{wasDead:{},wasAss:{}});if(o.length)log('  INV['+tag+']',o.slice(0,4).join(' | '));}
// helper: act turn for everybody quickly via meditar
function allMeditate(){const s=U.getState();while(s.phase==='private'){const p=s.players[s.turn];if(!p.acted)U.act(p.id,'meditar');const r=U.finishTurn();if(s.phase!=='private')break;U.nextTurn();}}
// S1 exposed on reload
log('S1 exposed/reload');
{let s=mk(5,30,3);s.players[0].alignment='asesino';s.players[1].alignment='asesino';s.assassinId=0;
 s.players[1].exposed=true;s.assassinExposed=true;
 log('  prompt antes:',JSON.stringify(U.councilPrompt()));
 U.save();U.loadGame();log('  prompt tras recarga:',JSON.stringify(U.councilPrompt()), 'exposed0=',U.getState().players[0].exposed);}
// S2 asesino muerto en r1
log('S2 asesino muerto en ronda 1 (via emboscada simulada)');
{let s=mk(4,20,5);const a=s.players[2];a.alignment='asesino';a.asesinoRound=1;a.asesinoVia='ceder';s.assassinId=2;
 U._health.finish(a,'heridas');log('  fase tras finish directo:',s.phase);
 for(const p of s.players){ if(s.phase==='private'&&s.turn===p.id&&!p.acted){U.act(p.id,'meditar');U.finishTurn();} if(U.getState().phase==='ending')break; U.nextTurn();}
 log('  fase',U.getState().phase,'ending',U.getState().ending&&U.getState().ending.title,U.getState().ending&&U.getState().ending.winner);inv('s2');}
// S3 todos moribundos
log('S3 todos moribundos');
{let s=mk(4,20,6);s.players.forEach(p=>U._health.damage(p,99,{src:'gen'}));
 log('  fase tras damage a todos (sin checkTerminal):',s.phase,'dying:',s.players.map(p=>p.dying).join());
 const r=U.finishTurn();log('  finishTurn->',JSON.stringify(r),'fase',s.phase,s.ending&&s.ending.title,s.ending&&s.ending.winner);inv('s3');
 log('  muertos:',s.players.map(p=>p.dead).join(),'causas',s.players.map(p=>p.cause).join());}
// S3b todos moribundos menos uno que es el que mata?
log('S3b todos moribundos y uno vivo');
{let s=mk(4,20,7);[1,2,3].forEach(i=>U._health.damage(s.players[i],99,{src:'gen'}));
 U.act(0,'meditar');U.finishTurn();U.nextTurn();log('  fase',s.phase,'ronda',s.round,'moribundos',s.players.map(p=>p.dying?'D':p.dead?'X':'v').join(''));
 // ahora el vivo (0) es el unico en pie con socorrer: act socorrer
 inv('s3b');}
// S5 uno vivo
log('S5 un solo vivo, sin asesino');
{let s=mk(5,20,8);[1,2,3,4].forEach(i=>U._health.finish(s.players[i],'heridas'));U.act(0,'meditar');U.finishTurn();log('  fase',s.phase,s.ending&&s.ending.title,'|',s.ending&&s.ending.text);inv('s5');}
// S6 secretos tras morir
log('S6 secretos de muertos');
{let s=mk(6,20,9);const forced=['redentor','poder','justiciero','superviviente','sombra','lazo'];
 s.players.forEach((p,i)=>{p.secret={id:forced[i],text:D.SECRETS.find(x=>x.id===forced[i]).text};});
 s.players.forEach((p,i)=>{if(i>0)U._health.finish(p,'heridas');});
 s.players[3].corr=60; // poder muerto con mas corr
 const e=U.computeEnding();e.players.forEach(p=>log('  ',p.name,p.secretTitle,p.dead?'MUERTO':'vivo','cumplido=',p.fulfilled,'|',p.secretWhy));}
// S4 10 jugadores 5 min
log('S4 10 jugadores 5/10 min');
for(const mins of [5,10]){let s=mk(10,mins,11);log('  maxRounds',U.maxRounds(),'min',mins,'councilSeconds',U.councilSeconds(),'behind',U.behindSchedule());}
// S14 nombres
log('S14 nombres raros');
{try{U.createGame(["a".repeat(20),"a".repeat(20),"c"],{minutes:20});log('  ',U.getState().players.map(p=>JSON.stringify(p.name)).join());}catch(e){log('  exc',e.message)}
 try{U.createGame(["Ana","ana","ANA ","  ",""],{minutes:20});log('  ',U.getState().players.map(p=>JSON.stringify(p.name)).join());}catch(e){log('  exc',e.message)}
 try{U.createGame(["Ana","Ana 2","Ana"],{minutes:20});log('  ',U.getState().players.map(p=>JSON.stringify(p.name)).join());}catch(e){log('  exc',e.message)}
 try{U.createGame(["__proto__","constructor","$&"],{minutes:20});log('  ',U.getState().players.map(p=>JSON.stringify(p.name)).join());}catch(e){log('  exc',e.message)}
 try{U.createGame([null,undefined,5],{minutes:"abc"});log('  ',U.getState().players.map(p=>JSON.stringify(p.name)).join(),'min',U.getState().durationMin);}catch(e){log('  exc',e.message)}
 // $ en nombres: clue
 U.createGame(["Pa$$&x","Luis","Marta"],{minutes:20});const s=U.getState();s.players[0].alignment='asesino';s.assassinId=0;
 let got=new Set();for(let i=0;i<60;i++){const c=U._makeClue(s.players[0],2);got.add(c.text);} log('  pistas con $:',[...got].filter(x=>/Pa|\$/.test(x)).slice(0,5).join(' || '));}
