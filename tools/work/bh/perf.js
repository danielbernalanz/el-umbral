const L=require('./lib.js'),{playGame}=require('./fuzz.js');const E=L.loadEngine(L.W097);const {U}=E;
for(const [np,min] of [[3,10],[6,30],[10,60],[10,10],[10,5]]){
 let tms=0,maxState=0,maxLog=0,maxGlog=0,n=0,calls=0,tsave=0,maxSave=0,rounds=0;
 for(let g=0;g<12;g++){
  const t0=process.hrtime.bigint();
  const r=playGame(E,{seed:700+g,np,minutes:min,mode:'legal',pace:1,keep:true});
  tms+=Number(process.hrtime.bigint()-t0)/1e6;calls+=r.calls;n++;rounds+=r.rounds;
  const st=JSON.parse(r.state);maxState=Math.max(maxState,r.state.length);maxGlog=Math.max(maxGlog,(st.glog||[]).length);
  const lg=U.exportLog? null:null;
 }
 // size of live save and logs at the end of last game
 const sv=L.mem['umbral.v5.save'];const logs=L.mem['umbral_logs'];
 // time of save+load at mid state
 U.createGame(['A','B','C','D','E','F','G','H','I','J'].slice(0,np),{minutes:min});
 const t1=process.hrtime.bigint();for(let i=0;i<50;i++){U.save();U.loadGame();}const per=Number(process.hrtime.bigint()-t1)/1e6/50;
 console.log(`np=${np} min=${min}: ${ (tms/n).toFixed(0)} ms/partida, ${(calls/n).toFixed(0)} llamadas/partida, rondas medias ${(rounds/n).toFixed(1)}, state final max ${(maxState/1024).toFixed(0)} KB, glog max ${maxGlog}, save+load inicial ${per.toFixed(2)} ms, umbral_logs ${logs?(logs.length/1024).toFixed(0):0} KB`);
}
