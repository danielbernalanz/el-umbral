"use strict";
/* Instantáneas cifradas de sala (persistencia sin disco ni cuentas).
   El servidor serializa el estado completo de una sala, lo comprime (gzip), lo cifra y autentica con AES-256-GCM
   (clave desde SNAPSHOT_KEY; el código de sala y la versión de esquema van como datos autenticados) y se lo entrega a los
   jugadores como blob opaco. Tras un reinicio, un jugador lo sube a /api/restore y la sala vuelve a existir.
   Sin SNAPSHOT_KEY la función queda DESACTIVADA (clave aleatoria de proceso: nada se podría descifrar tras reiniciar). */
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA = 1;                 /* súbelo si cambia el formato de Room/Game.snapshot */
const PREFIX = "U" + SCHEMA + ".";
const MAX_PLAIN = 8 * 1024 * 1024;

/* Identificador de compatibilidad del motor (v1.14.1). ANTES era un hash de data.js + engine.js + npc.js, así que CUALQUIER cambio
   de reglas, balance o textos invalidaba las salas guardadas (error 409) y cortaba las partidas en curso al desplegar.
   AHORA es un número fijo: una partida guardada se restaura con cualquier motor que lo comparta.
   SÚBELO SOLO si cambia el FORMATO del estado de la partida de forma que un estado antiguo ya no se pueda leer
   (campos renombrados o eliminados, o con otro significado). Los campos nuevos deben ser siempre opcionales. */
const ENGINE_COMPAT = 1;
function engineId() { return "c" + ENGINE_COMPAT; }

/* opts: { key: string|undefined, engineDir, log } */
function makeCodec(opts) {
  opts = opts || {};
  const hasKey = typeof opts.key === "string" && opts.key.length >= 16;
  const log = opts.log || (() => {});
  if (!hasKey) log("SNAPSHOT_KEY no definida (o muy corta, <16): persistencia de partidas DESACTIVADA; si el servidor se reinicia las salas se pierden.");
  const key = crypto.createHash("sha256").update("umbral-snapshot|" + (hasKey ? opts.key : crypto.randomBytes(32).toString("hex"))).digest();
  const engine = engineId(opts.engineDir);
  const aad = (code) => Buffer.from(PREFIX + String(code), "utf8");

  function encode(plain, code) {
    if (!hasKey) return null;
    const body = zlib.gzipSync(Buffer.from(JSON.stringify(plain), "utf8"));
    const iv = crypto.randomBytes(12);
    const c = crypto.createCipheriv("aes-256-gcm", key, iv);
    c.setAAD(aad(code));
    const ct = Buffer.concat([c.update(body), c.final()]);
    return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
  }
  /* -> { ok:true, plain } | { ok:false, reason: "off"|"format"|"auth"|"schema"|"engine"|"code" } */
  function decode(blob, code) {
    if (!hasKey) return { ok: false, reason: "off" };
    if (typeof blob !== "string" || blob.length < 40 || blob.length > 4 * 1024 * 1024 || blob.indexOf(PREFIX) !== 0 || !/^[A-Za-z0-9_-]+$/.test(blob.slice(PREFIX.length))) return { ok: false, reason: blob && String(blob).startsWith("U") && !String(blob).startsWith(PREFIX) ? "schema" : "format" };
    let plain;
    try {
      const raw = Buffer.from(blob.slice(PREFIX.length), "base64url");
      if (raw.length < 12 + 16 + 1) return { ok: false, reason: "format" };
      const d = crypto.createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
      d.setAAD(aad(code)); d.setAuthTag(raw.subarray(12, 28));
      const body = Buffer.concat([d.update(raw.subarray(28)), d.final()]);
      plain = JSON.parse(zlib.gunzipSync(body, { maxOutputLength: MAX_PLAIN }).toString("utf8"));
    } catch (e) { return { ok: false, reason: "auth" }; }
    if (!plain || typeof plain !== "object" || plain.schema !== SCHEMA) return { ok: false, reason: "schema" };
    if (plain.engine !== engine) return { ok: false, reason: "engine" };
    if (plain.code !== String(code)) return { ok: false, reason: "code" };
    return { ok: true, plain };
  }
  return { enabled: hasKey, encode, decode, engine, SCHEMA };
}

module.exports = { makeCodec, engineId, SCHEMA, ENGINE_COMPAT };
