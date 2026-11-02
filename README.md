# JANKEN — The Card Duel

Juego 1v1 online para navegador que fusiona **piedra, papel o tijera** con gestión de cartas y estética de juego de mesa táctil. Dos jugadores se enfrentan en duelos directos **P2P (WebRTC vía PeerJS)**: sin backend propio, sin base de datos y sin cuentas.

## Cómo se juega

- El anfitrión elige el mazo: **Duelo Rápido** (18 cartas · 3 rondas), **Partida Estándar** (30 cartas · 5 rondas) o **Gran Torneo** (54 cartas · 9 rondas). Tercios exactos de piedra, papel y tijera, barajado una sola vez; las cartas jugadas no vuelven al mazo.
- Cada ronda se reparten **3 cartas por jugador**. Ambos eligen una carta en secreto y se revelan simultáneamente.
- Si alguien gana el intento, suma 1 punto y termina la ronda. Si empatan, juegan otra carta de su mano (hasta 3 intentos). Tres empates consecutivos = **ronda nula**.
- Empate a puntos al final → **ronda de desempate** con mano fija `[piedra, papel, tijera]`. Si vuelve a ser nula, se repite hasta que haya ganador.

## Probar en local

Dado que utiliza módulos ES6 y Web Audio API, sírvelo con un servidor HTTP local:

```bash
npx serve .
# o bien
python -m http.server 8080
```

Abre la URL en dos ventanas o dispositivos: en una pulsa **Crear una mesa**, copia el código y en la otra **Unirse con código**.

## Desplegar en GitHub Pages / Vercel

1. **GitHub Pages**: En *Settings → Pages*, selecciona la rama `main` y guarda.
2. **Vercel**: Importa el repositorio con preset *Other* sin comando de build ni output directory.

## Arquitectura y Archivos

```
index.html
css/
  base.css          (Sistema de diseño: Obsidian, Forest, Ivory, Brass)
  screens.css       (Lobby editorial, modos de mazo, antesala face-off, victoria)
  game.css          (Mesa de duelo, HUD broadcast, cartas táctiles, arena)
  animations.css    (Curvas Apple/Spring, volteo 3D, choque, confeti)
js/
  main.js           (Arranque, router y orquestación de eventos)
  net.js            (PeerJS WebRTC P2P)
  state.js          (Estado global)
  deck.js           (Generación Fisher-Yates y reparto)
  rules.js          (Reglas puras y motor autoritativo)
  ui.js             (Renderizado y componentes)
  animations.js     (Control asíncrono de animaciones)
  audio.js          (Síntesis de audio con Web Audio API: chasquido, choque, victoria)
assets/icons/       (Piedra, papel, tijera y dorso JC)
```
