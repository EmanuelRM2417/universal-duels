# Universal Duels Alpha 0.4 — reglas matemáticas definitivas

## Estadísticas básicas

Ataque, Defensa, Ataque Especial, Defensa Especial y Velocidad: niveles netos de −10 a +10, sumativos, sin componer porcentajes. Se suman los niveles provenientes del personaje, estados y entornos; después se limita el total al rango permitido.

- `n >= 0`: `estadística_actual = redondear(base × (1 + n × 0,10))`.
- `n < 0`: `estadística_actual = redondear(base × (1 + n × 0,05))`.
- Ejemplo base 100: +1 → 110, +4 → 140, −1 → 95, −4 → 80.
- Los PS máximos no admiten niveles.

## Precisión, evasión y probabilidad de crítico

Los niveles de estas tres características también se suman y limitan de −10 a +10, pero cambian en un **5 % relativo a la probabilidad base**, no en cinco puntos porcentuales absolutos.

- `base > 0`: `probabilidad = limitar(base × (1 + niveles × 0,05), 0, 100)`.
- Ejemplo: un movimiento de precisión 80 % implica evasión base 20 %; evasión +4 produce `20 × 1,20 = 24 %`, por lo que, sin otros cambios de precisión, la probabilidad de acierto será **76 %**.
- Caso especial **base = 0 %**, niveles positivos: usar semilla 5 % con incremento del 20 % relativo a esa semilla por nivel: `5 × (1 + niveles × 0,20)`. Así, +1 → **6 %**, +2 → 7 %, +4 → 9 %. Los niveles nulos/negativos preservan el 0 %.
- La misma excepción se aplica a crítico y evasión con base cero.
- Los modificadores de precisión y evasión de un ataque son **factores separados multiplicados entre sí**, no puntos sumados: `acierto_final = precisión_ajustada × (100 − evasión_ajustada) / precisión_base`, usando como evasión base `(100 − precisión_base)`.
- Un ataque configurado con precisión **0 % es infalible**: ignora completamente los niveles de precisión, de evasión y otras alteraciones del acierto. No se debe tratar como 0 % de acierto ni añadirle azar.
- En un crítico acertado sigue aplicándose el +50 % aditivo al daño final, conforme a las reglas de combate.

Los efectos `Al usar` se activan aunque un movimiento falle; los eventos `Al acertar` solo tras acertar. Se mantiene esa semántica deliberadamente y se comprueba en las pruebas del editor.

## Fuente de verdad y pruebas

`stat-math.js` implementa esta matemática para el motor y la IA Avanzada; existe una copia idéntica en juego público y editor privado. El laboratorio local antiguo del editor se actualizó a las mismas reglas.

`alpha04-stat-math.test.mjs` comprueba ejemplos exactos, críticos con base cero, movimientos infalibles, multiplicación de precisión/evasión, variaciones de estadísticas, campos continuos, Singles y Doubles, además de reproducibilidad. Las dos suites `npm test` incluyen ese archivo.

## Cierre de eventos multigolpe y del daño final (revisión posterior)

- Las habilidades `on_hit` y `on_damage_taken`, así como la resolución de KO y `on_death`, se evalúan por **cada impacto** del multigolpe. `multihit.effects = "chain"` aplaza únicamente el efecto `on_hit` propio del movimiento hasta el final de la cadena, no las habilidades.
- El modificador configurable `damage_multiplier` mantiene 100 como valor neutro, pero su contribución se **suma** a los demás porcentajes finales: 150 aporta +50 puntos porcentuales y 50 aporta −50. STAB +20%, crítico +50%, ventajas de tipo y estos efectos no se componen multiplicativamente.
- La evasión inicial depende de la precisión de **cada movimiento**: 90%→10%, 80%→20%, 70%→30%, y así sucesivamente. Precisión configurada en 0% sigue indicando movimiento infalible.
