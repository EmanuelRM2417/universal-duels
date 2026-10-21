# Universal Duels — Alpha 0.6 · Corrección de flujo online

## Problema reproducido

Dos mensajes `select_order` simultáneos podían realizar lecturas del mismo estado antes de una consulta asíncrona de KV. Cada petición escribía su copia del estado; la segunda sobrescribía la primera, dejando solo una orden aceptada. La partida seguía esperando hasta el timeout. En la versión anterior, la prueba de concurrencia dejaba la partida en la ronda 1; con este parche avanza a la 2.

Además, cualquier excepción en `resolveRound()` eliminaba `pending.host` y `pending.guest`, con lo que el temporizador podía declarar un resultado técnico pese a que ambos ya habían elegido.

## Solución

- Serialización de handlers de WebSocket, alarmas y conectividad por sala para evitar escrituras concurrentes sobre estados obsoletos.
- Una selección válida equivale a una orden confirmada. Se responde `order_accepted` y se identifica la ronda para rechazar paquetes atrasados.
- Al recibir las dos selecciones, la sala entra en `resolving` y el límite de selección se anula durante el cálculo del turno.
- Si un error temporal interrumpe la resolución, ambas elecciones permanecen guardadas. Durable Objects reintenta con un tiempo de espera limitado, **sin adjudicar un ganador por error técnico**. Se registra un mensaje diagnóstico en el log del Worker.
- El cliente conserva una selección pendiente de confirmación temporalmente en `sessionStorage` y puede reenviarla al reconectarse. Mientras espera el acuse de recibo, efectúa reintentos espaciados exclusivamente para esa acción no confirmada, sin consultar repetidamente el estado general de la sala. Se evita asumir que se envió cuando el WebSocket está desconectado.

Las reglas existentes de timeout de **60 segundos para jugadores que no han elegido** y **30 segundos para reemplazos** se mantienen.

## Archivos alterados

- `worker.js` — serialización, estado `resolving`, reintentos y validación de ronda.
- `public/index.html` — confirmación, reconexión y presentación de resolución/reintentos.
- `alpha05-critical-regressions.test.mjs` — actualización de una aserción que exigía el envío antiguo sin número de ronda.
- `alpha06-online-concurrency.test.mjs` — pruebas nuevas de Singles/Doubles, paquetes atrasados y fallo de KV temporal.
- `package.json` — inclusión de la nueva prueba en `npm test`.

**Sin cambios:** `battle-engine.js`, `practice-ai.js`, `practice-session.js`, `public/practice.html`, `public/audio-director.js`, `public/catalog.html`, `wrangler.toml`, `.github/workflows/deploy.yml`, sprites, AUD, KV y R2.

## Validación

- `npm test`: todas las suites locales completadas satisfactoriamente.
- Prueba de concurrencia: antes del parche falla con `1 !== 2` (ronda sin resolver); después pasa.
- Singles y Doubles con dos selecciones concurrentes: pasan.
- Error temporal simulado durante el cálculo: conserva ambas órdenes, no adjudica timeout y el alarm posterior resuelve el turno correctamente.
- Comprobación de sintaxis de `worker.js` y de los scripts HTML del Main: satisfactoria.

## Límites de validación

No se ha desplegado este parche en Cloudflare ni se ha probado con dos dispositivos reales o con el catálogo privado del juego. El test de concurrencia reproduce una condición que explica el síntoma, pero el entorno real puede mostrar otras causas; si ocurre, los logs nuevos de `Error temporal resolviendo turno` ayudarán a diagnosticarla.

**Despliegue:** solo subir el ZIP de Main al repositorio correcto y revisar GitHub Actions. No tocar el Editor ni `Cargar parche` por esta corrección.
