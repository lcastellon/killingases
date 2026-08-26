# Fichas controladas por el anfitrión

El anfitrión es el único que reparte fichas. Los demás entran como espectadores y ven en todo momento cuántas fichas tienen disponibles.

## Cómo funcionará

1. Al crear una mesa, el anfitrión define **compra mínima** y **compra máxima** (además de ciegas y fichas iniciales).
2. Cualquier jugador con el código entra a la mesa **como espectador, con 0 fichas**: ve la mesa, el bote y el historial, pero no tiene asiento ni puede actuar.
3. El anfitrión ve un panel "Fichas de la mesa" con la lista de jugadores y botones para **agregar o quitar fichas** (+/- cantidad) a cada uno.
4. Cuando un jugador alcanza la compra mínima, se le asigna automáticamente el primer asiento libre y entra a la siguiente mano. Si sus fichas quedan por debajo del mínimo (o en 0), vuelve a espectador entre manos.
5. Los ajustes de fichas solo se permiten **entre manos**: si hay una mano en curso, el anfitrión recibe un aviso de que debe esperar a que termine.
6. Todo jugador (anfitrión incluido) ve una tarjeta propia con: fichas disponibles, estado (sentado / esperando fichas) y el rango de compra de la mesa.

## Detalles técnicos

Base de datos (migración):
- `poker_tables`: nuevas columnas `min_buyin` y `max_buyin` (con valores por defecto derivados de la ciega grande).
- `table_players`: `seat` pasa a ser opcional (nulo = espectador) y se ajusta el índice único de asiento para permitir varios espectadores; `chips` arranca en 0.
- Sin cambios de RLS: toda escritura sigue pasando por funciones de servidor con la clave privilegiada.

Servidor (`src/lib/poker/table.functions.ts` + `table.server.ts`):
- `joinTable`: inserta al jugador con `chips = 0` y `seat = null` (ya no reparte fichas iniciales).
- Nueva función `adjustPlayerChips({ code, userId, delta })`: verifica que quien llama sea el anfitrión, que no haya mano en curso, que el resultado no sea negativo ni supere la compra máxima, y luego actualiza fichas.
- Nueva lógica `reconcileSeats`: tras cada ajuste y entre manos, sienta a quien alcance el mínimo y libera el asiento de quien baje del mínimo.
- `dealNewHand` sigue usando solo jugadores sentados con fichas; se mantiene la validación de mínimo 2 jugadores.
- `getTableSnapshot` devuelve `minBuyin`, `maxBuyin`, `me.chips`, `me.isSpectator` y `players[].seat: number | null`.

Interfaz:
- `src/routes/index.tsx`: campos de compra mínima y máxima al crear mesa.
- `src/routes/_authenticated/mesa.$codigo.tsx`: tarjeta "Tus fichas" para todos; panel de administración de fichas visible solo para el anfitrión; lista de espectadores esperando fichas; los asientos solo muestran jugadores sentados.
- Nuevo componente `src/components/poker/ChipBank.tsx` con la lista de jugadores y los controles +/- del anfitrión.

Pruebas: se amplía `src/lib/poker/engine.test.ts` / se agregan casos para el ajuste de fichas (límites mínimo/máximo, rechazo en mano en curso, sentar y levantar por umbral).
