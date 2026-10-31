# Universal Duels · Editor privado Alpha 0.7

Este paquete conserva solamente el código ejecutable, recursos realmente enlazados,
configuración de Cloudflare y pruebas de regresión. Los informes de versiones
anteriores, archivos de marcador y la página raíz huérfana se eliminaron.

- `public/editor/`: edición de catálogo, habilidades, rachas, efectos y publicación manual.
- `public/lab/`: laboratorio privado de combate.
- `public/ui-studio.html`: estudio visual enlazado desde el editor.
- `worker.js`, `battle-engine.js`, `catalog-validation.js`, `release-control.js`, `release-assets.js`, `stat-math.js`: servidor, validación y motor.
- `.github/workflows/deploy.yml`, `wrangler.toml`, `wrangler.test.toml`: intactos.
- `*.test.mjs` y `run-regression-tests.mjs`: pruebas completas con `npm test`.

**Importante:** guardar contenido no lo publica; la publicación del catálogo
requiere la acción manual del editor. No se alteraron bindings de KV/R2,
Access ni el workflow. La variable `GOOGLE_CLIENT_ID` se configura
exclusivamente en el Worker Main, no aquí.

**Antes de publicar:** ejecutar `npm test`, ejecutar el despliegue manual de
Editor y Main en los repositorios correspondientes, probar Access y simular
una partida Singles/Doubles, y usar "Cargar parche al público" solo cuando
se haya verificado que la versión publicada debe cambiar.

Los efectos de una racha que sean reversibles se retiran cuando deja de
cumplirse la condición. El daño y la recuperación de PS instantáneos ya
realizados no se revierten retroactivamente. Sobrevivir siempre deja 1 PS.
