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
| `stun` | F4: aturdir y caer moribundo sobre quien aún no ha actuado con el flujo real del servidor (nadie pierde una acción a medio elegir; el aturdido pierde la ronda siguiente; el moribundo no bloquea la barrera) |
| `timers` | F4: autoturno del servidor con reloj acelerado (`UMBRAL_TIME_SCALE`): un jugador pasivo no bloquea la ronda; «esperando…» con cuenta atrás |
| `time` | F4: aviso común «La noche se acaba», «Añadir tiempo» solo anfitrión, pregunta de tiempo con votos visibles, empate = +1 ronda, anfitrión decide al votar |
| `desktop` | 1280x800: capturas y sin scroll horizontal |

Salida: `PASS/FAIL` por comprobación y capturas en `test/e2e/shots/` (o `--shots`). Código de salida 1 si algo falla.
No usa la red externa. El escaneo de privacidad solo vigila mientras la partida no ha terminado (tras el desenlace todo es público).

Variables de servidor para pruebas: `UMBRAL_READ_MS` (lectura previa a actuar sobre otros; 10000 por defecto, el E2E usa 0), `UMBRAL_TIME_SCALE` (multiplica todos los límites del reloj: p. ej. 0.08 = 12 veces más rápido).

| `dual` | F6: dos pestañas del mismo jugador: la antigua muestra «Usar aquí», se recupera la conexión, sin duplicar jugador |
| `absvote` | F6: con una jugadora ausente, la pregunta de tiempo llega a los presentes y a los 30 s decide la mayoría |

`game` además comprueba que la espera de la fase privada solo dice «Faltan N» (sin listo/decidiendo por jugador).
| `csp` | F7: con la CSP real (sin bypass) lobby, partida y SSE funcionan sin violaciones |
| `persist` / `persisthard` | Persistencia: el servidor (con `SNAPSHOT_KEY`) se reinicia a mitad de partida con SIGTERM (los 3 móviles vuelven) o `kill -9` (un móvil se cierra durante el reinicio): «Restaurando la partida…», la partida sigue y llega al desenlace, 0 fugas, la instantánea se borra al terminar |
| `npc2` | v1.7.0: sala de 2 (anfitrión + 1) con NPC; partida completa con privacidad |
| `npcroom` | v1.7.0: añadir/quitar NPC en el lobby, perfiles y tope de 10 |
| `npcsub` | v1.7.0: sustituir a un ausente por un NPC y recuperar el lugar |
