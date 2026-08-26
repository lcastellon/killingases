# Mata Ases — Omaha No Limit (multijugador online)

Primera entrega: una mesa de Omaha No Limit completamente jugable, con salas privadas para invitar amigos por código. La regla especial "Mata Ases" se añade después, sobre esta base.

## Experiencia

1. **Entrada** (`/`): nombre de la marca, botón "Crear mesa" y campo para "Unirse con código". Login rápido por email para identificar a cada jugador.
2. **Lobby de mesa** (`/mesa/$codigo`): lista de jugadores sentados, fichas iniciales, ciegas, código para compartir. El anfitrión inicia la mano cuando hay 2+ jugadores.
3. **Mesa de juego**: fondo de tapete, cartas comunitarias al centro, asientos alrededor con avatar/fichas/apuesta, tus 4 cartas grandes abajo y controles de acción (Fold / Check / Call / Bet / Raise con slider y atajos ½ bote, bote, all-in).
4. **Showdown**: se revelan manos, se muestra la mejor combinación de cada jugador y el ganador; el bote se anima hacia el ganador y arranca la mano siguiente.

Todos los jugadores ven lo mismo en tiempo real; cada uno solo ve sus propias cartas.

## Reglas implementadas

- Omaha: 4 cartas por jugador, obligatorio usar exactamente 2 propias + 3 del board.
- No Limit: apuesta mínima = ciega grande o subida previa, máxima = todas tus fichas.
- Rondas: preflop, flop, turn, river con ciegas, botón rotativo, all-in y botes laterales.
- Evaluación de manos alta (sin Hi-Lo), reparto del bote con empates.

## Diseño

Estética de casino nocturno pero moderna: fieltro verde profundo, dorado latón para acentos y bote, tipografía con carácter (display condensada para cifras, sans limpia para UI), cartas nítidas con buen contraste. Sin degradados morados genéricos. Optimizado primero para móvil (una mano), adaptable a escritorio.

## Detalles técnicos

- Se habilita **Lovable Cloud** para autenticación, base de datos y tiempo real.
- Tablas: `profiles`, `tables` (código, ciegas, estado, botón), `table_players` (asiento, fichas, apuesta, estado, cartas), `hands` (board, bote, ronda, turno), `hand_actions` (historial). RLS: cada jugador solo lee las cartas de su propia fila; el resto de la mesa es visible para los sentados.
- Motor de reglas en servidor mediante server functions (`join_table`, `start_hand`, `player_action`) para que nadie pueda hacer trampa desde el cliente; el cliente solo pinta estado.
- Sincronización con Realtime de Postgres sobre `hands` y `table_players`; TanStack Query para las lecturas iniciales.
- Rutas: `/` (entrada), `/mesa/$codigo` (lobby + juego), `/auth` (login).

## Fuera de alcance en esta entrega

Regla "Mata Ases", torneos, chat, estadísticas históricas, dinero real.
