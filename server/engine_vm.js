"use strict";
/* Carga data.js + engine.js (intactos) en un contexto vm propio. Un contexto por sala:
   el único estado mutable del motor es `state` (y el almacén en memoria LS), así que las salas no se mezclan. */
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");

const srcCache = new Map(); /* texto de los scripts, compartido (solo lectura) entre salas */
function readSrc(dir, file) {
  const f = path.join(dir, file), key = f;
  let st = srcCache.get(key);
  const mtime = fs.statSync(f).mtimeMs;
  if (!st || st.mtime !== mtime) { st = { mtime, text: fs.readFileSync(f, "utf8") }; srcCache.set(key, st); }
  return st.text;
}

/* opts: { dir, rng: () => [0,1), now: () => ms } */
function loadEngine(opts) {
  const dir = opts.dir;
  const sandbox = { __now: opts.now || Date.now, __rng: opts.rng || null };
  const ctx = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  vm.runInContext("Date.now = function () { return __now(); };" + (opts.rng ? "Math.random = function () { return __rng(); };" : ""), ctx);
  vm.runInContext(readSrc(dir, "data.js"), ctx, { filename: "data.js" });
  vm.runInContext(readSrc(dir, "engine.js"), ctx, { filename: "engine.js" });
  const U = vm.runInContext("UMBRAL", ctx), D = vm.runInContext("UMBRAL_DATA", ctx);
  return { ctx, U, D };
}

/* Generador con semilla (mulberry32) para pruebas reproducibles. */
function seeded(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

module.exports = { loadEngine, seeded };
