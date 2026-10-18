# Auditoría Alpha 0.4 — reglas de estados y eventos

## Hallazgos y correcciones

1. El selector de evento de estados mostraba el valor fijo `on_status` y `readBuilder()` lo imponía al guardar, destruyendo los eventos elegidos previamente. Ahora carga y persiste `rule.event` sin sobrescribirlo.
2. La validación de estados prohibía otras condiciones, el objetivo y otros eventos; ahora admite condiciones principales/adicionales Y/O/NO y los eventos de combate que el motor realmente despacha. Sigue prohibiendo eventos sin semántica válida para estados (`manual`, `manual_doubles`, `on_survive`).
3. El motor solo resolvía reglas del estado de tipo `on_status` y dejaba ignorados otros eventos: ahora los despacha en las mismas ocasiones que las habilidades: inicio/final de turno, final de ronda, atacar, acertar, recibir daño, entrar y morir. El evento `on_status` se evalúa al final de turno; se añadió `on_status_applied` para ejecución inmediata al adquirir el estado.
4. `on_condition` no estaba listado en eventos permitidos por el validador, y `block_status` figuraba en el editor pero no era válido. Ahora se aceptan.
5. Reglas continuas de estadística ligadas a estados admiten condiciones, tanto `on_status` como `on_condition`; no se acumulan repetidamente. Se vuelve a calcular su efecto tras daño, curación o eliminación del estado. Las acciones pasivas no reversibles se ejecutan al pasar la condición a verdadera, con un mecanismo de no repetición.
6. Los usos de las reglas del estado ahora se limpian al quitar el estado, para que al volver a aplicarlo puedan volver a activarse.
7. Se añadieron pruebas específicas de validación, persistencia del evento, activación al adquirir el estado y al final de turno con condición de PS. Los motores de Main y Editor son idénticos.
8. Se retiraron notas históricas de cambios redundantes de ambos proyectos. Se conservaron workflows, Wrangler, código, pruebas, assets y documentos necesarios.

## Comprobaciones

- `npm test` Editor: correcto.
- `npm test` Main: correcto.
- Prueba nueva: `node alpha04-status-event-compat.test.mjs`: correcta.
- Sintaxis del motor y del JS inline del Editor: correcta.
- Cloudflare / Access / datos KV: **no modificados**.

## Límites y precauciones

- No se ha ejecutado una prueba real de dos jugadores en Cloudflare ni pruebas de navegador autenticadas contra Access. Los tests no garantizan todas las combinaciones posibles.
- Una acción pasiva reversible de estadística se quita cuando deja de cumplirse su condición; acciones no reversibles (p. ej., curar, daño, alterar clima) se disparan al pasar de falso a verdadero, no continuamente por fotograma.
- `Al entrar` de un estado se refiere a la entrada del portador al campo; para dispararlo en el instante de recibir el estado debe elegirse `Al adquirir el estado`.
- Las reglas de estado `Al tener el estado` se ejecutan al final de turno. Para una pasiva condicional, elegir `Mientras se cumpla la condición`.
- No se han alterado datos publicados ni borradores. Hacer copia de seguridad del KV antes de cargar parches.
