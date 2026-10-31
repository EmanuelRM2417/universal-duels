# Universal Duels Alpha 0.7 — Activar cuentas Google y tutorial

## 1. Crear Client ID de Google (lo realiza el propietario)

1. Abrir https://console.cloud.google.com/ y seleccionar/crear proyecto.
2. En **Google Auth Platform** configurar **Branding** (nombre del juego, correo de asistencia, dominio autorizado `universalduels.com` y vínculos públicos requeridos, incluida política de privacidad), **Audience** (usuarios externos; si figura «Testing», autorizar usuarios de prueba hasta publicar) y **Clients**.
3. Crear un **OAuth Client ID** de tipo **Web application**.
4. En **Authorized JavaScript origins** agregar `https://universalduels.com`. Agregar `https://www.universalduels.com` únicamente si los jugadores usan esa URL directamente; y otros orígenes HTTPS únicamente si se usa realmente otra dirección pública de Main. No se requiere URL de redireccionamiento en el flujo actual: Google Identity Services entrega una credencial mediante la devolución de llamada de JavaScript.
5. Copiar **Client ID**, con formato `...apps.googleusercontent.com`. NO copiar ni compartir el Client Secret; este flujo no lo utiliza.

Documentación: https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid

## 2. Configurar Main en Cloudflare

1. Abrir **Cloudflare → Workers & Pages → Worker de MAIN → Settings → Variables and Secrets → Add**.
2. Agregar `GOOGLE_CLIENT_ID` (tipo Text) con el Client ID del paso anterior. Guardar/aplicar la configuración. NO se configura en el Editor privado.
3. Desplegar el ZIP actualizado de Main mediante el mismo workflow/manual que ya utiliza el proyecto. Cualquier cambio de variables desde el panel puede crear una nueva versión; confirmar cuál quedó publicado.
4. Abrir `https://universalduels.com/api/auth/config`. Debe indicar `"configured":true`. No contiene ningún secreto.
5. Probar Google en una ventana privada: primer acceso → tutorial interactivo; completar → sesión iniciada; recargar → NO repetir tutorial. Cerrar sesión y entrar de nuevo con la misma cuenta → no repetir. Como invitado, abrir nueva visita → tutorial obligatorio cada vez.

Documentación: https://developers.cloudflare.com/workers/configuration/environment-variables/

## 3. Características y limitaciones de esta Alpha

- Login Google: credencial verificada en el Worker con firma de Google, emisor, audiencia y caducidad. No se utiliza contraseña de Google ni se guarda el JWT en el navegador. Sesión mediante cookie HttpOnly/Secure/SameSite=Lax; duración 30 días y botón Cerrar sesión.
- **La autenticación aún no sustituye la identidad anónima de las salas online** ni sincroniza equipos, ranking o monedas entre dispositivos. La cuenta habilita el acceso y recuerda la finalización del tutorial. Se necesitará una migración de identidad y datos antes de añadir economía o progresión vinculadas a la cuenta.
- Cuentas y sesiones se almacenan temporalmente en el KV existente `PUBLIC_CONTENT` usando prefijo aislado `auth-v1:` sin modificar `wrangler.toml`. Esto es una solución Alpha: KV tiene consistencia eventual entre regiones; antes del lanzamiento masivo se recomienda almacenamiento transaccional dedicado (por ejemplo D1) y política de privacidad/cookies revisada.
- Invitados: el flujo de entrada de la interfaz exige el tutorial en cada visita; no es un bloqueo de todas las APIs ni un sistema de antifraude. El tutorial guiado termina cuando termina la práctica y se pulsa **Finalizar tutorial**. La práctica permite aprender aunque se pierda.
- Google real NO puede probarse sin crear el OAuth Client ID y configurarlo en Cloudflare. Se incluyeron tests de JWT con claves de prueba y de sesión, y pruebas de interfaz simulada.
- **AdSense**: el `index.html` del paquete conserva el identificador `ca-pub-5741352742672431` correctamente FUERA de `<style>`.

## 4. Editor: rachas y narrador

- Seleccionar la nueva condición **Racha (mínimo/máximo)** y configurar contador de golpes acertados/usos/golpes de cadena y mínimo/máximo; dejar máximo vacío para no limitar.
- Seleccionar independientemente el efecto existente **Modificar potencia del movimiento**; configurar valor base, aumento/disminución por nivel de racha (`perStack`) y por ronda transcurrida (`perRound`), tope y modo. Se conservan las rachas antiguas, que siguen funcionando.
- Nuevos efectos de daño recibido: **Recuperar PS según daño recibido (%)** y **Recibir daño según daño recibido (%)**. Configurar como los efectos equivalentes por daño infligido. Para disparar tras recibir daño, usar el evento correspondiente.
- En **Narrador**, agregar patrones originales y reemplazos, por ejemplo original `[PERSONAJE] recibe [EFECTO].` → reemplazo `[PERSONAJE] ahora tiene [EFECTO].` Los patrones aplican a narrador y Battle log si el texto coincide exactamente. Se admiten variables entre corchetes de letras mayúsculas: `[PERSONAJE]`, `[EFECTO]`, `[CLIMA]` y cualquier nombre similar. Las reglas se guardan en el BORRADOR privado; solo pasan al público mediante la acción **Cargar parche**, como antes.
- Los mensajes no coincidentes no se modifican. Las reglas son patrones de texto, NO expresiones regulares. El sistema permite personalizar las frases visibles, no cambia la lógica de los eventos ni agrega nuevos mensajes inexistentes.

## 5. Recomendaciones de despliegue seguro

- Conservar los workflows y bindings actuales; **no se ha realizado ningún despliegue**.
- Publicar primero los cambios del Editor, configurar los mensajes/rachas, publicar el catálogo manualmente y luego actualizar Main para compatibilidad de condiciones/acciones.
- Antes de producción, probar específicamente: racha con mínimo y máximo; incremento negativo y positivo; daño recibido si hay golpe y si falla; narrador y Battle log con plantilla; tutorial de invitado y Google; sesión expirada; entrenamientos Singles y Doubles; reconexión de sala.

## 6. Estadísticas de cuenta incorporadas en este parche

- Cada cuenta Google recibe un **ID público** persistente de ocho caracteres (`4 letras minúsculas + 4 números`, entremezclados). El nick se guarda en el perfil asociado a ese ID.
- Nuevo botón **Estadísticas** en Main. Se muestran totales y desgloses por **casuales (Entrenamiento)**, **salas**, **Singles**, **Doubles** y cruces; cada categoría muestra jugadas, ganadas, perdidas, winrate, daño infligido y recibido y personajes derrotados. Rendición equivale a derrota.
- Las estadísticas se generan en el servidor al terminar combates; no se acepta una petición del cliente para alterar contadores. Cada resultado lleva una clave de deduplicación para evitar incrementos repetidos al reintentarlo.
- Los invitados pueden jugar pero no guardan estas estadísticas. Las cuentas anteriores al parche reciben ID al volver a iniciar sesión Google.
- **Precaución de escala:** esta Alpha usa KV para persistir cuentas y contadores. KV no garantiza transacciones entre escrituras simultáneas ni lectura inmediata global; antes de un gran lanzamiento trasladar estas estadísticas a D1/almacenamiento transaccional o un Durable Object por cuenta. No se añadieron nuevos bindings.
- Si aparece “Google pendiente de configurar” aunque pusiste la variable, comprobar `https://universalduels.com/api/auth/config`. `configured:false` significa que la instancia de Worker que responde al dominio público **no está recibiendo** `GOOGLE_CLIENT_ID`. Verificar nombre exacto, entorno Production y ruta de dominio; aplicar el despliegue. `configured:true` con botón ausente requiere revisar origen autorizado en Google Cloud y bloqueo del script `accounts.google.com/gsi/client`.

## 7. Migración de Carga, Sobrevivir e inmunidad

- El Editor ya no muestra bloques independientes **Configurar Carga** / **Configurar Sobrevivir**. Al abrir una habilidad antigua, sus parámetros se convierten en reglas generales editables; la migración se guarda al guardar esa habilidad. No duplica reglas al volver a abrirla.
- **Carga**: condición **Racha**, con contador y mínimo/máximo, efecto elegido aparte y modo **Normal** o **Por turno**. Las mejoras pasivas se recalculan y desaparecen al perder la condición. Los efectos instantáneos (daño o curación ya realizados) no pueden revertirse físicamente; no deben utilizarse para acumular una bonificación persistente.
- **Sobrevivir**: siempre deja **exactamente 1 PS** con actualización visual en ese instante. El Editor conserva probabilidad, límite, reinicio por entrada/batalla, prioridad y fuentes de daño desde las configuraciones antiguas, ahora dentro de la regla.
- **Inmunidad a efectos**: nueva acción `effect_immunity` que impide aplicar efectos nuevos mientras permanece activa, a diferencia de `remove_effect` que elimina efectos ya presentes. No sustituye inmunidad a daño ni elimina estados existentes.
- Para contenido antiguo, el motor conserva lectura de las definiciones heredadas hasta que se editen y publiquen.
