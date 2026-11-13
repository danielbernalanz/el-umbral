# El Umbral online

Servidor Node (>= 20, **sin dependencias**) para jugar a El Umbral desde varios dispositivos.
El motor del juego (`data.js` + `engine.js`) se ejecuta **solo en el servidor**, un contexto `vm` por sala, sin editarlo.
Cada jugador recibe una **vista filtrada** (lista blanca) por SSE y envía comandos por POST.

## Arranque

    ENGINE_DIR=/ruta/a/www node server/index.js      # o copia el cliente a public/ (npm run sync-client)
    npm test                                         # todas las pruebas (~1 min)

Variables: `PORT` (3000), `ENGINE_DIR` (por defecto `public/`: debe contener `data.js` y `engine.js`),
`MAX_ROOMS` (50), `TRUST_PROXY=1` (usa `X-Forwarded-For` para los límites por IP; ponlo detrás de Render).
`CLIENT_SRC` solo lo usa `scripts/sync-client.js` (copia la carpeta del cliente a `public/`; el origen no se toca).

## API (F2)

| Ruta | Descripción |
|---|---|
| `GET /healthz` | `{ok, rooms, uptimeS}` |
| `POST /api/create {name}` | crea sala -> `{room, pid, token}` (token de 128 bits, guárdalo) |
| `POST /api/join {room, name}` | se une al lobby (3-10 jugadores; no se entra en partida empezada) |
| `POST /api/start {endAt}` | solo anfitrión; `endAt` = epoch ms entre 5 y 120 min desde ahora |
| `POST /api/leave`, `POST /api/ping` | salir / mantener viva la sala |
| `GET /events` | SSE: evento `view` con la vista del jugador (completa al conectar y tras cada cambio) y latido `:hb` cada 20 s |
| `POST /cmd {cmd, args}` | comando del motor (`act`, `cast`, `useItem`, `finishTurn`, `councilReady`, `continue`, `vote`...) |

El token va en la cabecera `x-token` (o `?t=` en `/events`, porque `EventSource` no admite cabeceras). Límites: cuerpo 8 KB,
10 comandos/s por token, 20 altas/min por IP, 50 salas; las salas sin conexiones se borran a los 30 min, las terminadas a los 15 y
ninguna vive más de 4 h. CORS abierto sin cookies.

## Estructura

    server/engine_vm.js   carga data.js+engine.js en un contexto vm (azar y reloj inyectables para pruebas)
    server/game.js        Game: comandos por jugador (cambio de contexto turn/pendingPush), barreras de fase,
                          retención de notas/crónica ajenas durante la fase privada, ofertas materializadas
    server/view.js        buildView: vista filtrada + consultas precalculadas (q.*); lista blanca
    server/room.js        salas, lobby, tokens, SSE y difusión
    server/index.js       http: estáticos de public/, API, límites
    test/                 leak.test.js (no-fuga), pure.test.js (auditoría de pureza), server.test.js (red); helpers/bot.js
    scripts/sync-client.js

## Privacidad (resumen)

- De los demás solo salen `id, name, dead, dying, exposed, visibleHealth` (+ `ready/online/host`). Nada ajeno hasta `phase === "ending"`.
- Lo que otros provocan durante la fase privada (notas y crónica) se retiene hasta el Consejo.
- Objetivos validados contra `q.targets`; error genérico «Objetivo no válido.»; `answerPact` usa índices locales.
- Consultas impuras del motor (`getOffer`, `unlockNotices`, `studyOptions`, `encounterStart`) se materializan en `Game.refresh`;
  `buildView` es puro (verificado en `test/pure.test.js`).

## Estado

F1 (vista) y F2 (servidor y salas) hechas. Pendiente: F3 cliente (`net.js`, lobby), F4 simultaneidad/relojes/votación de tiempo,
F5 reconexión y ausencia, F6 E2E con Playwright, F7 Render (`render.yaml`).
