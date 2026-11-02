# Orbit

Launcher alternativo para Roblox con interfaz propia. Usa Bloxstrap por debajo, así que tus mods y ajustes de Bloxstrap siguen funcionando.

## Instalar
Descarga `Orbit-Setup-x.x.x.exe` de la sección **Releases** del repo e instálalo. Desde ahí Orbit se actualiza solo.

Para correrlo desde el código: instala Node.js (https://nodejs.org) y da doble clic en `iniciar.bat`.

## Qué tiene
- **Inicio:** tu avatar en grande, juego destacado con botón JUGAR, "Continuar jugando", favoritos y tendencias.
- **Descubrir:** juegos populares de Roblox y buscador (acepta links de roblox.com).
- **Biblioteca:** favoritos de Orbit, los de tu cuenta de Roblox y lo que has jugado.
- **Servidores:** lista de servidores públicos con región (ciudad y país), jugadores y ping; filtra por país y únete al que quieras.
- **Mods:** sonido de muerte, cursor y cursor de shift lock, con vista previa. También puedes subir tus propios archivos.
- **Stats:** tiempo jugado hoy, en la semana y por juego (sale de los registros de Bloxstrap).
- **Perfil:** avatar, Robux, amigos, seguidores, favoritos e insignias recientes.
- **Insignias por juego:** en el detalle de cada juego ves cuáles tienes y cuáles te faltan.
- **Amigos:** quién está conectado y a qué juega, con botón para unirte.
- **Ajustes:** color de acento, ajustes de Bloxstrap y actualizaciones.

## Publicar una versión nueva
1. Cambia `"version"` en `package.json` (por ejemplo a `0.3.0`).
2. Haz commit de ese cambio.
3. En GitHub ve a **Actions → Publicar versión → Run workflow**.
4. GitHub compila el instalador y lo publica en Releases (tarda unos 5 minutos). Todas las copias instaladas de Orbit se actualizan solas.

## Archivos
- `main.js`: la parte de "backend" (APIs de Roblox, login, servidores, mods, actualizaciones).
- `src/`: la interfaz (HTML, CSS y JS). Aquí cambias el diseño.
- `src/mods/`: sonidos y cursores de la galería. Todos son originales de Orbit.
- `src/mock.js`: datos de prueba para ver la interfaz abriendo `src/index.html` en el navegador.
- `.github/workflows/release.yml`: compila y publica el instalador cuando subes un tag.

## Seguridad
El login se hace en la página oficial de Roblox y la sesión se guarda solo en tu PC. Orbit nunca muestra ni envía tu cookie a ningún lado. Nunca le pases tu cookie `.ROBLOSECURITY` a nadie.
