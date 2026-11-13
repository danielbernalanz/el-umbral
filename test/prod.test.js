"use strict";
/* F7: cabeceras de seguridad, caché con ETag, estáticos, /healthz y apagado limpio. */
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { createServer } = require("../server/index");
const { request } = require("./helpers/netclient");
const { ENGINE_DIR } = require("./helpers/bot");

test("producción: cabeceras, ETag/304, rutas bloqueadas y apagado limpio", async () => {
  const app = createServer({ engineDir: ENGINE_DIR, publicDir: ENGINE_DIR, trustProxy: true });
  await new Promise((r) => app.server.listen(0, "127.0.0.1", r));
  const port = app.server.address().port;
  const get = (p, h) => new Promise((res, rej) => { require("node:http").get({ host: "127.0.0.1", port, path: p, headers: h || {} }, (r) => { const c = []; r.on("data", (x) => c.push(x)); r.on("end", () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(c).toString() })); }).on("error", rej); });
  try {
    const h = await get("/healthz"); assert.strictEqual(h.status, 200); assert.strictEqual(JSON.parse(h.body).ok, true);
    const root = await get("/", { "x-forwarded-proto": "https" });
    assert.strictEqual(root.status, 200); assert.match(root.body, /<html/);
    assert.strictEqual(root.headers["x-content-type-options"], "nosniff");
    assert.strictEqual(root.headers["referrer-policy"], "no-referrer");
    assert.match(root.headers["content-security-policy"], /frame-ancestors 'none'/);
    assert.match(root.headers["content-security-policy"], /script-src 'self'(;|$)/);
    assert.ok(root.headers["strict-transport-security"]);
    assert.ok(!(await get("/")).headers["strict-transport-security"], "HSTS solo tras proxy https");
    const js = await get("/net.js"); assert.strictEqual(js.headers["cache-control"], "no-cache"); assert.ok(js.headers.etag);
    assert.strictEqual((await get("/net.js", { "if-none-match": js.headers.etag })).status, 304);
    const sw = await get("/sw.js"); assert.strictEqual(sw.headers["cache-control"], "no-cache");
    assert.match(sw.body, /\/events/); assert.match(sw.body, /\/cmd/); assert.match(sw.body, /\/api\//); assert.match(sw.body, /\/healthz/);
    assert.ok([403, 404].includes((await get("/..%2f..%2fpackage.json")).status));
    assert.strictEqual((await get("/nope.txt")).status, 404);
    const post = await request(port, "POST", "/api/create", { name: "Ana" });
    assert.strictEqual(post.headers["cache-control"], "no-store"); assert.strictEqual(post.headers["x-content-type-options"], "nosniff");
  } finally {
    await new Promise((r) => { const t0 = Date.now(); app.shutdown(() => { assert.ok(Date.now() - t0 < 4500); r(); }); });
  }
});
