# El Umbral — traspaso del proyecto (2026-11-14)

Juego social de deducción para 2-10 jugadores (pasar el móvil en local, o en línea con salas por código). Empaquetado como APK firmado (WebView) + servidor Node en Render. Idioma de todo: español.

## Estado
- **v1.10.0 (rama feat-v1100, sin fusionar ni desplegar)**: salud recortada a 3 zonas, tick determinista, señales públicas, Atender (ver `docs/designs/salud-v110.md`). Cambia el motor: desplegar con mesa vacía.
- **v1.7.0 cerrada Y DESPLEGADA** (2026-11-14, commit e75d11e, por API de Render con mesa vacía; verificada en vivo: `VERSION 1.7.0`, CACHE `umbral-v17-0`, create/join/start/leave OK). `npm test` 59/59; E2E online 18/18 escenarios (130 comprobaciones, Playwright ya instalado). APK firmado v1.7.0 entregado. Pendiente: Android real, humanos 6-10, Render bajo carga.
- v1.8.2 (rama feat-v182, sin fusionar): sospecha acumulada + contradecir (ver NOTAS_PROYECTO).
- **Estable y desplegada: v1.6.2** (77b9db7), referencia de rollback. Servicio https://el-umbral-h1ki.onrender.com.
- Ramas/worktrees de trabajo (2026-11-14): `feat-dano` (`work/wt_dano`) con la capa F0 de v1.8.0 hecha (63/63 tests verdes en ese worktree; queda F1-F6). `feat-fixes` ya fusionada. Plan de integración v1.9/v1.10 en `docs/designs/plan-v19-v110.md`.
- Si `git status` está sucio o hay un tag `pre-v170`, compruébalo antes de seguir; vuelve a 77b9db7 si no pasa `npm test`.

## Estructura
- `public/` = cliente web/APK (engine.js motor, data.js datos, ui.js interfaz, net.js modo en línea, fx.js, npc.js [v1.7], news.js novedades, sw.js, index.html, styles.css, img/). **Ahora la fuente es `public/`** (antes era una carpeta externa `apk/assets/www` + `scripts/sync-client.js`; ignora ese script).
- `server/` servidor sin dependencias (http+SSE+POST, `vm` por sala con engine.js/data.js intactos, vista filtrada por jugador, snapshots cifrados).
- `test/` (`npm test`, 59 tests, fugas de privacidad incluidas) y `test/e2e/online_e2e.py` (Playwright de Python; ver README allí). Instalado en esta máquina (`pip install playwright`); escenarios uno por uno.
- `tools/work/` simuladores y scripts de UI/balance (smart.js, smart_human.js, sim10.js, bh/fuzz.js, ui_run.py, ix_ui.py, fuzz_ui.py…). Aceptan `WWW=<carpeta del cliente>`; apúntalos a `public/`.
- `docs/designs/` diseños: magia, daño con riesgo, salud, online. `docs/NOTAS_PROYECTO.md` = notas históricas completas (decisiones, balance, estados por versión).

## Reglas del usuario (innegociables)
- Ningún jugador tiene desventaja ni ve menos opciones; sin modos «simples».
- Privacidad: nada público debe delatar roles, corrupción ni autor de acciones ocultas; test de no-fuga siempre (`test/leak.test.js`).
- Desbloqueo de acciones SOLO por lo que haces, nunca por reloj/ronda.
- Riesgos solo donde creen una decisión real y sean explicables antes de elegir; nunca decorativos (frasco de veneno: dosis fija, sin mejora con riesgo).
- Animaciones solo ligadas a la acción. El juego nunca termina en seco por tiempo (rondas extras). Hora de fin, no duración.
- Asesino emergente por tentación (sin roles al inicio); acusar no debe dar certeza 100 % (pendiente: sospecha acumulada); sin «batalla final»; sin contención que inhabilite.
- Balance objetivo 3 jugadores 10/12/15 min (smart_human): gana asesino ≈ 31/46-50/37-45 %, supervivientes con bots buenos ≥ 88 %; cambios dentro de ±4 pp.
- **Nunca perder progreso**: antes de apagar el PC o cerrar la sesión, haz commit (aunque sea WIP) en `main` y en cada worktree/rama, y comprueba `git status`. No se apaga nada con cambios sin guardar.

## Cola de trabajo (en este orden)
1. Cerrar v1.7.0 (ver arriba), subir versión en data.js/engine.js/fx.js/ui.js/index.html/sw.js(CACHE)/news.js (añadir entrada), APK y desplegar.
2. v1.8.0 daño con riesgo básico — `docs/designs/dano.md` (opciones recomendadas del propio documento).
3. v1.9.0 reto de habilidad único (opcional, bonus −6..+15, mismo reto y duración para todas las acciones, validación servidor) + magia recortada — `docs/designs/magia.md`.
4. v1.10.0 salud recortada (3 zonas) — `docs/designs/salud.md`.
5. Sospecha acumulada (acusar sin certeza; cooperación contra el Asesino).
6. Salas públicas (lista de salas sin empezar, nombre, límites anti-abuso) — AL FINAL.
Pendientes menores: pactos de una sola ronda (secreto «Palabra dada» casi imposible), `useItem` con error muta estado (fuzz), 10 jugadores a 20 min sin Asesino, pruebas en Android real y con personas. El texto de NPC a 360 px está arreglado y fusionado (`feat-fixes`, ebcd352). El falso positivo del escaneo de privacidad de `persist` no se reprodujo en 15 ejecuciones seguidas (2026-11-14): vigilarlo en el E2E `persist`.

## Cómo probar
`npm test` (≈1 min). E2E online: `python3 test/e2e/online_e2e.py <escenario>` uno por uno (lobby, game 1-3, restart, stun, timers, time, presence, dual, persist, persisthard, csp, absvote, external, desktop, small [+ npc2, npcroom, npcsub en v1.7]); en paralelo se satura y da falsos timeouts. Local: `tools/work/ui_run.py 2`, `ix_ui.py`, `fuzz_ui.py`. Balance: `WWW=public node tools/work/smart_human.js` (mira su cabecera para N/minutos).

## Cómo desplegar
- Render: servicio `el-umbral` (plan Free). **El auto-deploy desde GitHub NO funciona**: despliega a mano (panel de Render → Manual Deploy, o API). Salud: `/healthz`. Primera carga tras reposo puede dar 503 ~1 min.
- Tras cambiar `engine.js`/`data.js`/`npc.js` los snapshots de salas en curso se invalidan (409): desplegar con la mesa vacía. `SNAPSHOT_KEY` lo genera Render (`render.yaml`).
- APK: `tools/work/build_signed.py` (necesita el APK base original `ElUmbral-v0_6_3.apk`, la clave `ElUmbral-clave-firma.p12`/PEM del usuario [NO está en el repo] y `apksign.py`); sube NEW_VC/NEW_VN/OUT; verifica con `unzip -l` que van img/, styles.css, fx.js, net.js, news.js, npc.js. El APK solo abre la web para el modo en línea.
- Antes de desplegar, `git push origin HEAD:main`.

## No verificado nunca
Android real (táctil, teclado, botón Atrás, vibración/sonido), Render con muchos usuarios, latencias móviles, partidas con humanos 6-10 jugadores.
