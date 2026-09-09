# Revisión de imparcialidad del reparto

## Qué encontré al revisar las 4 manos de anoche

Revisé las cartas guardadas de cada mano y volví a comprobar el resultado a mano:

- Mano 1: León trío de jotas vs. doble par de Phil — correcto.
- Mano 2: León escalera al as vs. doble par de Phil — correcto.
- Mano 3: León trío de reyes vs. par de reyes de Phil — correcto.
- Mano 4: León color al reina vs. par de ochos de Phil — correcto.

En las cuatro, el ganador que anunció el juego es realmente el que tenía la mejor mano, usando 2 cartas propias + 3 de la mesa. No hay ninguna regla que favorezca a un jugador ni al anfitrión: las cartas se mezclan de nuevo en cada mano y se reparten en orden desde una baraja ya revuelta.

También hay manos anteriores (26 y 29 de agosto) donde ganó Phil, así que el patrón de anoche es una racha de 4 manos, no un sesgo. Cuatro manos son muy pocas para notar nada: la probabilidad de que un jugador gane 4 seguidas entre dos jugadores es de aproximadamente 1 en 16.

## Qué propongo hacer de todos modos

Para que nadie tenga dudas, tres mejoras concretas:

1. **Mezcla criptográfica.** Cambiar el generador de azar del reparto por el generador seguro del sistema (el mismo tipo que se usa en casinos en línea), en lugar del azar básico del lenguaje.
2. **Prueba de imparcialidad automática.** Añadir una prueba que reparta cientos de miles de manos simuladas y verifique que cada asiento gana casi exactamente la misma proporción, y que cada carta llega a cada posición con igual frecuencia. Si algún día se cuela un sesgo, la prueba falla.
3. **Transparencia de la mano.** Al terminar cada mano, el resumen ya muestra las cartas exactas; añadir además la lista completa de las cartas de todos los jugadores que llegaron al showdown, ordenada de mejor a peor, para que cualquiera pueda comprobar el resultado en el momento.

## Detalles técnicos

- `shuffle()` en `src/lib/poker/cards.ts` mantiene su firma con generador inyectable (los tests siguen usando uno determinista), pero el motor pasará un generador basado en `crypto.getRandomValues` con muestreo sin sesgo por rechazo (evita el sesgo de módulo).
- `startHand()` en `src/lib/poker/engine.ts` usa ese generador por defecto; sin cambios de estado ni de base de datos.
- Nuevas pruebas en `src/lib/poker/engine.test.ts`: distribución de posición de cartas y reparto de victorias en simulación masiva con tolerancia estadística.
- El listado ampliado del showdown es solo presentación en `src/components/poker/Showdown.tsx`, con datos que el servidor ya envía.

Sin migraciones de base de datos.
