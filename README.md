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

## Cliente en línea (F3)

El cliente (`public/`, copia de la fuente única `www`) tiene dos modos. **Local**: `U = window.UMBRAL` (el motor en el móvil), idéntico a antes.
**En línea**: `public/net.js` (`window.UmbralNet`) ofrece un `OnlineBackend` con las mismas firmas que usa `ui.js`; sin motor: las consultas
salen de la vista filtrada (`q.*`) y cada mutación es un `POST /cmd` que devuelve una Promise (la respuesta lleva la vista del jugador, con `ver`,
y se descartan vistas más viejas que la ya recibida). `ui.js` solo cambia en `run()/mut()` (síncrono en local) y en un bloque «EN LÍNEA».

- Lobby en el inicio: «Jugar local» / «Jugar en línea», crear sala o unirse con código, sala de espera con código grande, lista y «Iniciar» (anfitrión, hora de fin).
- URL del servidor: mismo origen si la página va por http(s); desde `file://`/APK (sin permiso INTERNET) el botón abre `ONLINE_URL` (constante en `net.js`) en el navegador. Para pruebas: «Servidor (avanzado)» o `?server=http://localhost:3000`. `?sala=ABCDE` rellena el código.
- Reconexión: token en `localStorage` (clave `umbral_online_session`), `EventSource` con reapertura propia, ping cada 20 s y aviso «Sin conexión».
- Privacidad: el cliente solo guarda la vista propia; nunca registra el token; log e historia solo tras el desenlace (`storyList` lo añade el servidor).
- Servidor, cambios de F3: `ver` en cada vista, la respuesta de `/cmd` incluye `view`, y `storyList` en el desenlace.
- Pruebas E2E: `test/e2e/` (ver su README).

## Cómo se juega en línea

1. Abre **https://el-umbral-h1ki.onrender.com** (o la URL de tu servidor) en el navegador del móvil u ordenador. En el APK, «Jugar en línea» abre esa misma web.
   El plan gratuito de Render **duerme el servicio** tras ~15 min sin uso: la primera carga o crear/unirse puede tardar ~50 s
   (el cliente muestra «Despertando el servidor…» y reintenta solo).
2. Pulsa «Jugar en línea», escribe tu nombre y **Crear sala**: aparece un código de 5 letras y un enlace (`/?sala=ABCDE`) para compartir.
3. Los demás abren el enlace o escriben el código y pulsan **Unirse**. Con 3 a 10 jugadores, el anfitrión elige la **hora de fin** (5-120 min) y pulsa **Iniciar**.
   No se puede entrar en una partida ya empezada.
4. Todos juegan a la vez su turno privado (el servidor cierra la ronda cuando todos terminan o se agota el tiempo), luego Consejo y resolución. Tras el desenlace se puede exportar el log y la historia.

Límites: 3-10 jugadores por sala, 50 salas, 20 altas/min por IP, 10 comandos/s por jugador, cuerpo 8 KB. Salas sin conexiones: 30 min; terminadas: 15 min; máximo 4 h.
Los datos viven en memoria, pero las partidas **sobreviven a un reinicio/despliegue** del servidor (ver «Persistencia entre reinicios»). Sin jugadores conectados una sala caduca a los 30 min.

**Local vs en línea.** Local (un solo móvil, turnos con traspaso) no cambia y no necesita servidor. En línea cada jugador usa su dispositivo, con vista filtrada
(nadie recibe datos ajenos), turnos simultáneos con reloj del servidor, autoturno, votación de tiempo, ausencia (tras 2 rondas desconectado) y reconexión con el mismo token.
En la fase privada solo se muestra «Faltan N»: no quién ha terminado.

## Despliegue (Render)

`render.yaml` define un servicio web Node (plan free, sin build, `node server/index.js`, `/healthz`, auto-deploy de `main`). Variables: `PORT` (la pone Render; escucha en `0.0.0.0`),
`TRUST_PROXY=1`, `MAX_ROOMS`. Cabeceras de seguridad en todas las respuestas (nosniff, no-referrer, X-Frame-Options, Permissions-Policy, CSP en el HTML sin inline-script; HSTS tras el proxy https).
Los estáticos se revalidan siempre (ETag/304) y `sw.js` no cachea `/events`, `/cmd`, `/api/*` ni `/healthz`. `SIGTERM` cierra los SSE y sale limpio (los clientes reintentan).

## Desarrollo y pruebas

    node scripts/sync-client.js /ruta/a/www     # public/ = copia del cliente (la fuente única es www; engine.js y data.js no se editan aquí)
    npm test                                     # 40+ pruebas (~1 min): no-fuga, pureza, red, F4/F5, bots por red, producción
    node test/bots_online.js 4,6,8,10 4 12 0.02  # batería grande de bots por red: jugadores, semillas, minutos, prob. de desconexión, aceleraciones
    python3 -I test/e2e/online_e2e.py            # E2E Playwright multi-navegador (ver test/e2e/README.md)

## Estado

F1-F7 hechas. Sin verificar desde el entorno de desarrollo (red bloqueada): el despliegue real en Render, WebView Android y latencias de móvil.


## Persistencia entre reinicios (despliegues en Render)

Render reinicia el proceso al desplegar y su disco es efímero. Para que las partidas en curso no se interrumpan **sin cuentas, base de datos ni dependencias**,
el servidor entrega a cada jugador una **instantánea cifrada** de su sala y, tras el reinicio, esos mismos jugadores se la devuelven.

- **Qué es.** `server/snapshot.js`: el estado completo de la sala (lobby o partida: estado del motor, barreras de fase, notas retenidas, ofertas, reloj, ausencias, votos, anfitrión, hash de tokens)
  se serializa, se comprime (gzip) y se cifra+autentica con **AES-256-GCM** (`node:crypto`); el código de sala y la versión de esquema van como datos autenticados.
  Un blob mide unos 10-30 KB. No contiene nada legible; sin la clave (solo el servidor la tiene) no se puede leer ni fabricar ni modificar.
- **Cuándo se envía.** Evento SSE `snapshot` (el mismo blob a todos los conectados de la sala): en cada cambio de fase/ronda/pregunta de tiempo, como mucho cada 10 s dentro de una fase (por si el proceso muere sin avisar, `kill -9`),
  al reconectar y en el **SIGTERM** del despliegue (justo antes de cerrar los SSE). El cliente (`net.js`) guarda solo el último por sala en `localStorage` (`umbral_online_snap_<SALA>`) y lo borra al terminar la partida, al salir o al perder la sala.
- **Restauración.** El servidor nuevo arranca sin salas. Un cliente que reconecta recibe `404 {unknownRoom}` (el cliente manda su código en `?room=` / `x-room`) y sube su blob a `POST /api/restore {room, blob}` (token en `x-token`, límite 1,5 MB, 12/min por IP, 6/min por token).
  El servidor descifra y valida (código de sala, token del que sube perteneciente a esa sala, esquema, **mismo motor**, antigüedad), abre una **ventana de 5 s** y crea la sala con el blob de **mayor `seq`** recibido en la ventana (evita rebobinar si el primer móvil en volver tenía una instantánea vieja).
  La sala vuelve con todos desconectados; cada jugador entra con su token. Una sala ya existente no se toca (el primero gana).
- **Nadie pierde por el reinicio.** `endAt` y los plazos de fase se desplazan el tiempo caído; cada plazo vigente conserva al menos 90 s (turno) / 60 s (resto) de margen tras restaurar; la gracia de «desconexión acelerada», de ausencia y del traspaso del anfitrión empieza al restaurar (60 s). `ver` salta +1.000.000 para que ningún cliente descarte las vistas nuevas.
- **Rechazos limpios.** Blob manipulado/truncado/de otra sala/otra clave: 400. Token que no es de esa sala: 401. Motor (`data.js`/`engine.js`) o esquema distintos: 409 (el cliente avisa «el servidor se actualizó y no pudo recuperar esta partida»; la sala se pierde, nunca se corrompe). Caducada (>4 h) o sala ya cerrada en este proceso: 410.
- **Clave.** `SNAPSHOT_KEY` (mínimo 16 caracteres; `render.yaml` la declara con `generateValue: true`, así que **persiste entre despliegues**; si la cambias, las instantáneas antiguas dejan de valer). Sin clave, la función queda **desactivada** (aviso en el log) y se comporta como antes: las salas se pierden al reiniciar.
- **Cliente.** Mientras reconecta muestra «Sin conexión… Reconectando…» y luego «Restaurando la partida…» sin perder la pantalla; reintenta con espera creciente y, si tras 8 intentos falla, ofrece «Reintentar».

**Límites.**
- Si **todos** los jugadores cierran la app durante el reinicio (o borran los datos del navegador), nadie puede subir el blob y la sala se pierde.
- Un despliegue que **cambia `data.js`/`engine.js`** (o el esquema de la instantánea) no puede recuperar partidas en curso (409): despliega esos cambios con la mesa vacía. Cambios solo de cliente/servidor sin tocar el motor sí se recuperan.
- Si el proceso muere sin avisar (`kill -9`, caída) se pierde lo ocurrido desde la última instantánea (≤10 s o el último cambio de fase): la partida vuelve a ese punto.
- Zona horaria/reloj: los plazos se desplazan con el reloj del servidor; si el nuevo servidor tuviese el reloj muy distinto, las comparaciones usan `savedAt`.
- Despliegues «sin corte» con dos instancias solapadas no están soportados (el estado vive en una sola instancia).
- La instantánea de un jugador contiene también los secretos de los demás, pero cifrados con la clave del servidor (AES-GCM de 256 bits): sin la clave es indescifrable.
