# Aplicar migración de chat de mesa

## Objetivo
Ejecutar la migración existente `supabase/migrations/20260909060000_table_chat.sql` en Lovable Cloud para crear o actualizar la tabla `public.table_messages` con las reglas de seguridad y realtime necesarias para el chat de mesa.

## Qué hace la migración

- Crea la tabla `public.table_messages` si no existe, con los campos:
  - `id`, `table_id`, `user_id`, `display_name`, `body`, `created_at`
  - Restricción de longitud del mensaje (1 a 280 caracteres)
- Crea un índice por `table_id` y `created_at DESC`.
- Habilita Row Level Security (RLS) sobre la tabla.
- Otorga permisos mínimos:
  - Solo lectura (`SELECT`) a usuarios autenticados.
  - Todo (`ALL`) a `service_role`.
  - Revoca `INSERT`, `UPDATE`, `DELETE` directos a `authenticated` y `anon`.
- Crea una política para que solo los miembros de la mesa puedan leer mensajes.
- Configura `REPLICA IDENTITY FULL` y añade la tabla a la publicación realtime `supabase_realtime`.
- Crea un trigger `AFTER INSERT` que actualiza la actividad de la mesa usando `public.touch_poker_table_activity()`.

## Criterio de éxito

- La tabla `public.table_messages` existe en la base de datos.
- RLS está activo, la política `table_messages_select_members` está presente.
- Los permisos reflejan solo lectura para jugadores autenticados y todo para el sistema.
- `supabase_realtime` publica cambios de `table_messages`.
- El frontend actual (`TableChat.tsx` y `chat.functions.ts`) sigue funcionando tras la migración.

## Alcance

Solo base de datos. No se modificará frontend, server functions ni se generará otra migración duplicada.