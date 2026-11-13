# E2E del cliente en línea (F3)

`online_e2e.py` abre 3 navegadores (Playwright, Python) contra un `node server/index.js` local en un puerto libre.

    npm run sync-client -- /ruta/a/www        # public/ = copia del cliente (o: --sync /ruta/a/www en el propio script)
    python3 -I test/e2e/online_e2e.py [--only lobby|game|restart|external|desktop] [--seed 1] [--mins 25] [--shots DIR]

Escenarios

| nombre | qué comprueba |
|---|---|
| `lobby` | crear sala, unirse con código, errores (código inexistente/corto, nombre repetido, sala llena, partida empezada, servidor inalcanzable), salir de la sala, iniciar |
| `game` | partida completa de 3 jugadores con un bot de interfaz hasta el desenlace; pantalla «esperando…», Consejo y resolución; doble toque; recarga a mitad (reconexión por token); corte de red y vuelta; **escaneo de privacidad** continuo (secreto, rol, afinidad, notas, pistas y pactos de cada jugador no aparecen en el DOM, en `getState()`, en los mensajes SSE crudos ni en las respuestas `/cmd` de los otros) y solo claves públicas de los demás jugadores |
| `restart` | el servidor cae a mitad de partida y vuelve (las salas se pierden): aviso de «sin conexión», luego «la sala ya no existe» y «Volver al inicio» |
| `external` | desde `file://` (como el APK) «Jugar en línea» abre `https://el-umbral-h1ki.onrender.com` fuera (popup) |
| `desktop` | 1280x800: capturas y sin scroll horizontal |

Salida: `PASS/FAIL` por comprobación y capturas en `test/e2e/shots/` (o `--shots`). Código de salida 1 si algo falla.
No usa la red externa. El escaneo de privacidad solo vigila mientras la partida no ha terminado (tras el desenlace todo es público).
