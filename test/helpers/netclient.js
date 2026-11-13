"use strict";
/* Cliente Node mínimo (http) para probar el servidor: JSON por POST y SSE con análisis de eventos. */
const http = require("node:http");

function request(port, method, path, body, token, raw) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : (raw ? body : JSON.stringify(body));
    const headers = { "Content-Type": "application/json" };
    if (token) headers["x-token"] = token;
    if (data !== null) headers["Content-Length"] = Buffer.byteLength(data);
    const req = http.request({ host: "127.0.0.1", port, method, path, headers, agent: false }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => { const txt = Buffer.concat(chunks).toString("utf8"); let json = null; try { json = JSON.parse(txt); } catch (e) { /* no JSON */ } resolve({ status: res.statusCode, headers: res.headers, text: txt, json }); });
    });
    req.on("error", reject);
    if (data !== null) req.write(data);
    req.end();
  });
}

class Client {
  constructor(port, name) { this.port = port; this.name = name; this.token = null; this.pid = null; this.room = null; this.view = null; this.raw = []; this.views = 0; this.hb = 0; this.req = null; }
  async create() { const r = await request(this.port, "POST", "/api/create", { name: this.name }); if (r.json && r.json.ok) { this.token = r.json.token; this.pid = r.json.pid; this.room = r.json.room; } return r; }
  async join(room) { const r = await request(this.port, "POST", "/api/join", { room, name: this.name }); if (r.json && r.json.ok) { this.token = r.json.token; this.pid = r.json.pid; this.room = r.json.room; } return r; }
  start(endAt) { return request(this.port, "POST", "/api/start", { endAt }, this.token); }
  async cmd(cmd, args) { const r = await request(this.port, "POST", "/cmd", { cmd, args: args || [] }, this.token); return r.json; }
  leave() { return request(this.port, "POST", "/api/leave", {}, this.token); }
  /* abre el SSE con el token en cabecera; resuelve con el primer evento view */
  connect() {
    return new Promise((resolve, reject) => {
      let buf = "", first = true;
      const req = http.request({ host: "127.0.0.1", port: this.port, method: "GET", path: "/events", headers: { "x-token": this.token, Accept: "text/event-stream" } }, (res) => {
        this.status = res.statusCode;
        if (res.statusCode !== 200) { res.resume(); return reject(new Error("SSE " + res.statusCode)); }
        res.setEncoding("utf8");
        res.on("data", (c) => {
          buf += c;
          let i;
          while ((i = buf.indexOf("\n\n")) !== -1) {
            const ev = buf.slice(0, i); buf = buf.slice(i + 2);
            if (ev.startsWith(":hb")) { this.hb++; continue; }
            const m = /^event: view\ndata: (.*)$/s.exec(ev);
            if (m) { this.raw.push(m[1]); this.view = JSON.parse(m[1]); this.views++; if (first) { first = false; resolve(this.view); } }
          }
        });
      });
      req.on("error", (e) => { if (first) reject(e); });
      req.end();
      this.req = req;
    });
  }
  close() { if (this.req) this.req.destroy(); }
  async until(fn, ms) {
    const t0 = Date.now();
    while (Date.now() - t0 < (ms || 4000)) { if (this.view && fn(this.view)) return this.view; await new Promise((r) => setTimeout(r, 5)); }
    throw new Error("timeout esperando vista (" + this.name + ") fase=" + (this.view && this.view.phase));
  }
}
module.exports = { request, Client };
