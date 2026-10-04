# Universal Duels — Alpha 0.2

## Doubles
- Singles y Doubles comparten el mismo motor.
- Doubles usa dos activos por lado y cuatro acciones por ronda.
- Orden: prioridad, Velocidad y desempate RNG.
- Los objetivos se resuelven por posición.
- Reemplazos por KO siempre manuales.

## Objetivos de movimientos
- `self`: sí mismo.
- `ally`: compañero. En Singles no tiene objetivo válido y el movimiento falla.
- `ally_team`: equipo aliado activo.
- `enemy_team`: equipo contrario activo.
- `single`: un objetivo distinto del usuario; en Doubles puede ser aliado o rival.
- `all`: todos los activos menos el usuario.

Físico/Especial admite `single`, `enemy_team` y `all`. Estado admite los seis. Los movimientos antiguos sin `targeting` se interpretan como `single`.

## Editor
- Evento `manual_doubles`: Al usarlo en Doubles.
- Acción `damage_multiplier`: ajusta el daño del movimiento actual por porcentaje.
- Acción `switch_character`: cambio manual o reserva aleatoria.

## Sala pública
- Singles / Doubles.
- Picked Team / Random Team.
- Picked Team conserva 8 posiciones arrastrables y botón de dado.
- Random Team mantiene oculto el equipo sorteado hasta iniciar y conserva el Picked Team desactivado.
- Al terminar o rendirse se vuelve a la misma sala.
