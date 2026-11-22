# Universal Duels — Editor privado (Alpha 0.9)

Editor de catálogo, objetos, habilidades, movimientos, condiciones, narrador, sprites, laboratorio, monitoreo, recursos y publicación manual de parches. El Editor es independiente del Main. **Guardar un borrador no modifica el juego público**.

## Desarrollo y validación

- Ejecutar `npm install` y `npm test`.
- Verificar sintaxis: `node --check worker.js` y `node --check battle-engine.js`.
- Verificar el bundle sin desplegar: `npx wrangler deploy --dry-run --outdir ./dist-check` (con Wrangler disponible); eliminar `dist-check` antes de comprimir.
- Comprobar en un entorno privado el acceso, guardado de objetos y de su sprite PNG cuadrado, selección de momentos, reglas de efectos, publicación/rollback y laboratorio Singles/Doubles.

## Seguridad e infraestructura

- Conservar íntegros `.github/workflows/deploy.yml`, `wrangler.toml` y `wrangler.test.toml`. El workflow existente también se dispara en `push` a `main`, además de `workflow_dispatch`.
- El Worker del Editor requiere Cloudflare Access, `EDITOR_DRAFTS`, `PUBLIC_CONTENT`, `EDITOR_SPRITES`, `MAIN_MONITOR`, `ROOMS` y `UD_MONITOR_SECRET` en los lugares definidos por Wrangler. No cambiar nombres o identificadores por simplificar archivos.
- `keep_vars = true` conserva las variables de texto establecidas en Dashboard. `[secrets] required = ["UD_MONITOR_SECRET"]` requiere que el secreto ya exista; no restaura valores si se eliminaron.
- `UD_MONITOR_SECRET` debe coincidir entre Main y Editor. `GOOGLE_CLIENT_ID` se configura únicamente en Main. No incluir claves de IA (`UD_AI_API_KEY`), secretos ni tokens en el repositorio.
- La publicación y el rollback del catálogo se realizan exclusivamente mediante el flujo privado de aprobación. No publicar automáticamente al guardar.

## IA y memoria privada

- La función de generación usa el catálogo completo (borradores privados prevalecen sobre la versión publicada) y ejemplos aprobados para la memoria de diseño; no realiza fine-tuning de modelos.
- Las correcciones se guardan como historial privado y solo se incorporan como ejemplos futuros cuando se elige «Aprobar como ejemplo». «Eliminar memoria» no elimina personajes ni catálogo.
- El proveedor de IA recibe el contenido enviado al generar, incluidos los datos del catálogo y los sprites adjuntos; revisar privacidad y costos antes de usar la función. La integración externa requiere prueba real en Cloudflare.

## Componentes conservados

`worker.js`, `battle-engine.js`, `catalog-validation.js`, `ai-*.js`, `release-*.js`, `public/`, `build-narrator-templates.cjs`, `run-regression-tests.mjs`, `*.test.mjs` y los manifiestos de Wrangler y GitHub. Las pruebas se mantienen para futuras iteraciones, aunque no son assets públicos de Wrangler.

Se retiraron documentos redundantes de Alpha 0.8 y se unificaron aquí las indicaciones vigentes, sin modificar componentes de ejecución.
