const L=require('./lib.js');const E=L.loadEngine(process.env.ENGDIR||L.W097);const {U,D}=E;
const NM=["Ana","Luis","Marta","Pablo","Eva","Iker","Noa","Leo","Mia","Rut"];
function mk(np,min,seed){Math.random=L.mulberry(seed||1);L.resetClock();Object.keys(L.mem).forEach(k=>delete L.mem[k]);U.createGame(NM.slice(0,np),{minutes:min||30});return U.getState();}
const log=(...a)=>console.log(...a);
log('R2 foco sin tope');{let s=mk(4,30,2);const p=s.players[0];p.focus=0;
 p.items.push({id:'amuleto'},{id:'amuleto'});let r=[];s.turn=0;
 U.useItem(0,0,null);r.push(p.focus);p.usedItem=false;U.useItem(0,0,null);r.push(p.focus);log('  tras 2 amuletos focus=',r.join(','),'(tope documentado: 2)');
 p.focus=2;p.acted=false;U.act(0,'resistir');log('  resistir con foco 2 ->',p.focus);}
log('R3 nextRound fuera de fase');{let s=mk(4,30,3);log('  ronda',s.round,'fase',s.phase);U.nextRound();log('  tras nextRound en private: ronda',s.round,'fase',s.phase,'(nadie ha actuado en la ronda 1)');
 U.nextRound();log('  otra vez: ronda',s.round);}
log('R3b doble nextRound legitimo (doble toque)');{let s=mk(3,60,4);for(let i=0;i<3;i++){const p=s.players[s.turn];U.act(p.id,'meditar');U.finishTurn();U.nextTurn();} log('  fase',s.phase);U.endCouncil();log('  fase',s.phase,'ronda',s.round);U.nextRound();U.nextRound();log('  tras doble nextRound: ronda',s.round,'fase',s.phase,'acted=',s.players.map(p=>p.acted).join());}
log('R4 Ermitano sangre');{let s=mk(4,30,5);const p=s.players[0];p.enc={npc:'ermitano',round:1};p.hp=U.maxHp(p);for(let i=0;i<6;i++){p.enc={npc:'ermitano',round:1};p.notes.length=0;const r=U.encounterAct(0,'sangre');if(p.notes.length&&/palma/.test(p.notes[0])){log('  ',p.notes[0]);break;}}}
log('R8 save persiste tras final por muerte');{let s=mk(4,30,6);s.players.forEach((p,i)=>{if(i)U._health.finish(p,'heridas')});U.act(0,'meditar');U.finishTurn();log('  fase',s.phase,'hasSave=',JSON.stringify(U.hasSave()));}
log('R8b ending por tiempo/nextRound limpia save');{let s=mk(4,5,7);U.tick(5000);s.playedMs=5*60000+1;U.act(0,'meditar');log('  fase',s.phase,'hasSave=',JSON.stringify(U.hasSave()));}
log('R9 trampa mata moribundo');{let s=mk(4,30,8);const a=s.players[0],t=s.players[1];s.hands.push({from:0,to:1,mode:'trampa',status:'active',round:1,since:1,stacks:1,age:1});
 U._health.damage(t,99,{src:'gen'});log('  t dying',t.dying,'dyingRound',t.dyingRound);
 // forzar fin de ronda: todos acted
 s.players.forEach(p=>p.acted=true);s.phase='resolution';U.nextRound();log('  tras nueva ronda: t.dead',t.dead,'causa',t.cause,'notas',JSON.stringify(t.notes.slice(-3)));log('  cron',JSON.stringify(s.chronicle.slice(-4).map(c=>c.text)));}
log('R10 encounterAct de muerto/fuera de turno/fase');{let s=mk(4,30,9);const p=s.players[2];U._health.finish(p,'heridas');p.enc={npc:'mercader',round:1};const r=U.encounterAct(2,'comprar');log('  muerto:',JSON.stringify(r).slice(0,100),'items',p.items.length);
 s.phase='council';const q=s.players[3];q.enc={npc:'mercader',round:1};const r2=U.encounterAct(3,'comprar');log('  council, no es su turno:',r2.ok);}
log('R11 minutes NaN');{U.createGame(["a","b","c"],{minutes:"abc"});log('  durationMin',U.getState().durationMin,'timeLeft',U.timeLeftMs(),'maxRounds',U.maxRounds());}
log('R12 nombre proto');{U.createGame(["__proto__","toString","c"],{minutes:20});log('  ',U.getState().players.map(p=>p.name).join('|'));}
