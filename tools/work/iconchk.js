const fs=require("fs");const W=process.argv[2];
global.window={};global.document={getElementById(){return null},dispatchEvent(){},addEventListener(){}};global.Event=function(){};
try{new Function("window","document",fs.readFileSync(W+"/img/sprites-map.js","utf8").replace(/\}\)\(window\)|\}\)\(this\)/,"})(window)"))(window,document)}catch(e){console.log("map eval",e.message)}
const map=window.UMBRAL_ICONS||{};const html=fs.readFileSync(W+"/index.html","utf8");
const ids=new Set([...html.matchAll(/<symbol[^>]*id="([^"]+)"/g)].map(m=>m[1]));
const bad=Object.entries(map).filter(([k,v])=>!ids.has(v));console.log("map",Object.keys(map).length,"symbols",ids.size,"mapas sin symbol:",bad);
const src=["ui.js","engine.js","data.js","index.html"].map(f=>fs.readFileSync(W+"/"+f,"utf8")).join("\n");
const used=new Set();
for(const m of src.matchAll(/\bic\(\s*["']([a-z_0-9]+)["']/g))used.add(m[1]);
for(const m of src.matchAll(/data-ic="([a-z_0-9]+)"/g))used.add(m[1]);
for(const m of src.matchAll(/\bicon\(\s*["']([a-z_0-9]+)["']/g))used.add(m[1]);
for(const m of src.matchAll(/\bicon:\s*"([a-z_0-9]+)"/g))used.add(m[1]);
console.log("usadas",used.size,"sin mapa:",[...used].filter(k=>!(k in map)));
