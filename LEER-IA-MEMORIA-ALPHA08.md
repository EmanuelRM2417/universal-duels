# Universal Duels Alpha 0.8 — IA: catálogo íntegro y memoria privada de correcciones

## Qué cambia

- La generación ya no recorta a 24 personajes, 60 movimientos o 40 habilidades.
- Se consultan **todas las categorías del catálogo** y todas sus páginas de KV: personajes, movimientos, habilidades, efectos, estados, campos, climas, escenarios, etiquetas y tutorial.
- También se mezclan los datos de la versión pública vigente con los borradores privados: el borrador tiene prioridad en caso de ID repetido. Se proporciona la tabla de tipos guardada o la predeterminada.
- Los ítems y definiciones completos se envían directamente al modelo cuando caben en una solicitud. Si el tamaño es mayor, se procesan **todos** los fragmentos, sin muestreos silenciosos, y se incluyen todos los IDs en el índice de la generación final. Esto puede aumentar tiempo y costo y no garantiza que la IA recuerde cada detalle.
- El acceso al catálogo utiliza lectura múltiple de hasta 100 claves por solicitud de Cloudflare KV.
- Cada generación guarda una copia privada del resultado original, pero **no** lo aprueba para entrenamiento automáticamente.
- «Memoria de diseño de IA» permite revisar diferencias entre la propuesta original y las versiones actuales de entidad, movimiento único y habilidad única. Los comentarios del propietario también se guardan.
- Al presionar «Aprobar como ejemplo», las correcciones pasan a formar parte del contexto de las futuras generaciones. «Eliminar memoria» borra los datos de aprendizaje, **no** los personajes ni el contenido del catálogo.

## Cómo utilizarlo

1. Desplegar **solo Editor** desde este ZIP con el procedimiento manual habitual.
2. Conservar el secreto existente `UD_AI_API_KEY` del Worker Editor. No incluirlo en el repositorio.
3. Abrir **Editor → Crear personaje con IA**; proporcionar nombre, sprite e indicaciones y elegir «Generar borrador».
4. Revisar el JSON y guardar movimiento, habilidad y personaje como borradores privados.
5. Balancear desde Catálogo si hace falta.
6. Regresar a la sección **Memoria de diseño de IA → Actualizar historial**, abrir el personaje, revisar sus diferencias y presionar **Aprobar como ejemplo**. Puede añadirse una explicación opcional de las decisiones.
7. La próxima generación utilizará los ejemplos aprobados. Se puede volver a aprobar un personaje tras nuevos ajustes o eliminar su historial.

## Seguridad y límites

- Requiere Cloudflare Access; los cambios de memoria también exigen origen del Editor.
- Nunca publica automáticamente ni toca Main, los workflows, `wrangler.toml`, variables, secretos, R2 o reglas de combate.
- Las entradas completas de catálogo, sus borradores, las correcciones aprobadas y el sprite proporcionado se envían al proveedor externo OpenAI cuando generás un personaje. Revisá si querés compartir esos datos antes de utilizar la función.
- Es **aprendizaje por ejemplos y contexto**, no fine-tuning ni modificación permanente de los pesos del modelo.
- A medida que aumenta el catálogo, aumenta el costo de tokens/solicitudes. La ejecución real de OpenAI no está validada aquí: la prueba utiliza respuestas simuladas.
- Cloudflare KV es eventualmente consistente; un borrador guardado podría tardar brevemente en ser visible para la aprobación.
- La interfaz se inspeccionó en Chromium con HTML estático; la navegación con un servidor local estuvo restringida en este entorno. Requiere comprobación final en el Editor desplegado.
