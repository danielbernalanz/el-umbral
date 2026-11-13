const path="../apk/assets/www/"; require(path+"data.js"); const U=require(path+"engine.js"); const D=globalThis.UMBRAL_DATA;
U.createGame(["A","B","C","D"],{minutes:20}); const st=U.getState();
for(const sec of D.SECRETS){
  st.players[0].secret={id:sec.id,text:sec.text};
  const si=U.secretInfo(0); console.log(sec.id.padEnd(14),"|",si.hint);
}
// con pacto vigente
st.players[0].secret={id:"sombra",text:""}; 
for(const type of ["pacto_silencio","pacto_no_agresion","pacto_proteccion"]){
  st.pacts=[{a:0,b:1,type,round:1,expires:st.round,done:false,accepted:true}];
  console.log("sombra+",type,"|",U.secretInfo(0).hint);
}
st.pacts=[{a:1,b:0,type:"pacto_proteccion",round:1,expires:st.round+1,done:false,accepted:true}];
console.log("sombra protegido |",U.secretInfo(0).hint);
st.players[0].secret={id:"lazo",text:""}; console.log("lazo con pacto |",U.secretInfo(0).hint);
st.players[0].secret={id:"justiciero",text:""}; st.players[0].clues=[{about:2,strength:2,text:"x"}]; console.log("justicia |",U.secretInfo(0).hint);
st.players[0].secret={id:"superviviente",text:""}; st.players[0].hp=3; st.players[0].items=[{id:"vendas"},{id:"hierbas"}]; console.log("intacto |",U.secretInfo(0).hint);
// premios
for(const sec of D.SECRETS){ const g=require(path+"engine.js"); }
U.createGame(["A","B","C","D"],{minutes:20}); const s2=U.getState(); s2.round=s2.maxRounds;
const checks={redentor:p=>{p.corr=0},poder:p=>{p.corr=99},justiciero:p=>{p.successfulAccusations=1},superviviente:p=>{},sombra:p=>{p.betrayals=1},lazo:p=>{p.keptPacts=2}};
s2.players.slice(0,4).forEach((p,i)=>{ const sec=D.SECRETS[i]; p.secret={id:sec.id,text:sec.text}; checks[sec.id](p); });
s2.players[3].secret={id:"lazo",text:""}; s2.players[3].keptPacts=2;
// forzar cierre de consejo
s2.phase="council"; s2.council={interactions:[],ambushes:[],used:{}}; s2.players.forEach(p=>s2.council.used[p.id]={accuse:0,plot:0});
U.endCouncil();
s2.players.forEach(p=>console.log(p.name,p.secret.id,"pagado:",p.secretPaid,"|",p.notes.slice(-1)[0]));
console.log(U.exportStory(true).slice(0,1800));
