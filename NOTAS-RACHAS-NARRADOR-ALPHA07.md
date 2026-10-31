# Editor Alpha 0.7 — Rachas y narrador

- Nueva condición `streak_count`: elegir contador, mínimo y máximo (máximo vacío = sin límite). Se evalúa por la misma cadena de reglas ya existente.
- Los efectos de movimiento mantienen `modify_move_power` y sus configuraciones anteriores; ahora admiten aumentos/disminuciones por nivel de racha y por ronda.
- Nuevos efectos `heal_from_received_damage` y `damage_from_received_damage` con porcentaje sobre daño recibido recientemente.
- Apartado **Narrador**: cambiar los textos visibles mediante patrón de origen + reemplazo con variables en corchetes; textos no coincidentes permanecen intactos. La configuración se guarda privada en el Editor y llega a Main únicamente con **Cargar parche**.
- Se conserva la configuración del Estudio visual, las reglas existentes, KV, R2, Access, `wrangler.toml` y `deploy.yml`.
- Requiere la versión correspondiente de Main para que nuevas condiciones, efectos y plantillas funcionen en batallas.
- No hay despliegue automático hecho por este paquete.
