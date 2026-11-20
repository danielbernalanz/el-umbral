/* EL UMBRAL - historial de novedades (lo lee el panel «Novedades» del menú principal).
   CÓMO ACTUALIZAR en cada versión: añade UN objeto al PRINCIPIO de la lista (la más reciente arriba) con la misma versión que D.VERSION
   (data.js), una fecha AAAA-MM-DD, un título corto y 3-6 puntos en español claro, pensados para el jugador. Nada de reglas ocultas ni de
   lo que pueda delatar roles o secretos. No hace falta tocar engine.js, data.js ni ui.js (solo subir el CACHE de sw.js como siempre). */
(function (w) {
  "use strict";
  w.UMBRAL_NEWS = [
    { version: "1.8.0", fecha: "2026-11-20", titulo: "Más formas de dañar, con riesgo claro", puntos: [
      "El veneno ahora es retardado: no se nota la ronda siguiente y después hace daño real durante dos rondas, hasta que se cure con hierbas, antídoto o descansando.",
      "Nueva acción: Poner una trampa. Se esconde una ronda y salta la siguiente sobre quien se mueva por las ruinas; puede caer un inocente, o tú mismo.",
      "Nueva acción: Sabotear. Estropeas en secreto un objeto de otro: la próxima vez que lo use, fallará y puede volverse contra él.",
      "Cada acción nueva dice, antes de elegirla, qué ganas y qué arriesgas. Se desbloquean por lo que haces (explorar, robar o tener una cuerda o una ganzúa).",
      "Los golpes, las marcas mágicas, los síntomas del veneno y los mecanismos de las trampas quedan registrados en secreto para poder investigarlos en una próxima versión."
    ] },
    { version: "1.7.0", fecha: "2026-11-13", titulo: "Mesas de 2 y jugadores de la casa (NPC)", puntos: [
      "Ya se puede jugar con 2 jugadores.",
      "Puedes añadir NPC a la mesa (hasta 10 jugadores en total) y sustituir por un NPC a quien se ausente, en local y en línea. Cada NPC tiene su perfil (prudente, agresivo, curandero u oscuro), se ve claramente que es un NPC, y quien se fue puede recuperar su lugar.",
      "Socorrer aparece destacado arriba en tu turno cuando alguien cae moribundo, con el plazo real que le queda.",
      "El aviso del moribundo es más claro y coincide con lo que de verdad ocurre.",
      "Los textos de los secretos al final de la partida ya no repiten el premio."
    ] },
    { version: "1.6.2", fecha: "2026-11-13", titulo: "Animaciones y novedades", puntos: [
      "Animaciones breves ligadas a lo que ocurre: tajo al apuñalar, destello del conjuro, luz al curar, escudo al protegerte, temblor al recibir daño y sello de los pactos. Se apagan si tu móvil pide reducir el movimiento.",
      "Nuevo apartado «Novedades» en el menú principal, con el historial de cambios de cada versión."
    ] },
    { version: "1.6.1", fecha: "2026-11-13", titulo: "Más claridad al desbloquear acciones", puntos: [
      "Las acciones nuevas se desbloquean solo por lo que haces en la partida, no porque pase el tiempo. Un apartado «Por desbloquear» te dice qué te falta.",
      "Bendecir ya forma parte de las acciones de ayuda.",
      "Enfrentar tiene un tope por ronda y su coste se paga a ciegas, igual para todos.",
      "En línea cada uno juega en su propio dispositivo."
    ] },
    { version: "1.6.0", fecha: "2026-11-13", titulo: "Modo en línea", puntos: [
      "Crea una sala y comparte el código: cada jugador usa su propio móvil.",
      "Los turnos son simultáneos: nadie espera a que los demás terminen para empezar.",
      "Si se cae la conexión puedes volver a la misma partida.",
      "Las partidas sobreviven a las actualizaciones del juego mientras alguien siga conectado."
    ] },
    { version: "1.5.0", fecha: "2026-11-13", titulo: "Hora de fin", puntos: [
      "En vez de elegir minutos, eliges la hora a la que quieres terminar.",
      "El reloj muestra el tiempo restante y la hora de fin; las rondas extras recalculan la hora estimada."
    ] },
    { version: "1.4.0", fecha: "2026-11-13", titulo: "Final sin cortes", puntos: [
      "Aviso común «La noche se acaba» dos minutos antes del final.",
      "Al agotarse el tiempo, la mesa decide: añadir 1 ronda, añadir 2 rondas o terminar ahora, siempre con desenlace completo.",
      "Turno automático: si alguien se queda parado, el turno se completa con una acción tranquila sin perder lo ya hecho.",
      "La versión se ve en el menú."
    ] },
    { version: "1.3.0", fecha: "2026-11-13", titulo: "El Umbral reclama", puntos: [
      "La tentación puede llegar también a mitad de partida.",
      "La corrupción ahora presiona: el Umbral puede exigir «hambre» cada ronda y, si no se cumple, deja una herida normal.",
      "Purificar, resistir y curar frenan ese daño."
    ] },
    { version: "1.2.0", fecha: "2026-11-12", titulo: "Atmósfera", puntos: [
      "Ambiente sonoro opcional y vibración ajustable.",
      "Entrega del móvil más tensa, rumores entre rondas y epílogo final para cada jugador."
    ] },
    { version: "1.1.0", fecha: "2026-11-12", titulo: "Nueva interfaz", puntos: [
      "Interfaz renovada con iconos propios para acciones, objetos, estados y conjuros.",
      "Pantallas más claras en móviles pequeños.",
      "Créditos de los iconos en el menú principal."
    ] },
    { version: "1.0.1", fecha: "2026-11-11", titulo: "Tentación, sombras y secretos", puntos: [
      "La tentación se ofrece según cómo juegas, y quien la acepta se vuelve más poderoso y más peligroso.",
      "Sombras y nigromancia, con desbloqueos propios.",
      "Cada secreto tiene un premio visible y una pista de qué hacer.",
      "Más eventos y objetos, y exportar la historia de la partida."
    ] },
    { version: "1.0.0", fecha: "2026-11-11", titulo: "Primera versión jugable", puntos: [
      "Turno privado, declaración secreta, Consejo público y resolución.",
      "Magia con maestría, pactos secretos y hasta 10 jugadores.",
      "El Asesino no se reparte al empezar: puede nacer durante la partida."
    ] }
  ];
})(window);
