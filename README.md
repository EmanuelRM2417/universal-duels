# Universal Duels — Main (Alpha 0.9)

Proyecto público. Contiene el Worker, motor de combate, partidas Singles/Doubles, Entrenamiento, catálogo, tutorial y recursos web. Esta distribución conserva el código y las pruebas de regresión de la última Alpha 0.9.

## Desarrollo y validación local

- Requisitos: Node.js y acceso a las dependencias npm.
- Instalar dependencias: `npm install`.
- Ejecutar pruebas de regresión: `npm test`.
- Comprobar sintaxis: `node --check worker.js` y `node --check battle-engine.js`.
- Comprobar bundle sin desplegar: `npx wrangler deploy --dry-run --outdir ./dist-check` (requiere Wrangler instalado). El directorio `dist-check` debe eliminarse antes de empaquetar.
- Validar manualmente en entorno privado: Salas, Entrenamiento, Singles/Doubles, selección de 3 objetos, bloqueo del mismo objeto en Doubles, objetivos por posición, cambios de posición, bloqueo/consumo de objetos, mensajes y sprites, reconexión y finalización de combate.

## Publicación y entorno

- `wrangler.toml` define el Worker `universalduels`, R2 `PUBLIC_SPRITES`, KV `PUBLIC_CONTENT`, Durable Object `ROOMS` y Assets `public/`; **no cambiar identificadores ni bindings al limpiar archivos**.
- `keep_vars = true` conserva variables de texto configuradas en Dashboard; `[secrets] required = ["UD_MONITOR_SECRET"]` exige la presencia del secreto previamente configurado. La declaración no recupera secretos borrados.
- `GOOGLE_CLIENT_ID` es un Client ID público de Google Identity Services (termina en `.apps.googleusercontent.com`), se configura en el Worker Main. No agregar secretos, tokens ni claves privadas a archivos del repositorio.
- Verificar la autenticación en `/api/auth/config` (`configured:true`), acceso Google/invitado, tutorial, estadísticas, sesión y recarga.
- El Workflow `.github/workflows/deploy.yml` existente se ejecuta **también en push a la rama `main`** (además de `workflow_dispatch`). Subir cambios a esa rama puede desplegar automáticamente: revisar el workflow antes de realizar pushes. **Esta entrega no ejecuta despliegues.**
- La publicación del catálogo es un paso manual independiente gestionado desde el Editor; guardar borradores no los publica.
- El Editor debe seguir protegido por Cloudflare Access. El vínculo `MAIN_MONITOR` y `UD_MONITOR_SECRET` deben configurarse coherentemente entre ambos Workers.

## Archivos mantenidos

`worker.js`, `battle-engine.js`, `auth.js`, `monitoring.js`, `practice-ai.js`, `practice-session.js`, `stat-math.js`, `public/`, `.github/workflows/`, `wrangler.toml`, `wrangler.test.toml`, `package.json`, `run-regression-tests.mjs` y `*.test.mjs` permanecen disponibles. Los tests no forman parte de los assets publicados por Wrangler, pero se conservan para evitar regresiones futuras.

Los documentos antiguos de Alpha 0.1–0.8 se retiraron del paquete porque eran históricos y algunos describían nombres de Workers o procedimientos ya obsoletos. Consultar los ZIP anteriores para ese historial.
