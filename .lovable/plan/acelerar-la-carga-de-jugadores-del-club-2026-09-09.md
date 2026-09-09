# Acelerar la carga de "Jugadores del club"

## Qué observé

- La base de datos responde rápido: las consultas del panel (perfiles, mesas, jugadores sentados) tardan menos de 1 ms de media.
- El panel pide la información en dos llamadas separadas (jugadores y comisión) y no muestra nada hasta que llega la primera respuesta: por eso se siente "vacío" y lento al abrirlo.
- Antes de leer la lista de jugadores, el panel ejecuta la limpieza de mesas inactivas y espera a que termine. Esa limpieza recorre mesas, reintegra fichas y bloquea filas, así que retrasa cada refresco (cada 5 segundos) aunque no haya nada que cerrar.
- Al refrescar, la lista se queda "cargando" en lugar de mantener los datos anteriores en pantalla.

## Cambios

1. **No bloquear la lista con la limpieza**: la lista de jugadores se lee de inmediato; la limpieza de mesas inactivas se ejecuta aparte y como máximo una vez por minuto, sin que el panel la espere. La devolución de fichas al cerrar mesas se mantiene exactamente igual.
2. **Una sola petición**: jugadores, mesas y comisión de la casa llegan juntos en una respuesta, en lugar de dos llamadas seguidas.
3. **Refresco sin parpadeo**: mientras llega la nueva información se mantiene visible la anterior; el refresco automático baja a cada 10 segundos y se pausa cuando la pestaña no está visible.
4. **Aparición inmediata**: al abrir el panel se muestra la estructura de la lista (esqueleto) en lugar de un texto "Cargando…", y la búsqueda ya funciona en cuanto llegan los datos.

## Detalles técnicos

- `hostPanelData` deja de llamar a `closeInactiveTables` de forma bloqueante; la limpieza se dispara con control de frecuencia (marca de tiempo en memoria del servidor, mínimo 60 s) y se ignora su resultado en la respuesta.
- Se añade un server fn combinado (`getHostPanel` devuelve también las estadísticas de rake) para evitar dos round-trips con validación de sesión cada uno; `getHouseStats` se conserva por compatibilidad.
- En `src/routes/_authenticated/panel.tsx`: una sola `useQuery` con `placeholderData: keepPreviousData`, `refetchInterval: 10000`, `refetchOnWindowFocus` y esqueleto de carga.
- Sin cambios de esquema ni de reglas de juego.
