# Orbit

Launcher alternativo para Roblox con interfaz propia. Usa Bloxstrap por debajo, así que tus mods y ajustes de Bloxstrap siguen funcionando.

## Cómo abrirlo
1. Necesitas Node.js (https://nodejs.org, versión LTS).
2. Doble clic en `iniciar.bat`. La primera vez instala lo necesario (un par de minutos).

## Qué tiene
- **Inicio:** juego destacado con botón JUGAR, "Continuar jugando", favoritos y tendencias.
- **Descubrir:** juegos populares de Roblox y buscador (también acepta links de roblox.com).
- **Biblioteca:** tus favoritos de Orbit, los de tu cuenta de Roblox y lo que has jugado.
- **Stats:** tiempo jugado hoy, en la semana y por juego (sale de los registros de Bloxstrap).
- **Perfil:** avatar, Robux, amigos y seguidores.
- **Amigos:** quién está conectado y a qué juega, con botón para unirte.
- **Ajustes:** color de acento y los ajustes principales de Bloxstrap.

## Archivos
- `main.js`: la parte de "backend" (APIs de Roblox, login, logs, Bloxstrap).
- `src/`: la interfaz (HTML, CSS y JS). Aquí cambias el diseño.
- `src/mock.js`: datos de prueba para ver la interfaz abriendo `src/index.html` en el navegador.

## Hacer un .exe
`npm run build` genera un ejecutable portable en `dist/`.

## Seguridad
El login se hace en la página oficial de Roblox y la sesión se guarda solo en tu PC. Orbit nunca muestra ni envía tu cookie a ningún lado. Nunca le pases tu cookie `.ROBLOSECURITY` a nadie.
