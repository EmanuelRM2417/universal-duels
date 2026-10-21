# Universal Duels — Integración Alpha 0.5 (20 de octubre de 2026)

## Origen y alcance

Paquetes originales del usuario: `universal-duels-main (4).zip` y `universal-duels-editor-privado (3).zip`. Se conservaron los repositorios separados, las vinculaciones de Cloudflare, el almacenamiento y los `deploy.yml` originales sin ninguna ejecución remota.

## Cambios realizados

- **Combates online**: el servidor confirma la orden completa al recibir `select_order`, en vez de esperar indefinidamente un paquete `order` adicional. Se mantiene un límite de **60 segundos por selección de turno** y **30 segundos por sustitución**, basado en los plazos del Durable Object; cronómetro visible arriba a la izquierda. Se actualizan los plazos en cada fase. Las velocidades de reproducción dejan de ofrecerse en salas online.
- **Interfaz de combate**: caja blanca de narración abajo; animaciones de acción física, especial y de estado, entrada/salida y flechas por cambios de estadísticas; sonidos de acciones y cambios de estadísticas con supresión de repeticiones simultáneas. Se implementan en Main, Entrenamiento y Lab conservando sus modos de uso. Los cambios de estadística comprenden fuentes de movimiento, habilidad, estado, clima/campo y bonificaciones pasivas.
- **Nombres de estadísticas**: PS, Ataque, Ataque especial, Defensa, Defensa especial, Velocidad, Prob. de crítico, Evasión y Precisión en la presentación del combate.
- **Entrenamiento**: narración abajo, velocidades de animación aplicadas realmente a las esperas, nueva partida reemplaza la sesión pendiente del navegador, música única con el Main cuando está embebido.
- **Lab**: velocidades aplicadas al tiempo de animación, efectos audiovisuales y presentación actualizada; los datos del motor permanecen compartidos con Main.
- **Catálogo**: campos/escenarios/climas/estados/habilidades/efectos enseñan únicamente la descripción escrita por el autor; los movimientos añaden datos pero no reglas. Búsqueda de nombre o `#etiqueta`, enlaces de etiquetas bajo habilidad global, hasta tres filtros de tipo, orden por nombre o estadísticas en ambos sentidos. Gráficas de barras verticales de color rojo (0) a verde (máximo), PS a 1000 y las demás a 200. Se muestra ampliada solo la mitad frontal de cada sprite compuesto.
- **Vida**: barra dinámica roja→verde según porcentaje de PS en Main, Lab y Entrenamiento.
- **Tipos**: se utiliza el recurso `/api/type-icons/<tipo>` con texto de respaldo si aún no existe PNG publicado. El Editor conserva la configuración independiente de medallones por tipo.
- **Música**: Editor añade listas independientes y ampliables de pistas MP3 de lobby y batalla, subida a R2 privado y publicación manual en snapshot. La API del Main ahora incluye `audioPlaylists`; un director único reproduce pistas aleatorias excluyendo las dos anteriores cuando hay al menos tres. No se crean reproductores independientes dentro de páginas embebidas. La canción de lobby conserva pista y posición al entrar y salir de combate. Audio de escenario y efectos siguen disponibles.
- **Navegación**: Catálogo y Entrenamiento dentro del documento principal usando un panel con iframe, sin abrir pestaña y sin cambiar la URL del navegador principal; Tutorial abre dentro del Main y un tutorial abierto en un iframe tampoco crea un reproductor duplicado.
- **Cloudflare Editor**: se conserva el namespace KV original `453d2d63210e42149663b5771e76a803` y el AUD verificado de Cloudflare Access, evitando la regresión de autorización previa. La publicación sigue siendo exclusivamente manual con «Cargar parche».
- **Narración multigolpe**: se oculta el encabezado separado “Golpe x/y” en la presentación y se anota el número de golpe en los eventos de daño, sin modificar el cálculo real de multigolpe en el motor.

## Comprobaciones efectuadas

- `npm test` en Main: **finalizó con código 0**.
- `npm test` en Editor: **finalizó con código 0**.
- `node alpha05-publish-playlist.test.mjs`: **finalizó con código 0**. Verifica publicación pública de listas en revisión actual y snapshot, además de comprobaciones de integración de navegación, etiquetas, estadísticas y sesiones.
- Scripts embebidos en todas las páginas HTML principales: **sintaxis correcta**.
- `battle-engine.js` de Main y Editor: **idénticos**.
- `.github/workflows/deploy.yml`: **idénticos a los de los ZIP recibidos**.
- No se realizaron cambios de repositorios remotos, despliegues, modificaciones de datos o publicación de parches.

## Límites de esta validación

- **No se ha probado contra tu Cloudflare real** ni se ha iniciado una sala pública entre dos navegadores reales.
- Se intentó iniciar una prueba automatizada en Chromium, pero el entorno de ejecución bloqueó las navegaciones de Chromium, por lo que **no es correcto afirmar que todas las animaciones y elementos estén comprobados visualmente**.
- **Android/Chrome controlan la notificación multimedia y las restricciones de autoplay**; la web no puede garantizar que desaparezca la notificación del sistema ni reproducir sonido antes de cualquier interacción si el navegador lo prohíbe. Se intenta iniciar al cargar y continuar en la primera interacción disponible.
- La regla de dos canciones distintas antes de repetir requiere al menos **tres pistas** en la lista; con una o dos es matemáticamente imposible cumplirla a la vez que se reproduce sin parar.
- Los medallones aparecerán cuando sus archivos PNG se suban al Editor y se publiquen. Hasta entonces se muestra texto para no ocultar el tipo.
- No se desplegaron archivos y **no debe pulsarse «Cargar parche» antes de comprobar en el Editor que el contenido, sonidos, borradores y tipos están correctos**.

## Instalación

1. `universal-duels-alpha05-main-integrada.zip` corresponde **solo** al repositorio Main (`universalduels`).
2. `universal-duels-alpha05-editor-integrada.zip` corresponde **solo** al repositorio Editor (`universal-duels-editor-privado`).
3. Antes de hacer commit o push, confirmar el repositorio de destino; ambos proyectos conservan workflows que podrían iniciar despliegues automáticamente.
4. Después del despliegue, comprobar los turnos online en dos sesiones, los reemplazos tras KO, Lab, Entrenamiento, audio y carga del catálogo. Solo después utilizar publicación manual de contenido.
