# Universal Duels Alpha 0.4 — Renacer y editor condicional

## Correcciones
- «Al sobrevivir» ahora es un evento aceptado por la validación del editor (habilidades y movimientos).
- Renacer en Doubles: se confirma el KO únicamente después de resolver los efectos «Al morir». Una resurrección inmediata no produce un falso KO ni exige sustitución; se actualiza el estado visual del personaje revivido.
- Las acciones «Resucitar» se resuelven antes que otros efectos «Al morir» de la misma habilidad, independientemente del orden de las reglas, para permitir aplicar inmunidad inmediatamente.
- El efecto Sobrevivir no depende de tirada aleatoria ni prioridad, y su configuración se muestra solamente al seleccionarlo como acción.
- Se quitaron de las configuraciones básicas de habilidades los campos de Carga y Sobrevivir. Se conservan sin modificar las configuraciones heredadas ya guardadas, por compatibilidad.
- Racha salió de las configuraciones básicas de movimientos y quedó en una sección propia de efectos opcionales que solo aparece al editar movimientos.
- Los parámetros de Racha, multigolpe, cambio de estadística, inmunidad, modificadores y filtros de entorno/estado se ocultan si el control correspondiente está desactivado.
- Se añadió prueba de regresión para Renacer en Doubles y para la aceptación de «Al sobrevivir».

## Seguridad del despliegue
- Main: Worker `duelo-pixel-rooms`.
- Editor: Worker `universal-duels-test`; binding `EDITOR_DRAFTS` conserva el ID `453d2d63210e42149663b5771e76a803`.
- `deploy.yml` y `wrangler.toml` no se modificaron.
- **No se ha desplegado a Cloudflare**. Un push a la rama `main` ejecutará el workflow habitual.

## Comprobación manual recomendada
1. En el Lab, editar Renacer para dispararse en `Al morir` y configurar la resurrección al 1% más dos turnos de inmunidad.
2. En Doubles, provocar un golpe mortal al Fénix y verificar que sigue en su slot con al menos 1 PS, sin mensaje de reemplazo.
3. Confirmar que puede actuar en la ronda siguiente y que la inmunidad bloquea los golpes.
4. En el Editor, añadir una regla «Al sobrevivir» y guardar sin error.
5. Activar/desactivar opciones dependientes en movimiento, habilidad, campo, clima, escenario y estado.

Las suites completas locales de Main y Editor y los tests adicionales pasaron; no se hizo una prueba end-to-end en Cloudflare.
