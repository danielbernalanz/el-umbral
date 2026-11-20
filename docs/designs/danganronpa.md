# Plan: más formas de matar + investigación (inspiración Danganronpa)

Fecha: 2026-11-20. Solo diseño; nada implementado. Respeta las reglas de HANDOFF.md.

## Qué tomamos de Danganronpa (y qué NO)
Tomamos: motivos que empujan a matar; crímenes con método y escena; investigación con pistas parciales; juicio donde las pruebas contradicen versiones; testimonio final de la víctima.
NO tomamos: revelar al culpable con certeza 100 %, ejecución del culpable, evento final obligatorio, contención que inhabilite, roles al inicio, ver menos opciones según jugador.

## 1. Formas de matar (se integra con docs/designs/dano.md, v1.8.0)
Cada método deja una FIRMA distinta (lo que luego investigan) y tiene un riesgo que se ve antes de elegir:
- Veneno en objeto/bebida: letal retardado (1-2 rondas), firma «síntomas»; frasco de dosis fija, sin mejora de riesgo.
- Trampa: se coloca una ronda, salta la siguiente sobre quien la active; firma «mecanismo»; puede herir a un inocente.
- Sabotaje: manipular el objeto/arma de otro para que falle o se vuelva contra él; firma «objeto alterado».
- Emboscada (ya existe): firma «golpe»; riesgo de testigos.
- Maldición lenta / ritual oscuro: tarda más, firma «marca» (solo si hay conocimiento oscuro).
- Empujón/accidente escenificado: baja letalidad, alta ambigüedad (¿accidente o crimen?).
- Ahogar en silencio (a un moribundo): remata sin ruido, riesgo si alguien lo socorre.
Regla: ningún método da certeza de autor; las firmas son pistas, no pruebas.

## 2. Escena e investigación
- Tras una muerte (o herida grave) se abre fase de investigación: cada jugador vivo gasta 1-2 «indagaciones» por ronda en turno privado (misma cantidad para todos).
- Indagar un cuerpo/escena da pistas VERACES pero parciales: método (firma), ronda aproximada, si hubo prisa o sangre fría, si faltaba un objeto.
- Pistas se guardan en una libreta privada; se pueden compartir hablando (mentir es posible al hablar, nunca en la pista del sistema).
- Testimonio final: el muerto deja una frase veraz y vaga (p. ej. «lo vi venir de cerca», «olía a hierbas»).
- Presencia/coartada simplificada: se registra con quién estuvo cada jugador cada ronda (pactos, socorrer, compartir acción). El Asesino puede tener testigos falsos solo por acciones reales, no por texto.

## 3. Motivos (estilo Monokuma)
- Evento opcional por partida, público: «El Umbral ofrece un motivo»: una recompensa por matar, un secreto revelado a todos, o una escasez.
- Se une a la tentación existente: da una razón común, no marca a nadie. Un motivo por partida como máximo, desbloqueado por lo que ocurre (p. ej. tras N heridas), no por reloj.

## 4. Juicio / consejo con pruebas
- El consejo público tras un crimen permite «contradecir»: elegir una declaración de alguien y una pista propia que la contradiga. Si la pista es veraz y choca, sube la SOSPECHA pública de esa persona (marcador visible, no rol).
- Sin revelación del Asesino: el resultado es un nivel de sospecha acumulada (conecta con la tarea «sospecha acumulada»). Cooperar contra el más sospechoso sin certeza.
- Falsas pistas: el Asesino puede «plantar» una pista falsa con coste y riesgo de ser descubierta; descubrirla da pista nueva. (Cuidado: la antigua «presentar prueba» se eliminó; esto es pasivo, no una acusación.)

## 5. Fases (orden, un agente edita a la vez)
F0 Revisar dano.md/salud.md y fijar firmas y pistas (dev, solo docs).
F1 Firmas y trazas en el motor + métodos nuevos (trampa, sabotaje, veneno retardado, empujón) con riesgo visible (dev; encaja en v1.8.0).
F2 Investigación: indagaciones, libreta privada, testimonio final, vista filtrada por jugador y online (dev + test de no-fuga).
F3 Sospecha acumulada + contradicción en consejo (dev).
F4 Motivos opcionales (dev).
F5 Balance (smart_human 3j a 10/12/15 min y 2j; 6/8/10j), tests de fuga, E2E (mecanico ejecuta, dev decide).
Cada fase: versión nueva, news.js, npm test, sin desplegar con salas abiertas.

## 6. Riesgos y preguntas abiertas
- Las pistas no deben delatar rol ni corrupción; test de fugas obligatorio.
- Exceso de texto en móvil: pistas en fichas cortas con icono.
- Bots (smart/smart_human) deben aprender a investigar o el balance se sesga.
- Decidir: ¿cuántas indagaciones por ronda? ¿una muerte «sin firma clara»? Recomendado: 1 indagación/ronda, 2 si hay muerte.
