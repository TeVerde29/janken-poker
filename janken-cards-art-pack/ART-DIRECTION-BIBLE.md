# JANKEN CARDS — Biblia de Dirección de Arte e Ingeniería Visual
**Estudio:** Antigravity Indie Game Art Direction  
**Estado:** Guardado en bóveda independiente (`janken-cards-art-pack/`). **No inyectado en el sistema en producción.**

---

## 1. Filosofía del Sistema Visual ("Nocturne Tactile Luxury")

La identidad artística de **JANKEN CARDS** rechaza los clichés del videojuego web casual (exceso de neón, degradados arcoíris, emojis o paneles tipo SaaS administrativo) y adopta el lenguaje de **objetos de colección físicos iluminados en estudio**, guiado por las **Apple Human Interface Guidelines (Fluid Interfaces)** y el diseño editorial minimalista.

### 1.1 Paleta Oficial y Comportamiento de Materiales

| Token CSS | Nombre Artístico | Hex | Rol Material y Psicológico |
| :--- | :--- | :--- | :--- |
| `--jc-midnight-900` | **Azul Noche Abisal** | `#0B101B` | Atmósfera envolvente, silencio visual y tapete de pizarra nocturna. |
| `--jc-charcoal-900` | **Carbón Mineral** | `#161B26` | Cuerpo físico de las cartas, chasis táctil de baja reflectancia. |
| `--jc-gold-500` | **Oro Suave Bruñido** | `#C8A96A` | Filigranas incrustadas, cantos dorados, foco de selección y victoria. |
| `--jc-ivory-100` | **Marfil Algodón** | `#F7F4ED` | Papel escultórico plisado, puntos de luz especular y tipografía editorial. |
| `--jc-steel-500` | **Gris Acero Forjado** | `#7A8494` | Hojas metálicas de tijera, sellos de bloqueo y equilibrio de empate. |

### 1.2 Reglas de Colección para las 3 Cartas Principales
Para que **Piedra**, **Papel** y **Tijera** se sientan parte de una misma baraja comercial de edición coleccionista:
1. **Proporción Constante:** Relación de aspecto `3:4` (`600×800px` en SVG vectorial y formato vertical unificado en renders 3D).
2. **Sistema de Bordes Doble Bisel:** Marco exterior con radio de `36px` (escala 600×800), filete interior de oro bruñido a `22px` del canto y micro-bisel de acero a `14px`.
3. **Esquema de Iluminación de Estudio Único:**
   - **Key Light (Luz Principal):** Cenital-izquierda (`30% X, 25% Y`) cálida en tono marfil-oro (`#EFE0BB`).
   - **Rim Light (Luz de Recorte):** Inferior-derecha fría en tono acero (`#949FB1`) para separar el volumen 3D del fondo carbón.
4. **Índices Geométricos Puros (Sin Texto Inventado):** Cada esquina porta un glifo geométrico abstracto (hexágono mineral para Piedra, rombo plisado para Papel, eje cruzado para Tijera).

---

## 2. Catálogo Completo de los 15 Recursos Gráficos

Cada recurso ha sido diseñado por separado y guardado en formatos listos para producción web (**SVG vectorial con transparencia** en `svg-vectors/` y **Renders 3D de alta resolución** en `renders-3d/`).

### Recurso 1 — Logo Original de JANKEN CARDS
- **Archivos:** `svg-vectors/01-logo-janken-cards.svg` | `renders-3d/01-logo-emblem.png`
- **Pantalla de destino:** Pantalla de título (Splash / Menú principal), cabecera de selección de sala y marca de agua institucional.
- **Formato recomendado:** `SVG` para escalado infinito en UI y `PNG/WebP` para el emblema 3D iluminado en el Hero del menú.
- **Cómo debe animarse:** Entrada ceremonial con rotación lenta del anillo exterior punteado (`24s linear infinite`) y pulso sutil en el fulcro dorado central al pasar el cursor.
- **Integración Web (CSS / SVG):** Incrustar el `<svg>` inline para animar independientemente los grupos `#triad-stone`, `#triad-paper` y `#triad-scissors` mediante `transform-origin: center` y `stroke-dashoffset`.

### Recurso 2 — Diseño del Reverso de las Cartas
- **Archivos:** `svg-vectors/02-card-back.svg` | `renders-3d/02-card-back.png`
- **Pantalla de destino:** Mazo central, mano oculta del oponente en tiempo real y cara trasera antes de la revelación simultánea.
- **Formato recomendado:** `SVG` optimizado o `WebP` sin pérdida a `1200×1600px`.
- **Cómo debe animarse:** Durante la espera de revelación, los tres anillos entrelazados del centro reciben un barrido de brillo especular (`linear-gradient` en máscara) que reacciona a la inclinación 3D de la carta.
- **Integración Web (CSS 3D):** Colocar dentro de `.jc-card-face-back` con `backface-visibility: hidden` sincronizado con `.jc-card-face-front` rotado `180deg` en el eje Y.

### Recurso 3 — Carta de Piedra (Monolito de Basalto y Kintsugi)
- **Archivos:** `svg-vectors/03-card-piedra.svg` | `renders-3d/03-card-piedra.png`
- **Pantalla de destino:** Selección de mazo, mano activa del jugador y duelo central de revelación.
- **Formato recomendado:** `SVG` + `PNG/WebP` de alta resolución.
- **Cómo debe animarse:** Movimiento con sensación de **masa mineral pesada** (`--jc-spring-heavy-stone`, `damping: 1.0, response: 0.55s`). Al revelarse o ganar, las vetas doradas tipo Kintsugi emiten un destello cálido.
- **Integración Web (CSS / WebGL):** Usar el SVG para capas interactivas nítidas o cargar el render 3D como textura base con un normal map sutil en Three.js / CSS `filter: drop-shadow()`.

### Recurso 4 — Carta de Papel (Artefacto Escultórico en Marfil Plisado)
- **Archivos:** `svg-vectors/04-card-papel.svg` | `renders-3d/04-card-papel.png`
- **Pantalla de destino:** Selección de mazo, mano activa del jugador y duelo central de revelación.
- **Formato recomendado:** `SVG` + `PNG/WebP` de alta resolución.
- **Cómo debe animarse:** Movimiento **aerodinámico y tenso** (`damping: 0.92, response: 0.38s`). Al elevarse, las facetas de papel marfil cambian sutilmente su contraste simulando *subsurface scattering* (dispersión de luz cálida).
- **Integración Web (CSS / SVG):** Aprovechar los polígonos independientes del SVG para aplicar una micro-escala diferencial al hacer hover, dando sensación de pliegue vivo.

### Recurso 5 — Carta de Tijera (Hojas de Acero de Damasco y Pivote de Oro)
- **Archivos:** `svg-vectors/05-card-tijera.svg` | `renders-3d/05-card-tijera.png`
- **Pantalla de destino:** Selección de mazo, mano activa del jugador y duelo central de revelación.
- **Formato recomendado:** `SVG` + `PNG/WebP` de alta resolución.
- **Cómo debe animarse:** Movimiento **ágil y quirúrgico** (`damping: 0.85, response: 0.32s`). Al seleccionarse o atacar, las dos hojas rotan `±4deg` sobre el eje mecánico dorado central con un destello especular frío a lo largo del filo.
- **Integración Web (CSS / SVG):** En el archivo SVG, los dos grupos de hojas están centrados en el fulcro `(0, -12)`, permitiendo rotarlos con CSS `transform: rotate()` sin deformar la perspectiva.

### Recurso 6 — Mazo de Cartas Apiladas en Perspectiva 3D
- **Archivos:** `svg-vectors/06-deck-3d-stack.svg` | `renders-3d/06-deck-3d-stack.png`
- **Pantalla de destino:** Pantalla de selección de mazo, rincón de reserva en la mesa de juego y sala de espera multijugador.
- **Formato recomendado:** `SVG` con sombras proyectadas o `PNG` transparente.
- **Cómo debe animarse:** Al robar carta o barajar, las capas superiores se deslizan secuencialmente en el eje Z/Y con un retardo escalonado (`stagger: 40ms`).
- **Integración Web (CSS / DOM):** Cada estrato del SVG puede animarse con `translateY()` para reflejar visualmente cuántas cartas quedan en la partida.

### Recurso 7 — Efecto Visual de Carta Seleccionada
- **Archivo:** `svg-vectors/07-fx-card-selected.svg`
- **Pantalla de destino:** Mano del jugador durante la fase de decisión táctica y selección de mazo.
- **Formato recomendado:** `SVG` transparente superpuesto (`pointer-events: none`).
- **Cómo debe animarse:** Los 4 brackets esquinados se contraen desde `scale(1.08)` hasta abrazar el borde de la carta con un muelle de amortiguación crítica (`damping: 1.0, response: 0.35s`), mientras los nodos cardinales de marfil respiran suavemente.
- **Integración Web (CSS):** Superponer como `position: absolute; inset: -12px;` sobre `.jc-card-actor.is-selected` junto con `mix-blend-mode: screen`.

### Recurso 8 — Efecto de Carta Bloqueada
- **Archivos:** `svg-vectors/08-fx-card-locked.svg` | `renders-3d/08-fx-card-locked.png`
- **Pantalla de destino:** Cartas ya jugadas en rondas previas, cartas deshabilitadas por reglas de mazo o mano congelada tras confirmar jugada.
- **Formato recomendado:** `SVG` transparente (overlay directo) y `PNG` 3D de referencia.
- **Cómo debe animarse:** Cierre mecánico seco de las bandas diagonales de acero y asentamiento del sello hexagonal central con una breve vibración amortiguada (`translateX(±2px)` en `120ms`).
- **Integración Web (CSS):** Aplicar sobre la carta bloqueada combinando el overlay SVG con `filter: saturate(0.35) brightness(0.75)` en la carta subyacente.

### Recurso 9 — Efecto de Revelación de Carta
- **Archivo:** `svg-vectors/09-fx-card-reveal.svg`
- **Pantalla de destino:** Centro de la mesa de duelo en el instante exacto en que ambas cartas alcanzan los `90°` de su giro 3D simultáneo.
- **Formato recomendado:** `SVG` vectorial con gradientes radiales aditivos.
- **Cómo debe animarse:** Explosión silenciosa y elegante: escala de `0.2` a `1.35` en `420ms` (`cubic-bezier(0.16, 1, 0.3, 1)`) mientras la opacidad se disipa de `1` a `0`, dejando paso a la cara revelada de la carta.
- **Integración Web (CSS / WebGL):** Usar con `mix-blend-mode: plus-lighter` o `screen` exactamente en el keyframe `40%` de la animación de volteo.

### Recurso 10 — Efecto de Victoria
- **Archivos:** `svg-vectors/10-fx-victory.svg` | `renders-3d/10-fx-victory-crest.png`
- **Pantalla de destino:** Resolución de ronda ganada y pantalla de triunfo final de la partida.
- **Formato recomendado:** `SVG` + `PNG` 3D de alta resolución.
- **Cómo debe animarse:** La corona solar exterior gira majestuosamente mientras el prisma imperial central emerge con un muelle suave y proyecta rayos geométricos dorados.
- **Integración Web (CSS / Lottie):** Combinar con `13-fx-gold-particles.svg` en una capa superior para envolver la carta ganadora en polvo de oro ascendente.

### Recurso 11 — Efecto de Empate
- **Archivo:** `svg-vectors/11-fx-draw.svg`
- **Pantalla de destino:** Resolución de ronda cuando ambos jugadores revelan el mismo elemento.
- **Formato recomendado:** `SVG` vectorial transparente.
- **Cómo debe animarse:** Los dos anillos (Acero a la izquierda, Oro a la derecha) convergen hacia el centro formando una *Vesica Piscis* en equilibrio estático y emiten una onda simétrica horizontal.
- **Integración Web (CSS):** Sincronizar con las clases `.jc-anim-f-left` y `.jc-anim-f-right` para que el destello central nazca justo en el instante del contacto entre ambas cartas.

### Recurso 12 — Efecto de Derrota
- **Archivo:** `svg-vectors/12-fx-defeat.svg`
- **Pantalla de destino:** Sobre la carta vencida en el duelo o como viñeta de fin de partida al perder.
- **Formato recomendado:** `SVG` vectorial transparente.
- **Cómo debe animarse:** Aparición súbita de la línea de fractura mineral (`stroke-dashoffset` de `600` a `0` en `260ms`) acompañada de un oscurecimiento abisal y ligero desprendimiento de las esquirlas centrales.
- **Integración Web (CSS):** Superponer sobre la carta perdedora aplicando a la carta un descenso de elevación (`translateZ(-20px) rotateZ(-3deg)`) y atenuación de brillo.

### Recurso 13 — Partículas Doradas Sutiles
- **Archivos:** `svg-vectors/13-fx-gold-particles.svg` | `renders-3d/13-fx-gold-particles.png`
- **Pantalla de destino:** Menú principal, celebración de victoria y atmósfera ambiental de la mesa de juego.
- **Formato recomendado:** `SVG` multicapa o `PNG/WebP` con `mix-blend-mode: screen`.
- **Cómo debe animarse:** Deriva vertical lenta con paralaje en 3 velocidades distintas (partículas desenfocadas en primer plano moviéndose más rápido que las hojuelas nítidas del fondo).
- **Integración Web (CSS / Canvas 2D):** Animar mediante `transform: translate3d()` en bucle continuo o usar las hojuelas como sprite en un emisor ligero de `requestAnimationFrame`.

### Recurso 14 — Fondo de Mesa de Juego Premium
- **Archivos:** `svg-vectors/14-bg-game-table.svg` | `renders-3d/14-bg-game-table.png`
- **Pantalla de destino:** Tablero principal de partida multijugador (`16:9` panorámico adaptable).
- **Formato recomendado:** `WebP/PNG` para la textura rica de pizarra y cuero oscuro + `SVG` superpuesto para que las líneas de latón incrustado mantengan nitidez retina en cualquier monitor 4K o móvil.
- **Cómo debe animarse:** Las líneas de latón del círculo central de duelo aumentan su opacidad (`0.4` -> `0.95`) cuando ambos jugadores han colocado su carta en la arena y están listos para revelar.
- **Integración Web (CSS Grid / SVG):** Usar `14-bg-game-table.png` como `background-image: cover` y superponer `14-bg-game-table.svg` alineado con las zonas de drop de las cartas.

### Recurso 15 — Elementos Visuales para la Pantalla de Espera
- **Archivos:** `svg-vectors/15-waiting-room-elements.svg` | `renders-3d/15-waiting-room-totem.png`
- **Pantalla de destino:** Lobby de sala privada (mientras el anfitrión comparte el código de sala y espera al segundo jugador).
- **Formato recomendado:** `SVG` interactivo por capas + `PNG` 3D ambiental.
- **Cómo debe animarse:** El anillo exterior de acero rota en sentido horario (`24s`), el anillo medio de oro rota en sentido antihorario (`16s`), y en el núcleo la carta sólida (Jugador 1) orbita suavemente junto a la silueta punteada (Jugador 2 esperado). Cuando el Jugador 2 entra, la silueta punteada se vuelve sólida en oro con un destello.
- **Integración Web (CSS / SVG):** Los grupos internos `#wait-ring-outer`, `#wait-ring-middle` y `#wait-core-cards` ya vienen identificados por ID para animarlos directamente desde CSS.

---

## 3. Especificación Técnica de las 7 Secuencias de Animación (A–G)

Todas las secuencias están implementadas y listas para usar en `animations/janken-cinematic-animations.css` y `animations/janken-spring-physics.js`, y pueden previsualizarse en vivo abriendo `showcase.html`.

| Secuencia | Nombre | Duración / Bucle | Cámara | Física e Integración Técnica |
| :--- | :--- | :--- | :--- | :--- |
| **Animación A** | **Menú Principal** | `6.0s` (Bucle infinito sin saltos) | Fija con perspectiva `1200px` | 3 cartas flotando con desfase de fase (`0s`, `-2s`, `-4s`), rotación orbital suave en 3 ejes (`rotateX`, `rotateY`, `rotateZ`) y sombras dinámicas que se expanden al elevarse. |
| **Animación B** | **Barajado Físico** | `3.2s` (Por ciclo de mezcla) | Fija cenital en ángulo `3/4` | Separación en dos mitades (`.jc-anim-b-deck-left` y `.jc-anim-b-deck-right`), arqueo espacial en Z (`translateZ(60px)`) e imbricación con muelle sub-amortiguado (`--jc-spring-underdamped`). |
| **Animación C** | **Selección Táctil** | Respuesta `0ms` / Asentamiento `420ms` | Seguimiento 1:1 al puntero | Basada en `attachTactileCardPhysics()`: la carta se inclina hacia el dedo/cursor en tiempo real mientras un reflejo especular dorado (`::after`) cruza la superficie a `115deg`. |
| **Animación D** | **Revelación Simultánea** | `750ms` (Acción) / `4.2s` (Loop demo) | Fija frontal | Dos cartas enfrentadas se elevan en Z (`+70px`), giran `180°` en `rotateY` de forma simultánea y disparan el destello `09-fx-card-reveal.svg` exactamente al cruzar el perfil de `90°`. |
| **Animación E** | **Victoria** | `4.5s` (Loop ceremonial) | Fija con foco en ganador | Elevación imperial de la carta ganadora, despliegue del emblema `10-fx-victory.svg` detrás y emisión continua de partículas `13-fx-gold-particles.svg` en modo aditivo. |
| **Animación F** | **Empate** | `3.4s` (Choque y equilibrio) | Fija simétrica | Ambas cartas se desplazan hacia el eje central (`±12px`), colisionan elásticamente, retroceden a una distancia armónica (`±20px`) y activan la resonancia `11-fx-draw.svg`. |
| **Animación G** | **Espera en Sala** | `5.0s` (Respiración) / `24s` (Órbita) | Fija ambiental | Movimiento pendular hipnótico de bajo consumo de GPU (`transform` + `opacity` exclusivamente) sobre el mazo y el astrolabio `15-waiting-room-elements.svg`. |
