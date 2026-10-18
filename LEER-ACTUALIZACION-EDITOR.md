# Editor Alpha 0.4: corrección de la interfaz que no se actualiza

La raíz `/` dirige a `/editor/` (editor visual nuevo). El laboratorio antiguo no fue eliminado: está en `/lab/`.

Identificador de esta entrega: `UD-EDITOR-ALPHA04-ETIQUETAS-20261017`.
Se muestra debajo de la navegación lateral del editor. El API protegido `/editor-api/status` devuelve también `editorBuild` con ese identificador.

## Para actualizar el repositorio del editor

Extraé el ZIP y colocá su **contenido directamente en la raíz del repositorio**. En GitHub deberían existir estas rutas:

- `.github/workflows/deploy.yml`
- `wrangler.toml`
- `worker.js`
- `public/index.html`
- `public/editor/index.html`
- `public/lab/index.html`

No debe quedar una carpeta adicional `universal-duels-editor-privado/` conteniendo esos archivos dentro de la raíz del repositorio.

## Comprobar qué Worker estás visitando

Este ZIP mantiene intactos `wrangler.toml` y `.github/workflows/deploy.yml`.
El `name` actual de `wrangler.toml` es `universal-duels-editor-privado`, mientras que paquetes mucho más antiguos tenían `duelo-pixel-rooms`. El workflow publica al nombre de Worker especificado en el `wrangler.toml` del repositorio: si visitás el nombre viejo o un dominio enlazado a ese Worker anterior, NO verás las actualizaciones.

No se cambia automáticamente el nombre del Worker porque el principal usa `duelo-pixel-rooms` y restaurar ese nombre al editor podría sobrescribir el juego. Verificá en GitHub Actions que el workflow completó y cuál Worker se desplegó antes de tocar un mapeo de dominio.

## Riesgo de despliegue

El workflow original `deploy.yml` publica cuando hacés push a `main` y también permite ejecución manual. NO subás este código hasta que quieras ejecutarlo en Cloudflare.

Nada se ha subido por esta entrega a GitHub ni Cloudflare. No se han creado KV/R2 ni workflows nuevos.
