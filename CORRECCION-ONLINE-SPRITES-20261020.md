# Universal Duels Alpha 0.5 — Correcciones verificadas

## Main

- **Turno online:** `select_order` ahora valida una sola vez y registra la orden definitiva. Si las dos acciones están confirmadas, la ronda se resuelve inmediatamente; el cliente no depende de un segundo mensaje `order` que anteriormente nunca enviaba. Se mantiene el temporizador y las protecciones del servidor.
- **Narración:** se usa un solo `#battleMessage`, hijo directo de `#battleStage`, anclado abajo con CSS explícito para host y guest. No aparece otro cuadro generado dentro de los controles.
- **Sprites de personajes:** `sprite-renderer.js` separa las dos mitades del PNG antes de pintarlas en un canvas, detecta los píxeles visibles y usa un escalado proporcional compartido entre las dos vistas. No puede aparecer un trozo del sprite vecino si una vista es más estrecha. Se usa en Online, Entrenamiento y Lab.
- **Medallones de tipos:** vuelve `typeMark()` en el combate y equipo online. El catálogo también carga medallones desde `/api/type-icons/:id` usando la revisión publicada. Si falta el PNG publicado, muestra texto como respaldo, sin hacer públicos borradores.
- **Catálogo:** muestra la mitad frontal del sprite sin estirar las dos vistas.

## Editor

- Mantiene la biblioteca de iconos por tipo, el Lab y el logo del juego.
- Usa el mismo `sprite-renderer.js` que Main.
- Se agregó una prueba de integridad para detectar un AUD, KV, Worker o binding R2 incorrecto.

## Configuración preservada

- Worker Main: `universalduels`.
- Worker Editor: `universal-duels-editor-privado`.
- KV `PUBLIC_CONTENT` / `EDITOR_DRAFTS`: `453d2d63210e42149663b5771e76a803`.
- Bucket R2: `universal-duels-sprites-test`.
- Access AUD: `99bc017b30ecadb6150e289655d2c2fcdf043e1d65c3fa644d7df00f2350e346`.
- `wrangler.toml` y `.github/workflows/deploy.yml`: **sin cambios de contenido respecto al último hotfix**.

## Pruebas

- `npm test` Main: **pasa** (incluye prueba adicional de regresión).
- `npm test` Editor: **pasa** (incluye prueba adicional de integridad de Access/KV).
- Sala simulada: dos clientes envían `select_order` y se resuelven turnos Singles y Doubles; no depende de confirmación adicional.
- Chromium local: al mostrar un spritesheet sintético con dos siluetas de distinta anchura, vista frontal contiene únicamente su color y vista trasera únicamente el suyo. Sin contaminación entre mitades.
- Chromium local: `#battleMessage` aparece abajo con posición absoluta tanto en configuración host como guest.
- Comprobación de sintaxis JavaScript en los scripts HTML y los archivos JS del Main/Editor.

## Lo que aún requiere prueba desplegada

No hay acceso a tus salas reales ni a la configuración activa de Cloudflare desde esta sesión. Estas pruebas **no certifican** que un despliegue específico haya sido aplicado ni que todos los medallones existan en la revisión pública. No se ejecutó `wrangler deploy`, no se publicó un parche y no se alteraron los recursos de KV/R2.

**Al subir los archivos al repositorio, recordá que `deploy.yml` tiene disparador `push` sobre la rama `main`, por lo que puede desplegar automáticamente.**
