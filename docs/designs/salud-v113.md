# v1.13.0 — Salud: resto recortado y seguro

Sobre `salud-v110.md`. Cambia el motor y los datos (desplegar con mesa vacía: los snapshots dan 409).

## Entra
- **Atender con técnica** (parámetro `stake` de `act`, validado en motor; en línea pasa por el mismo comando `act`). Todas disponibles de entrada; las que exigen objeto salen atenuadas con «falta: …» (solo depende de la mochila propia: `U.treatOptions(pid)`, `q.treat` en la vista, sin fugas). Efecto y coste se enseñan ANTES de elegir. Sin azar: el riesgo es de coste y de acertar con las señales públicas.
  - **Presionar y limpiar** (gratis): corta un sangrado leve y frena la infección; un sangrado fuerte (sev 2: torso serio/grave) solo baja a goteo. (Cambio respecto a v1.10: antes cortaba cualquiera.)
  - **Torniquete** (sin objeto): corta CUALQUIER sangrado; el paciente tiene un miembro entumecido la ronda en que se pone y la siguiente (−1 cuerpo/ataque y −1 defensa; `p.tournRound`, `tornActive`, dentro de `armPen/legPen`). Solo si había sangrado; no cambia nada público (la señal «sangra» desaparece sin más).
  - **Entablillar** (gasta vendas SIEMPRE, aunque no hiciera falta): si el miembro tiene lesión seria o grave, `zones.miembros` baja a 3 (leve) y la lesión pasa a contusión; deja de cojear/proteger.
  - **Cauterizar** (antorcha, que se gasta, o linterna, que no): sella sangrado e infección (incluida una herida abierta sin cuidar); el paciente pierde 1 de vitalidad si tiene 3 o más (sin matar).
  - El texto del actor es uniforme (no revela si había algo); el atendido recibe la nota privada con autor y técnica (como antes).
- **Silueta tocable** (SVG de 3 zonas) en la ficha del propio jugador: color por gravedad, toca una zona y ve su lesión, tipo y qué hacer. Accesible por teclado (Enter/espacio) y a 360 px. Solo del propio cuerpo; de los demás sigue viéndose únicamente el texto público de señales.
- NPC y bots usan las técnicas con lo que ven a simple vista (señales públicas + su mochila): cauterizar/torniquete con quien sangra, entablillar con quien cojea o protege un brazo si llevan vendas. El perfil del NPC no aparece en ninguna vista.

## Se deja para después
- **Cirugía**: sin objeto propio ni riesgo coherente que mostrar con seguridad; se descarta hasta que existan órganos/heridas internas.
- Examinar (diagnóstico con precisión), Limpiar como técnica con objeto (aguardiente), oficio Sanador (se desbloquearía por tratamientos con éxito), hipotermia y enfermedad como estados, silueta de pacientes ajenos con las señales públicas.
- **Integración de secretos y pactos con Atender** (Intacto, Justicia, «atender gratis» entre pactados): no entra; la pista dinámica de Intacto no menciona aún entablillar.
- Torniquete «aflojar o perder el miembro» y entablillar con fallo: no entran (riesgo decorativo sin decisión real a corto plazo).
