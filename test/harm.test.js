"use strict";
/* F0 de «daño con riesgo» (v1.8): catálogo D.HARM, objetos nuevos, contadores de oficios y textos de acciones.
   No prueba la resolución (F1): la cola state.harm debe existir vacía y las acciones nuevas seguir cerradas. */
const test = require("node:test");
const assert = require("node:assert");
const { loadEngine, seeded } = require("../server/engine_vm");
const { ENGINE_DIR } = require("./helpers/bot");

const DELIVERIES = ["directa", "diferida", "persistente", "plantada", "ambiental"];
const FAMILIES = ["filo", "veneno", "trampa", "fuego", "social"];
const OFICIOS = { filo: 0, veneno: 0, trampa: 0, fuego: 0, social: 0 };
const NEW_ITEMS = ["ampolla", "laudano", "cepo", "polvora", "moho", "aceite", "odre", "cebo", "trapo"];
const NEW_ACTIONS = ["zancadilla", "arma_improvisada", "ensanarse", "contagiar", "sabotear", "cepo",
  "cuerda", "polvora", "fuego", "embarrar", "sembrar_sospecha", "vigilar", "preparar_emboscada"];

function plain(x) { return JSON.parse(JSON.stringify(x)); }

function engine(seed) {
  return loadEngine({ dir: ENGINE_DIR, rng: seeded(seed), now: () => 1.8e12 });
}

test("D.HARM: las 24 formas de dañar, con ids únicos y todos los campos obligatorios", () => {
  const { D } = engine(1);
  assert.ok(Array.isArray(D.HARM), "D.HARM debe ser una lista");
  assert.strictEqual(D.HARM.length, 24, "el diseño fija 24 formas (§1)");
  const ids = new Set(), names = new Set();
  D.HARM.forEach((f) => {
    assert.ok(/^[a-z][a-z0-9_]*$/.test(f.id), "id estable en minúsculas: " + f.id);
    assert.ok(!ids.has(f.id), "id repetido: " + f.id); ids.add(f.id);
    assert.ok(typeof f.name === "string" && f.name.trim(), "nombre visible: " + f.id);
    assert.ok(!names.has(f.name), "nombre repetido: " + f.name); names.add(f.name);
    assert.ok(DELIVERIES.indexOf(f.delivery) !== -1, "entrega válida (" + f.id + "): " + f.delivery);
    assert.ok(FAMILIES.indexOf(f.family) !== -1, "familia válida (" + f.id + "): " + f.family);
    assert.ok(typeof f.req === "string" && f.req.trim(), "requisito visible: " + f.id);
    assert.ok(Number.isFinite(f.d0) && f.d0 >= 0 && f.d0 <= 8, "dificultad base d0: " + f.id);
    assert.ok(Number.isFinite(f.P) && f.P >= 0, "potencia base P: " + f.id);
    assert.strictEqual(typeof f.dial, "boolean", "dial booleano: " + f.id);
    assert.strictEqual(typeof f.lethal, "boolean", "letalidad booleana: " + f.id);
    assert.ok(typeof f.effect === "string" && f.effect.trim(), "efecto breve: " + f.id);
    assert.ok(typeof f.victim === "string" && f.victim.trim(), "texto de víctima: " + f.id);
    assert.ok(f.public === null || typeof f.public === "string", "texto público o null: " + f.id);
    if (f.public) assert.ok(!/\{|\}/.test(f.public), "el texto público no lleva plantillas ni nombres: " + f.id);
    assert.ok(f.object === null || (typeof f.object === "string" && D.ITEMS[f.object]), "objeto existente en ITEMS (" + f.id + "): " + f.object);
    assert.ok(f.consume === null || typeof f.consume === "boolean", "consume booleano o null: " + f.id);
  });
  /* §1: 13 formas con dial (empeño propio) y 11 de dosis fija / dependientes de otro hecho. */
  assert.strictEqual(D.HARM.filter((f) => f.dial).length, 13, "13 formas con dial");
  assert.strictEqual(D.HARM.filter((f) => !f.dial).length, 11, "11 formas sin dial");
  /* §7: solo Apuñalar puede rematar moribundos entre las formas del catálogo. */
  assert.deepStrictEqual(plain(D.HARM.filter((f) => f.lethal).map((f) => f.id)), ["apunalar"]);
  FAMILIES.forEach((fam) => assert.ok(D.HARM.some((f) => f.family === fam), "hay formas de la familia " + fam));
});

test("9 objetos nuevos: existen en ITEMS, tienen nombre/descripción y están en alguna categoría", () => {
  const { D } = engine(2);
  const CATS = ["LOOT_ITEMS", "DARK_ITEMS", "UTIL_ITEMS", "MEDIC_ITEMS"];
  NEW_ITEMS.forEach((id) => {
    const def = D.ITEMS[id];
    assert.ok(def, "objeto nuevo en ITEMS: " + id);
    assert.strictEqual(def.id, id, "id coherente: " + id);
    assert.ok(typeof def.name === "string" && def.name.trim(), "nombre: " + id);
    assert.ok(typeof def.desc === "string" && def.desc.trim(), "descripción: " + id);
    assert.ok(CATS.some((c) => D[c].indexOf(id) !== -1), "el objeto " + id + " debe estar en alguna categoría");
  });
  /* Los objetos con efecto inmediato usan kinds que useItem ya entiende. */
  ["aceite", "odre"].forEach((id) => assert.ok(["prep", "heal"].indexOf(D.ITEMS[id].kind) !== -1, "kind usable: " + id));
});

test("oficios: inicializados en partida nueva y migrados en saves locales antiguos; state.harm arranca vacío", () => {
  const { U } = engine(3);
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 15 });
  const S = U.getState();
  assert.ok(Array.isArray(S.harm), "state.harm existe");
  assert.deepStrictEqual(plain(S.harm), [], "la cola de daño arranca vacía");
  S.players.forEach((p) => assert.deepStrictEqual(plain(p.oficios), OFICIOS, "oficios a 0: " + p.name));

  /* Save antiguo: sin harm, sin oficios, oficios parciales o con tipos malos. */
  S.players[0].oficios = { filo: 2, veneno: "1", trampa: "x" };
  S.players[1].oficios = null;
  delete S.players[2].oficios;
  S.harm = { viejo: true };
  U.save();
  const M = U.loadGame();
  assert.ok(M, "el save local se puede cargar");
  assert.deepStrictEqual(plain(M.harm), [], "harm ausente o inválido se migra a []");
  assert.deepStrictEqual(plain(M.players[0].oficios), { filo: 2, veneno: 1, trampa: 0, fuego: 0, social: 0 });
  assert.deepStrictEqual(plain(M.players[1].oficios), OFICIOS);
  assert.deepStrictEqual(plain(M.players[2].oficios), OFICIOS);

  /* Una partida nueva posterior vuelve a empezar limpia (no arrastra el save). */
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 15 });
  const N = U.getState();
  assert.deepStrictEqual(plain(N.harm), []);
  N.players.forEach((p) => assert.deepStrictEqual(plain(p.oficios), OFICIOS));
});

test("acciones nuevas de daño: textos y requisito visible en D.ACTIONS, y cerradas hasta F1", () => {
  const { U, D } = engine(4);
  U.createGame(["Ana", "Luis", "Marta"], { minutes: 15 });
  const p = U.getState().players[0];
  const vis = U.visibleActions(p);
  const shown = vis.main.concat(vis.more.reduce((a, g) => a.concat(g.acts), [])).map((a) => a.id);
  NEW_ACTIONS.forEach((id) => {
    const a = D.ACTIONS.find((x) => x.id === id);
    assert.ok(a, "acción en D.ACTIONS: " + id);
    assert.ok(typeof a.name === "string" && a.name.trim(), "nombre de la acción: " + id);
    assert.ok(typeof a.desc === "string" && a.desc.trim(), "descripción breve: " + id);
    assert.ok(typeof a.req === "string" && a.req.trim(), "requisito visible (§6): " + id);
    assert.ok(FAMILIES.indexOf(a.family) !== -1, "familia de la acción: " + id);
    assert.ok(a.hostile, "es una forma dirigida: " + id);
    /* F0 solo publica los datos: sin UNLOCK ni resolución no debe aparecer ni poder usarse. */
    assert.strictEqual(U.isUnlocked(p, a), false, "cerrada en F0: " + id);
    assert.strictEqual(shown.indexOf(id), -1, "no se muestra en la mesa en F0: " + id);
  });
  /* Las que reutilizan una acción existente no crean duplicados. */
  ["apunalar", "aturdir", "envenenar", "maldecir"].forEach((id) => {
    assert.strictEqual(D.ACTIONS.filter((a) => a.id === id).length, 1, "acción existente única: " + id);
  });
});

