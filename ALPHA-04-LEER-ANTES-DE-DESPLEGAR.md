# Universal Duels Alpha 0.4 — candidata local de validación

**No es una autorización de despliegue. No se ha modificado la cuenta ni los recursos de Cloudflare.**

## Qué contiene

- `universal-duels-main`: Worker público, motor de combate, Singles/Doubles, práctica contra IA, catálogo, cliente, tests, rutas HTTP y WebSocket.
- `universal-duels-editor-privado`: editor, Lab, regresión determinista, preview y publicación manual de parches, comparación de versiones, historial, rollback, recursos visuales y tests.

## Trabajo completado en esta revisión

- Se conectó el editor al *mismo namespace de contenido público* que lee el juego, sin modificarlo actualmente; los borradores permanecen en KV privado.
- Se declararon bindings R2 en el editor y se corrigió una peligrosa colisión de nombres: **editor y Worker público ya tienen nombres diferentes** en los archivos de configuración.
- Previsualización y selección de cambios; validación de referencias, regresiones guardadas y confirmación manual. Snapshot preparado antes de modificar `public-v1:current`; rollback manual desde historial.
- Manifiestos versionados de sprites/iconos/escenarios/climas con reutilización de objetos idénticos para evitar copias R2. Las imágenes de partidas antiguas mantienen sus rutas.
- Motor compartido: estadísticas básicas +10% / −5% por nivel; precisión, evasión y crítico +/−5% relativo a su base, supresión de habilidades, multigolpe/Carga/Sobrevivir/Al morir/resurrección; checkpoints incrementales para reducir la reconstrucción completa de rondas.
- Práctica simplificada: sin semillas ni sesiones visibles, una partida pendiente que se puede reanudar desde el mismo navegador y nuevas partidas después de terminar, Singles/Doubles, IA y cambios voluntarios.
- Errores de arranque del editor corregidos tras pruebas de Chromium aislado: selectores de movimientos y función obsoleta; Práctica superó recorrido visual simulado de principio a fin.
- Catálogo navegable, campos de configuración de mecánicas Alpha 0.4 en el editor y comparación de regresiones con versión publicada.
- Pruebas de API HTTP con almacenamiento simulado, seguridad de creación de salas, consumo de assets y regresiones de motor.
- GitHub Actions de despliegue cambiados a **manuales**. CI de validación en push/PR ejecuta tests y la compilación de Wrangler en modo `--dry-run`, sin desplegar.

## Comprobación local

Dentro de **cada** carpeta:

```sh
npm install
npm test
node --check worker.js
npx wrangler deploy --dry-run --outdir ./dist-alpha04
```

`--dry-run` no debe modificar Cloudflare. Es imprescindible ejecutarlo antes de evaluar una publicación. En este entorno se ejecutaron las pruebas locales y sintaxis, pero **no la compilación con Wrangler**: npm no permite acceder al registro (`EAI_AGAIN`). Tampoco fue posible completar pruebas visuales con navegador por bloqueo del entorno.

## Precauciones de Cloudflare

- **No ejecutar `wrangler deploy`, ni el workflow manual de despliegue, ahora.**
- Los ficheros `wrangler.test.toml` tienen identificadores/buckets de ensayo a configurar deliberadamente; no deben apuntar a KV ni a R2 públicos.
- Comprobar el nombre real de Worker/Access de editor-privado antes de cualquier despliegue. El nombre separado en esta candidata puede requerir enlazar el dominio y las políticas de Access adecuados, sin desproteger el editor.
- Las ID de namespaces de producción del `wrangler.toml` se conservaron según los ZIP proporcionados; verificar manualmente que corresponden a los recursos correctos antes de desplegar.
- Cloudflare KV es *eventualmente consistente*: mover el puntero al final minimiza cambios a medias, **pero no equivale a una transacción ACID**. Ejecutar prueba de publicación/rollback en un entorno aislado antes del uso público.
- Una actualización del Worker puede reemplazar el código de motor de combates ya activos; programar el cambio sin partidas en curso o conservar versiones anteriores del motor para garantizar compatibilidad.
- El sistema de abuso usa límites técnicos razonables por red, no el antiguo límite de tres partidas. La experiencia muestra una sola partida pendiente, sin semilla ni sesión.

## Condiciones para llamarla Alpha 0.4 oficial

1. `npm test` y compilación *Wrangler dry-run* satisfactorios **en ambos proyectos**.
2. Tests Singles/Doubles y mecánicas encadenadas satisfactorios; pruebas reales de reconexión, sustitución, Práctica, editor y rollback en infraestructura **aislada**.
3. Revisión de latencia/costos de Workers, Durable Objects, KV y R2 dentro de los límites gratuitos.
4. Confirmación **explícita** del propietario antes de publicación. Esta entrega no realiza ninguno de esos despliegues.
