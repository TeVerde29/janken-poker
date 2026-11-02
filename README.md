# Janken Cards

Juego 1v1 online para navegador que mezcla **piedra, papel o tijera** con gestión de cartas. Dos jugadores se conectan con un código de sala y juegan **P2P (WebRTC vía PeerJS)**: sin backend propio, sin base de datos y sin cuentas.

## Cómo se juega

- El anfitrión elige mazo de **18, 30 o 54 cartas** (3, 5 o 9 rondas). Tercios exactos de piedra, papel y tijera, barajado una sola vez; las cartas jugadas no vuelven al mazo.
- Cada ronda se reparten **3 cartas por jugador**. Ambos eligen en secreto y se revelan a la vez.
- Si alguien gana el intento, suma 1 punto y termina la ronda. Si empatan, juegan otra carta de su mano (hasta 3 intentos). Tres empates seguidos = **ronda nula**.
- Empate a puntos al final → **ronda de desempate** con mano fija `[piedra, papel, tijera]`. Si vuelve a ser nula, se repite hasta que haya ganador.

## Probar en local

Los scripts son módulos ES, así que hay que servir la carpeta con un servidor (abrir `index.html` con doble clic no funciona):

```bash
npx serve .
# o bien
python -m http.server 8080
```

Abre la URL en dos pestañas o en dos dispositivos: en una **Crear sala**, copia el código y en la otra **Unirse a sala**. Hace falta Internet: PeerJS se carga desde unpkg y usa su servidor de señalización gratuito (`0.peerjs.com`).

## Desplegar en Vercel (plan Hobby)

No hay paso de compilación.

1. Sube el repositorio a GitHub.
2. En Vercel: **Add New → Project**, importa el repo.
3. Framework Preset: **Other**. Deja vacíos *Build Command* y *Output Directory* (la raíz).
4. **Deploy**. Cada `push` vuelve a desplegar.

Alternativa sin Git: `npx vercel` desde la carpeta, o arrastrar la carpeta en el panel de Vercel. También funciona tal cual en GitHub Pages.

## Estructura

```
index.html
css/   base.css · screens.css · game.css · animations.css
js/    main.js (arranque y controlador) · net.js (PeerJS) · state.js (estado)
       deck.js (mazo) · rules.js (reglas + motor del host) · ui.js · animations.js
assets/icons/  piedra.svg · papel.svg · tijera.svg · jc.svg (dorso)
```

El **host es la autoridad**: baraja, reparte, valida las jugadas y calcula resultados. El guest solo recibe su mano y envía su carta.

## Redes restrictivas (TURN)

Si dos jugadores no logran conectar (NAT simétrico, redes corporativas), añade un servidor TURN en `EXTRA_ICE_SERVERS` dentro de [js/net.js](js/net.js), por ejemplo con el plan gratuito de Metered.ca.
