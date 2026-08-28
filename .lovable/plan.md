# Banco global del club

Hoy las fichas viven pegadas a cada mesa: en la base de datos Leon tiene 10,000 en la mesa VEF3R5 y 0 en KG6SFJ, porque cada fila de jugador-en-mesa guarda su propio saldo. Vamos a cambiarlo por un **banco único por jugador**, del que cada uno decide cuánto lleva a la mesa que quiera.

## Cómo funcionará

1. Cada jugador del club tiene un **saldo global** (banco). Solo el anfitrión puede subirlo o bajarlo, desde el panel de admin.
2. Al entrar a una mesa, el jugador elige su compra dentro del mínimo/máximo de esa mesa. Ese monto **se descuenta de su banco** y se convierte en sus fichas en la mesa.
3. Al levantarse de la mesa (o al cerrarla el anfitrión), las fichas que tenga en la mesa **regresan a su banco**.
4. Si intenta comprar más de lo que tiene en el banco, se le avisa: "Tu banco tiene X fichas; pide fichas al anfitrión."
5. El jugador ve siempre dos cifras: **banco del club** y **fichas en esta mesa**.
6. La recarga rápida en mesa ("volver con X") también sale de su banco; ya no crea fichas de la nada.
7. El panel de admin deja de asignar fichas por mesa: pasa a mostrar el banco de cada jugador con botones para dar/quitar, más una vista de en qué mesas está sentado y con cuánto.

## Detalles técnicos

Base de datos (migración):
- `profiles`: nueva columna `bank_chips integer not null default 0`.
- Migración de datos: por cada jugador, sumar sus fichas de mesas ya cerradas a `bank_chips` (las mesas abiertas conservan sus fichas en juego).
- Sin cambios de RLS/GRANT nuevos: `profiles` ya es legible por autenticados; toda escritura de saldo pasa por funciones de servidor con clave privilegiada.

Servidor (`src/lib/poker/table.server.ts`):
- `getBank(db, userId)` / helper para leer y escribir `bank_chips`.
- `buyIn`: valida contra `bank_chips` además de min/max de mesa; descuenta del banco y acredita en `table_players.chips` de forma consecutiva (leer, validar, actualizar banco, actualizar mesa; si falla la segunda escritura, revertir el banco).
- `cashOut` (usada por `leaveTable` y `closeTable`): mueve `table_players.chips` al banco y deja la fila en 0 / sin asiento.
- `rebuyChips`: en vez de regalar el stack inicial, toma del banco lo necesario hasta el objetivo, acotado por el banco disponible.
- `resetTableStacks`: se elimina o se reemplaza por "devolver fichas al banco de todos" (sin crear fichas).
- `adjustPlayerChips` cambia de significado: ajusta el **banco global** del jugador (solo anfitrión, sin exigir que esté en una mesa, sin tope de `max_buyin`; sí impide dejarlo negativo).
- `hostPanelData`: incluye `bankChips` por jugador y sus mesas con fichas en juego.
- `getTableSnapshot`: agrega `me.bankChips`.

Funciones de servidor (`src/lib/poker/table.functions.ts`):
- `setPlayerChips` pasa a recibir `{ userId, delta }` (sin `code`) y ajusta el banco.
- `buyInTable`, `rebuyTable`, `leaveTable`, `closeTable` se ajustan a los nuevos helpers.
- `addPlayerToTable` deja de acreditar fichas: solo inscribe al jugador como espectador.

Interfaz:
- `src/routes/_authenticated/panel.tsx`: columna "Banco" por jugador con +/- y monto libre; lista de mesas donde tiene fichas en juego.
- `src/routes/_authenticated/mesa.$codigo.tsx`: tarjeta con "Banco del club" y "Fichas en la mesa"; el diálogo de compra limita el máximo al banco disponible y muestra el saldo; mensaje claro cuando el banco es insuficiente; botón "Levantarme y regresar fichas al banco".

Pruebas (`src/lib/poker/engine.test.ts` o un nuevo archivo de pruebas de banco): compra descuenta del banco, compra mayor al banco se rechaza, cash-out devuelve fichas, recarga limitada por banco.
