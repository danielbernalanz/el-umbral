const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1200,height:800}});
await p.goto('file:///tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/work/contact.html');
await p.screenshot({path:'/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/work/contact.png',fullPage:true});
// prueba del cargador real
await p.setContent('<body></body>');await p.addScriptTag({path:'/tmp/claude-0/-home-claude/7b586fea-69a6-5d02-a28a-5cd182c7f952/scratchpad/apk/assets/www/img/sprites-map.js'});
console.log(await p.evaluate(()=>icon('a_explorar','x')));
await b.close()})();
