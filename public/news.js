/* EL UMBRAL - historial de novedades (lo lee el panel «Novedades» del menú principal).
   CÓMO ACTUALIZAR en cada versión: añade UN objeto al PRINCIPIO de la lista (la más reciente arriba) con la misma versión que D.VERSION
   (data.js), una fecha AAAA-MM-DD, un título corto y 3-6 puntos en español claro, pensados para el jugador. Nada de reglas ocultas ni de
   lo que pueda delatar roles o secretos. No hace falta tocar engine.js, data.js ni ui.js (solo subir el CACHE de sw.js como siempre). */
(function (w) {
  "use strict";
  w.UMBRAL_NEWS = [
    { version: "1.14.0", fecha: "2026-11-24", titulo: "Cuidados, acciones flojas y magia más viva", puntos: [
      "Atender cura 3 de vitalidad al paciente y, si había algo que tratar, da +4 de virtud al que atiende (como mucho una vez cada 2 rondas por paciente).",
      "Entrenar dura tres rondas, da +1 de foco y, cada tres entrenamientos, sube tu atributo más bajo.",
      "Magia: cada tres rondas un conjuro recupera un uso, encadenar la misma escuela da +1 de potencia y las pifias tienen efectos al azar.",
      "Hechizar pasa a llamarse Magia sucia.",
      "El Taumaturgo elige su primer conjuro entre tres y puede encontrar Mensaje secreto, Atadura o Revelar.",
      "Sabotear elige la clase de objeto (curación, utilidad o ataque); quien ha caído puede susurrar una pista a alguien vivo.",
      "Con el tope de conjuros lleno, eliges qué olvidar."
    ] },
    { version: "1.13.2", fecha: "2026-11-23", titulo: "La sospecha responde antes a las pistas", puntos: [
      "Las acusaciones de personas distintas elevan la sospecha con más rapidez.",
      "Presentar una pista verificada puede elevar la sospecha sobre quien dejó ese rastro.",
      "No se revela quién presentó la pista ni el rol de quien dejó el rastro."
    ] },
    { version: "1.13.1", fecha: "2026-11-23", titulo: "Arreglos de una partida real", puntos: [
      "El plazo para socorrer a un moribundo tras una caza ahora se explica bien: en partidas largas tiene hasta que acabe la próxima ronda.",
      "El premio de «dos pistas» ya no repite jugador cuando hay otros candidatos.",
      "Los NPC ya no muestran su estilo de juego en el registro exportado.",
      "Corregida la gramática de los usos que le quedan a un objeto (le queda 1 uso).",
    ] },
    { version: "1.13.0", fecha: "2026-11-20", titulo: "Atender con técnicas y silueta del cuerpo", puntos: [
      "Atender ahora tiene cuatro técnicas, y antes de confirmar ves qué hace y qué cuesta cada una: presionar y limpiar (gratis), torniquete, entablillar y cauterizar.",
      "Presionar corta un sangrado leve, pero uno fuerte solo lo baja a goteo. El torniquete corta cualquiera, pero deja un miembro entumecido hoy y mañana (−1 a cuerpo y defensa). Cauterizar sella sangrado e infección al instante a cambio de 1 de vitalidad del paciente; necesita una antorcha (una linterna sirve y no se gasta).",
      "Entablillar gasta tus vendas y quita el estorbo de un brazo o una pierna con lesión seria. Si no había nada que alinear, las vendas se gastan igualmente: fíjate en lo que se ve (cojea, protege un brazo).",
      "Tu ficha muestra una silueta tocable con tus tres zonas: el color indica la gravedad y, al tocar una zona, ves su lesión y qué hacer.",
      "Los NPC también usan estas técnicas, con lo que ven a simple vista."
    ] },
    { version: "1.12.0", fecha: "2026-11-20", titulo: "Presentar pistas y NPC con carácter", puntos: [
      "Contradecir desaparece: ahora puedes presentar ante el Consejo UNA de tus pistas de Indagar. Se muestra a todos con el mismo texto que viste, sin tu nombre, como pista verificada por el juego. Nada la compara con nadie: la mesa decide.",
      "La sospecha ya no sube por acertar con una pista: solo por acusaciones de varias personas y actos hostiles a la vista. Quien dejó un rastro sabrá en privado que ha salido a la luz, sin saber quién lo presentó.",
      "Cada NPC recibe un carácter al azar que nunca se muestra: solo se ve que es un NPC. Ya no se elige perfil al añadirlo.",
      "En mesas de más de cuatro jugadores, el Umbral también puede tentar a mitad de partida a quien ya se ha acercado a la oscuridad.",
      "Arreglo: un objeto que no se puede usar ya no cuenta como acto contra el hambre del Umbral."
    ] },
    { version: "1.11.0", fecha: "2026-11-20", titulo: "Magia de nivel 2", puntos: [
      "Aparecen seis conjuros intermedios, uno o dos por escuela: Custodia y Aurora (Luz), Zarza (Naturaleza), Eco (Umbral), Olvido (Mente) y Mordedura (Sombra).",
      "Se aprenden estudiando un grimorio, y solo si ya eres Practicante en un conjuro de esa misma escuela (o si un ermitaño te enseña). En el estudio, una de las tres opciones pasa a ser de nivel 2: nadie ve menos opciones.",
      "Sus efectos se resuelven al caer la noche, todos a la vez y por capas: primero los contrahechizos, luego los amparos, después los ataques, las curas y la información. Da igual quién actuó antes.",
      "Eco te deja nombrar a alguien: si lanzó un conjuro de nivel 2 esa noche, lo deshaces; si no, el eco se pierde y te mancha. Custodia protege a otra persona del primer conjuro de nivel 2 que le lancen.",
      "Los conjuros de nivel 2 pesan el doble en tu tope (máximo 4 conjuros y 5 de peso). Tu primera escuela practicada te da afinidad: −1 dificultad en tus conjuros de nivel 2 de esa escuela.",
      "Si usas el reto de pulso al estudiar, un buen pulso te cuesta 1 de oscuridad menos y uno torpe, 1 más. Omitirlo deja el coste normal.",
      "Lo que se oye en la crónica de un conjuro de nivel 2 nunca nombra a su objetivo, salga bien o mal."
    ] },
    { version: "1.10.0", fecha: "2026-11-20", titulo: "Salud más realista: tres zonas", puntos: [
      "El cuerpo ahora tiene tres zonas: cabeza, torso y brazos y piernas. Cada zona guarda una sola lesión, con su gravedad (leve, seria o grave) y su tipo (corte, perforación, contusión, fractura o quemadura).",
      "Sin sorpresas: un corte o una perforación de 3 o más de daño sangra siempre; las contusiones y quemaduras no. Y una herida abierta seria que lleva dos rondas sin cuidados se infecta; la ronda anterior se te avisa.",
      "Tu ficha tiene un panel «Qué te pasa y qué hacer», con cuánto pierdes por ronda y en cuántas rondas caerías moribundo si nada cambia.",
      "Nueva acción para todos: Atender. Cuidas a otro jugador sin objetos ni tirada: cortas su sangrado y frenas la infección. No cura vitalidad. Quien atiende no sabe qué había; el atendido sí lo sabe.",
      "Los demás solo ven señales ambiguas (cojea, protege un brazo, se tambalea, sangra, pálido, vendado), iguales sin importar el motivo."
    ] },
    { version: "1.9.0", fecha: "2026-11-20", titulo: "Reto de pulso y escuelas de magia", puntos: [
      "Nuevo reto opcional al actuar o conjurar: dos toques cuando la aguja pase por la zona clara. Acertar suma hasta +15 puntos a tu probabilidad de éxito; fallarlo del todo resta 6; omitirlo deja la probabilidad normal.",
      "Es el mismo reto, con la misma duración, para todas las acciones y todos los jugadores. Nadie pierde opciones por no jugarlo. En línea lo valida el servidor: no se puede falsear.",
      "Se puede desactivar desde la ayuda («Retos de pulso»). En mesas locales de 6 o más jugadores viene desactivado de serie.",
      "Los conjuros muestran su escuela (Luz, Sombra, Naturaleza, Mente o Umbral). De momento solo agrupa y da sabor: no cambia las tiradas."
    ] },
    { version: "1.8.2", fecha: "2026-11-20", titulo: "Sospecha acumulada", puntos: [
      "Acusar ya no revela quién es el Asesino con certeza: nadie ve si tus pruebas eran buenas. Solo sube la sospecha pública sobre esa persona.",
      "Cada jugador tiene un marcador público de sospecha (0 a 4). Sube cuando varios jugadores distintos le acusan, y con actos hostiles a la vista; baja con rondas tranquilas y con actos de bien.",
      "El marcador no es el rol y puede señalar a un inocente. Con sospecha alta, la mesa coopera mejor: enfrentarte a esa persona ya no es a ciegas y varios ataques seguidos le pesan más.",
            "Los NPC también acusan."
    ] },
    { version: "1.8.1", fecha: "2026-11-20", titulo: "Indagar: seguir los rastros", puntos: [
      "Nueva acción para todos: Indagar. Gastas el turno en examinar las heridas y muertes de las últimas rondas y obtienes una pista.",
      "La pista es veraz pero parcial: el tipo de rastro (golpe, marca oscura, síntomas, mecanismo u objeto manipulado), la ronda aproximada y, a veces, un detalle vago.",
      "Nunca dice quién fue ni da certeza; si no hay nada que examinar, no encuentras nada.",
      "En mesas de 4 o menos, tras una muerte reciente, una indagación da dos pistas.",
      "Tus indicios se guardan en tu ficha y solo los ves tú."
    ] },
    { version: "1.8.0", fecha: "2026-11-20", titulo: "Más formas de dañar, con riesgo claro", puntos: [
      "El veneno ahora es retardado: no se nota la ronda siguiente y después hace daño real durante dos rondas, hasta que se cure con hierbas, antídoto o descansando.",
      "Nueva acción: Poner una trampa. Se esconde una ronda y salta la siguiente sobre quien se mueva por las ruinas; puede caer un inocente, o tú mismo.",
      "Nueva acción: Sabotear. Estropeas en secreto un objeto de otro: la próxima vez que lo use, fallará y puede volverse contra él.",
      "Cada acción nueva dice, antes de elegirla, qué ganas y qué arriesgas. Se desbloquean por lo que haces (explorar, robar o tener una cuerda o una ganzúa).",
      "Los golpes, las marcas mágicas, los síntomas del veneno y los mecanismos de las trampas quedan registrados en secreto para poder investigarlos en una próxima versión."
    ] },
    { version: "1.7.0", fecha: "2026-11-13", titulo: "Mesas de 2 y jugadores de la casa (NPC)", puntos: [
      "Ya se puede jugar con 2 jugadores.",
      "Puedes añadir NPC a la mesa (hasta 10 jugadores en total) y sustituir por un NPC a quien se ausente, en local y en línea. Cada NPC juega con su propio carácter, que no se revela, y se ve claramente que es un NPC, y quien se fue puede recuperar su lugar.",
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
