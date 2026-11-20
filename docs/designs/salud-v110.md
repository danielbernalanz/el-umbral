# v1.10.0 — Salud recortada (3 zonas)

Recorte aplicado de `salud.md` («Anatomía»): 3 zonas, una lesión por zona, tick determinista, señales públicas ambiguas, previsión privada y la acción Atender. Sin tocar magia, sospecha ni reto.

## Modelo
- Zonas: `cabeza`, `torso`, `miembros` (brazos y piernas). `p.zones[z]` = daño acumulado (fuente de verdad, como antes); `p.inj[z] = {t, part?, last, since}` = lesión única de la zona (tipo dominante, parte de los miembros según el último golpe, ronda del último golpe).
- Nivel `n` por daño acumulado: 1 leve (1-3), 2 seria (4-5), 3 grave (6+). Los penalizadores (−1 ataque/cuerpo con brazo, −1 defensa con pierna, −1 mente con cabeza) empiezan en el nivel 2, igual que antes (umbral de daño 4), para no mover el equilibrio.
- Tipos: corte, perforación, quemadura, contusión, fractura. Origen→tipo: cazar=perforación, apuñalar=corte, magia=quemadura, trampa=fractura, golpe genérico en el torso=corte (laceración), resto=contusión. Fusión: perforación > corte > quemadura > fractura > contusión; contusión de 4+ en un miembro = fractura.
- `damage(p, n, {src, zone, tipo, noZone, noBleed})` acepta los nombres antiguos `brazos`/`piernas` (zona `miembros` con parte). Contrato compatible con v1.8 (`harm`, `sigs`).

## Tick determinista (sin azar)
- Sangrado: un corte o perforación de 3+ de daño sangra siempre (2 rondas, 1 por ronda; 2 en un torso seria/grave). Antes: 25-45 % de probabilidad. El estado `sangrado` guarda `sev`; los sangrados de otros orígenes (marchitar, crítico) siguen en 2 por ronda.
- Infección: una herida ABIERTA (corte, perforación, quemadura) seria o grave que lleva 2 rondas sin cuidados (golpe, curación, descanso o Atender) se infecta; la ronda anterior se avisa en privado. Antes: 40 % por ronda en cualquier zona grave.
- Previsión privada `forecast`: rondas hasta caer moribundo según sangrado/infección/veneno actuales (solo sumas, sin azar).

## Público
`look = {aspecto, signos[]}`; signos en orden fijo y máx. 3: `cojea`, `protege_brazo`, `tambalea`, `sangra`, `palido` (shock, infección o veneno ya sintomático: misma señal), `vendado` (1 ronda tras vendas/botiquín/descanso). Función solo del cuerpo (zonas, estados físicos, vitalidad): nunca de corrupción, rol, causa ni autor. `visibleHealth` es el texto de `look`.

## Atender (nueva acción, para todos desde el inicio)
Sobre otro jugador no moribundo, sin objetos ni tirada: corta el sangrado e infección y reinicia el reloj de infección de las heridas abiertas. No cura vitalidad. Texto del actor uniforme (no revela si había algo); el atendido recibe la nota privada con el autor (como Socorrer). Sin riesgo: una acción natural y segura no lleva riesgo decorativo.

## UI
Zonas con gravedad y tipo, panel «Qué te pasa y qué hacer» (máx. 3 líneas) con pérdida por ronda y previsión.

## Migración
Partidas locales guardadas (formato 5): `initHealth` funde brazos+piernas en `miembros` (parte = la más dañada) y crea `p.inj`. En línea: cambia el hash del motor, los snapshots antiguos dan 409; desplegar con mesa vacía.

## Pendiente (v1.10.1)
Torniquete, férula/entablillar, cauterizar, cirugía, Examinar (diagnóstico con precisión), Limpiar como técnica separada con objeto, oficio Sanador, silueta SVG tocable, hipotermia y enfermedad como estados, integración de secretos (Intacto) y pactos con Atender.
