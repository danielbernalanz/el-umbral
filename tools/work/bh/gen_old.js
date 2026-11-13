// genera saves de motores antiguos (092/095) en distintos puntos de la partida
const L=require('./lib.js');const fs=require('fs');
const which=process.argv[2];const dir=which==='092'?L.W092:L.W095;
const E=L.loadEngine(dir);const {U,D}=E;
const out=[];const N=+process.argv[3]||40;
for(let g=0;g<N;g++){
  const rng=L.mulberry(g*977+5);Math.random=L.mulberry(g*131+3);L.resetClock();Object.keys(L.mem).forEach(k=>delete L.mem[k]);
  const R=n=>Math.floor(rng()*n),pk=a=>a[R(a.length)];
  const np=3+R((U.MAX_PLAYERS||6)-2);const NM=["Ana","Luis","Marta","Pablo","Eva","Iker","Noa","Leo","Mia","Rut"].slice(0,np);
  U.createGame(NM,{minutes:[10,20,30,60][R(4)]});
  let steps=0;const snap=()=>{const raw=L.mem["umbral.v5.save"];if(raw&&rng()<0.12&&out.length<400)out.push({ver:which,g,raw});};
  const adv=ms=>{while(ms>0){U.tick(Math.min(ms,5000));ms-=5000}};
  while(steps++<1500){const s=U.getState();if(!s||s.phase==='ending')break;snap();
    if(s.phase==='private'){ if(s.handoff){U.nextTurn();continue;} const p=s.players[s.turn];
      if(!p.acted){ let done=false;
        if(p.spells&&p.spells.length&&rng()<0.4){const sp=pk(p.spells);const tg=s.players.filter(x=>x.id!==p.id&&!x.dead);done=U.cast(p.id,sp.id,tg.length?pk(tg).id:null,'normal').ok;}
        for(let k=0;k<8&&!done;k++){const a=pk(D.ACTIONS);if(a.id==='conjurar')continue;if(a.assassinOnly&&p.alignment!=='asesino')continue;if(U.isUnlocked&&!U.isUnlocked(p,a))continue;
          let t=null;if(a.target){const o=s.players.filter(x=>x.id!==p.id&&!x.dead&&(!a.canTarget||a.canTarget(x)));if(!o.length)continue;t=pk(o).id}
          const st=a.mode?pk(['sincera','trampa']):a.gamble?pk([5,10,20]):null;done=U.act(p.id,a.id,t,st).ok;}
        if(!done)U.act(p.id,'meditar');}
      if(U.declare&&rng()<0.5){const al=s.players.filter(x=>x.id!==p.id&&!x.dead);if(al.length)U.declare(p.id,pk(['acusacion','emboscada','pacto_silencio','pacto_no_agresion','pacto_proteccion']),pk(al).id);}
      adv(rng()*40000);U.finishTurn();snap();
    } else if(s.phase==='council'){ if(U.resolveCouncil)U.resolveCouncil(); adv(60000); U.endCouncil(); }
    else if(s.phase==='resolution'){U.nextRound();}
  }
}
fs.writeFileSync('out/saves_'+which+'.json',JSON.stringify(out));
const ph={};out.forEach(o=>{const j=JSON.parse(o.raw);ph[j.phase]=(ph[j.phase]||0)+1});console.log(which,out.length,'saves',JSON.stringify(ph),'v=',[...new Set(out.map(o=>JSON.parse(o.raw).v))]);
