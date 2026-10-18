# Universal Duels Alpha 0.4 — Corrección Y/O y duplicación de efectos

## Correcciones
- Se eliminó la transformación forzada de operadores Y/O y de la negación NO al guardar reglas de estados alterados.
- El operador para combinar condiciones se elige **en cada condición adicional**. Se ocultó el control antiguo 'Operador del grupo' porque no intervenía en la evaluación real y confundía.
- El editor ofrece **Duplicar efecto** en cada regla (movimientos, habilidades, efectos y estados) y en cada efecto de entorno (clima, campo y escenario).
- La duplicación lee los valores actuales del formulario, incluidos condiciones adicionales, operadores, negaciones, objetivos y parámetros visibles, y añade la copia justo después de la original, sin guardarla automáticamente.

## Aclaración importante sobre el daño
- Y / O combinan condiciones de una **misma regla**. Si hay tres reglas independientes de daño (5%, 7%, 9%), las tres pueden ejecutarse en el mismo turno. O no significa 'elegir una regla entre varias'.
- Para daño aleatorio entre 5% y 10% en un solo evento, el motor necesitaría una mecánica explícita de rango aleatorio / efecto exclusivo, que NO se añadió en este parche.
- Este parche no modifica las fórmulas de daño ni el motor: corrige el guardado de operadores y agrega controles de duplicación.

## Validación
- npm test Editor: OK.
- node alpha04-or-duplicate-regression.test.mjs: OK.
- Validación de JavaScript de la interfaz: OK.
- Prueba local de navegador: duplicación de regla O y daño 8, duplicación de entorno 7, sin excepciones JS.
- No se realizó despliegue real a Cloudflare.

## Despliegue
- Solo cambiar el repositorio EDITOR. Se mantiene Worker universal-duels-test, binding EDITOR_DRAFTS a 453d2d63210e42149663b5771e76a803 y workflows existentes.
- Subir archivos a la raíz del repositorio, no dentro de una carpeta adicional. El push a main puede activar el deploy automático.
