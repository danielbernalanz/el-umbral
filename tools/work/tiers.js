const path="/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/";
const src=require("fs").readFileSync("sim2.js","utf8").replace('const end = U.getEnding','{const st=U.getState(); st.players.forEach(q=>{global.T=global.T||[0,0,0,0,0]; global.T[q.tierSeen||0]++; global.PL=(global.PL||0)+1;});}\n  const end = U.getEnding').replace('require(path + "data.js")','require(path + "data.js")');
require("fs").writeFileSync("sim4.js",src+'\nconsole.log("tramo máx visto por jugador (0..4):",JSON.stringify(T.map(x=>(100*x/PL).toFixed(0)+"%")));');
