# Universal Duels — Alpha 0.5 consolidada

Entrega de código, **sin despliegue ni publicación de contenido**. Se han unificado los archivos aportados de Alpha 0.4 auditada y Alpha 0.5, con pruebas automatizadas realizadas localmente.

## Restauraciones y correcciones
- Motor de combate auditado de Alpha 0.4 con compatibilidad de Alpha 0.5; ambos paquetes contienen el mismo `battle-engine.js`.
- Carga, rachas por uso/golpe, condiciones pasivas, multiplicidad de golpes/cadenas, modificadores finales y registro de eventos/estados.
- Editor avanzado: condiciones, operadores, duplicación, objetivos, cadenas, rachas, campos de efectos y configuraciones opcionales de Carga/Sobrevivir.
- Interpolación del texto de espera de acciones corregida en la caja de combate.
- Entrenamiento recuperado con interfaz completa de batalla de Alpha 0.4 (sprites, HP, objetivos Doubles, efectos, narración y controles), integrado con audio de Alpha 0.5.
- Tutorial público recuperado y editable mediante el parche manual del Editor. Se han incorporado las categorías `tutorial` y `tags` a las operaciones de publicación.
- Audio con música y efectos de volumen independiente, botón compacto y posición recordada de la música del lobby. Escenarios con soundtrack configurable.
- Restricción de interfaz vertical en pantallas pequeñas (Main y Entrenamiento); en vertical se solicita girar el teléfono.
- Corrección del vencimiento de turno: una selección válida previamente reconocida por el servidor no se pierde solo por faltar la confirmación final.
- Eliminada la vista antigua de prototipo de la raíz del Worker Editor: ahora redirige a `/editor/`.
- En el Main, `wrangler.toml` mantiene el nombre del Worker actual `universalduels`. Recursos existentes de Durable Objects, KV, R2 y Access preservados.

## Pruebas realizadas
- `npm test` Main: **29 comprobaciones/archivos de prueba**, finalizado sin errores.
- `npm test` Editor: **46 comprobaciones/archivos de prueba**, finalizado sin errores.
- Pruebas añadidas para condiciones y disparadores pasivos, duplicación, validación, salas Singles/Doubles, selección reconocida antes de un timeout, visuales de entornos, Tutorial, audio y compatibilidad de publicación.
- Análisis sintáctico de scripts incrustados en páginas HTML y JS del motor/Workers, sin errores.
- Integridad: ambos paquetes utilizan una copia byte a byte idéntica del motor.

## Límites de la verificación y decisiones deliberadas
- **No se ha ejecutado una partida real en Cloudflare ni un test integral en navegadores Android, ni validado el audio mediante archivos publicados en R2.** Por tanto, los resultados no equivalen a garantizar ausencia de bugs en producción.
- **Los workflows `.github/workflows/*.yml` están idénticos a los ZIP de Alpha 0.5 recibidos.** Esos ZIP incluyen un `deploy.yml` con confirmación manual histórica `PUBLICAR_ALPHA04` y otros workflows de prueba/validación. Esto difiere del `deploy.yml` tradicional descrito en el contexto del usuario. No se corrigió porque está prohibido modificar workflows sin autorización expresa; revisar antes de desplegar.
- La imagen/logo oficial de Universal Duels no está suministrada como archivo de imagen en los cuatro ZIP fuente. No se ha inventado ni incorporado un sustituto.
- Se excluyeron del paquete ciertos tests adicionales de Alpha 0.4 que no formaban parte de los ZIP Alpha 0.5 y asumían comportamientos incompatibles o una estructura ya reemplazada (p. ej., PS máximos 1000 en vez de 500, rutas históricas del Editor, expectativas incompatibles de resurrección y workflow anterior). Las pruebas de ambas suites consolidadas pasan, pero esos desacuerdos no se ocultan como compatibilidad total.
- El código del Editor y sus borradores no publica directamente: el contenido llega al público exclusivamente mediante `Cargar parche` y su flujo de confirmación.

## Cómo probar sin publicar
1. Extraer cada ZIP en un repositorio/carpeta separado.
2. Ejecutar `npm install` y después `npm test` en Main y Editor.
3. Revisar `wrangler.toml`, `wrangler.test.toml` y los workflows con los identificadores reales de Cloudflare antes de cualquier despliegue.
4. Abrir `/` en Main y `/editor/` en Editor para probar la interfaz con el contenido publicado o los borradores existentes.

**Atención:** un push al repositorio o un despliegue manual puede afectar al juego en línea. Esta entrega no ha modificado ningún servicio en Cloudflare.
