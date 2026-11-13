#!/usr/bin/env node
/* Copia el cliente (fuente única) a public/. Uso: node scripts/sync-client.js [rutaWww]
   Por defecto toma la ruta de la variable CLIENT_SRC. No edita nada en el origen. */
const fs = require("fs"), path = require("path");
const src = process.argv[2] || process.env.CLIENT_SRC;
if (!src) { console.error("Indica la ruta de www (argumento o CLIENT_SRC)."); process.exit(1); }
const dst = path.join(__dirname, "..", "public");
function copy(a, b) {
  const st = fs.statSync(a);
  if (st.isDirectory()) { fs.mkdirSync(b, { recursive: true }); fs.readdirSync(a).forEach(f => copy(path.join(a, f), path.join(b, f))); }
  else fs.copyFileSync(a, b);
}
copy(src, dst);
console.log("Copiado", src, "->", dst);
